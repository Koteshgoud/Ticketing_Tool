"""Comprehensive End-to-End Test for Ticket Attachment Visibility & Authorization."""

import requests
import json
import os
import hashlib

BASE_URL = "http://localhost:8000"

def get_session_token(email: str, user_id: str = None) -> str:
    body = {"email": email}
    if user_id:
        body["user_id"] = user_id
    res = requests.post(f"{BASE_URL}/api/v1/auth/session", json=body)
    if not res.ok:
        raise Exception(f"Failed to get session for {email}: {res.status_code} {res.text}")
    return res.json()["access_token"]

def main():
    print("=== STARTING COMPREHENSIVE ATTACHMENT FLOW VERIFICATION ===")

    # Users in system
    admin_email = "s.ronda@oklut.com"           # shruthi (admin)
    teamlead_email = "k.ananthu@oklut.com"       # Kotesh (assigned team lead)
    employee_email = "a.reddy@oklut.com"         # Aditya (assigned employee / creator)
    unauthorized_email = "u.vadlamudi@oklut.com" # Uday (unassigned employee)

    print("\n1. Authenticating test users via POST /api/v1/auth/session...")
    admin_token = get_session_token(admin_email)
    tl_token = get_session_token(teamlead_email)
    emp_token = get_session_token(employee_email)
    unauth_token = get_session_token(unauthorized_email)
    print("   Tokens acquired successfully for Admin, Team Lead, Assigned Employee, and Unauthorized Employee.")

    # 2. Check existing ticket TKT-8707 for Team Lead (Kotesh)
    print("\n2. Checking existing ticket TKT-8707 attachments for assigned Team Lead (Kotesh)...")
    res_8707 = requests.get(
        f"{BASE_URL}/api/v1/tickets/TKT-8707/attachments",
        headers={"Authorization": f"Bearer {tl_token}"}
    )
    print(f"   TKT-8707 GET status for Team Lead: {res_8707.status_code}")
    if res_8707.ok:
        items = res_8707.json()
        print(f"   TKT-8707 attachments count: {len(items)}")
        for it in items:
            print(f"   - {it.get('name')} ({it.get('size')}) [ID: {it.get('id')}]")
    else:
        print(f"   Error: {res_8707.text}")

    # Check unauthorized access to TKT-8707 for Uday
    res_unauth_8707 = requests.get(
        f"{BASE_URL}/api/v1/tickets/TKT-8707/attachments",
        headers={"Authorization": f"Bearer {unauth_token}"}
    )
    print(f"   TKT-8707 GET status for unauthorized employee (Uday): {res_unauth_8707.status_code}")
    assert res_unauth_8707.status_code == 403, f"Expected 403 Forbidden but got {res_unauth_8707.status_code}"
    print("   CONFIRMED: Unauthorized employee receives 403 Forbidden on TKT-8707.")

    # 3. Create an isolated test ticket in Supabase
    test_ticket_id = "TKT-TEST-E2E-99"
    print(f"\n3. Setting up isolated test ticket {test_ticket_id}...")

    # We can use Supabase client to create ticket
    from app.db.supabase import get_supabase_client
    sb = get_supabase_client()

    # Clean existing test ticket if any
    sb.table("tickets").delete().eq("id", test_ticket_id).execute()

    ticket_record = {
        "id": test_ticket_id,
        "ticket_number": "TICK-9999",
        "subject": "E2E Attachment Visibility Verification Ticket",
        "description": "Verifying ticket attachment persistence, assignment visibility, and authorization.",
        "category": "development",
        "priority": "High",
        "status": "In Progress",
        "employee_id": "OKL005",
        "employee": "Aditya",
        "employee_email": employee_email,
        "assigned_agent": "Kotesh",
        "assigned_agent_id": "OKL003",
        "assigned_to_type": "teamlead",
        "handled_by": "teamlead",
        "department": "Engineering",
        "departments": ["Engineering"],
        "created_at": "2026-10-21T05:00:00Z"
    }
    insert_ticket_res = sb.table("tickets").insert(ticket_record).execute()
    print(f"   Inserted test ticket {test_ticket_id} in Supabase: {len(insert_ticket_res.data or [])} record(s).")

    # 4. Upload real test file as the ticket creator (Aditya)
    print(f"\n4. Uploading real attachment to {test_ticket_id} via POST /api/v1/tickets/{test_ticket_id}/attachments...")
    sample_content = b"System diagnostic trace and logs for E2E attachment test.\nTimestamp: 2026-10-21T10:45:00Z\nIntegrity hash check ok."
    sample_sha256 = hashlib.sha256(sample_content).hexdigest()

    upload_res = requests.post(
        f"{BASE_URL}/api/v1/tickets/{test_ticket_id}/attachments",
        headers={"Authorization": f"Bearer {emp_token}"},
        files={"files": ("e2e_diagnostic_report.pdf", sample_content, "application/pdf")}
    )
    print(f"   Upload response status: {upload_res.status_code}")
    assert upload_res.status_code == 201, f"Expected 201 Created but got {upload_res.status_code}: {upload_res.text}"
    uploaded_items = upload_res.json()
    att_id = uploaded_items[0]["id"]
    att_name = uploaded_items[0]["name"]
    print(f"   Uploaded attachment ID: {att_id}, name: {att_name}")

    # 5. Verify Assigned Team Lead (Kotesh) can list and see the attachment
    print(f"\n5. Verifying Assigned Team Lead (Kotesh) accesses attachments on {test_ticket_id}...")
    tl_list_res = requests.get(
        f"{BASE_URL}/api/v1/tickets/{test_ticket_id}/attachments",
        headers={"Authorization": f"Bearer {tl_token}"}
    )
    print(f"   Team Lead GET status: {tl_list_res.status_code}")
    assert tl_list_res.status_code == 200
    tl_items = tl_list_res.json()
    assert len(tl_items) >= 1
    assert tl_items[0]["name"] == "e2e_diagnostic_report.pdf"
    print(f"   CONFIRMED: Team Lead sees attachment '{tl_items[0]['name']}' ({tl_items[0]['size']}).")

    # 6. Verify Assigned Employee (Aditya) can list and see the attachment
    print(f"\n6. Verifying Assigned Employee (Aditya) accesses attachments on {test_ticket_id}...")
    emp_list_res = requests.get(
        f"{BASE_URL}/api/v1/tickets/{test_ticket_id}/attachments",
        headers={"Authorization": f"Bearer {emp_token}"}
    )
    print(f"   Employee GET status: {emp_list_res.status_code}")
    assert emp_list_res.status_code == 200
    emp_items = emp_list_res.json()
    assert len(emp_items) >= 1
    assert emp_items[0]["name"] == "e2e_diagnostic_report.pdf"
    print(f"   CONFIRMED: Employee sees attachment '{emp_items[0]['name']}' ({emp_items[0]['size']}).")

    # 7. Verify Admin (shruthi) can list and see the attachment
    print(f"\n7. Verifying Admin (shruthi) accesses attachments on {test_ticket_id}...")
    admin_list_res = requests.get(
        f"{BASE_URL}/api/v1/tickets/{test_ticket_id}/attachments",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    print(f"   Admin GET status: {admin_list_res.status_code}")
    assert admin_list_res.status_code == 200
    admin_items = admin_list_res.json()
    assert len(admin_items) >= 1
    assert admin_items[0]["name"] == "e2e_diagnostic_report.pdf"
    print(f"   CONFIRMED: Admin sees attachment '{admin_items[0]['name']}' ({admin_items[0]['size']}).")

    # 8. Verify Unauthorized Employee (Uday) is rejected with 403 Forbidden
    print(f"\n8. Verifying Unauthorized Employee (Uday) is rejected on {test_ticket_id}...")
    unauth_list_res = requests.get(
        f"{BASE_URL}/api/v1/tickets/{test_ticket_id}/attachments",
        headers={"Authorization": f"Bearer {unauth_token}"}
    )
    print(f"   Unauthorized Employee GET status: {unauth_list_res.status_code}")
    assert unauth_list_res.status_code == 403, f"Expected 403 Forbidden but got {unauth_list_res.status_code}"
    print(f"   CONFIRMED: Unauthorized Employee receives 403 Forbidden: {unauth_list_res.json()}")

    # 9. Verify Download and Preview for Assigned Team Lead
    print(f"\n9. Testing Download and View endpoints for Team Lead...")
    # Download by ID
    dl_res = requests.get(
        f"{BASE_URL}/api/v1/tickets/{test_ticket_id}/attachments/{att_id}/download",
        headers={"Authorization": f"Bearer {tl_token}"}
    )
    print(f"   Download by ID status: {dl_res.status_code}")
    assert dl_res.status_code == 200
    assert hashlib.sha256(dl_res.content).hexdigest() == sample_sha256
    print("   CONFIRMED: Downloaded file matches original SHA-256 hash perfectly.")

    # Download by raw filename
    dl_name_res = requests.get(
        f"{BASE_URL}/api/v1/tickets/{test_ticket_id}/attachments/{att_name}/download",
        headers={"Authorization": f"Bearer {tl_token}"}
    )
    print(f"   Download by Filename status: {dl_name_res.status_code}")
    assert dl_name_res.status_code == 200
    assert hashlib.sha256(dl_name_res.content).hexdigest() == sample_sha256
    print("   CONFIRMED: Download by filename matches original SHA-256 hash.")

    # View endpoint
    view_res = requests.get(
        f"{BASE_URL}/api/v1/tickets/{test_ticket_id}/attachments/{att_id}/view",
        headers={"Authorization": f"Bearer {tl_token}"}
    )
    print(f"   View status: {view_res.status_code}, Content-Type: {view_res.headers.get('Content-Type')}")
    assert view_res.status_code == 200
    assert "application/pdf" in view_res.headers.get("Content-Type", "")
    assert "inline" in view_res.headers.get("Content-Disposition", "")
    print("   CONFIRMED: View endpoint returns correct inline Content-Disposition and PDF content-type.")

    # 10. Check Database Persistence & Supabase RLS Status
    print("\n10. Checking Supabase Database Persistence & RLS Status...")
    db_att_res = sb.table("ticket_attachments").select("*").eq("ticket_id", test_ticket_id).execute()
    print(f"    Supabase ticket_attachments query returned {len(db_att_res.data or [])} rows.")
    disk_folder = os.path.join("backend", "uploads", "attachments", test_ticket_id)
    print(f"    Local disk folder exists: {os.path.exists(disk_folder)}")
    if os.path.exists(disk_folder):
        files_on_disk = os.listdir(disk_folder)
        print(f"    Files on disk: {files_on_disk}")

    # 11. Cleanup test ticket
    print("\n11. Cleaning up test ticket...")
    sb.table("tickets").delete().eq("id", test_ticket_id).execute()
    import shutil
    if os.path.exists(disk_folder):
        shutil.rmtree(disk_folder, ignore_errors=True)
    print("    Cleanup complete.")

    print("\n=== ALL E2E ATTACHMENT FLOW VERIFICATION CHECKS PASSED SUCCESSFULLY ===")

if __name__ == "__main__":
    main()
