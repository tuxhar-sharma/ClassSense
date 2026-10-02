"""SCRFD detection, five-point alignment, and ArcFace ONNX embeddings."""
import base64
import binascii
from pathlib import Path
from threading import Lock
from typing import Any

import cv2
import numpy as np
from app.config import settings


class RecognitionUnavailable(RuntimeError):
    pass


class FaceRecognitionService:
    model_name = "arcface-w600k-r50"
    embedding_dim = 512
    blur_threshold = 30.0

    def __init__(self):
        self._lock = Lock()
        self._detector = None
        self._recognizer = None

    @property
    def ready(self):
        return Path(settings.ARCFACE_MODEL_PATH).is_file() and Path(settings.FACE_DETECTOR_MODEL_PATH).is_file()

    def _load_models(self):
        if self._recognizer is not None:
            return
        if not self.ready:
            raise RecognitionUnavailable("Face models are not installed. Run backend/setup_models.py before face enrollment or classroom capture.")
        try:
            import onnxruntime as ort
            from insightface.model_zoo.scrfd import SCRFD
            recognizer = ort.InferenceSession(settings.ARCFACE_MODEL_PATH, providers=["CPUExecutionProvider"])
            detector_session = ort.InferenceSession(settings.FACE_DETECTOR_MODEL_PATH, providers=["CPUExecutionProvider"])
            detector = SCRFD(model_file=settings.FACE_DETECTOR_MODEL_PATH, session=detector_session)
            detector.prepare(ctx_id=-1, input_size=(640, 640), det_thresh=0.7)
            if recognizer.get_inputs()[0].shape[1:] != [3, 112, 112]:
                raise ValueError("Expected ArcFace input dimensions [batch, 3, 112, 112].")
            self._recognizer = recognizer
            self._detector = detector
        except Exception as error:
            raise RecognitionUnavailable("Unable to load face models. Check model files and ONNX Runtime installation.") from error

    def decode_base64_image(self, value: str):
        if not isinstance(value, str) or len(value) > settings.MAX_IMAGE_BYTES * 4 // 3 + 1024:
            return None
        try:
            if "," in value:
                value = value.split(",", 1)[1]
            data = base64.b64decode(value, validate=True)
            if len(data) > settings.MAX_IMAGE_BYTES:
                return None
            image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
            if image is None or min(image.shape[:2]) < 60 or max(image.shape[:2]) > 10000:
                return None
            return image
        except (ValueError, binascii.Error, cv2.error):
            return None

    def encode_image_to_base64(self, image):
        ok, encoded = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not ok:
            raise ValueError("Unable to encode face thumbnail.")
        return "data:image/jpeg;base64," + base64.b64encode(encoded).decode("ascii")

    def check_quality(self, face_crop):
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        return sharpness >= self.blur_threshold, sharpness

    def _detect(self, image):
        self._load_models()
        height, width = image.shape[:2]
        scale = min(1.0, 1600 / max(height, width))
        resized = cv2.resize(image, (round(width * scale), round(height * scale))) if scale < 1 else image
        boxes, landmarks = self._detector.detect(resized, input_size=(640, 640))
        if len(boxes) == 0:
            return []
        if landmarks is None:
            raise RecognitionUnavailable("Detector model does not provide five-point face landmarks.")
        detections = []
        for box, points in zip(boxes, landmarks):
            x1, y1, x2, y2, score = box
            detections.append(np.concatenate(([x1 / scale, y1 / scale, (x2 - x1) / scale, (y2 - y1) / scale], points.reshape(-1) / scale, [score])))
        return detections

    def _align(self, image, face):
        points = np.asarray(face[4:14], dtype=np.float32).reshape(5, 2)
        target = np.array([[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366],
                           [41.5493, 92.3655], [70.7299, 92.2041]], dtype=np.float32)
        matrix, _ = cv2.estimateAffinePartial2D(points, target, method=cv2.LMEDS)
        if matrix is None:
            raise ValueError("Could not align face landmarks.")
        return cv2.warpAffine(image, matrix, (112, 112), borderValue=0)

    def extract_embedding_from_crop(self, aligned_face):
        self._load_models()
        blob = cv2.dnn.blobFromImage(aligned_face, 1.0 / 127.5, (112, 112), (127.5, 127.5, 127.5), swapRB=True)
        embedding = self._recognizer.run(None, {self._recognizer.get_inputs()[0].name: blob})[0].reshape(-1)
        norm = np.linalg.norm(embedding)
        if len(embedding) != self.embedding_dim or not np.isfinite(embedding).all() or norm <= 0:
            raise RecognitionUnavailable("ArcFace returned an invalid embedding.")
        return (embedding / norm).tolist()

    def process_selfie_enrolment(self, image_input: Any):
        image = self.decode_base64_image(image_input) if isinstance(image_input, str) else image_input
        if image is None:
            return False, None, None, "Invalid image. Use a JPEG or PNG under 10 MB."
        with self._lock:
            faces = self._detect(image)
            if len(faces) != 1:
                return False, None, None, "Upload a clear frontal selfie containing exactly one face."
            face = self._align(image, faces[0])
            if not self.check_quality(face)[0]:
                return False, None, None, "The selfie is too blurry. Retake it in good light."
            return True, self.extract_embedding_from_crop(face), self.encode_image_to_base64(face), "Face enrolled successfully."

    def detect_and_extract_classroom_faces(self, image_input: Any):
        image = self.decode_base64_image(image_input) if isinstance(image_input, str) else image_input
        if image is None:
            raise ValueError("One of the classroom images is invalid or too large.")
        with self._lock:
            results = []
            for detection in self._detect(image):
                face = self._align(image, detection)
                if not self.check_quality(face)[0]:
                    continue
                results.append({"bbox": [int(value) for value in detection[:4]],
                    "embedding": self.extract_embedding_from_crop(face),
                    "crop_b64": self.encode_image_to_base64(face)})
            return results

    def compute_similarity(self, first, second):
        if not first or not second or len(first) != len(second):
            return 0.0
        a, b = np.asarray(first, dtype=np.float32), np.asarray(second, dtype=np.float32)
        norm = np.linalg.norm(a) * np.linalg.norm(b)
        if norm == 0 or not np.isfinite(norm):
            return 0.0
        return float(np.clip(np.dot(a, b) / norm, -1.0, 1.0))


face_service = FaceRecognitionService()
