"""READ-ONLY live Supabase probe: schema, counts, key rows. No writes."""

from app.db.supabase import get_supabase_client, get_supabase_admin_client, has_service_role_key
from app.config import get_settings

TABLES = [
    "users", "tickets", "ticket_attachments", "ticket_activities",
    "ticket_comments", "escalations", "portal_notifications", "notifications", "clients",
]

def main() -> None:
    s = get_settings()
    print("supabase_url:", s.supabase_url)
    print("service_role_key configured:", has_service_role_key())
    sb = get_supabase_client()
    admin = get_supabase_admin_client()
    print("admin client differs from anon:", admin is not sb)

    for t in TABLES:
        try:
            res = sb.table(t).select("*", count="exact", head=True).execute()
            print(f"  {t}: count={res.count}")
        except Exception as e:
            print(f"  {t}: ERROR {type(e).__name__}: {str(e)[:200]}")

    print("\n--- users (id, name, email, role, department, team_lead, status) ---")
    try:
        res = sb.table("users").select("id, name, email, role, department, team_lead, status, avatar, created_at").order("created_at").execute()
        for u in res.data or []:
            print("   ", {k: u.get(k) for k in ("id", "name", "email", "role", "department", "team_lead", "status")})
    except Exception as e:
        print("ERROR", str(e)[:300])

    print("\n--- tickets sample (first 12 by created_at desc) ---")
    try:
        res = sb.table("tickets").select(
            "id, subject, status, priority, employee, employee_email, employee_id, department, "
            "assigned_agent, assigned_agent_id, assigned_to_type, handled_by, sla_status, sla_remaining, sla_due_at, created_at"
        ).order("created_at", desc=True).limit(12).execute()
        for t in res.data or []:
            print("   ", {k: t.get(k) for k in ("id", "status", "priority", "employee_email", "department", "assigned_agent", "assigned_agent_id", "sla_status", "sla_due_at")})
    except Exception as e:
        print("ERROR", str(e)[:300])

    print("\n--- tickets total fetched ---")
    try:
        res = sb.table("tickets").select("id, status, sla_status, department, assigned_agent_id, employee_email").execute()
        rows = res.data or []
        print("fetched:", len(rows))
        from collections import Counter
        print("status:", Counter((r.get("status") or "").lower() for r in rows))
        print("sla_status:", Counter((r.get("sla_status") or "") for r in rows))
        print("departments:", Counter((r.get("department") or "") for r in rows))
    except Exception as e:
        print("ERROR", str(e)[:300])

    print("\n--- portal_notifications sample (5) ---")
    try:
        res = sb.table("portal_notifications").select("*").order("timestamp", desc=True).limit(5).execute()
        for n in res.data or []:
            print("   ", {k: n.get(k) for k in ("id", "ticket_id", "title", "for_role", "read")})
    except Exception as e:
        print("ERROR", str(e)[:300])

    print("\n--- ticket_attachments rows ---")
    try:
        res = sb.table("ticket_attachments").select("*").execute()
        for a in res.data or []:
            print("   ", a)
    except Exception as e:
        print("ERROR", str(e)[:300])


if __name__ == "__main__":
    main()
