-- Public submission goes through /api/comments: signed device identity,
-- trusted IP/device limits, content checks and a forced pending status.
-- Public SELECT and admin RLS policies remain unchanged.
revoke insert (stop_id, content, display_name, commenter_code) on public.comments from anon, authenticated;
