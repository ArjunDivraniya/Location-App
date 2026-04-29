'use client';

import { useEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { GeoPoint, NearbyUser } from '@/lib/geo';
import { formatDistance } from '@/lib/geo';

type LocationMapProps = {
  currentLocation: GeoPoint | null;
  nearbyUsers: NearbyUser[];
  onPickLocation: (location: GeoPoint) => void;
};

function MapClickHandler({ onPickLocation }: { onPickLocation: (location: GeoPoint) => void }) {
  useMapEvents({
    click(event) {
      onPickLocation({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  return null;
}

function MapCenterUpdater({ location }: { location: GeoPoint }) {
  const map = useMap();

  useEffect(() => {
    map.setView([location.lat, location.lng], map.getZoom(), { animate: true });
  }, [location, map]);

  return null;
}

export function LocationMap({ currentLocation, nearbyUsers, onPickLocation }: LocationMapProps) {
  const [leafletLib, setLeafletLib] = useState<typeof import('leaflet') | null>(null);
  const center = currentLocation ?? { lat: 28.6139, lng: 77.209 };

  useEffect(() => {
    let active = true;

    import('leaflet').then((module) => {
      if (!active) return;

      try {
        // Ensure Leaflet CSS is present (client-only). Some environments may not have document.head.
        if (typeof document !== 'undefined') {
          const existing = document.querySelector('link[href*="leaflet.css"]');
          if (!existing) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            // Use official Leaflet CDN so the stylesheet is available at runtime
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

            // Safely find a head element and ensure appendChild exists before calling it
            const head = document.head || (document.getElementsByTagName ? document.getElementsByTagName('head')[0] : null);
            if (head && typeof (head as any).appendChild === 'function') {
              head.appendChild(link);
            } else {
              console.warn('[LocationMap] document.head is not available or appendChild not a function; skipping leaflet.css injection');
            }
          }
        }

        // Try to patch default icon paths in case bundler changed asset locations.
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const L = module as any;
          if (L && L.Icon && L.Icon.Default && typeof L.Icon.Default.mergeOptions === 'function') {
            L.Icon.Default.mergeOptions({
              iconRetinaUrl: (L as any).Icon.Default.imagePath ? (L as any).Icon.Default.imagePath + '/marker-icon-2x.png' : undefined,
              iconUrl: (L as any).Icon.Default.imagePath ? (L as any).Icon.Default.imagePath + '/marker-icon.png' : undefined,
              shadowUrl: (L as any).Icon.Default.imagePath ? (L as any).Icon.Default.imagePath + '/marker-shadow.png' : undefined,
            });
          }
        } catch (e) {
          console.warn('[LocationMap] failed to patch Icon.Default', e);
        }

        setLeafletLib(module);
      } catch (e) {
        console.error('[LocationMap] error loading leaflet', e);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const markers = useMemo(
    () =>
      leafletLib
        ? nearbyUsers.map((user) => {
            const nearbyIcon = leafletLib.divIcon({
              className: 'location-marker location-marker-nearby',
              html: '<span></span>',
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            });

            return (
              <Marker key={user.id} position={[user.lat, user.lng]} icon={nearbyIcon}>
                <Popup>
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-900">{user.displayName}</div>
                    <div className="text-sm text-slate-600">{formatDistance(user.distanceKm)} away</div>
                  </div>
                </Popup>
              </Marker>
            );
          })
        : [],
    [leafletLib, nearbyUsers]
  );

  const currentIcon = useMemo(
    () =>
      leafletLib
        ? leafletLib.divIcon({
            className: 'location-marker location-marker-current',
            html: '<span></span>',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          })
        : null,
    [leafletLib]
  );

  if (!leafletLib || !currentIcon) {
    return (
      <div className="flex h-[560px] items-center justify-center rounded-[28px] border border-white/10 bg-[#07111f] text-sm text-white/60 shadow-glow">
        Loading map...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#07111f] shadow-glow">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-sm text-white/70">
        <span>Tap the map to set or move your location pin</span>
        <span>{nearbyUsers.length} users nearby</span>
      </div>

      <MapContainer center={[center.lat, center.lng]} zoom={12} className="h-[560px] w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onPickLocation={onPickLocation} />
        <MapCenterUpdater location={center} />
        {currentLocation ? (
          <>
            <Marker position={[currentLocation.lat, currentLocation.lng]} icon={currentIcon}>
              <Popup>Your current location</Popup>
            </Marker>
            <Circle center={[currentLocation.lat, currentLocation.lng]} radius={5000} pathOptions={{ color: '#4dd7b0', fillColor: '#4dd7b0', fillOpacity: 0.12 }} />
          </>
        ) : null}
        {markers}
      </MapContainer>
    </div>
  );
}
