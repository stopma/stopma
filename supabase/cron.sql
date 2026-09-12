-- Apply separately on hosted Supabase after initial migration.
create extension if not exists pg_cron;
select cron.schedule('stop-ma-cleanup','15 3 * * *','select public.cleanup_data();');
