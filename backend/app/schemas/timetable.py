from datetime import date
from typing import Literal
from pydantic import BaseModel, Field, model_validator, field_validator

class TimetableSubject(BaseModel):
    course_name: str = Field(min_length=1, max_length=150)
    course_code: str = Field(default="", max_length=50)
    faculty_ids: list[str] = Field(default_factory=list, max_length=8)
    lab_group: Literal["", "G1", "G2"] = ""

    @field_validator('course_name', 'course_code')
    @classmethod
    def trim_text(cls, value, info):
        value = value.strip()
        if info.field_name == 'course_name' and not value:
            raise ValueError('Subject name must not be blank.')
        return value

class PublishedSlot(TimetableSubject):
    day_of_week: Literal['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    start_time: str = Field(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    end_time: str = Field(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    room: str = Field(default="", max_length=50)
    session_type: Literal['Lecture', 'Lab', 'Tutorial', 'Library', 'Enrichment', 'Project', 'PDP', 'Activity', 'Bridge course'] = 'Lecture'
    source_note: str = Field(default="", max_length=1000)
    period: str = Field(default="", max_length=20)
    notation: str = Field(default="", max_length=30)

    @model_validator(mode='after')
    def check_times(self):
        if self.end_time <= self.start_time:
            raise ValueError('Each slot must end after it starts.')
        return self

class PublishTimetable(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    branch: Literal['Information Technology'] = 'Information Technology'
    semester: Literal['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']
    section: Literal['A', 'B', 'C']
    effective_from: date
    entries: list[PublishedSlot] = Field(min_length=1, max_length=250)
    subjects: list[TimetableSubject] = Field(default_factory=list, max_length=100)
    notes: list[str] = Field(default_factory=list, max_length=30)
    source_document: str = Field(default='Created in ClassSense', max_length=255)
    expected_revision: int = Field(default=0, ge=0)

    @model_validator(mode='after')
    def validate_slots(self):
        seen = set()
        identities = {}
        codes = {}
        for slot in [*self.entries, *self.subjects]:
            identity = (slot.course_name, slot.course_code, slot.lab_group)
            instructors = tuple(sorted(set(slot.faculty_ids)))
            if identity in identities and identities[identity] != instructors:
                raise ValueError(f'Use consistent faculty for {slot.course_name} {slot.lab_group}.')
            identities[identity] = instructors
            code_key = (slot.course_code or slot.course_name, slot.lab_group)
            if code_key in codes and codes[code_key] != slot.course_name:
                raise ValueError('A subject code and batch must refer to one subject name.')
            codes[code_key] = slot.course_name
        for slot in self.entries:
            key = (slot.day_of_week, slot.start_time, slot.end_time, slot.course_name, slot.course_code, slot.lab_group)
            if key in seen:
                raise ValueError('Duplicate timetable row. Remove the duplicate before publishing.')
            seen.add(key)
        if any(len(note) > 1500 for note in self.notes):
            raise ValueError('Each source note must be at most 1500 characters.')
        return self
