-- Ensure required PostGIS extensions exist
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;

-- Ensure required schemas exist in spatialdb
CREATE SCHEMA IF NOT EXISTS routing;

-- Set search path for convenience
ALTER DATABASE spatialdb SET search_path TO "$user", public, routing;

-- Verify PostGIS installation
DO $$
BEGIN
    RAISE NOTICE 'PostGIS Version: %', PostGIS_Full_Version();
END $$;