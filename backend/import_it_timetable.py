"""Explicit one-time import of the supplied IT sheets; never overwrites published edits.

Run from the project root: .venv/Scripts/python.exe backend/import_it_timetable.py
Faculty must already have approved accounts. This command creates assignments and
saved timetable notifications using the same transaction as the admin publisher.
"""
import json
import app.models
from app.database import initialize_database, SessionLocal
from app.models.user import User
from app.services.timetable_management import catalog_payload, publish_timetable, latest_publication

def main():
    initialize_database()
    with SessionLocal() as db:
        actor = db.query(User).filter_by(role='admin').first()
        if not actor:
            raise RuntimeError('Create the initial administrator before importing timetables.')
        plans = []
        for semester in ['3rd', '5th', '7th']:
            for section in 'ABC':
                if latest_publication(db, semester, section, effective_only=False):
                    continue
                plans.append(catalog_payload(db, semester, section))
        results = [publish_timetable(db, payload, actor) for payload in plans]
        db.commit()
        print(json.dumps({'classes_published': len(results), 'notifications_saved': sum(row['notifications'] for row in results)}, indent=2))

if __name__ == '__main__':
    main()
