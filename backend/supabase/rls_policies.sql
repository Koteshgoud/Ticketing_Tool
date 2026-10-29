-- ============================================================================
-- Ticketing System - RESTRICTIVE RLS Policies (REQUIRED)
-- ============================================================================
--
-- INSTRUCTIONS:
-- 1) Apply this in Supabase SQL Editor with service_role/owner privileges.
-- 2) RLS remains ENABLED. Anon has NO write/read grants. Writes require service_role.
-- 3) The FastAPI backend uses SUPABASE_SERVICE_ROLE_KEY server-side to perform
--    scoped operations. Direct frontend Supabase calls must NOT rely on anon policies.
--
-- Applying requires a service role key or Dashboard SQL access. Without it,
-- Supabase metadata persistence for ticket_attachments, ticket_activities,
-- escalations remains BLOCKED (as noted in the audit).
-- ============================================================================

-- Enable RLS on all relevant tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies dynamically
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Revoke all from anon and authenticated by default
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

-- USERS: authenticated may read only their own row if auth_user_id is mapped
CREATE POLICY "users_select_own_authenticated" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id IS NOT NULL AND auth_user_id = auth.uid()
  );

CREATE POLICY "users_all_service_role" ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- TICKETS: service_role only
CREATE POLICY "tickets_all_service_role" ON public.tickets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- TICKET_COMMENTS: service_role only
CREATE POLICY "ticket_comments_all_service_role" ON public.ticket_comments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- PORTAL_NOTIFICATIONS: service_role only
CREATE POLICY "portal_notifications_all_service_role" ON public.portal_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- TICKET_ATTACHMENTS: service_role only
CREATE POLICY "ticket_attachments_all_service_role" ON public.ticket_attachments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- TICKET_ACTIVITIES: service_role only
CREATE POLICY "ticket_activities_all_service_role" ON public.ticket_activities
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ESCALATIONS: service_role only
CREATE POLICY "escalations_all_service_role" ON public.escalations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
