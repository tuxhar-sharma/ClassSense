"""Read-only department schedule, independent of attendance-course provisioning."""
import re
from app.services.it_timetable_data import SOURCE, PERIODS, DAYS, CODES, FACULTY, HOME_ROOMS, GRIDS


def class_key(branch, semester, section):
    branch = re.sub(r"[^a-z]", "", (branch or "").lower())
    if branch not in {"it", "informationtechnology"}:
        return None
    match = re.fullmatch(r"\s*([1-8])(?:st|nd|rd|th)?(?:\s+semester)?\s*", (semester or "").lower())
    if not match:
        return None
    # Letter sections only. IT-1 is deliberately not guessed to mean IT A.
    section = re.sub(r"[^A-Z0-9]", "", (section or "").upper())
    if section.startswith("IT"):
        section = section[2:]
    key = (int(match[1]), section)
    return key if key in GRIDS else None


def faculty_for(key, subject, group=""):
    faculty = FACULTY[key]
    return faculty.get(f"{subject}#{group}", faculty.get(subject, faculty.get(subject.removesuffix(" Lab"), "")))


def department_timetable(student):
    key = class_key(student.branch, student.semester, student.section)
    result = {
        "available": bool(key), "source": SOURCE,
        "periods": [{"period": label, "start_time": start, "end_time": end} for label, start, end in PERIODS],
        "lab_group": getattr(student, "lab_group", "") or "",
        "entries": [], "faculty_assignments": [], "warnings": [],
        "message": "", "class_label": "", "printed_semester_label": "",
    }
    if not key:
        result["message"] = "Department timetable is available for IT semesters 3, 5 and 7, sections A, B and C. Choose your official letter section; numeric sections are not automatically mapped. First-semester data has not been supplied."
        return result
    semester, section = key
    result["class_label"] = f"IT {section} · Semester {semester}"
    result["printed_semester_label"] = "Even Semester : 2026-2027" if semester == 7 else "Odd Semester : 2026-2027"
    if not result["lab_group"]:
        result["warnings"].append("Lab batch is not selected. Both G1 and G2 are shown; select your assigned batch to personalize labs.")
    if semester == 7:
        result["warnings"].extend([
            "The source labels semester 7 as 'Even Semester'. This is preserved as printed and may be a source typo.",
            "Monday III–IV prints both DSR Lab and MSRPM Lab as G1. Both are preserved; confirm allocation with the department.",
            "Parallel subjects may be electives. All printed options remain visible; follow your official subject allocation.",
            "Minor Project has no faculty or room printed. STR-2 appears only in the faculty table, with no weekly slot.",
        ])
    if key == (5, "C"):
        result["warnings"].append("Room spellings R-SH-1A / R-SH1-A are preserved from the transcription; some scan room labels were unclear.")
    if semester == 3:
        result["warnings"].append("BCM/BCP cells include '(LE)' in the source. Its meaning is not confirmed; BCP faculty is blank.")
    if semester == 5:
        result["warnings"].append("ST-1 appears in the faculty table but has no weekly grid slot.")

    for day, row in zip(DAYS, GRIDS[key]):
        for cell in row.split("|"):
            period_range, alternatives = cell.split(":", 1)
            bounds = [int(value) for value in period_range.split("-")]
            first, last = bounds[0], bounds[-1]
            parallel = alternatives.split("/")
            for index, raw in enumerate(parallel):
                subject_group, _, room = raw.partition("@")
                subject, _, group = subject_group.partition("#")
                if group and result["lab_group"] and group != result["lab_group"]:
                    continue
                kind = "Lab" if subject.endswith(" Lab") else {
                    "LIB": "Library", "Enrichment Activities": "Enrichment",
                    "Minor Project": "Project", "PDP": "PDP", "MMM": "Activity",
                    "BCM": "Bridge course", "BCP": "Bridge course",
                }.get(subject, "Lecture")
                home_room = HOME_ROOMS.get(key, "") if kind in {"Lecture", "PDP", "Activity"} else ""
                note = ""
                if semester == 7 and day == "Monday" and first == 3:
                    note = "Both alternatives are printed G1; department confirmation needed."
                result["entries"].append({
                    "id": f"it-2026-27-{semester}-{section}-{day}-{period_range}-{index}",
                    "course_id": "", "course_code": CODES[semester].get(subject, ""),
                    "course_name": subject, "day_of_week": day,
                    "start_time": PERIODS[first - 1][1], "end_time": PERIODS[last - 1][2],
                    "period": PERIODS[first - 1][0] + (f"–{PERIODS[last - 1][0]}" if first != last else ""),
                    "room": room or home_room, "room_source": "cell" if room else "class header" if home_room else "not specified",
                    "session_type": kind, "faculty_name": faculty_for(key, subject, group),
                    "lab_group": group, "parallel_slot": len(parallel) > 1,
                    "slot_key": f"{day}-{period_range}", "source_note": note,
                    "source": "department", "notation": "(LE)" if subject in {"BCM", "BCP"} else "",
                })
    subjects = list(CODES[semester]) + ["PDP", "MMM", "LIB", "Enrichment Activities"]
    if semester == 7:
        subjects = list(CODES[semester]) + ["Minor Project", "Enrichment Activities"]
    for subject in subjects:
        groups = ["G1", "G2"] if key == (5, "C") and subject == "DAA Lab" else [""]
        for group in groups:
            result["faculty_assignments"].append({
                "subject": subject, "code": CODES[semester].get(subject, ""),
                "faculty_name": faculty_for(key, subject, group), "lab_group": group,
                "scheduled": any(subject in cell for row in GRIDS[key] for cell in row.split("|")),
            })
    return result
