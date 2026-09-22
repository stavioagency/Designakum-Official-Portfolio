-- Row-level security on every table, and nothing granted to Supabase's public
-- roles.
--
-- Supabase exposes the `public` schema over a REST API to two roles, `anon` and
-- `authenticated`, and by default grants them full access to every table in it.
-- This app never uses that API: it talks to Postgres directly, server side, as
-- the `postgres` role, which owns the tables and bypasses RLS. So the API was a
-- door nobody used and nobody had locked. Anyone holding the project's anon key
-- could read, edit and delete every row of every table, `users` included.
--
-- RLS with no policies means those roles see nothing; the revoke removes their
-- table privileges as well, so the door stays shut even if RLS were ever turned
-- off on one table. The app's own connection is unaffected by either.
--
-- The roles only exist on Supabase, so the revoke is skipped anywhere else.
do $$
declare t record;
declare supabase boolean := exists (select 1 from pg_roles where rolname = 'anon')
                        and exists (select 1 from pg_roles where rolname = 'authenticated');
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    if supabase then
      execute format('revoke all on table public.%I from anon, authenticated', t.tablename);
    end if;
  end loop;
end $$;
