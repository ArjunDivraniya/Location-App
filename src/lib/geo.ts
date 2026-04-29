export type GeoPoint = {
  lat: number;
  lng: number;
};

export type NearbyUser = {
  id: string;
  displayName: string;
  lat: number;
  lng: number;
  updatedAt: string;
  distanceKm: number;
  roomKey: string;
};

const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(start: GeoPoint, end: GeoPoint) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(end.lat - start.lat);
  const deltaLng = toRadians(end.lng - start.lng);
  const lat1 = toRadians(start.lat);
  const lat2 = toRadians(end.lat);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.sin(deltaLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export function withinRadius(users: Array<Omit<NearbyUser, 'distanceKm'>>, center: GeoPoint, radiusKm = 5) {
  return users
    .map((user) => ({
      ...user,
      distanceKm: haversineDistanceKm(center, { lat: user.lat, lng: user.lng }),
    }))
    .filter((user) => user.distanceKm <= radiusKm)
    .sort((left, right) => left.distanceKm - right.distanceKm);
}

export function roomKeyForPoint(point: GeoPoint, radiusKm = 5) {
  const latStep = radiusKm / 111.32;
  const lngStep = radiusKm / (111.32 * Math.max(Math.cos((point.lat * Math.PI) / 180), 0.25));
  const latBucket = Math.round(point.lat / latStep);
  const lngBucket = Math.round(point.lng / lngStep);

  return `room:${latBucket}:${lngBucket}`;
}

export function formatDistance(distanceKm: number) {
  if (distanceKm < 1) {
    return `${Math.max(0.1, Math.round(distanceKm * 10) / 10)} km`;
  }

  return `${distanceKm.toFixed(1)} km`;
}
