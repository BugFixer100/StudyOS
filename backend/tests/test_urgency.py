from datetime import date, timedelta

from services.urgency import compute_urgency


def test_urgency_critical_for_imminent_deadline():
    due_date = date.today() + timedelta(days=1)
    result = compute_urgency(due_date=due_date, estimated_minutes=60, priority="High")

    assert result["days_left"] == 1
    assert result["label"] == "Critical"
    assert result["is_overdue"] is False


def test_urgency_high_for_short_deadline():
    due_date = date.today() + timedelta(days=3)
    result = compute_urgency(due_date=due_date, estimated_minutes=45, priority="High")

    assert result["days_left"] == 3
    assert result["label"] == "High"


def test_urgency_overdue_when_due_date_passed():
    due_date = date.today() - timedelta(days=2)
    result = compute_urgency(due_date=due_date, estimated_minutes=60, priority="High")

    assert result["days_left"] == -2
    assert result["is_overdue"] is True
    assert result["label"] == "Overdue"


def test_urgency_no_deadline():
    result = compute_urgency(due_date=None, estimated_minutes=30, priority="Medium")

    assert result["days_left"] is None
    assert result["label"] == "No deadline"
    assert result["is_overdue"] is False
