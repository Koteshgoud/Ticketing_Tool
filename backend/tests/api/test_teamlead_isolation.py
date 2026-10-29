"""Unit and API tests verifying Team Lead data isolation and cross-team security."""

from typing import Any
import pytest
from httpx import AsyncClient

from app.auth.jwt import create_app_token
from app.services.access import (
    ROLE_TEAMLEAD,
    ROLE_ADMIN,
    ticket_visible,
    teamlead_managed_employees,
    _scopes_overlap,
)


def test_scopes_overlap_logic() -> None:
    """Verify that scopes overlap correctly handles departments and distinct teams."""
    # Department overlap
    assert _scopes_overlap("IT Support", "IT") is True
    assert _scopes_overlap("HR", "IT Support") is False

    # Distinct teams within same department do NOT overlap
    assert _scopes_overlap("Team Alpha", "Team Beta") is False
    assert _scopes_overlap("Pod 1", "Pod 2") is False


def test_ticket_visibility_isolation_unit() -> None:
    """Unit test ticket_visible for two Team Leads in the same department."""
    tl_a = {
        "id": "TL_A",
        "name": "Lead A",
        "email": "lead_a@example.com",
        "role": "teamlead",
        "department": "IT Support",
        "team": "Team Alpha",
    }
    payload_a = {"sub": "TL_A", "email": "lead_a@example.com", "role": "teamlead"}

    tl_b = {
        "id": "TL_B",
        "name": "Lead B",
        "email": "lead_b@example.com",
        "role": "teamlead",
        "department": "IT Support",
        "team": "Team Beta",
    }
    payload_b = {"sub": "TL_B", "email": "lead_b@example.com", "role": "teamlead"}

    admin = {
        "id": "ADMIN_1",
        "role": "admin",
    }
    payload_admin = {"sub": "ADMIN_1", "role": "admin"}

    ticket_team_a = {
        "id": "TKT-A-01",
        "subject": "Alpha Issue",
        "department": "IT Support",
        "assigned_agent_id": "EMP_A1",
        "assigned_agent": "Employee A1",
        "assigned_by_user_id": "TL_A",
        "employee_id": "EMP_A1",
    }

    ticket_team_b = {
        "id": "TKT-B-01",
        "subject": "Beta Issue",
        "department": "IT Support",
        "assigned_agent_id": "EMP_B1",
        "assigned_agent": "Employee B1",
        "assigned_by_user_id": "TL_B",
        "employee_id": "EMP_B1",
    }

    # TL A assigned by TL A -> visible to TL A
    assert ticket_visible(payload_a, tl_a, ticket_team_a) is True
    # TL A did NOT assign and is not associated with Team B -> NOT visible to TL A despite IT Support dept
    assert ticket_visible(payload_a, tl_a, ticket_team_b) is False

    # TL B assigned by TL B -> visible to TL B
    assert ticket_visible(payload_b, tl_b, ticket_team_b) is True
    # TL B did NOT assign and is not associated with Team A -> NOT visible to TL B
    assert ticket_visible(payload_b, tl_b, ticket_team_a) is False

    # Admin sees both
    assert ticket_visible(payload_admin, admin, ticket_team_a) is True
    assert ticket_visible(payload_admin, admin, ticket_team_b) is True


def test_teams_overlap_exact_tokens() -> None:
    """Verify that _teams_overlap requires exact token intersection and prevents substring matches."""
    from app.services.access import _teams_overlap
    assert _teams_overlap("Team Alpha", "Team Alpha") is True
    assert _teams_overlap("Team Alpha", "Team Beta") is False
    assert _teams_overlap("Alpha", "Alpha Team") is False
    assert _teams_overlap(None, "Team Alpha") is False


def test_serialize_ticket_user_flags() -> None:
    """Verify serialize_ticket correctly attaches is_assigned_to_me and is_created_by_me."""
    from app.services.access import serialize_ticket

    user = {"id": "EMP_01", "name": "Alice", "email": "alice@example.com"}
    payload = {"sub": "EMP_01", "name": "Alice", "email": "alice@example.com", "role": "employee"}

    ticket_assigned = {
        "id": "TKT-101",
        "subject": "Printer issue",
        "assigned_agent_id": "EMP_01",
        "assigned_agent": "Alice",
        "employee_id": "EMP_99",
        "status": "Open",
    }
    serialized = serialize_ticket(ticket_assigned, payload=payload, user=user)
    assert serialized["is_assigned_to_me"] is True
    assert serialized["is_created_by_me"] is False

    ticket_created = {
        "id": "TKT-102",
        "subject": "Laptop issue",
        "assigned_agent_id": "EMP_02",
        "assigned_agent": "Bob",
        "employee_id": "EMP_01",
        "status": "Open",
    }
    serialized2 = serialize_ticket(ticket_created, payload=payload, user=user)
    assert serialized2["is_assigned_to_me"] is False
    assert serialized2["is_created_by_me"] is True


def test_ticket_stats_assigned_and_my_counts() -> None:
    """Verify ticket_stats counts assignedTicketsCount and myTicketsCount."""
    from app.services.access import ticket_stats

    user = {"id": "EMP_01", "name": "Alice", "email": "alice@example.com"}
    payload = {"sub": "EMP_01", "name": "Alice", "email": "alice@example.com", "role": "employee"}

    tickets = [
        # Assigned to Alice (Active)
        {"id": "TKT-1", "assigned_agent_id": "EMP_01", "assigned_agent": "Alice", "status": "Open"},
        # Assigned to Alice (Resolved - must be counted in assignedTicketsCount)
        {"id": "TKT-2", "assigned_agent_id": "EMP_01", "assigned_agent": "Alice", "status": "Resolved"},
        # Created by Alice, assigned to Bob
        {"id": "TKT-3", "employee_id": "EMP_01", "assigned_agent_id": "EMP_02", "assigned_agent": "Bob", "status": "Open"},
        # Neither
        {"id": "TKT-4", "employee_id": "EMP_03", "assigned_agent_id": "EMP_02", "assigned_agent": "Bob", "status": "Open"},
    ]

    stats = ticket_stats(tickets, payload=payload, user=user)
    assert stats["assignedTicketsCount"] == 2  # Includes active + resolved assigned to Alice
    assert stats["myTicketsCount"] == 1        # Created by Alice
    assert stats["totalTickets"] == 4
    assert stats["resolvedTickets"] == 1
    assert stats["openTickets"] == 3
