"""Container entry point: initialize schema without creating sample data."""
import uvicorn
import app.models
from app.database import initialize_database

if __name__ == '__main__':
    initialize_database()
    uvicorn.run('app.main:app', host='0.0.0.0', port=8000)
