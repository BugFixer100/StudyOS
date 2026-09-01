"""
database.py

This file sets up the connection to our SQLite database.

Think of it as: "where is the data, and how do we talk to it?"

We use SQLAlchemy here, which lets us later define database tables
as normal Python classes (in models.py) instead of writing raw SQL
everywhere.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# This is the actual file on disk that holds ALL your data.
# Because it's a single file, backing up your entire academic history
# later is as simple as copying this one file somewhere safe.
DATABASE_URL = "sqlite:///./studyos.db"

# The "engine" is the thing that actually knows how to talk to SQLite.
# connect_args is needed only because SQLite has a quirk with multiple
# threads accessing the same connection - FastAPI can use multiple
# threads, so we allow that here.
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

# SessionLocal is a "factory" for creating a new database session
# every time an API request comes in. A session is basically a
# temporary workspace for reading/writing data.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base is the parent class that all our table models (in models.py)
# will inherit from. SQLAlchemy uses this to know which Python classes
# represent actual database tables.
Base = declarative_base()


def get_db():
    """
    This function is used by FastAPI routes to get a database session.

    The 'yield' pattern here means:
    1. Create a session
    2. Hand it to whichever route asked for it
    3. Once that route is done (success or error), close the session

    This guarantees we never leave database connections open by accident.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
