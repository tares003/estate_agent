-- 0001_postgis.sql — enable the PostGIS extension.
--
-- Property-search radius queries (master spec §F) require spatial types/indexes.
-- Applied on the real PostgreSQL instance (Prisma Migrate / psql). PostGIS is NOT
-- available in pglite, so the RLS isolation test (src/rls.test.ts) does not load
-- this migration — it exercises the tenant-isolation policy pattern on a plain
-- table. The geometry columns + GiST indexes land with the §F property catalogue
-- migration that depends on this extension.

CREATE EXTENSION IF NOT EXISTS postgis;
