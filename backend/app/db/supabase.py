"""Supabase Python Client initialization."""

from functools import lru_cache
from supabase import Client, create_client
from app.config import get_settings

settings = get_settings()

# Row-Level-Security protected tables require a privileged key. When
# SUPABASE_SERVICE_ROLE_KEY is configured we use it; otherwise we fall back to
# the anon/publishable key (writes to protected tables will then be rejected by RLS).
_PROTECTED_TABLES = {"ticket_attachments", "ticket_activities"}


@lru_cache
def get_supabase_client() -> Client:
    """Return a cached singleton Supabase Client using the active API key."""
    key = settings.supabase_anon_key or settings.supabase_publishable_key
    return create_client(settings.supabase_url, key)


@lru_cache
def get_supabase_anon_client() -> Client:
    """Return a cached singleton Supabase Client."""
    key = settings.supabase_publishable_key or settings.supabase_anon_key
    return create_client(settings.supabase_url, key)


@lru_cache
def get_supabase_admin_client() -> Client:
    """Return a client that bypasses RLS when a service role key is available.

    Falls back to the anon/publishable key so the application keeps working in
    environments where the service role key has not been configured yet (the
    attachment endpoints additionally fall back to on-disk storage in that case).
    """
    key = settings.supabase_service_role_key or settings.supabase_anon_key or settings.supabase_publishable_key
    return create_client(settings.supabase_url, key)


def has_service_role_key() -> bool:
    """Whether a privileged service role key is configured."""
    return bool(settings.supabase_service_role_key and settings.supabase_service_role_key.strip())
