# STOP.ma — verification record

## Existing resources

- Workspace: `C:\STOP-MA`
- Repository: https://github.com/stopma/stopma
- Supabase project: `qxtqqbdfarbskvyvgjqr` (stop-ma, eu-west-1)
- Owner admin: one confirmed Supabase Auth user, UUID configured locally in `ADMIN_USER_ID`.
- Launch remains closed (`SITE_LAUNCH_READY=false` in `.env.local`).
- Custom domains are intentionally excluded from the current deployment task.

## Verified

- Next.js production build and TypeScript checks passed.
- Content validation and PostgreSQL tests passed, including concurrent vote uniqueness, RLS, presence expiration and rate limiting.
- HTTP smoke checks passed: public routes, legal pages, 404 status, CSRF rejection and unavailable-service response.
- Live Supabase integration passed; disposable test data was removed.
- Live admin HTTP verification passed using an owner-authorized temporary session: confirmed owner identity, Pending dashboard, Edit, Approve, Reject, published/hidden detail visibility, and unauthenticated access rejection. Only the test session was signed out afterward; the owner's password was not read or changed and no email was sent.
- Live local HTTP verification passed: submission stored as pending, pending details return 404, published details return 200, voting increments once, repeated voting is rejected without increment, presence records a real browser identifier, phone-number content is rejected. Disposable test post and visitor were removed.

## Pending before completion

- Vercel CLI login confirmation, project linking to the existing GitHub repository, environment upload and production deployment.
- Verify the deployed URL and its real Supabase integration, including the owner login flow.
- Repeat final mobile/desktop browser verification on the deployed site. Browser-control tools currently fail during Windows sandbox startup; do not claim final deployed browser QA passed.
- Confirm the hosted cleanup Cron schedule. `supabase/cron.sql` defines the intended schedule, but its successful creation has not yet been observed.
- Keep the public launch closed until the requested verification is complete and the previously deferred privacy/legal setup is resolved.

## Test commands

```sh
npm test
npm run typecheck
npm run build
node tests/http-smoke.mjs
node --env-file=.env.local tests/supabase-live.mjs
node --env-file=.env.local tests/admin-live.mjs
node --env-file=.env.local tests/http-live.mjs
```

The smoke script expects an unconfigured build. The admin script requires explicit owner authorization to create a temporary sign-in session; it logs no credentials. The public live HTTP script targets a temporary localhost:3001 test server with public features enabled for the test process only; it does not alter the saved launch flag or enable production submissions.
