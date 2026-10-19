INSERT INTO "Note" ("id", "scope", "prospectId", "authorId", "body", "createdAt", "updatedAt")
SELECT
  'legacy_' || p."id",
  'PROSPECT'::"NoteScope",
  p."id",
  COALESCE(p."ownerId", creator."userId", admin."id"),
  btrim(p."notes"),
  p."createdAt",
  p."createdAt"
FROM "Prospect" p
LEFT JOIN LATERAL (
  SELECT a."userId"
  FROM "AuditLog" a
  WHERE a."resourceType" = 'Prospect'
    AND a."resourceId" = p."id"
    AND a."action" = 'USER_CREATED'
    AND a."userId" IS NOT NULL
  ORDER BY a."createdAt" ASC
  LIMIT 1
) creator ON TRUE
LEFT JOIN LATERAL (
  SELECT u."id"
  FROM "User" u
  WHERE u."role" = 'SUPER_ADMIN'
  ORDER BY u."createdAt" ASC
  LIMIT 1
) admin ON TRUE
WHERE p."notes" IS NOT NULL
  AND btrim(p."notes") <> ''
  AND COALESCE(p."ownerId", creator."userId", admin."id") IS NOT NULL;
