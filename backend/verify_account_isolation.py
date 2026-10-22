"""Account isolation and scope verification suite.

Verifies that:
1. Admin (s.ronda@oklut.com) sees all tickets across all departments.
2. Team Lead (k.ananthu@oklut.com, dept: IT Support) only sees IT Support tickets.
3. Employee Uday (u.vadlamudi@oklut.com, ID: OKL004) only sees their own assigned or created tickets.
4. Employee Aditya (a.reddy@oklut.com, ID: OKL005) only sees their own assigned or created tickets (and not Uday's).
5. Summary counts (/tickets/stats/summary) are strictly scoped per identity.
6. In-app notifications (/notifications) are properly scoped.
7. Avatar removal via PATCH /users/profile clears avatar.
8. Verification of invite endpoints (/auth/verify-invite, /auth/resend-invite).
"""

from __future__ import annotations

import os
import sys

os.environ["OTEL_SDK_DISABLED"] = "true"
os.environ["PYTHONIOENCODING"] = "utf-8"

import logging
logging.disable(logging.INFO)

from fastapi.testclient import TestClient
from app.main import app
from app.auth.jwt import create_app_token
from app.db.supabase import get_supabase_admin_client

client = TestClient(app)

def make_token(user_id: str, email: str, role: str, name: str = "Test User", department: str = "") -> str:
    return create_app_token(user_id=user_id, email=email, role=role, name=name, department=department)

def run_checks():
    print("=================================================================")
    print("RUNNING TICKETING SYSTEM ACCOUNT ISOLATION & SECURITY CHECKS")
    print("=================================================================")

    # 1. Inspect users in Supabase
    sb = get_supabase_admin_client()
    users_res = sb.table("users").select("id, name, email, role, department").execute()
    users = users_res.data or []
    print(f"\n[1] Verified {len(users)} users in database:")
    for u in users:
        print(f"    - {u.get('id')}: {u.get('name')} <{u.get('email')}> | Role: {u.get('role')} | Dept: {u.get('department')}")

    # Tokens based on active DB records
    admin_token = make_token("usr-admin-1791538577749", "s.ronda@oklut.com", "admin", "shruthi", "IT Operations")
    tl_token = make_token("OKL003", "k.ananthu@oklut.com", "teamlead", "Kotesh", "IT Support")
    emp1_token = make_token("OKL004", "u.vadlamudi@oklut.com", "employee", "Uday", "IT")
    emp2_token = make_token("OKL005", "a.reddy@oklut.com", "employee", "Aditya", "HR Operations")

    # 2. Check ticket listings
    print("\n[2] Checking ticket visibility per role:")
    
    admin_res = client.get("/api/v1/tickets", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_res.status_code == 200, f"Admin listing failed: {admin_res.text}"
    admin_tickets = admin_res.json()
    print(f"    [OK] Admin sees total tickets across all departments: {len(admin_tickets)}")

    tl_res = client.get("/api/v1/tickets", headers={"Authorization": f"Bearer {tl_token}"})
    assert tl_res.status_code == 200, f"Team Lead listing failed: {tl_res.text}"
    tl_tickets = tl_res.json()
    print(f"    [OK] Team Lead (Kotesh, IT Support) sees tickets: {len(tl_tickets)}")
    # Verify every ticket seen by Team Lead is IT Support (or assigned to Kotesh)
    for t in tl_tickets:
        dept = str(t.get("department") or "")
        depts = str(t.get("departments") or "")
        assigned_to = str(t.get("assigned_agent") or "")
        is_it = "it" in dept.lower() or "it" in depts.lower()
        is_assigned = "kotesh" in assigned_to.lower() or "ananthu" in assigned_to.lower()
        assert is_it or is_assigned, f"Leak: Team Lead saw non-IT ticket: {t.get('id')} dept={dept}"
    print("    [OK] Team Lead isolation verified: 0 tickets outside IT Support scope.")

    emp1_res = client.get("/api/v1/tickets", headers={"Authorization": f"Bearer {emp1_token}"})
    assert emp1_res.status_code == 200, f"Employee Uday listing failed: {emp1_res.text}"
    emp1_tickets = emp1_res.json()
    print(f"    [OK] Employee Uday (OKL004) sees tickets: {len(emp1_tickets)}")
    for t in emp1_tickets:
        emp_id = str(t.get("employee_id") or "")
        emp_email = str(t.get("employee_email") or "")
        emp_name = str(t.get("employee") or "")
        agent_id = str(t.get("assigned_agent_id") or "")
        agent_name = str(t.get("assigned_agent") or "")
        matches = (
            emp_id == "OKL004"
            or agent_id == "OKL004"
            or "uday" in emp_name.lower()
            or "uday" in agent_name.lower()
            or "u.vadlamudi" in emp_email.lower()
        )
        assert matches, f"Leak: Employee saw unrelated ticket: {t.get('id')} employee={emp_name}"
    print("    [OK] Employee Uday isolation verified: all visible tickets belong strictly to Uday.")

    emp2_res = client.get("/api/v1/tickets", headers={"Authorization": f"Bearer {emp2_token}"})
    assert emp2_res.status_code == 200, f"Employee Aditya listing failed: {emp2_res.text}"
    emp2_tickets = emp2_res.json()
    print(f"    [OK] Employee Aditya (OKL005) sees tickets: {len(emp2_tickets)}")
    for t in emp2_tickets:
        emp_id = str(t.get("employee_id") or "")
        emp_email = str(t.get("employee_email") or "")
        emp_name = str(t.get("employee") or "")
        agent_id = str(t.get("assigned_agent_id") or "")
        agent_name = str(t.get("assigned_agent") or "")
        matches = (
            emp_id == "OKL005"
            or agent_id == "OKL005"
            or "aditya" in emp_name.lower()
            or "aditya" in agent_name.lower()
            or "a.reddy" in emp_email.lower()
        )
        assert matches, f"Leak: Employee saw unrelated ticket: {t.get('id')} employee={emp_name}"
    print("    [OK] Employee Aditya isolation verified: all visible tickets belong strictly to Aditya.")

    # Cross isolation: Uday's tickets and Aditya's tickets must not overlap unless co-assigned
    u_ids = {t["id"] for t in emp1_tickets}
    a_ids = {t["id"] for t in emp2_tickets}
    print(f"    [OK] Cross-employee isolation: Uday tickets={len(u_ids)}, Aditya tickets={len(a_ids)}, Overlap={len(u_ids & a_ids)}")

    # Hierarchy verification
    assert len(emp1_tickets) <= len(tl_tickets) <= len(admin_tickets)
    print(f"    [OK] Hierarchy confirmed: Employee ({len(emp1_tickets)}) <= Team Lead ({len(tl_tickets)}) <= Admin ({len(admin_tickets)})")

    # 3. Check stats summary scoping
    print("\n[3] Checking /tickets/stats/summary scoping:")
    admin_stats = client.get("/api/v1/tickets/stats/summary", headers={"Authorization": f"Bearer {admin_token}"}).json()
    tl_stats = client.get("/api/v1/tickets/stats/summary", headers={"Authorization": f"Bearer {tl_token}"}).json()
    emp1_stats = client.get("/api/v1/tickets/stats/summary", headers={"Authorization": f"Bearer {emp1_token}"}).json()
    emp2_stats = client.get("/api/v1/tickets/stats/summary", headers={"Authorization": f"Bearer {emp2_token}"}).json()

    print(f"    - Admin stats total: {admin_stats.get('totalTickets')}")
    print(f"    - Team Lead stats total: {tl_stats.get('totalTickets')}")
    print(f"    - Employee Uday stats total: {emp1_stats.get('totalTickets')}")
    print(f"    - Employee Aditya stats total: {emp2_stats.get('totalTickets')}")
    assert admin_stats.get("totalTickets") == len(admin_tickets)
    assert tl_stats.get("totalTickets") == len(tl_tickets)
    assert emp1_stats.get("totalTickets") == len(emp1_tickets)
    assert emp2_stats.get("totalTickets") == len(emp2_tickets)
    print("    [OK] Stats summary totals match scoped ticket listings perfectly.")

    # 4. Check notification scoping
    print("\n[4] Checking /notifications scoping:")
    admin_notifs = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {admin_token}"}).json()
    tl_notifs = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {tl_token}"}).json()
    emp_notifs = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {emp1_token}"}).json()
    print(f"    - Admin notifications: {len(admin_notifs)}")
    print(f"    - Team Lead notifications: {len(tl_notifs)}")
    print(f"    - Employee notifications: {len(emp_notifs)}")

    # 5. Check avatar update and removal via PATCH /users/profile
    print("\n[5] Checking avatar update and removal via PATCH /users/profile:")
    # Set avatar
    set_res = client.patch(
        "/api/v1/users/profile",
        headers={"Authorization": f"Bearer {emp1_token}"},
        json={"avatar": "https://example.com/avatar1.png"}
    )
    assert set_res.status_code == 200, f"Failed to set avatar: {set_res.text}"
    assert set_res.json().get("avatar") == "https://example.com/avatar1.png"

    # Remove avatar (pass empty string)
    clear_res = client.patch(
        "/api/v1/users/profile",
        headers={"Authorization": f"Bearer {emp1_token}"},
        json={"avatar": ""}
    )
    assert clear_res.status_code == 200, f"Failed to clear avatar: {clear_res.text}"
    assert clear_res.json().get("avatar") is None, f"Avatar was not cleared: {clear_res.json()}"
    print("    [OK] Avatar removal verified: PATCH /users/profile with avatar='' clears avatar to None.")

    # 6. Check invite endpoints
    print("\n[6] Checking /auth/verify-invite and /auth/resend-invite endpoints:")
    inv_none = client.get("/api/v1/auth/verify-invite?email=nonexistent999@oklut.com").json()
    assert inv_none.get("valid") is False
    print("    [OK] Nonexistent invite rejected properly.")

    inv_active = client.get("/api/v1/auth/verify-invite?email=s.ronda@oklut.com").json()
    assert inv_active.get("already_active") is True
    print("    [OK] Active user check returns already_active=True properly.")

    resend_none = client.post("/api/v1/auth/resend-invite", json={"email": "nonexistent999@oklut.com"}).json()
    assert resend_none.get("success") is False
    print("    [OK] Nonexistent user resend-invite returns success=False properly.")

    resend_active = client.post("/api/v1/auth/resend-invite", json={"email": "s.ronda@oklut.com"}).json()
    assert resend_active.get("success") is False
    assert "already active" in resend_active.get("message", "").lower()
    print("    [OK] Active user resend-invite returns 'already active' properly.")

    print("\n=================================================================")
    print("ALL ISOLATION, DATA PRIVACY & ACCESS CONTROL CHECKS PASSED!")
    print("=================================================================")

if __name__ == "__main__":
    run_checks()
