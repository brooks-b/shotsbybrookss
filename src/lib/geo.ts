/**
 * One decimal place of latitude is ~11 km: enough to say "Tokyo", never
 * enough to find a house. Every coordinate that reaches the manifest
 * goes through here.
 */
export const CITY_PRECISION = 1;

export function roundCoord(value: number, decimals = CITY_PRECISION): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function toCityLevel(point: { lat: number; lng: number }) {
  return { lat: roundCoord(point.lat), lng: roundCoord(point.lng) };
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
