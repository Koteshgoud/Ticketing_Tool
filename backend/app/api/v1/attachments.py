"""Ticket attachments API endpoints supporting file uploads, downloads, and previews."""

import json
import mimetypes
import re
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import unquote

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse

from app.auth.dependencies import authorize_ticket_access, get_current_user
from app.db.supabase import get_supabase_admin_client, get_supabase_client, has_service_role_key

router = APIRouter(prefix="/tickets/{ticket_id}/attachments", tags=["Attachments"])

# Storage directory for attachments
UPLOAD_BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads" / "attachments"
UPLOAD_BASE_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {
    ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg",
    ".txt", ".csv", ".log", ".json", ".xml", ".md",
    ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".zip", ".rar", ".7z", ".tar", ".gz",
}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB
METADATA_FILE = "_metadata.json"


def _validate_ticket_id(ticket_id: str) -> str:
    """Reject path traversal attempts in the ticket id path segment."""
    clean = (ticket_id or "").strip()
    if (
        not clean
        or clean in (".", "..")
        or ".." in clean
        or "/" in clean
        or "\\" in clean
        or "\x00" in clean
    ):
        raise HTTPException(status_code=400, detail="Invalid ticket id.")
    return clean


def require_ticket_access(
    ticket_id: str,
    payload: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Authentication + server-side authorization dependency for ticket-scoped routes.

    - 401 when the request has no valid token (handled by get_current_user).
    - 404 when the ticket does not exist.
    - 403 when the authenticated user is not permitted to access the ticket.
    """
    ticket_id = _validate_ticket_id(ticket_id)
    sb = get_supabase_client()
    res = sb.table("tickets").select("*").eq("id", ticket_id).limit(1).execute()
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket = rows[0]
    if not authorize_ticket_access(payload, ticket):
        raise HTTPException(status_code=403, detail="You do not have access to this ticket")
    return ticket


def _content_matches_extension(suffix: str, content: bytes) -> bool:
    """Light magic-byte validation so an allowed extension can't smuggle another type."""
    if suffix in (".jpg", ".jpeg"):
        return content[:3] == b"\xff\xd8\xff"
    if suffix == ".png":
        return content[:8] == b"\x89PNG\r\n\x1a\n"
    if suffix == ".gif":
        return content[:6] in (b"GIF87a", b"GIF89a")
    if suffix == ".bmp":
        return content[:2] == b"BM"
    if suffix == ".webp":
        return content[:4] == b"RIFF" and content[8:12] == b"WEBP"
    if suffix == ".pdf":
        return content[:5] == b"%PDF-"
    if suffix in (".zip", ".docx", ".xlsx", ".pptx"):
        return content[:2] == b"PK"
    # Text-like and other archive formats: no signature enforced.
    return True


def format_size(size_bytes: int) -> str:
    """Format bytes to human-readable size string."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{round(size_bytes / 1024, 1)} KB"
    else:
        return f"{round(size_bytes / (1024 * 1024), 2)} MB"


def _ticket_folder(ticket_id: str) -> Path:
    folder = UPLOAD_BASE_DIR / _validate_ticket_id(ticket_id)
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _split_stored_name(stored: str) -> tuple[str, str]:
    """Return (att_id, original_name) from a stored filename."""
    if "__" in stored:
        att_id, name = stored.split("__", 1)
        return att_id, name
    # Legacy convention: "<att_id>_<original_name>"
    if "_" in stored:
        att_id, name = stored.split("_", 1)
        return att_id, name
    return stored, stored


def _safe_stored_filename(original_name: str) -> str:
    """Strip path components and characters that are invalid on Windows."""
    name = (original_name or "attachment").replace("\\", "/").split("/")[-1]
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name).strip() or "attachment"
    return name


def _metadata_path(folder: Path) -> Path:
    return folder / METADATA_FILE


def _load_metadata(ticket_id: str) -> dict[str, dict[str, Any]]:
    """Load the sidecar metadata index, keyed by attachment id.

    The index is written even when Supabase ``ticket_attachments`` is protected
    by RLS and the insert is rejected, so uploader/type/original name metadata
    is never silently lost.
    """
    folder = _ticket_folder(ticket_id)
    path = _metadata_path(folder)
    if not path.exists():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover - defensive
        print(f"[attachments] metadata index unreadable for {ticket_id}: {exc}")
        return {}
    if not isinstance(raw, list):
        return {}
    index: dict[str, dict[str, Any]] = {}
    for item in raw:
        if isinstance(item, dict) and item.get("id"):
            index[str(item["id"])] = item
    return index


def _save_metadata(ticket_id: str, index: dict[str, dict[str, Any]]) -> None:
    folder = _ticket_folder(ticket_id)
    path = _metadata_path(folder)
    tmp = path.with_suffix(".json.tmp")
    try:
        tmp.write_text(
            json.dumps(list(index.values()), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        tmp.replace(path)
    except Exception as exc:  # pragma: no cover - defensive
        print(f"[attachments] could not write metadata index for {ticket_id}: {exc}")
        try:
            tmp.unlink(missing_ok=True)
        except Exception:
            pass


def _record_for_file(
    ticket_id: str,
    file_path: Path,
    base_url: str,
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    att_id, original_name = _split_stored_name(file_path.name)
    meta = meta or {}
    size_bytes = file_path.stat().st_size
    mime_type = (
        meta.get("mime_type")
        or mimetypes.guess_type(original_name)[0]
        or "application/octet-stream"
    )
    return {
        "id": att_id,
        "ticket_id": ticket_id,
        "name": meta.get("name") or original_name,
        "stored_name": file_path.name,
        "size": format_size(size_bytes),
        "size_bytes": size_bytes,
        "mime_type": mime_type,
        "type": mime_type,
        "url": f"{base_url}/api/v1/tickets/{ticket_id}/attachments/{att_id}/download",
        "download_url": f"{base_url}/api/v1/tickets/{ticket_id}/attachments/{att_id}/download",
        "view_url": f"{base_url}/api/v1/tickets/{ticket_id}/attachments/{att_id}/view",
        "uploaded_by": meta.get("uploaded_by") or "",
        "uploaded_by_id": meta.get("uploaded_by_id") or "",
        "created_at": meta.get("created_at")
        or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(file_path.stat().st_mtime)),
    }


def _disk_records(ticket_id: str, base_url: str) -> list[dict[str, Any]]:
    clean = _validate_ticket_id(ticket_id)
    folder = UPLOAD_BASE_DIR / clean
    if not folder.is_dir():
        return []
    metadata = _load_metadata(clean)
    records: list[dict[str, Any]] = []
    for f in sorted(folder.iterdir()):
        if not f.is_file() or f.name == METADATA_FILE or f.name.startswith("."):
            continue
        att_id, _ = _split_stored_name(f.name)
        records.append(_record_for_file(clean, f, base_url, metadata.get(att_id)))
    return records


def _base_url(request: Request | None) -> str:
    if request is not None:
        return str(request.base_url).rstrip("/")
    return "http://localhost:8000"


def _db_attachments(ticket_id: str) -> list[dict[str, Any]]:
    try:
        sb = get_supabase_admin_client()
        res = (
            sb.table("ticket_attachments")
            .select("*")
            .eq("ticket_id", ticket_id)
            .order("created_at", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as exc:  # pragma: no cover - defensive
        print(f"[attachments] metadata lookup failed for {ticket_id}: {exc}")
        return []


@router.get("", summary="List attachments for a ticket")
@router.get("/", include_in_schema=False)
def list_attachments(
    ticket_id: str,
    request: Request,
    _ticket: dict[str, Any] = Depends(require_ticket_access),
) -> list[dict[str, Any]]:
    """Return attachments for a ticket, merging DB metadata with on-disk files.

    Files on disk take precedence for name/size so nothing that was uploaded is
    ever hidden, even if the metadata row could not be written.
    """
    base = _base_url(request)
    merged: dict[str, dict[str, Any]] = {}

    for row in _db_attachments(ticket_id):
        att_id = str(row.get("id") or row.get("name") or "")
        if not att_id:
            continue
        merged[att_id] = {
            "id": row.get("id") or att_id,
            "ticket_id": ticket_id,
            "name": row.get("name") or att_id,
            "size": row.get("size") or "N/A",
            "size_bytes": row.get("size_bytes"),
            "mime_type": row.get("mime_type") or row.get("type"),
            "type": row.get("mime_type") or row.get("type"),
            "url": row.get("url")
            or f"{base}/api/v1/tickets/{ticket_id}/attachments/{att_id}/download",
            "download_url": row.get("url")
            or f"{base}/api/v1/tickets/{ticket_id}/attachments/{att_id}/download",
            "view_url": f"{base}/api/v1/tickets/{ticket_id}/attachments/{att_id}/view",
            "uploaded_by": row.get("uploaded_by"),
            "uploaded_by_id": row.get("uploaded_by_id"),
            "created_at": row.get("created_at"),
        }

    for rec in _disk_records(ticket_id, base):
        # Disk metadata is authoritative for files that exist.
        existing = merged.get(rec["id"])
        if existing:
            existing.update(rec)
        else:
            merged[rec["id"]] = rec

    return list(merged.values())


@router.post("", status_code=status.HTTP_201_CREATED, summary="Upload attachment(s) for a ticket")
@router.post("/", include_in_schema=False, status_code=status.HTTP_201_CREATED)
async def upload_attachments(
    ticket_id: str,
    request: Request,
    files: list[UploadFile] = File(...),
    current_user: dict[str, Any] = Depends(get_current_user),
    _ticket: dict[str, Any] = Depends(require_ticket_access),
) -> list[dict[str, Any]]:
    """
    Upload one or more files for a ticket:
    - Validates extension and size
    - Saves the file to local backend storage (always)
    - Stores metadata in the local sidecar index and in Supabase when permitted
    - Returns the list of created attachment records
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files were provided.")

    base = _base_url(request)
    ticket_folder = _ticket_folder(ticket_id)
    sb = get_supabase_admin_client()
    uploader_name = (current_user.get("name") or "").strip()
    uploader_email = (current_user.get("email") or "").strip()

    # Validate every file before writing anything, so a bad file cannot leave a
    # partially-uploaded batch behind.
    prepared: list[tuple[str, str, bytes]] = []
    for idx, upload in enumerate(files):
        original_name = _safe_stored_filename(
            upload.filename or f"attachment_{idx + 1}.bin"
        )
        suffix = Path(original_name).suffix.lower()

        if suffix and suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported file type '{suffix}' for '{original_name}'.",
            )

        content = await upload.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail=f"'{original_name}' is empty.")
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"'{original_name}' exceeds the {format_size(MAX_FILE_SIZE)} limit.",
            )
        if not _content_matches_extension(suffix, content):
            raise HTTPException(
                status_code=415,
                detail=f"'{original_name}' content does not match its file type.",
            )
        prepared.append((original_name, upload.content_type or "", content))

    # Check for duplicate files against existing attachments on this ticket
    existing_records = _disk_records(ticket_id, base)
    existing_set = {
        (str(r.get("name") or "").strip().lower(), r.get("size_bytes"))
        for r in existing_records
    }
    batch_set: set[tuple[str, int]] = set()

    for original_name, _, content in prepared:
        key = (original_name.strip().lower(), len(content))
        if key in existing_set:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"File '{original_name}' is already attached to this ticket.",
            )
        if key in batch_set:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Duplicate file '{original_name}' included in the upload batch.",
            )
        batch_set.add(key)

    index = _load_metadata(ticket_id)
    results: list[dict[str, Any]] = []

    for idx, (original_name, client_mime, content) in enumerate(prepared):
        att_id = f"att-{int(time.time() * 1000)}-{idx}-{uuid.uuid4().hex[:6]}"
        stored_name = f"{att_id}__{original_name}"
        file_path = ticket_folder / stored_name
        with open(file_path, "wb") as f:
            f.write(content)

        mime_type = (
            client_mime
            or mimetypes.guess_type(original_name)[0]
            or "application/octet-stream"
        )
        created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        record = {
            "id": att_id,
            "ticket_id": ticket_id,
            "name": original_name,
            "stored_name": stored_name,
            "size": format_size(len(content)),
            "size_bytes": len(content),
            "mime_type": mime_type,
            "type": mime_type,
            "url": f"{base}/api/v1/tickets/{ticket_id}/attachments/{att_id}/download",
            "download_url": f"{base}/api/v1/tickets/{ticket_id}/attachments/{att_id}/download",
            "view_url": f"{base}/api/v1/tickets/{ticket_id}/attachments/{att_id}/view",
            "uploaded_by": uploader_name or uploader_email,
            "uploaded_by_id": str(current_user.get("sub") or ""),
            "created_at": created_at,
        }

        # Sidecar metadata is the durable fallback when RLS rejects DB inserts.
        index[att_id] = record
        _save_metadata(ticket_id, index)

        try:
            insert_res = (
                sb.table("ticket_attachments")
                .insert(
                    {
                        "id": att_id,
                        "ticket_id": ticket_id,
                        "name": original_name,
                        "size": record["size"],
                        "url": record["url"],
                        "created_at": created_at,
                    }
                )
                .execute()
            )
            if insert_res.data:
                record["metadata_persisted"] = True
            else:
                record["metadata_persisted"] = False
        except Exception as exc:
            record["metadata_persisted"] = False
            level = "warning" if not has_service_role_key() else "error"
            print(
                f"[attachments] {level}: metadata insert failed for {att_id} "
                f"(ticket {ticket_id}): {exc}. Metadata saved to {METADATA_FILE}; "
                "set SUPABASE_SERVICE_ROLE_KEY to persist it in Supabase."
            )

        results.append(record)

    return results


def _find_file(ticket_id: str, att_id: str) -> Path | None:
    """Locate a stored file by attachment id (or filename)."""
    folder = _ticket_folder(ticket_id)
    if not folder.exists():
        return None

    raw_clean = unquote(att_id or "").strip()
    # Strip optional trailing human size such as " (23.2 KB)" or " (1 MB)"
    clean_id = re.sub(r"\s*\([^)]*\)$", "", raw_clean).strip()
    norm_clean = re.sub(r"[\s_]+", "_", clean_id.lower())

    for f in folder.iterdir():
        if not f.is_file() or f.name == METADATA_FILE or f.name.startswith("."):
            continue
        stored_id, original_name = _split_stored_name(f.name)
        norm_orig = re.sub(r"[\s_]+", "_", original_name.lower())
        norm_stored = re.sub(r"[\s_]+", "_", stored_id.lower())

        if (
            f.name == raw_clean
            or f.name == clean_id
            or stored_id == clean_id
            or original_name == clean_id
            or norm_orig == norm_clean
            or norm_stored == norm_clean
            or original_name.replace("_", " ").lower() == clean_id.replace("_", " ").lower()
        ):
            return f
    return None


@router.get("/{att_id}/download", summary="Download ticket attachment")
def download_attachment(
    ticket_id: str,
    att_id: str,
    _ticket: dict[str, Any] = Depends(require_ticket_access),
):
    """Download an attachment file by its ID or filename."""
    match = _find_file(ticket_id, att_id)
    if match is not None:
        media_type, _ = mimetypes.guess_type(str(match))
        _, original_name = _split_stored_name(match.name)
        return FileResponse(
            path=str(match),
            filename=original_name,
            media_type=media_type or "application/octet-stream",
        )
    raise HTTPException(status_code=404, detail="Attachment not found.")


@router.get("/{att_id}/view", summary="Preview/View ticket attachment inline")
def view_attachment(
    ticket_id: str,
    att_id: str,
    _ticket: dict[str, Any] = Depends(require_ticket_access),
):
    """View an attachment inline (images, PDFs, text) when the file exists."""
    match = _find_file(ticket_id, att_id)
    if match is not None:
        media_type, _ = mimetypes.guess_type(str(match))
        _, original_name = _split_stored_name(match.name)
        return FileResponse(
            path=str(match),
            media_type=media_type or "application/octet-stream",
            headers={"Content-Disposition": f'inline; filename="{original_name}"'},
        )
    raise HTTPException(status_code=404, detail="Attachment not found.")
