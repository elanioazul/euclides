// ST_Simplify works in the units of the geometry's SRID, so routes are simplified in a metric CRS:
// ETRS89 / UTM zone 30N covers Asturias (the ORS graph extent)
export const METRIC_SRID = 25830;
export const SIMPLIFY_TOLERANCE_M = 1;
