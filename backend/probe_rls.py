"""Controlled RLS write-probe with immediate cleanup. Uses isolated zz-probe-* rows only."""

from app.db.supabase import get_supabase_client

PROBE_TICKET = "zz-probe-rls-ticket"


def try_insert_delete(sb, table: str, row: dict, cleanup_filter: tuple) -> None:
    try:
        sb.table(table).insert(row).execute()
        print(f"  {table}: INSERT OK (anon allowed)")
    except Exception as e:
        msg = str(e)
        code = ""
        if "42501" in msg:
            code = " [42501 RLS BLOCKED]"
        print(f"  {table}: INSERT FAILED{code} -> {msg[:180]}")
        return
    try:
        sb.table(table).delete().eq(*cleanup_filter).execute()
        print(f"  {table}: cleanup DELETE OK")
    except Exception as e:
        print(f"  {table}: cleanup FAILED -> {str(e)[:180]}")


def main() -> None:
    sb = get_supabase_client()

    # 1. Does the `notifications` table (unused by app) have usable columns?
    print("--- notifications table (unused) ---")
    try:
        res = sb.table("notifications").select("*").limit(3).execute()
        rows = res.data or []
        print("  rows:", len(rows), "columns:", sorted(rows[0].keys()) if rows else "(empty - no column info)")
    except Exception as e:
        print("  ERROR:", str(e)[:200])

    # 2. users.team / designation values (team-lead -> team mapping)
    print("--- users team/designation ---")
    try:
        res = sb.table("users").select("id, name, role, department, team, designation").execute()
        for u in res.data or []:
            print("  ", u)
    except Exception as e:
        print("  ERROR:", str(e)[:200])

    # 3. RLS write tests (immediate cleanup, isolated ids)
    print("--- RLS write probes (anon key) ---")
    try_insert_delete(sb, "ticket_attachments",
                      {"id": "zz-probe-att", "ticket_id": PROBE_TICKET, "name": "probe.txt",
                       "size": 4, "url": "", "created_at": "2026-10-21T00:00:00+00:00"},
                      ("id", "zz-probe-att"))
    try_insert_delete(sb, "ticket_activities",
                      {"id": "zz-probe-act", "ticket_id": PROBE_TICKET, "user": "probe",
                       "action": "probe", "timestamp": "2026-10-21T00:00:00+00:00"},
                      ("id", "zz-probe-act"))
    try_insert_delete(sb, "portal_notifications",
                      {"id": "zz-probe-notif", "ticket_id": None, "title": "probe",
                       "message": "probe", "type": "info", "for_role": "admin",
                       "read": False, "timestamp": "2026-10-21T00:00:00+00:00"},
                      ("id", "zz-probe-notif"))

    # 4. Can anon UPDATE portal_notifications read state? (create row -> update -> delete)
    print("--- portal_notifications update probe ---")
    try:
        sb.table("portal_notifications").insert({
            "id": "zz-probe-notif2", "ticket_id": None, "title": "probe", "message": "probe",
            "type": "info", "for_role": "admin", "read": False,
            "timestamp": "2026-10-21T00:00:00+00:00"}).execute()
        sb.table("portal_notifications").update({"read": True}).eq("id", "zz-probe-notif2").execute()
        print("  UPDATE OK (anon allowed)")
        sb.table("portal_notifications").delete().eq("id", "zz-probe-notif2").execute()
        print("  cleanup OK")
    except Exception as e:
        print("  FAILED:", str(e)[:200])
        try:
            sb.table("portal_notifications").delete().eq("id", "zz-probe-notif2").execute()
        except Exception:
            pass

    # 5. leftover attachment rows for zz-probe ticket?
    res = sb.table("ticket_attachments").select("id").eq("ticket_id", PROBE_TICKET).execute()
    print("leftover probe attachment rows:", res.data)


if __name__ == "__main__":
    main()
