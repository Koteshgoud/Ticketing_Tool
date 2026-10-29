"""Tests for Ticket Attachment endpoints (/api/v1/tickets/{ticket_id}/attachments)."""

import shutil
import pytest
from httpx import AsyncClient
from app.api.v1.attachments import UPLOAD_BASE_DIR, require_ticket_access
from app.main import app

TEST_TICKET_ID = "TKT-TEST-PYTEST-01"

@pytest.fixture(autouse=True)
def cleanup_test_folder():
    """Ensure test upload folder is cleaned up before and after test."""
    target_dir = UPLOAD_BASE_DIR / TEST_TICKET_ID
    if target_dir.exists():
        shutil.rmtree(target_dir, ignore_errors=True)
    yield
    if target_dir.exists():
        shutil.rmtree(target_dir, ignore_errors=True)

@pytest.mark.asyncio
async def test_attachments_unauthorized(client: AsyncClient):
    """Unauthenticated access should be rejected with 401."""
    resp = await client.get(f"/api/v1/tickets/{TEST_TICKET_ID}/attachments")
    assert resp.status_code == 401

@pytest.mark.asyncio
async def test_attachment_upload_and_listing(authenticated_client: AsyncClient):
    """Authenticated user can upload attachment, list, download, and view."""
    app.dependency_overrides[require_ticket_access] = lambda: {
        "id": TEST_TICKET_ID,
        "employee_id": "00000000-0000-0000-0000-000000000001",
        "created_by": "00000000-0000-0000-0000-000000000001",
        "status": "Open",
    }
    try:
        file_content = b"Mock test file content for attachment visibility verification."
        files = {"files": ("test_doc.txt", file_content, "text/plain")}

        # Upload
        upload_resp = await authenticated_client.post(
            f"/api/v1/tickets/{TEST_TICKET_ID}/attachments",
            files=files,
        )
        assert upload_resp.status_code == 201
        upload_data = upload_resp.json()
        assert len(upload_data) == 1
        assert upload_data[0]["name"] == "test_doc.txt"
        assert "url" in upload_data[0]
        assert "download_url" in upload_data[0]
        assert "view_url" in upload_data[0]

        # List attachments
        list_resp = await authenticated_client.get(
            f"/api/v1/tickets/{TEST_TICKET_ID}/attachments"
        )
        assert list_resp.status_code == 200
        attachments = list_resp.json()
        assert len(attachments) == 1
        assert attachments[0]["name"] == "test_doc.txt"

        # Download attachment
        dl_resp = await authenticated_client.get(
            f"/api/v1/tickets/{TEST_TICKET_ID}/attachments/test_doc.txt/download"
        )
        assert dl_resp.status_code == 200
        assert dl_resp.content == file_content

        # View attachment
        view_resp = await authenticated_client.get(
            f"/api/v1/tickets/{TEST_TICKET_ID}/attachments/test_doc.txt/view"
        )
        assert view_resp.status_code == 200
        assert view_resp.content == file_content
    finally:
        app.dependency_overrides.pop(require_ticket_access, None)
