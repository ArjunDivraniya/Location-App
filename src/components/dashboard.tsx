'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, LocateFixed, LogOut, MapPinned, Users } from 'lucide-react';
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

type DashboardProps = {
  view?: 'dashboard' | 'chat';
};

export function Dashboard({ view = 'dashboard' }: DashboardProps) {
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
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
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
      setStatus(`Current room ${current.room_key}`);
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
    // Debugging instrumentation added to trace why permission prompt may not appear.
    console.log('[Dashboard] requestLiveLocation called, locationLoading=', locationLoading);

    if (locationLoading) {
      console.log('[Dashboard] requestLiveLocation aborted: already loading');
      return;
    }

    if (!navigator.geolocation) {
      console.log('[Dashboard] geolocation API not available');
      setError('Geolocation is not supported in this browser.');
      return;
    }

    // Check permissions API (if available) to log current state before requesting
    try {
      if ('permissions' in navigator && navigator.permissions?.query) {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        console.log('[Dashboard] geolocation permission state before request:', perm.state);
        setStatus(`Geolocation permission: ${perm.state}`);
      }
    } catch (permErr) {
      console.log('[Dashboard] permissions.query error', permErr);
    }

    setLocationLoading(true);
    setStatus('Requesting location permission...');

    // Call through getCurrentPosition and log the callbacks so we can see if browser invoked them
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        console.log('[Dashboard] getCurrentPosition success', position.coords);
        try {
          const point = { lat: position.coords.latitude, lng: position.coords.longitude };
          await persistLocation(point);
          setStatus('Live location enabled');

          if (liveWatchId.current !== null) {
            navigator.geolocation.clearWatch(liveWatchId.current);
          }

          liveWatchId.current = navigator.geolocation.watchPosition(
            async (nextPosition) => {
              console.log('[Dashboard] watchPosition update', nextPosition.coords);
              const nextPoint = { lat: nextPosition.coords.latitude, lng: nextPosition.coords.longitude };
              await persistLocation(nextPoint, false);
            },
            (watchError) => {
              console.log('[Dashboard] watchPosition error', watchError);
              setError(watchError.message);
              setLiveEnabled(false);
            },
            { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
          );
          // Mark live mode active when watch is established
          setLiveEnabled(true);
        } finally {
          setLocationLoading(false);
        }
      },
      (geoError) => {
        console.log('[Dashboard] getCurrentPosition error', geoError);
        // geoError.code: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        let message = geoError?.message || 'Location request failed';
        try {
          if (geoError?.code === 1) {
            message = 'Location permission denied. Allow location access in your browser settings.';
          } else if (geoError?.code === 2) {
            message = 'Position unavailable. Please try again or check your device settings.';
          } else if (geoError?.code === 3) {
            message = 'Location request timed out. Please try again.';
          }
        } catch (e) {
          // ignore
        }

        setError(message);
        setStatus('Location unavailable');
        setLocationLoading(false);
        setLiveEnabled(false);
      },
      // Increase timeout to 30s to reduce spurious timeouts on slow devices/networks
      { enableHighAccuracy: true, timeout: 30000 }
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
        setLiveEnabled(false);
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

  const roomMembers = roomKey ? nearbyUsers.filter((user) => user.roomKey === roomKey) : [];
  const roomMemberCount = roomKey ? roomMembers.length + 1 : 0;

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-white/70">
        <Loader2 className="mr-2 animate-spin" size={18} />
        Preparing your dashboard...
      </div>
    );
  }

  if (view === 'chat') {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-[28px] border border-white/10 bg-white/6 px-4 py-4 shadow-glow backdrop-blur sm:px-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            <ArrowLeft size={16} />
            Back to dashboard
          </button>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">Live room</p>
            <p className="mt-1 max-w-[220px] truncate text-sm font-semibold text-white sm:max-w-xs sm:text-base">{roomKey ?? 'No room active yet'}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <article className="rounded-[24px] border border-white/10 bg-black/20 p-4 shadow-glow">
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">Room members</p>
                <p className="mt-2 text-2xl font-semibold text-white">{roomMemberCount > 0 ? roomMemberCount : 0}</p>
                <p className="mt-1 text-sm text-white/60">You plus nearby people in the same room.</p>
              </article>
              <article className="rounded-[24px] border border-white/10 bg-black/20 p-4 shadow-glow">
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">Current room</p>
                <p className="mt-2 break-all text-sm font-semibold text-white">{roomKey ?? 'No room assigned yet'}</p>
                <p className="mt-1 text-sm text-white/60">Move your pin to join another room.</p>
              </article>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/6 p-4 shadow-glow backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-white">Room members</span>
                <span className="text-xs text-white/50">{roomMemberCount > 0 ? `${roomMemberCount} total` : 'No members yet'}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {roomMembers.length > 0 ? (
                  roomMembers.slice(0, 6).map((user) => (
                    <span key={user.id} className="rounded-full bg-aqua/15 px-3 py-1 text-xs font-semibold text-aqua">
                      {user.displayName}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-white/50">Your room members will appear here.</span>
                )}
              </div>
            </div>
          </div>

          <div className="min-h-[78vh] overflow-hidden rounded-[28px] border border-white/10 bg-white/6 shadow-glow">
            <ChatPanel
              roomKey={roomKey}
              messages={messages}
              profileMap={profileMap}
              currentUserId={sessionUserId ?? ''}
              onSendMessage={handleSendMessage}
              compact
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-3 rounded-[32px] border border-white/10 bg-white/6 p-4 shadow-glow backdrop-blur lg:flex-row lg:items-center lg:justify-between sm:p-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <img src="/logo.svg" alt="Location Chat" className="h-8 w-8 rounded-md sm:h-10 sm:w-10" />
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">Location chat</p>
            <h1 className="mt-1 text-xl font-semibold text-white sm:text-3xl">Hello, {profile?.display_name ?? 'there'}</h1>
            <p className="mt-1 hidden text-xs leading-5 text-white/65 sm:block sm:max-w-2xl sm:text-sm sm:leading-6">
              Share your pin or tap the map to group with nearby users.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3">
          {liveEnabled ? (
            <button
              onClick={() => {
                if (liveWatchId.current !== null && navigator.geolocation) {
                  navigator.geolocation.clearWatch(liveWatchId.current);
                  liveWatchId.current = null;
                }
                setLiveEnabled(false);
                setStatus('Live location disabled');
              }}
              className="inline-flex items-center gap-1 rounded-2xl border border-[#ffb4b4]/60 bg-[#ff9f9f] px-2 py-2 text-xs font-semibold text-[#2b0505] shadow-[0_10px_30px_rgba(255,140,140,0.18)] transition hover:bg-[#ffbdbd] sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
            >
              <LocateFixed size={14} className="text-[#2b0505] sm:size-4" />
              <span className="hidden sm:inline">Disable</span>
            </button>
          ) : (
            <button
              onClick={requestLiveLocation}
              disabled={locationLoading}
              className="inline-flex items-center gap-1 rounded-2xl border border-[#7ff0e0]/60 bg-[#74ebda] px-2 py-2 text-xs font-semibold text-[#04110f] shadow-[0_10px_30px_rgba(77,215,176,0.34)] transition hover:bg-[#84f0e3] hover:shadow-[0_14px_34px_rgba(77,215,176,0.42)] disabled:cursor-not-allowed disabled:border-[#7ff0e0]/30 disabled:bg-[#5fd9c7] disabled:text-[#071715] disabled:opacity-100 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
            >
              {locationLoading ? <Loader2 size={14} className="animate-spin text-[#071715] sm:size-4" /> : <LocateFixed size={14} className="text-[#071715] sm:size-4" />}
              <span className="hidden sm:inline">{locationLoading ? 'Requesting...' : 'Enable location'}</span>
            </button>
          )}

          {/* Mobile: open chat full-screen */}
          <button
            onClick={() => router.push('/dashboard/chat')}
            className="inline-flex items-center gap-1 rounded-2xl border border-white/12 bg-white/6 px-2 py-2 text-xs font-semibold text-white transition hover:bg-white/10 hover:border-white/20 md:hidden"
            aria-label="Open chat"
          >
            Chat
          </button>
          <button onClick={handleSignOut} className="inline-flex items-center gap-1 rounded-2xl border border-white/12 bg-white/6 px-2 py-2 text-xs font-semibold text-white transition hover:bg-white/10 hover:border-white/20 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm">
            <LogOut size={14} className="sm:size-4" />
            <span className="hidden sm:inline">Sign out</span>
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

      {error ? (
        <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100 flex items-center justify-between">
          <div className="mr-4">{error}</div>
          <div>
            <button
              onClick={() => {
                setError(null);
                requestLiveLocation();
              }}
              className="ml-2 inline-flex items-center gap-2 rounded-2xl border border-rose-300/30 bg-rose-300/10 px-3 py-1 text-sm font-semibold text-rose-100 hover:bg-rose-300/20"
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-[0.85fr_1.3fr] min-h-[600px] md:min-h-[760px] md:h-[calc(100vh-280px)] lg:h-[calc(100vh-260px)] xl:h-[calc(100vh-220px)]">
        <div className="space-y-4 overflow-y-auto lg:max-h-full">
          {/* Nearby users list — show first 4, with an option to view more */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:gap-4">
            {nearbyUsers
              .filter((u) => u.distanceKm <= 5)
              .slice(0, 4)
              .map((user) => {
                const isActive = roomKey !== null && user.roomKey === roomKey;
                return (
                  <article key={user.id} className="rounded-[24px] border border-white/10 bg-white/6 p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-sm text-white sm:text-base">{user.displayName}</p>
                        <p className="truncate text-xs text-white/55 sm:text-sm">{user.roomKey}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${isActive ? 'bg-green-100 text-green-800' : 'bg-white/5 text-white/70'}`}>
                          {isActive ? 'In room' : 'Nearby'}
                        </span>
                        <span className="rounded-full bg-aqua/15 px-2 py-0.5 text-xs font-semibold text-aqua">{formatDistance(user.distanceKm)}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-white/60 sm:mt-3 sm:text-sm" suppressHydrationWarning>
                      Updated {new Date(user.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </article>
                );
              })}

            {nearbyUsers.length > 4 ? (
              <article className="rounded-[24px] border border-white/10 bg-white/6 p-4 flex items-center justify-center">
                <button onClick={() => setShowUsersModal(true)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/5">
                  {`View all ${nearbyUsers.length} nearby`}
                </button>
              </article>
            ) : null}
          </div>

          <LocationMap
            currentLocation={currentLocation}
            nearbyUsers={nearbyUsers}
            onPickLocation={async (point) => {
              await persistLocation(point);
            }}
          />
        </div>

        <ChatPanel
          roomKey={roomKey}
          messages={messages}
          profileMap={profileMap}
          currentUserId={sessionUserId ?? ''}
          onSendMessage={handleSendMessage}
        />
      </section>

      {showUsersModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="mx-auto w-full max-w-lg">
            <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <div className="flex items-center justify-between pb-3">
                <div className="text-white font-semibold">Nearby users</div>
                <button onClick={() => setShowUsersModal(false)} className="rounded-full bg-white/6 p-2 text-white">Close</button>
              </div>
              <div className="grid gap-3">
                {nearbyUsers
                  .filter((u) => u.distanceKm <= 5)
                  .map((user) => {
                    const isActive = roomKey !== null && user.roomKey === roomKey;
                    return (
                      <div key={user.id} className="flex items-center justify-between rounded-lg border border-white/6 p-3">
                        <div>
                          <div className="font-semibold text-white">{user.displayName}</div>
                          <div className="text-sm text-white/60">{user.roomKey}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isActive ? 'bg-green-100 text-green-800' : 'bg-white/5 text-white/70'}`}>
                            {isActive ? 'In room' : 'Nearby'}
                          </span>
                          <span className="text-sm text-white/60">{formatDistance(user.distanceKm)}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
