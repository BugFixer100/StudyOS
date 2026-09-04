from __future__ import annotations

from datetime import date
from typing import Any, Dict, Optional


PRIORITY_WEIGHT = {
    "Low": 1.0,
    "Medium": 1.5,
    "High": 2.2,
    "Urgent": 3.0,
}


def compute_urgency(
    due_date: Optional[date],
    estimated_minutes: Optional[int] = None,
    priority: str = "Medium",
    status: str = "Not Started",
) -> Dict[str, Any]:
    """
    Compute a task urgency score from deadline pressure and workload.

    Rules:
    - No due date => no urgency
    - Overdue tasks get a strong penalty
    - Shorter deadlines increase urgency
    - More workload and higher priority increase urgency
    """
    if due_date is None:
        return {
            "score": 0,
            "label": "No deadline",
            "days_left": None,
            "is_overdue": False,
            "danger_zone": False,
        }

    today = date.today()
    days_left = (due_date - today).days
    workload = estimated_minutes or 0
    priority_factor = PRIORITY_WEIGHT.get(priority, PRIORITY_WEIGHT["Medium"])

    if status and status.lower() == "completed":
        return {
            "score": 0,
            "label": "Completed",
            "days_left": days_left,
            "is_overdue": days_left < 0,
            "danger_zone": False,
        }

    safe_days = max(abs(days_left), 1)
    score = (workload * priority_factor) / safe_days

    if days_left < 0:
        score += 50
        label = "Overdue"
    elif days_left <= 1:
        label = "Critical"
    elif days_left <= 3:
        label = "High"
    elif days_left <= 7:
        label = "Medium"
    else:
        label = "Low"

    # Danger Zone: overdue, OR due very soon combined with heavy workload,
    # not-yet-started status, or high/urgent priority. This is the single
    # authoritative place this rule is decided - the frontend should only
    # ever display this flag, never recompute it.
    is_overdue = days_left < 0
    high_risk_deadline = days_left <= 2
    heavy_workload = workload >= 180
    not_started = (status or "").lower() == "not started"
    high_priority = (priority or "").lower() in ("high", "urgent")
    danger_zone = is_overdue or (high_risk_deadline and (heavy_workload or not_started or high_priority))

    return {
        "score": round(score, 2),
        "label": label,
        "days_left": days_left,
        "is_overdue": is_overdue,
        "danger_zone": danger_zone,
    }
