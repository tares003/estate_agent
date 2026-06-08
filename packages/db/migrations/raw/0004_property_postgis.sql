-- 0004_property_postgis.sql — spatial column + GiST index for property radius
-- search (master spec §F / §K.1 "search radius" filter).
--
-- Prisma does not model PostGIS geometry/geography types, so the spatial column
-- is added in raw SQL. `properties.latitude` / `.longitude` (Float, modelled by
-- Prisma) remain the source of truth a human edits; `geog` is a derived
-- geography(Point,4326) column kept in sync by a trigger and used for fast
-- ST_DWithin radius queries through the GiST index.
--
-- Depends on 0001_postgis.sql (CREATE EXTENSION postgis). PostGIS is NOT
-- available in pglite, so the RLS isolation test in src/core-entities.test.ts
-- runs against a plain pglite table and this migration is asserted only
-- structurally there; it is applied for real (and the radius query exercised)
-- against PostgreSQL + PostGIS via Testcontainers in CI.

-- geography(Point,4326) so ST_DWithin distances are in metres on the WGS84
-- spheroid without per-query casts. NULL where coordinates are not yet geocoded.
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS geog geography(Point, 4326);

-- Backfill any rows already carrying coordinates. ST_MakePoint takes
-- (longitude, latitude) — X then Y — so order matters.
UPDATE properties
  SET geog = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
  WHERE longitude IS NOT NULL AND latitude IS NOT NULL AND geog IS NULL;

-- Keep geog in sync with latitude/longitude on every insert/update.
CREATE OR REPLACE FUNCTION properties_sync_geog() RETURNS trigger AS $$
BEGIN
  IF NEW.longitude IS NOT NULL AND NEW.latitude IS NOT NULL THEN
    NEW.geog := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.geog := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS properties_sync_geog_trg ON properties;
CREATE TRIGGER properties_sync_geog_trg
  BEFORE INSERT OR UPDATE OF longitude, latitude ON properties
  FOR EACH ROW EXECUTE FUNCTION properties_sync_geog();

-- GiST spatial index powers ST_DWithin(geog, point, radius_metres) radius search.
CREATE INDEX IF NOT EXISTS properties_geog_gist ON properties USING GIST (geog);
