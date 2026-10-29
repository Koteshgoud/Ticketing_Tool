"""Password hashing helpers.

Existing rows in the Supabase ``users`` table store plaintext passwords (a
legacy of the client-side login implementation). New/changed passwords are
stored as PBKDF2-SHA256 digests:

    pbkdf2_sha256$<iterations>$<salt_hex>$<digest_hex>

:func:`verify_password` transparently accepts a legacy plaintext value so
existing accounts keep working; the login endpoint upgrades such rows to a
hash on the next successful sign-in.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets

_ALGORITHM = "pbkdf2_sha256"
_ITERATIONS = 240_000


def hash_password(password: str) -> str:
    if not password:
        raise ValueError("Password must not be empty")
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("ascii"), _ITERATIONS
    ).hex()
    return f"{_ALGORITHM}${_ITERATIONS}${salt}${digest}"


def is_hashed(value: str | None) -> bool:
    return bool(value) and str(value).startswith(f"{_ALGORITHM}$")


def verify_password(stored: str | None, provided: str | None) -> bool:
    """Validate a password against a hashed or legacy plaintext value."""
    if not stored or provided is None:
        return False
    stored = str(stored)
    if is_hashed(stored):
        try:
            _, iterations, salt, digest = stored.split("$", 3)
            computed = hashlib.pbkdf2_hmac(
                "sha256",
                provided.encode("utf-8"),
                salt.encode("ascii"),
                int(iterations),
            ).hex()
            return hmac.compare_digest(computed, digest)
        except (ValueError, TypeError):
            return False
    # Legacy plaintext comparison (constant-time to avoid trivial timing leaks).
    return hmac.compare_digest(stored, provided)
