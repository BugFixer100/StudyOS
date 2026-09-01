from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from services.dashboard import build_today_dashboard

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/today", response_model=Dict[str, Any])
def get_today_dashboard(db: Session = Depends(get_db)):
    """
    Build the main "Today" dashboard payload:
    - today's classes
    - next class / upcoming class
    - urgent tasks ranked by urgency
    - top 5 recommended actions
    """
    return build_today_dashboard(db)
