/**
 * Globe math with plain {x, y, z} objects, so the phone globe can use it
 * without pulling three.js into the bundle.
 */
import type { TravelStop } from "@/lib/frames";

export type Vec3 = { x: number; y: number; z: number };

export type GlobeDrive = {
  /** 0 → 1: the globe fading in. */
  intro: number;
  /** 0 → stops − 1: how far along the route the arcs have drawn. */
  progress: number;
  /** 0 → 1: slides the globe sideways to make room for the readout. */
  shift: number;
  /** 0 → 1: zooms in on a place with several cities close together. */
  zoom: number;
};

export type GlobeProps = {
  stops: TravelStop[];
  /** Index of the stop to face, or −1 to idle-spin. */
  active: number;
  drive: React.RefObject<GlobeDrive>;
  lite: boolean;
  running: boolean;
  onPick: (index: number) => void;
};

const D2R = Math.PI / 180;

/**
 * Lat/lng → point on a sphere. Longitude −90° faces the camera (+z) at zero
 * rotation and east runs to the right, so the globe reads north-up.
 */
export function latLngToVec3(lat: number, lng: number, radius = 1): Vec3 {
  const phi = (90 - lat) * D2R;
  const theta = (lng + 180) * D2R;
  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

/**
 * The globe rotation (Euler XYZ) that puts a lat/lng dead centre, north up.
 * First spin around Y to bring the point onto the YZ plane, then tilt
 * around X by the latitude to bring it level with the camera.
 */
export function rotationToFace(lat: number, lng: number): { x: number; y: number } {
  const p = latLngToVec3(lat, lng);
  return { x: lat * D2R, y: Math.atan2(-p.x, p.z) };
}

/** Shortest signed difference between two angles, in radians. */
export function angleDelta(from: number, to: number) {
  const d = (to - from) % (Math.PI * 2);
  return d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d;
}

/** Points along a lifted great-circle arc between two lat/lngs. */
export function arcPoints(a: { lat: number; lng: number }, b: { lat: number; lng: number }, segments = 64): Vec3[] {
  const va = latLngToVec3(a.lat, a.lng);
  const vb = latLngToVec3(b.lat, b.lng);
  const dot = Math.min(Math.max(va.x * vb.x + va.y * vb.y + va.z * vb.z, -1), 1);
  const angle = Math.acos(dot);
  const lift = Math.min(Math.max(angle * 0.09, 0.01), 0.11);
  const sinA = Math.sin(angle);
  const points: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Spherical interpolation; plain lerp for near-identical points.
    const wa = sinA < 1e-6 ? 1 - t : Math.sin((1 - t) * angle) / sinA;
    const wb = sinA < 1e-6 ? t : Math.sin(t * angle) / sinA;
    const x = va.x * wa + vb.x * wb;
    const y = va.y * wa + vb.y * wb;
    const z = va.z * wa + vb.z * wb;
    const r = (1.004 + lift * Math.sin(Math.PI * t)) / Math.hypot(x, y, z);
    points.push({ x: x * r, y: y * r, z: z * r });
  }
  return points;
}
