-- Run after the first Prisma migration. Runtime DATABASE_URL must use a role
-- without BYPASSRLS; the migration role in DIRECT_URL may remain privileged.
CREATE SCHEMA IF NOT EXISTS app;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'saring_app') THEN
    CREATE ROLE saring_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public, app TO saring_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO saring_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO saring_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO saring_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO saring_app;
GRANT saring_app TO postgres;

CREATE OR REPLACE FUNCTION app.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$ SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app.current_auth_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$ SELECT NULLIF(current_setting('app.current_auth_user_id', true), '')::uuid $$;

ALTER TABLE "UserProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserProfile" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_self ON "UserProfile";
CREATE POLICY user_self ON "UserProfile"
  USING ("authUserId" = COALESCE(app.current_auth_user_id(), auth.uid()));

ALTER TABLE "OrganizationMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationMembership" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS membership_self ON "OrganizationMembership";
CREATE POLICY membership_self ON "OrganizationMembership"
  USING ("userId" IN (
    SELECT id FROM "UserProfile"
    WHERE "authUserId" = COALESCE(app.current_auth_user_id(), auth.uid())
  ));

ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_member ON "Organization";
CREATE POLICY organization_member ON "Organization"
  USING (id = app.current_org_id());

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'TenderPackage', 'Vendor', 'Document', 'SourceRecord',
    'GraphNode', 'GraphEdge', 'AuditEvent', 'UploadIntent', 'AnalysisJob',
    'CanonicalSnapshot'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("organizationId" = app.current_org_id()) WITH CHECK ("organizationId" = app.current_org_id())',
      table_name
    );
  END LOOP;
END $$;

ALTER TABLE "AnalysisProgressEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnalysisProgressEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS progress_event_tenant ON "AnalysisProgressEvent";
CREATE POLICY progress_event_tenant ON "AnalysisProgressEvent"
  USING (EXISTS (
    SELECT 1 FROM "AnalysisJob" job
    WHERE job.id = "AnalysisProgressEvent"."jobId"
      AND job."organizationId" = app.current_org_id()
  ));

ALTER TABLE "EngineResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EngineResult" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS engine_result_tenant ON "EngineResult";
CREATE POLICY engine_result_tenant ON "EngineResult"
  USING (EXISTS (
    SELECT 1 FROM "TenderPackage" package
    WHERE package.id = "EngineResult"."packageId"
      AND package."organizationId" = app.current_org_id()
  ));

ALTER TABLE "CaseAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CaseAccess" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS case_access_tenant ON "CaseAccess";
CREATE POLICY case_access_tenant ON "CaseAccess"
  USING (EXISTS (
    SELECT 1 FROM "TenderPackage" p
    WHERE p.id = "CaseAccess"."packageId" AND p."organizationId" = app.current_org_id()
  ));

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Participation', 'Finding', 'EvidenceBrief', 'ReviewDisposition'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS package_tenant ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY package_tenant ON %I USING (EXISTS (SELECT 1 FROM "TenderPackage" p WHERE p.id = %I."packageId" AND p."organizationId" = app.current_org_id()))',
      table_name,
      table_name
    );
  END LOOP;
END $$;

ALTER TABLE "DocumentPassage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentPassage" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS passage_tenant ON "DocumentPassage";
CREATE POLICY passage_tenant ON "DocumentPassage"
  USING (EXISTS (
    SELECT 1 FROM "Document" d
    WHERE d.id = "DocumentPassage"."documentId" AND d."organizationId" = app.current_org_id()
  ));

-- Audit history is append-only for the runtime role.
REVOKE UPDATE, DELETE ON "AuditEvent" FROM PUBLIC;

-- The secret-key Data API is used only to resolve a trusted callback back to
-- the original tenant context. User-facing records remain inaccessible to
-- anon/authenticated Data API roles.
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT SELECT ON "AnalysisJob" TO service_role;
GRANT SELECT, INSERT, UPDATE ON "Organization", "OrganizationMembership", "UserProfile" TO service_role;
GRANT SELECT ON "OrganizationMembership", "UserProfile" TO authenticated;
