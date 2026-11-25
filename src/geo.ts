import { load, save } from './storage';

export type Position = { lat: number; lng: number; accuracy: number };

/** Readings vaguer than this (meters) are neither saved nor used for matching. */
export const MAX_ACCURACY_M = 150;
/** How close a past expense must be for its note to be suggested. */
export const NEARBY_RADIUS_M = 100;
/** Records this close to each other count as the same place (absorbs GPS jitter). */
export const SAME_PLACE_M = 30;

const PREF_KEY = 'geoNotes';
export const geoEnabled = () => load(PREF_KEY) !== 'off';
export const setGeoEnabled = (on: boolean) => save(PREF_KEY, on ? 'on' : 'off');

export function getPosition(): Promise<Position | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        resolve(pos.accuracy <= MAX_ACCURACY_M ? pos : null);
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}

/** Great-circle distance in meters. */
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
