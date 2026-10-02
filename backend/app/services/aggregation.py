from typing import List, Dict, Any, Optional
from app.services.face_recognition import face_service
from app.config import settings

class MultiImageAggregationService:
    def __init__(
        self,
        high_threshold: float = settings.HIGH_CONFIDENCE_THRESHOLD,
        low_threshold: float = settings.LOW_CONFIDENCE_THRESHOLD,
        min_appearances: int = settings.MIN_IMAGE_APPEARANCES
    ):
        self.high_threshold = high_threshold
        self.low_threshold = low_threshold
        self.min_appearances = min_appearances

    def aggregate_session_capture(
        self,
        images_base64: List[str],
        enrolled_students: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Processes 3-4 classroom images, extracts facial embeddings per frame,
        and applies multi-image aggregation decision logic against enrolled students.

        Returns:
            {
                "attendance_records": [...],
                "verification_queue_items": [...],
                "summary": {
                    "total_enrolled": int,
                    "present_count": int,
                    "absent_count": int,
                    "pending_review_count": int,
                    "images_processed": int
                }
            }
        """
        num_images = len(images_base64)
        effective_min_appearances = self.min_appearances

        # Step 1: Detect faces and calculate similarities per image
        student_matches: Dict[str, List[Dict[str, Any]]] = {
            student["id"]: [] for student in enrolled_students
        }

        # Process each classroom image in-memory
        for img_idx, img_b64 in enumerate(images_base64):
            detected_faces = face_service.detect_and_extract_classroom_faces(img_b64)
            frame_matches = {}
            
            for face in detected_faces:
                face_emb = face["embedding"]
                crop_b64 = face["crop_b64"]
                
                # Compare detected face against all enrolled students
                best_match_id: Optional[str] = None
                best_sim = 0.0
                runner_up_sim = 0.0
                
                for student in enrolled_students:
                    stored_emb = student.get("face_embedding")
                    if not stored_emb:
                        continue
                    sim = face_service.compute_similarity(face_emb, stored_emb)
                    if sim > best_sim:
                        runner_up_sim = best_sim
                        best_sim = sim
                        best_match_id = student["id"]
                    elif sim > runner_up_sim:
                        runner_up_sim = sim
                
                # If best match meets minimum relevance threshold, record sighting
                if best_match_id and best_sim >= self.low_threshold:
                    match = {
                        "image_index": img_idx,
                        "similarity": best_sim,
                        "ambiguous": best_sim - runner_up_sim < 0.08,
                        "crop_b64": crop_b64
                    }
                    # One student can contribute only one sighting per frame.
                    if best_match_id not in frame_matches or best_sim > frame_matches[best_match_id]["similarity"]:
                        frame_matches[best_match_id] = match
            for student_id, match in frame_matches.items():
                student_matches[student_id].append(match)

        # Step 2: Multi-Image Aggregation Decision per enrolled student
        attendance_records = []
        verification_queue_items = []
        present_count = 0
        absent_count = 0
        review_count = 0

        for student in enrolled_students:
            s_id = student["id"]
            matches = student_matches.get(s_id, [])
            
            # Count unique images where student was detected
            unique_images = {m["image_index"] for m in matches}
            appearances = len(unique_images)
            high_appearances = len({m["image_index"] for m in matches if m["similarity"] >= self.high_threshold and not m["ambiguous"]})
            
            if matches:
                max_sim = max(m["similarity"] for m in matches)
                best_match = max(matches, key=lambda m: m["similarity"])
                best_crop = best_match["crop_b64"]
            else:
                max_sim = 0.0
                best_crop = None

            # Decision Logic per MoSCoW Specification
            if max_sim >= self.high_threshold and high_appearances >= effective_min_appearances:
                # High confidence + multi-image confirmation -> Auto-mark Present
                status = "present"
                auto_marked = True
                present_count += 1
                rec = {
                    "student_id": s_id,
                    "status": status,
                    "confidence_score": round(max_sim, 4),
                    "faculty_verified": False,
                    "auto_marked": auto_marked,
                    "appearances": appearances
                }
                attendance_records.append(rec)
            
            elif max_sim >= self.low_threshold or not student.get("face_embedding"):
                # Borderline similarity or single-shot sighting -> Route to Verification Queue
                status = "pending_review"
                auto_marked = False
                review_count += 1
                
                rec = {
                    "student_id": s_id,
                    "status": status,
                    "confidence_score": round(max_sim, 4),
                    "faculty_verified": False,
                    "auto_marked": auto_marked,
                    "appearances": appearances
                }
                attendance_records.append(rec)

                # Queue entry for Faculty Verification
                verification_queue_items.append({
                    "candidate_student_id": s_id,
                    "similarity_score": round(max_sim, 4),
                    "face_crop_data": best_crop,
                    "resolution_status": "pending"
                })
            
            else:
                # Undetected or below low threshold -> Auto-mark Absent
                status = "absent"
                auto_marked = True
                absent_count += 1
                rec = {
                    "student_id": s_id,
                    "status": status,
                    "confidence_score": 0.0,
                    "faculty_verified": False,
                    "auto_marked": auto_marked,
                    "appearances": 0
                }
                attendance_records.append(rec)

        return {
            "attendance_records": attendance_records,
            "verification_queue_items": verification_queue_items,
            "summary": {
                "total_enrolled": len(enrolled_students),
                "present_count": present_count,
                "absent_count": absent_count,
                "pending_review_count": review_count,
                "images_processed": num_images
            }
        }

aggregation_service = MultiImageAggregationService()
