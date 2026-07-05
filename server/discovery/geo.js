/**
 * Geo helpers for location-based discovery (Roadmap Phase 7).
 * Providers carry lat/lng; clients search "near me". Pure + testable.
 */

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (Number(deg) * Math.PI) / 180;
}

function isValidCoord(p) {
  const lat = Number(p?.lat);
  const lng = Number(p?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** Great-circle distance in km between {lat,lng} points, or null if invalid. */
function haversineKm(a, b) {
  if (!isValidCoord(a) || !isValidCoord(b)) return null;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Is point b within radiusKm of point a? */
function withinRadius(a, b, radiusKm) {
  const d = haversineKm(a, b);
  return d != null && d <= Number(radiusKm);
}

module.exports = { haversineKm, withinRadius, isValidCoord, EARTH_RADIUS_KM };
