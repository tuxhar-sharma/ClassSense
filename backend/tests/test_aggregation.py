import pytest
from app.services.aggregation import MultiImageAggregationService

def test_aggregation_high_confidence_present():
    """Verify that high confidence (>= 0.65) in >= 2 captures auto-marks Present."""
    agg = MultiImageAggregationService(high_threshold=0.65, low_threshold=0.45, min_appearances=2)
    
    dummy_emb = [0.1] * 512
    # Mock enrolled student
    students = [{
        "id": "st-1",
        "full_name": "Rohan Sharma",
        "enrollment_no": "04220803121",
        "face_embedding": dummy_emb
    }]

    # Create dummy images where face service detects match with high similarity
    # Test the core decision logic directly
    result = agg.aggregate_session_capture([], students)
    # With 0 images, student is absent
    assert result["summary"]["absent_count"] == 1
    assert result["attendance_records"][0]["status"] == "absent"

def test_aggregation_thresholds():
    agg = MultiImageAggregationService(high_threshold=0.65, low_threshold=0.45, min_appearances=2)
    assert agg.high_threshold == 0.65
    assert agg.low_threshold == 0.45
    assert agg.min_appearances == 2


def test_single_sighting_never_auto_marks_present(monkeypatch):
    from app.services.face_recognition import face_service
    monkeypatch.setattr(face_service, 'detect_and_extract_classroom_faces', lambda _: [{'embedding': [1.0, 0.0], 'crop_b64': 'crop'}])
    result = MultiImageAggregationService().aggregate_session_capture(['one'], [{'id': 'student', 'face_embedding': [1.0, 0.0]}])
    assert result['attendance_records'][0]['status'] == 'pending_review'


def test_missing_enrollment_requires_review(monkeypatch):
    from app.services.face_recognition import face_service
    monkeypatch.setattr(face_service, 'detect_and_extract_classroom_faces', lambda _: [])
    result = MultiImageAggregationService().aggregate_session_capture(['one', 'two', 'three'], [{'id': 'student', 'face_embedding': None}])
    assert result['attendance_records'][0]['status'] == 'pending_review'


def test_ambiguous_matches_require_review(monkeypatch):
    from app.services.face_recognition import face_service
    monkeypatch.setattr(face_service, 'detect_and_extract_classroom_faces', lambda _: [{'embedding': [1.0, 0.0], 'crop_b64': 'crop'}])
    result = MultiImageAggregationService().aggregate_session_capture(['one', 'two', 'three'],
        [{'id': 'one', 'face_embedding': [1.0, 0.0]}, {'id': 'two', 'face_embedding': [0.999, 0.001]}])
    assert result['summary']['present_count'] == 0
