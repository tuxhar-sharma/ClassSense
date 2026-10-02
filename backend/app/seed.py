"""Initialize an empty schema; no sample accounts or attendance are created."""
import app.models
from app.database import initialize_database

if __name__ == "__main__":
    initialize_database()
