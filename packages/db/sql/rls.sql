-- ---------------------------------------------------------------------------
-- Row-level security, grants, and append-only enforcement.
--
-- Applied by `pnpm db:migrate` AFTER the Drizzle migrations, as the owner.
-- Idempotent: safe to re-run on every migrate.
--
-- THE DETAIL THAT MAKES OR BREAKS THIS FILE
-- -----------------------------------------
-- Postgres does not apply RLS policies to a table's owner, and `FORCE ROW
-- LEVEL SECURITY` only closes that hole for the owner itself. Migrations run
-- as the owner; the application runs as `gymx_app`, which owns nothing and is
-- created NOBYPASSRLS by scripts/bootstrap.ts. Without that separation every
-- policy below is decoration.
--
-- Settings the policies read (set per-transaction by packages/db/src/tenant.ts):
--   app.gym_id       the tenant being operated on
--   app.user_id      the authenticated user
--   app.is_platform  'on' when a verified platform admin is acting cross-gym
--
-- `nullif(current_setting(...), '')` is used throughout so an UNSET setting
-- yields NULL, and `column = NULL` is NULL, not true. Every policy fails closed.
-- ---------------------------------------------------------------------------

-- Helper: current tenant as uuid, or NULL when unset.
CREATE OR REPLACE FUNCTION app_current_gym_id() RETURNS uuid
  LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.gym_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
  LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app_is_platform() RETURNS boolean
  LANGUAGE sql STABLE AS
$$ SELECT coalesce(nullif(current_setting('app.is_platform', true), '') = 'on', false) $$;


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO gymx_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gymx_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gymx_app;
GRANT EXECUTE ON FUNCTION app_current_gym_id() TO gymx_app;
GRANT EXECUTE ON FUNCTION app_current_user_id() TO gymx_app;
GRANT EXECUTE ON FUNCTION app_is_platform() TO gymx_app;

-- The migration bookkeeping table is the owner's business, not the app's.
REVOKE ALL ON TABLE drizzle.__drizzle_migrations FROM gymx_app;


-- ---------------------------------------------------------------------------
-- gyms
--   A gym sees itself. A verified platform admin sees all of them. And a user
--   can always see a gym they hold a role in, even with no gym selected.
--
--   That last clause is not a convenience -- it resolves a bootstrap problem.
--   Sign-in has to answer "which gyms do you belong to?" before any gym is
--   active, so it joins user_roles to gyms with app.gym_id unset. Without this
--   clause the join matches no gyms and every user appears to belong to none.
--   The EXISTS is itself filtered by the user_roles policy below, so it cannot
--   be used to enumerate gyms you have no role in.
-- ---------------------------------------------------------------------------
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyms FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gyms_select ON gyms;
CREATE POLICY gyms_select ON gyms FOR SELECT
  USING (
    id = app_current_gym_id()
    OR app_is_platform()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.gym_id = gyms.id
        AND ur.user_id = app_current_user_id()
    )
  );

DROP POLICY IF EXISTS gyms_insert ON gyms;
CREATE POLICY gyms_insert ON gyms FOR INSERT
  WITH CHECK (app_is_platform());

DROP POLICY IF EXISTS gyms_update ON gyms;
CREATE POLICY gyms_update ON gyms FOR UPDATE
  USING (id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (id = app_current_gym_id() OR app_is_platform());

DROP POLICY IF EXISTS gyms_delete ON gyms;
CREATE POLICY gyms_delete ON gyms FOR DELETE
  USING (app_is_platform());


-- ---------------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------------
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS locations_all ON locations;
CREATE POLICY locations_all ON locations FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  -- No `OR app_is_platform()` in WITH CHECK: even a platform admin writes into
  -- the gym they have assumed, never into an arbitrary one.
  WITH CHECK (gym_id = app_current_gym_id());


-- ---------------------------------------------------------------------------
-- users  (global identity, not tenant-scoped)
--   Visible to: yourself, a platform admin, or anyone holding a role in a gym
--   you also hold a role in. The EXISTS clause is itself filtered by the
--   user_roles policy below, so it cannot be used to enumerate other tenants.
-- ---------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users FOR SELECT
  USING (
    app_is_platform()
    OR id = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = users.id
        AND ur.gym_id = app_current_gym_id()
    )
  );

-- Sign-in must find an account by email before any context exists. Restricted
-- to SELECT and only ever reached through withAnonymous(); the row contains an
-- argon2id hash, and every tenant table stays invisible in that context.
DROP POLICY IF EXISTS users_authenticate ON users;
CREATE POLICY users_authenticate ON users FOR SELECT
  USING (app_current_user_id() IS NULL AND app_current_gym_id() IS NULL AND NOT app_is_platform());

DROP POLICY IF EXISTS users_insert ON users;
CREATE POLICY users_insert ON users FOR INSERT
  WITH CHECK (app_is_platform() OR app_current_gym_id() IS NOT NULL);

DROP POLICY IF EXISTS users_update ON users;
CREATE POLICY users_update ON users FOR UPDATE
  USING (
    app_is_platform()
    OR id = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = users.id AND ur.gym_id = app_current_gym_id()
    )
  );

DROP POLICY IF EXISTS users_delete ON users;
CREATE POLICY users_delete ON users FOR DELETE
  USING (app_is_platform());


-- ---------------------------------------------------------------------------
-- platform_admins
--   You may see your own row; platform admins see all. This is what makes
--   withPlatform() safe: it verifies membership with only app.user_id set,
--   before it is allowed to raise the platform flag.
-- ---------------------------------------------------------------------------
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_admins_select ON platform_admins;
CREATE POLICY platform_admins_select ON platform_admins FOR SELECT
  USING (user_id = app_current_user_id() OR app_is_platform());

DROP POLICY IF EXISTS platform_admins_write ON platform_admins;
CREATE POLICY platform_admins_write ON platform_admins FOR ALL
  USING (app_is_platform())
  WITH CHECK (app_is_platform());


-- ---------------------------------------------------------------------------
-- user_roles
--   Readable within the current gym, and always for your own memberships --
--   that second clause is what lets sign-in list the gyms you belong to before
--   a tenant has been chosen. Writes are confined to the current gym.
-- ---------------------------------------------------------------------------
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_select ON user_roles;
CREATE POLICY user_roles_select ON user_roles FOR SELECT
  USING (
    gym_id = app_current_gym_id()
    OR user_id = app_current_user_id()
    OR app_is_platform()
  );

DROP POLICY IF EXISTS user_roles_insert ON user_roles;
CREATE POLICY user_roles_insert ON user_roles FOR INSERT
  WITH CHECK (gym_id = app_current_gym_id());

DROP POLICY IF EXISTS user_roles_update ON user_roles;
CREATE POLICY user_roles_update ON user_roles FOR UPDATE
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());

DROP POLICY IF EXISTS user_roles_delete ON user_roles;
CREATE POLICY user_roles_delete ON user_roles FOR DELETE
  USING (gym_id = app_current_gym_id() OR app_is_platform());


-- ---------------------------------------------------------------------------
-- audit_log  -- APPEND ONLY
--   Insert and select. UPDATE and DELETE are revoked below, so "who changed
--   what" cannot be quietly rewritten by the application that wrote it.
-- ---------------------------------------------------------------------------
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select ON audit_log;
CREATE POLICY audit_log_select ON audit_log FOR SELECT
  USING (gym_id = app_current_gym_id() OR app_is_platform());

DROP POLICY IF EXISTS audit_log_insert ON audit_log;
CREATE POLICY audit_log_insert ON audit_log FOR INSERT
  WITH CHECK (
    gym_id = app_current_gym_id()
    -- A platform admin acting from the console has no tenant context, but the
    -- entry still belongs in the affected gym's trail: a gym owner should be
    -- able to see that Metabox changed their VAT rate. Creating a gym is
    -- recorded with a null gym_id, which the same clause allows.
    OR app_is_platform()
  );


-- ---------------------------------------------------------------------------
-- Append-only enforcement.
--
-- Belt and braces with the policies above: even if a future migration adds a
-- permissive UPDATE policy by accident, the privilege simply is not there.
-- ---------------------------------------------------------------------------
REVOKE UPDATE, DELETE ON TABLE audit_log FROM gymx_app;


-- ---------------------------------------------------------------------------
-- Phase 1 — Members, households, documents, consents, guest passes, imports
--
-- All tenant-scoped tables use the same policy shape:
--   SELECT: own gym or platform admin
--   INSERT/UPDATE/DELETE: only own gym (no platform write to arbitrary gyms)
-- ---------------------------------------------------------------------------

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE members FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS members_all ON members;
CREATE POLICY members_all ON members FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


ALTER TABLE member_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_documents_all ON member_documents;
CREATE POLICY member_documents_all ON member_documents FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE households FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS households_all ON households;
CREATE POLICY households_all ON households FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


-- household_members has no gym_id column; policy uses an EXISTS check against
-- the households table, which is itself already RLS-filtered.
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS household_members_all ON household_members;
CREATE POLICY household_members_all ON household_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM households h
      WHERE h.id = household_members.household_id
        AND (h.gym_id = app_current_gym_id() OR app_is_platform())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM households h
      WHERE h.id = household_members.household_id
        AND h.gym_id = app_current_gym_id()
    )
  );


ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consents_all ON consents;
CREATE POLICY consents_all ON consents FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


ALTER TABLE guest_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_passes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guest_passes_all ON guest_passes;
CREATE POLICY guest_passes_all ON guest_passes FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_jobs_all ON import_jobs;
CREATE POLICY import_jobs_all ON import_jobs FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


ALTER TABLE import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_rows FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_rows_all ON import_rows;
CREATE POLICY import_rows_all ON import_rows FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


-- ---------------------------------------------------------------------------
-- Phase 2 — Plans, price tiers, access rules
-- ---------------------------------------------------------------------------

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plans_all ON plans;
CREATE POLICY plans_all ON plans FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


ALTER TABLE plan_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_price_tiers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_price_tiers_all ON plan_price_tiers;
CREATE POLICY plan_price_tiers_all ON plan_price_tiers FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


ALTER TABLE plan_access_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_access_rules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_access_rules_all ON plan_access_rules;
CREATE POLICY plan_access_rules_all ON plan_access_rules FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


-- ---------------------------------------------------------------------------
-- Phase 3 — Subscriptions, holds, invoices, invoice lines
-- ---------------------------------------------------------------------------

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_all ON subscriptions;
CREATE POLICY subscriptions_all ON subscriptions FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


ALTER TABLE subscription_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_members FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_members_all ON subscription_members;
CREATE POLICY subscription_members_all ON subscription_members FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


ALTER TABLE subscription_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_holds FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_holds_all ON subscription_holds;
CREATE POLICY subscription_holds_all ON subscription_holds FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoices_all ON invoices;
CREATE POLICY invoices_all ON invoices FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_lines_all ON invoice_lines;
CREATE POLICY invoice_lines_all ON invoice_lines FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


-- ---------------------------------------------------------------------------
-- Phase 4 — Payments, till shifts, allocation, credit notes, write-offs
-- ---------------------------------------------------------------------------

ALTER TABLE tills ENABLE ROW LEVEL SECURITY;
ALTER TABLE tills FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tills_all ON tills;
CREATE POLICY tills_all ON tills FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


ALTER TABLE till_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE till_shifts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS till_shifts_all ON till_shifts;
CREATE POLICY till_shifts_all ON till_shifts FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_all ON payments;
CREATE POLICY payments_all ON payments FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_allocations_all ON payment_allocations;
CREATE POLICY payment_allocations_all ON payment_allocations FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credit_notes_all ON credit_notes;
CREATE POLICY credit_notes_all ON credit_notes FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


ALTER TABLE write_offs ENABLE ROW LEVEL SECURITY;
ALTER TABLE write_offs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS write_offs_all ON write_offs;
CREATE POLICY write_offs_all ON write_offs FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


-- Append-only enforcement: payments and credit_notes cannot be updated or deleted.
REVOKE UPDATE, DELETE ON TABLE payments FROM gymx_app;
REVOKE UPDATE, DELETE ON TABLE credit_notes FROM gymx_app;


-- ---------------------------------------------------------------------------
-- Phase 5 — Access control: entry/exit, occupancy
-- ---------------------------------------------------------------------------

ALTER TABLE access_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS access_events_all ON access_events;
CREATE POLICY access_events_all ON access_events FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visits_all ON visits;
CREATE POLICY visits_all ON visits FOR ALL
  USING (gym_id = app_current_gym_id() OR app_is_platform())
  WITH CHECK (gym_id = app_current_gym_id());


-- Append-only enforcement: access_events cannot be updated or deleted.
REVOKE UPDATE, DELETE ON TABLE access_events FROM gymx_app;


-- ---------------------------------------------------------------------------
-- Default privileges, so tables created by later phases' migrations are
-- reachable by the app without editing this file for the grant (the RLS
-- policies for them still have to be written here, deliberately).
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gymx_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO gymx_app;
