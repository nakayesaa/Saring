-- Private, immutable raw-evidence bucket. Apply after Prisma tables exist.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence',
  'evidence',
  false,
  52428800,
  ARRAY['application/pdf', 'application/zip', 'application/json', 'text/csv']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "evidence_select_for_members" ON storage.objects;
CREATE POLICY "evidence_select_for_members"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'evidence'
  AND EXISTS (
    SELECT 1
    FROM public."OrganizationMembership" membership
    JOIN public."UserProfile" profile ON profile.id = membership."userId"
    WHERE profile."authUserId" = auth.uid()
      AND membership."organizationId"::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "evidence_insert_for_contributors" ON storage.objects;
CREATE POLICY "evidence_insert_for_contributors"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'evidence'
  AND EXISTS (
    SELECT 1
    FROM public."OrganizationMembership" membership
    JOIN public."UserProfile" profile ON profile.id = membership."userId"
    WHERE profile."authUserId" = auth.uid()
      AND membership."organizationId"::text = (storage.foldername(name))[1]
      AND membership.role IN ('ADMIN', 'REVIEWER', 'ANALYST')
  )
);

-- Deliberately no UPDATE or DELETE policy. Retention/deletion operations must
-- run through an audited, privileged server workflow.
