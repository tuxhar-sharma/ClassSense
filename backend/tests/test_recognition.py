from pathlib import Path
import cv2
import numpy as np
import pytest

from app.services.face_recognition import face_service
from app.services.aggregation import MultiImageAggregationService


@pytest.fixture(scope='module')
def sample():
    insightface = pytest.importorskip('insightface')
    path = Path(insightface.__file__).parent / 'data' / 'images' / 't1.jpg'
    if not face_service.ready or not path.exists():
        pytest.skip('Download the face models and install the InsightFace sample images to run real-model checks.')
    return cv2.imread(str(path))


def test_real_model_detects_distinct_faces(sample):
    faces = face_service.detect_and_extract_classroom_faces(sample)
    assert len(faces) >= 2
    assert all(len(face['embedding']) == 512 for face in faces)
    assert face_service.compute_similarity(faces[0]['embedding'], faces[0]['embedding']) > 0.99
    assert face_service.compute_similarity(faces[0]['embedding'], faces[1]['embedding']) < 0.65


def test_blank_selfie_is_rejected(sample):
    success, embedding, _, _ = face_service.process_selfie_enrolment(np.zeros_like(sample))
    assert success is False and embedding is None


def test_group_selfie_is_rejected(sample):
    success, embedding, _, _ = face_service.process_selfie_enrolment(sample)
    assert success is False and embedding is None


def test_real_single_person_selfie_enrolls_and_matches_classroom(sample):
    face = face_service.detect_and_extract_classroom_faces(sample)[0]
    x, y, width, height = face['bbox']
    padding = int(max(width, height) * 0.25)
    selfie = sample[max(0, y-padding):y+height+padding, max(0, x-padding):x+width+padding]
    success, embedding, photo, message = face_service.process_selfie_enrolment(selfie)
    assert success, message
    assert len(embedding) == 512 and photo
    assert face_service.compute_similarity(embedding, face['embedding']) >= 0.65


def test_real_multiframe_pipeline_recognizes_enrolled_faces(sample):
    faces = face_service.detect_and_extract_classroom_faces(sample)
    students = [{'id': str(index), 'face_embedding': face['embedding']} for index, face in enumerate(faces)]
    height, width = sample.shape[:2]
    images = []
    for angle in (-1, 0, 1):
        matrix = cv2.getRotationMatrix2D((width / 2, height / 2), angle, 1)
        frame = cv2.warpAffine(sample, matrix, (width, height))
        images.append(face_service.encode_image_to_base64(frame))
    result = MultiImageAggregationService().aggregate_session_capture(images, students)
    assert result['summary']['present_count'] >= 2
    assert all(record['appearances'] >= 2 for record in result['attendance_records'] if record['status'] == 'present')
