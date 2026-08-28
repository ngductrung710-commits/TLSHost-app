-- ============================================================================
-- Creates the role the application connects as, in development and production.
--
-- Run once per database, as a superuser, before the first migration:
--
--   psql -U postgres -d tlshost -v password="'something-long'" \
--        -f prisma/setup-role.sql
--
-- Why a separate role at all, when the postgres user already works:
-- row-level security does not apply to a table's owner. Connecting the app as
-- the owner leaves every policy in 20260828000100_guarantees silently
-- inactive, so a missing orgId filter would look completely fine locally and
-- leak data the moment it reached a database where the app was not the owner.
--
-- Using the non-owner role in development too means tenant isolation is a
-- thing that either works on your machine or fails on your machine. That is
-- the only way a guarantee like this stays true.
-- ============================================================================

\set app_password :password

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tlshost_app') THEN
    CREATE ROLE tlshost_app LOGIN;
  END IF;
END
$$;

ALTER ROLE tlshost_app WITH PASSWORD :app_password;

-- Read and write rows; no DDL. Migrations run as the owner, the app never
-- alters a table, and a role that cannot DROP cannot be talked into it.
GRANT USAGE ON SCHEMA public TO tlshost_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tlshost_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tlshost_app;

-- Tables created by future migrations need the same grants. Without this, the
-- next migration adds a table the application cannot read, and the failure
-- shows up as an empty page rather than an error anyone can place.
--
-- FOR ROLE names the role that will create those tables — default privileges
-- are recorded per creating role, so this has to match whoever runs migrate.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tlshost_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO tlshost_app;
