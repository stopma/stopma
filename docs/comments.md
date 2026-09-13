# Moderated comments

Comments appear only on individual STOP pages. All submissions start pending; the public reader uses the anonymous Supabase key and RLS to expose only approved comments on published STOPs. The counter includes approved comments only.

The form stores the pseudo in localStorage. A separate signed HttpOnly/SameSite cookie maintains the device's commenter UUID; its short label displays 12 hexadecimal characters. It is a device pseudonym, not proof of a person's identity. Clearing cookies creates a new identity.

Submission is restricted to `/api/comments`: direct anonymous/authenticated database inserts were revoked in migration `202609130002_comment_submission_gateway.sql`. The API normalizes text, removes invisible controls, checks the 300-character content/40-character name limits, blocks links, common email/phone patterns (including Arabic digits), common slurs and threats, and a honeypot. Client-supplied status/identity are ignored. Screening is necessarily incomplete; manual approval remains mandatory.

Rate limiting is 20 submissions per trusted Vercel IP/hour and 5 attempts per signed device/hour. Database safeguards also limit 5 comments per commenter/hour and 30 per STOP/hour, with transaction locks and a unique normalized-text index to prevent duplicates even with a changed name/code. Raw IPs are not stored; the rate-limit key is HMAC-derived.

Admin has pending/approved/rejected tabs, associated STOP, pseudo/code/date, approval, rejection, edit, and confirmed deletion. The moderation API checks the configured admin, CSRF origin, a rate limit and the stored `updated_at`; writes use the admin session JWT and RLS. Reject/Delete remain possible even if old text would fail the new screening.

For a fresh database, apply the initial migration, then the two comment migrations in order. Set the sole administrator in `stop_private.comment_admins` to the same existing account as `ADMIN_USER_ID` (the first comment migration contains STOP.ma's existing UUID). Both comment migrations have already been applied to the current Supabase project; do not reapply the table-creation migration.

Tests:
- `node node_modules/tsx/dist/cli.mjs --test tests/comment-safety.test.ts tests/comments.test.ts`
- `node --env-file=.env.local tests/comments-browser-live.mjs`
- `node --env-file=.env.local tests/comment-moderation-browser.mjs`

Browser scripts default to a local production build on port 3004. Set `TEST_BASE_URL=https://stop.ma` explicitly to test production instead. They create only tagged disposable comments and remove them. The moderation test requires owner authorization for a temporary admin session and signs out only that session. Browser analytics are excluded from test traffic.
