"""Download official models for the academic project (InsightFace research weights)."""
from pathlib import Path
from urllib.request import urlretrieve
from zipfile import ZipFile
import shutil

MODEL_DIR = Path(__file__).resolve().parent / "models"


def setup_models():
    MODEL_DIR.mkdir(exist_ok=True)
    detector = MODEL_DIR / "det_10g.onnx"
    recognition = MODEL_DIR / "w600k_r50.onnx"
    if not recognition.exists() or not detector.exists():
        archive = MODEL_DIR / "buffalo_l.zip"
        urlretrieve("https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip", archive)
        with ZipFile(archive) as bundle:
            for model in (detector, recognition):
                name = next(name for name in bundle.namelist() if Path(name).name == model.name)
                temporary = model.with_suffix(".download")
                with bundle.open(name) as source, temporary.open("wb") as destination:
                    shutil.copyfileobj(source, destination)
                temporary.replace(model)
        archive.unlink()
    print("SCRFD and ArcFace installed. Enroll real student selfies before classroom capture.")


if __name__ == "__main__":
    setup_models()
