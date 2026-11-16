"""Copy a stopped ClassSense SQLite database into an empty PostgreSQL database.

Uses SQL types from the application but copies encrypted templates as raw text.
The source is opened read-only. All inserts run in one target transaction.
"""
import argparse
from pathlib import Path
import sqlite3

from sqlalchemy import MetaData, Text, create_engine, func, inspect, select
from sqlalchemy.engine import make_url

from app import models  # noqa: F401: register every application table
from app.database import Base


def transfer(source, target):
    """Create missing tables and copy rows; refuse nonempty or outdated databases."""
    metadata = MetaData()
    for table in Base.metadata.sorted_tables:
        copied = table.to_metadata(metadata)
        # Avoid decrypting/re-encrypting biometric templates during transfer.
        if copied.name == "students":
            copied.c.face_embedding.type = Text()
    metadata.create_all(target)
    source_inspector = inspect(source)
    counts = {}
    with source.connect() as reader, target.begin() as writer:
        for table in metadata.sorted_tables:
            if writer.scalar(select(func.count()).select_from(table)):
                raise ValueError("Target contains data; use a new empty database.")
        for table in metadata.sorted_tables:
            if not source_inspector.has_table(table.name):
                raise ValueError(f"Source lacks table {table.name}; initialize the SQLite schema first.")
            available = {column["name"] for column in source_inspector.get_columns(table.name)}
            if set(table.c.keys()) - available:
                raise ValueError(f"Source table {table.name} is outdated; initialize the SQLite schema first.")
            count = 0
            result = reader.execute(select(table))
            for batch in result.mappings().partitions(500):
                writer.execute(table.insert(), [dict(row) for row in batch])
                count += len(batch)
            if writer.scalar(select(func.count()).select_from(table)) != count:
                raise ValueError(f"Row-count verification failed for {table.name}.")
            counts[table.name] = count
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path(__file__).parent / "classsense.db")
    parser.add_argument("--target-url", help="Defaults to DATABASE_URL from backend/.env or environment")
    args = parser.parse_args()
    from app.config import settings

    url = make_url(args.target_url or settings.DATABASE_URL)
    if url.get_backend_name() != "postgresql":
        parser.error("Set DATABASE_URL to PostgreSQL or supply --target-url.")
    url = url.set(drivername="postgresql+psycopg")
    path = args.source.resolve(strict=True)
    source = create_engine("sqlite://", creator=lambda: sqlite3.connect(path.as_uri() + "?mode=ro", uri=True))
    target = create_engine(url, pool_pre_ping=True)
    try:
        counts = transfer(source, target)
        for table, count in counts.items():
            print(f"{table}: {count} rows verified")
        print("Transfer committed. Keep the SQLite backup and the existing biometric key.")
    finally:
        source.dispose()
        target.dispose()


if __name__ == "__main__":
    main()
