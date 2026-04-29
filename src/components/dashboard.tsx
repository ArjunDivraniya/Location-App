'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LocateFixed, LogOut, MapPinned, Users } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import type { ChatMessageRow, LocationRow, ProfileRow } from '@/lib/types';
import type { GeoPoint, NearbyUser } from '@/lib/geo';
import { formatDistance, roomKeyForPoint, withinRadius } from '@/lib/geo';
import { ChatPanel } from '@/components/chat-panel';
import dynamic from 'next/dynamic';

const LocationMap = dynamic(() => import('@/components/location-map').then((module) => module.LocationMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] items-center justify-center rounded-[28px] border border-white/10 bg-[#07111f] text-sm text-white/60 shadow-glow">
      Loading map...
    </div>
  ),
});

export function Dashboard() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [currentLocation, setCurrentLocation] = useState<GeoPoint | null>(null);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileRow>>({});
  const [roomKey, setRoomKey] = useState<string | null>(null);
  const [status, setStatus] = useState('Loading your proximity workspace...');
  const [error, setError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const liveWatchId = useRef<number | null>(null);
  const pendingMessages = useRef<
    Array<{
      tempId: string;
      roomKey: string;
      userId: string;
      body: string;
      createdAt: string;
    }>
  >([]);

  const ensureProfile = useCallback(async (userId: string, displayName: string) => {
    const { data } = await supabase.from('profiles').select('id, display_name, avatar_url').eq('id', userId).maybeSingle();

    if (data) {
      setProfile(data as ProfileRow);
      return;
    }

    const upsertProfile = {
      id: userId,
      display_name: displayName,
      avatar_url: null,
    };
    await supabase.from('profiles').upsert(upsertProfile);
    setProfile(upsertProfile);
  }, [supabase]);

  const refreshWorkspace = useCallback(async (userId: string) => {
    const [profileResult, locationResult, allProfilesResult, allLocationsResult] = await Promise.all([
      supabase.from('profiles').select('id, display_name, avatar_url').eq('id', userId).maybeSingle(),
      supabase.from('user_locations').select('user_id, latitude, longitude, room_key, updated_at').eq('user_id', userId).maybeSingle(),
      supabase.from('profiles').select('id, display_name, avatar_url'),
      supabase.from('user_locations').select('user_id, latitude, longitude, room_key, updated_at'),
    ]);

    if (profileResult.data) {
      setProfile(profileResult.data as ProfileRow);
    }

    const profiles = (allProfilesResult.data ?? []) as ProfileRow[];
    setProfileMap(Object.fromEntries(profiles.map((item) => [item.id, item])));

    const current = locationResult.data as LocationRow | null;
    if (current) {
      const point = { lat: current.latitude, lng: current.longitude };
      setCurrentLocation(point);
      setRoomKey(current.room_key);
      setStatus(`Active room ${current.room_key}`);
    }

    const locations = (allLocationsResult.data ?? []) as LocationRow[];
    if (current) {
      const profileLookup = new Map(profiles.map((item) => [item.id, item.display_name]));
      const nearby = withinRadius(
        locations
          .filter((location) => location.user_id !== userId)
          .map((location) => ({
            id: location.user_id,
            displayName: profileLookup.get(location.user_id) ?? 'Nearby user',
            lat: location.latitude,
            lng: location.longitude,
            updatedAt: location.updated_at,
            roomKey: location.room_key,
          })),
        { lat: current.latitude, lng: current.longitude },
        5
      );

      setNearbyUsers(nearby);
    } else {
      setNearbyUsers([]);
      setRoomKey(null);
      setStatus('Set a location to join a nearby room');
    }
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }

      const user = data.session?.user;
      if (!user) {
        router.replace('/');
        return;
      }

      if (!mounted) {
        return;
      }

      setSessionUserId(user.id);
      await Promise.all([ensureProfile(user.id, user.user_metadata?.display_name ?? user.email ?? 'Nearby user'), refreshWorkspace(user.id)]);
      setLoading(false);
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [ensureProfile, refreshWorkspace, router, supabase]);

  useEffect(() => {
    if (!sessionUserId) {
      return;
    }

    const channel = supabase
      .channel('location-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_locations' }, () => {
        refreshWorkspace(sessionUserId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshWorkspace, sessionUserId, supabase]);

  useEffect(() => {
    if (!roomKey) {
      setMessages([]);
      pendingMessages.current = [];
      return;
    }

    let cancelled = false;
    const channel = supabase
      .channel(`room:${roomKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_messages', filter: `room_key=eq.${roomKey}` }, (payload) => {
        const nextMessage = payload.new as ChatMessageRow;
        setMessages((current) => {
          const pendingMatchIndex = pendingMessages.current.findIndex(
            (pending) =>
              pending.roomKey === nextMessage.room_key &&
              pending.userId === nextMessage.user_id &&
              pending.body === nextMessage.body &&
              Math.abs(new Date(pending.createdAt).getTime() - new Date(nextMessage.created_at).getTime()) < 7000
          );

          if (pendingMatchIndex !== -1) {
            const [pendingMatch] = pendingMessages.current.splice(pendingMatchIndex, 1);
            return [...current.filter((message) => message.id !== pendingMatch.tempId && message.id !== nextMessage.id), nextMessage].sort((left, right) => left.created_at.localeCompare(right.created_at));
          }

          if (current.some((message) => message.id === nextMessage.id)) {
            return current;
          }

          return [...current, nextMessage].sort((left, right) => left.created_at.localeCompare(right.created_at));
        });
      })
      .subscribe();

    async function loadMessages() {
      const { data } = await supabase
        .from('room_messages')
        .select('id, room_key, user_id, body, created_at')
        .eq('room_key', roomKey)
        .order('created_at', { ascending: true });

      if (!cancelled) {
        setMessages((data ?? []) as ChatMessageRow[]);
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomKey, supabase]);

  async function persistLocation(point: GeoPoint, notify = true) {
    if (!sessionUserId) {
      return;
    }

    const nextRoomKey = roomKeyForPoint(point, 5);
    const upsertPayload = {
      user_id: sessionUserId,
      latitude: point.lat,
      longitude: point.lng,
      room_key: nextRoomKey,
      updated_at: new Date().toISOString(),
    };

    const { error: locationError } = await supabase.from('user_locations').upsert(upsertPayload);

    if (locationError) {
      setError(locationError.message);
      return;
    }

    setCurrentLocation(point);
    setRoomKey(nextRoomKey);
    setStatus(notify ? 'Location updated and room refreshed' : 'Location synced');
    await refreshWorkspace(sessionUserId);
  }

  async function requestLiveLocation() {
    if (locationLoading) {
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.');
      return;
    }

    setLocationLoading(true);
    setStatus('Requesting location permission...');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const point = { lat: position.coords.latitude, lng: position.coords.longitude };
          await persistLocation(point);
          setStatus('Live location enabled');

          if (liveWatchId.current !== null) {
            navigator.geolocation.clearWatch(liveWatchId.current);
          }

          liveWatchId.current = navigator.geolocation.watchPosition(
            async (nextPosition) => {
              const nextPoint = { lat: nextPosition.coords.latitude, lng: nextPosition.coords.longitude };
              await persistLocation(nextPoint, false);
            },
            (watchError) => setError(watchError.message),
            { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
          );
        } finally {
          setLocationLoading(false);
        }
      },
      (geoError) => {
        setError(geoError.message);
        setStatus('Location permission was denied');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  useEffect(() => {
    if (sessionUserId && !currentLocation) {
      requestLiveLocation();
    }
  }, [sessionUserId]);

  useEffect(() => {
    return () => {
      if (liveWatchId.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(liveWatchId.current);
      }
    };
  }, []);

  async function handleSendMessage(message: string) {
    if (!sessionUserId || !roomKey) {
      return;
    }

    const createdAt = new Date().toISOString();
    const tempId = crypto.randomUUID();
    const optimisticMessage: ChatMessageRow = {
      id: tempId,
      room_key: roomKey,
      user_id: sessionUserId,
      body: message,
      created_at: createdAt,
    };
    pendingMessages.current.push({ tempId, roomKey, userId: sessionUserId, body: message, createdAt });
    setMessages((current) => [...current, optimisticMessage].sort((left, right) => left.created_at.localeCompare(right.created_at)));

    const { error: sendError } = await supabase.from('room_messages').insert({
      room_key: roomKey,
      user_id: sessionUserId,
      body: message,
    });

    if (sendError) {
      setError(sendError.message);
      pendingMessages.current = pendingMessages.current.filter((pending) => pending.tempId !== tempId);
      setMessages((current) => current.filter((msg) => msg.id !== optimisticMessage.id));
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
  }

  const summaryCards = [
    { label: 'Nearby users', value: nearbyUsers.length.toString(), icon: Users },
    { label: 'Current room', value: roomKey ?? 'No room', icon: MapPinned },
    { label: 'Status', value: status, icon: Loader2 },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-white/70">
        <Loader2 className="mr-2 animate-spin" size={18} />
        Preparing your dashboard...
      </div>
    );
  }

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[32px] border border-white/10 bg-white/6 p-6 shadow-glow backdrop-blur lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Location chat dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Hello, {profile?.display_name ?? 'there'}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            Share your current pin or tap the map, and the app will automatically group you with users inside a 5km radius.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={requestLiveLocation} disabled={locationLoading} className="inline-flex items-center gap-2 rounded-2xl border border-[#7ff0e0]/60 bg-[#74ebda] px-4 py-3 text-sm font-semibold text-[#04110f] shadow-[0_10px_30px_rgba(77,215,176,0.34)] transition hover:bg-[#84f0e3] hover:shadow-[0_14px_34px_rgba(77,215,176,0.42)] disabled:cursor-not-allowed disabled:border-[#7ff0e0]/30 disabled:bg-[#5fd9c7] disabled:text-[#071715] disabled:opacity-100">
            {locationLoading ? <Loader2 size={16} className="animate-spin text-[#071715]" /> : <LocateFixed size={16} className="text-[#071715]" />}
            <span className="whitespace-nowrap">{locationLoading ? 'Requesting location...' : 'Enable live location'}</span>
          </button>
          <button onClick={handleSignOut} className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 hover:border-white/20">
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-[28px] border border-white/10 bg-black/20 p-5 shadow-glow">
            <div className="flex items-center justify-between text-white/60">
              <span className="text-sm">{label}</span>
              <Icon size={16} />
            </div>
            <div className="mt-4 text-2xl font-semibold text-white">{value}</div>
          </article>
        ))}
      </section>

      {error ? <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.3fr] min-h-[760px] lg:h-[calc(100vh-260px)] xl:h-[calc(100vh-220px)]">
        <div className="space-y-4 overflow-y-auto lg:max-h-full">
          <LocationMap
            currentLocation={currentLocation}
            nearbyUsers={nearbyUsers}
            onPickLocation={async (point) => {
              await persistLocation(point);
            }}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {nearbyUsers.slice(0, 2).map((user) => (
              <article key={user.id} className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">{user.displayName}</p>
                    <p className="text-sm text-white/55">{user.roomKey}</p>
                  </div>
                  <span className="rounded-full bg-aqua/15 px-3 py-1 text-xs font-semibold text-aqua">{formatDistance(user.distanceKm)}</span>
                </div>
                <p className="mt-3 text-sm text-white/60" suppressHydrationWarning>
                  Updated {new Date(user.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </article>
            ))}
          </div>
        </div>

        <ChatPanel
          roomKey={roomKey}
          messages={messages}
          profileMap={profileMap}
          currentUserId={sessionUserId ?? ''}
          onSendMessage={handleSendMessage}
        />
      </section>
    </main>
  );
}
