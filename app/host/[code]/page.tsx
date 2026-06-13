'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase-client';
import type { Room, Guest, QueueItem, VoteSession, Battle } from '@/lib/types';

type Tab = 'now-playing' | 'queue' | 'guests' | 'battle';

interface CurrentTrack {
  uri: string;
  id?: string;
  name: string;
  artist: string;
  image: string | null;
  duration_ms?: number;
}

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'now-playing', label: 'Now Playing', icon: '🎵' },
    { id: 'queue', label: 'Queue', icon: '📋' },
    { id: 'guests', label: 'Guests', icon: '👥' },
    { id: 'battle', label: 'Battle', icon: '⚔️' },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#111',
        borderTop: '1px solid #1A1A1A',
        display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 100,
      }}
    >
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            color: tab === t.id ? '#1DB954' : '#888',
            padding: '12px 4px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            fontSize: '20px',
          }}
        >
          <span>{t.icon}</span>
          <span style={{ fontSize: '10px', fontWeight: tab === t.id ? 700 : 400 }}>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

function NowPlayingTab({
  room,
  track,
  isPlaying,
  activeVote,
  onVeto,
}: {
  room: Room | null;
  track: CurrentTrack | null;
  isPlaying: boolean;
  activeVote: VoteSession | null;
  onVeto: () => void;
}) {
  const [reactions, setReactions] = useState({ fire: 0, skull: 0, dance: 0 });

  useEffect(() => {
    if (track?.uri && room?.id) {
      fetch(`/api/rooms/${room.code}/react`, {
        method: 'GET',
      }).catch(() => {});
    }
  }, [track?.uri, room]);

  const voteTypeLabel: Record<string, string> = {
    skip: 'Skip Song',
    challenge: 'Challenge for Aux',
    pull_aux: 'Pull the Aux',
  };

  return (
    <div style={{ padding: '16px', paddingBottom: '80px' }}>
      {track ? (
        <>
          {track.image ? (
            <img
              src={track.image}
              alt={track.name}
              style={{ width: '100%', aspectRatio: '1', borderRadius: '20px', objectFit: 'cover', marginBottom: '20px' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: '20px',
                background: '#1A1A1A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '80px',
                marginBottom: '20px',
              }}
            >
              🎵
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', color: '#1DB954', fontWeight: 700 }}>
                {isPlaying ? '▶ NOW PLAYING' : '⏸ PAUSED'}
              </span>
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px' }}>{track.name}</h2>
            <p style={{ color: '#888', margin: 0, fontSize: '16px' }}>{track.artist}</p>
          </div>

          {room?.current_aux_holder_id && (
            <div
              style={{
                background: '#111',
                border: '1px solid #1DB954',
                borderRadius: '12px',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>🎧</span>
              <span style={{ fontSize: '14px', color: '#1DB954', fontWeight: 600 }}>Someone has the aux</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '8px' }}>
            {[{ type: 'fire', emoji: '🔥' }, { type: 'skull', emoji: '💀' }, { type: 'dance', emoji: '🕺' }].map(r => (
              <div key={r.type} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '36px' }}>{r.emoji}</div>
                <div style={{ fontSize: '14px', color: '#888' }}>
                  {reactions[r.type as keyof typeof reactions]}
                </div>
              </div>
            ))}
          </div>

          {activeVote && (
            <div
              style={{
                position: 'fixed',
                bottom: '80px',
                left: '16px',
                right: '16px',
                background: '#111',
                border: '2px solid #FF4444',
                borderRadius: '20px',
                padding: '20px',
                zIndex: 50,
              }}
              className="animate-slide-up"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>
                    🗳️ Vote: {voteTypeLabel[activeVote.type] || activeVote.type}
                  </p>
                  <p style={{ margin: '4px 0 0', color: '#888', fontSize: '13px' }}>
                    {activeVote.yes_votes} yes · {activeVote.no_votes} no · need {activeVote.required}
                  </p>
                </div>
                {room && room.vetoes_remaining > 0 && (
                  <button
                    onClick={onVeto}
                    style={{
                      background: '#FF4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '8px 14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    VETO ({room.vetoes_remaining})
                  </button>
                )}
              </div>
              <div style={{ background: '#1A1A1A', borderRadius: '8px', overflow: 'hidden', height: '8px' }}>
                <div
                  style={{
                    background: '#1DB954',
                    height: '100%',
                    width: `${Math.min(100, (activeVote.yes_votes / Math.max(1, activeVote.required)) * 100)}%`,
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', paddingTop: '80px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎵</div>
          <p style={{ color: '#888', fontSize: '18px' }}>Nothing playing yet</p>
          <p style={{ color: '#555', fontSize: '14px' }}>Add songs to the queue to get started</p>
        </div>
      )}
    </div>
  );
}

function QueueTab({
  queue,
  roomCode,
  onRemove,
}: {
  queue: QueueItem[];
  roomCode: string;
  onRemove: (id: string) => void;
}) {
  return (
    <div style={{ padding: '16px', paddingBottom: '80px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '16px' }}>Queue ({queue.length})</h2>
      {queue.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: '48px', color: '#888' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
          <p>Queue is empty</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {queue.map((item, idx) => (
            <div
              key={item.id}
              style={{
                background: '#111',
                border: '1px solid #1A1A1A',
                borderRadius: '14px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span style={{ color: '#555', fontSize: '14px', minWidth: '20px' }}>#{idx + 1}</span>
              {item.track_image ? (
                <img src={item.track_image} alt="" style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🎵</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.track_name}</div>
                <div style={{ color: '#888', fontSize: '13px' }}>{item.track_artist}</div>
                <div style={{ color: '#555', fontSize: '11px' }}>by {item.suggested_by_name || 'Unknown'}</div>
              </div>
              <button
                onClick={() => onRemove(item.id)}
                style={{ background: 'none', border: 'none', color: '#FF4444', fontSize: '18px', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GuestsTab({
  guests,
  roomCode,
  onMuteToggle,
}: {
  guests: Guest[];
  roomCode: string;
  onMuteToggle: (guestId: string, muted: boolean) => void;
}) {
  return (
    <div style={{ padding: '16px', paddingBottom: '80px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '16px' }}>Guests ({guests.length})</h2>
      {guests.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: '48px', color: '#888' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
          <p>No guests yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {guests.map(guest => (
            <div
              key={guest.id}
              style={{
                background: '#111',
                border: '1px solid #1A1A1A',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#1DB954',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#000',
                  flexShrink: 0,
                }}
              >
                {guest.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {guest.name}
                  {guest.is_muted && <span style={{ fontSize: '12px', color: '#FF4444', background: '#2A1111', padding: '2px 6px', borderRadius: '6px' }}>MUTED</span>}
                </div>
                <div style={{ color: '#888', fontSize: '13px' }}>💳 {guest.credits} credits</div>
              </div>
              <button
                onClick={() => onMuteToggle(guest.id, !guest.is_muted)}
                style={{
                  background: guest.is_muted ? '#1DB954' : '#2A1111',
                  color: guest.is_muted ? '#000' : '#FF4444',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {guest.is_muted ? 'Unmute' : 'Mute'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BattleTab({ activeBattle, roomCode }: { activeBattle: Battle | null; roomCode: string }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!activeBattle?.expires_at) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((new Date(activeBattle.expires_at!).getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeBattle?.expires_at]);

  if (!activeBattle) {
    return (
      <div style={{ padding: '16px', paddingBottom: '80px', textAlign: 'center', paddingTop: '48px' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚔️</div>
        <p style={{ color: '#888' }}>No active battle</p>
        <p style={{ color: '#555', fontSize: '14px' }}>Guests can start a battle from their view</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>⚔️ Battle</h2>
        {activeBattle.expires_at && (
          <div style={{ background: '#1DB954', color: '#000', borderRadius: '10px', padding: '6px 12px', fontWeight: 700, fontSize: '14px' }}>
            {timeLeft}s
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center' }}>
        <div style={{ background: '#111', border: `2px solid ${activeBattle.winner === 'a' ? '#1DB954' : '#1A1A1A'}`, borderRadius: '16px', padding: '16px', textAlign: 'center' }}>
          {activeBattle.track_a.album?.images?.[0]?.url && (
            <img src={activeBattle.track_a.album.images[0].url} alt="" style={{ width: '100%', aspectRatio: '1', borderRadius: '10px', objectFit: 'cover', marginBottom: '8px' }} />
          )}
          <div style={{ fontWeight: 700, fontSize: '14px' }}>{activeBattle.track_a.name}</div>
          <div style={{ color: '#888', fontSize: '12px' }}>{activeBattle.track_a.artists?.[0]?.name}</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#1DB954', marginTop: '8px' }}>{activeBattle.votes_a}</div>
        </div>

        <div style={{ fontSize: '24px', fontWeight: 900, color: '#888' }}>VS</div>

        <div style={{ background: '#111', border: `2px solid ${activeBattle.winner === 'b' ? '#1DB954' : '#1A1A1A'}`, borderRadius: '16px', padding: '16px', textAlign: 'center' }}>
          {activeBattle.track_b?.album?.images?.[0]?.url ? (
            <img src={activeBattle.track_b.album.images[0].url} alt="" style={{ width: '100%', aspectRatio: '1', borderRadius: '10px', objectFit: 'cover', marginBottom: '8px' }} />
          ) : (
            <div style={{ width: '100%', aspectRatio: '1', borderRadius: '10px', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', marginBottom: '8px' }}>?</div>
          )}
          {activeBattle.track_b ? (
            <>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>{activeBattle.track_b.name}</div>
              <div style={{ color: '#888', fontSize: '12px' }}>{activeBattle.track_b.artists?.[0]?.name}</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#1DB954', marginTop: '8px' }}>{activeBattle.votes_b}</div>
            </>
          ) : (
            <div style={{ color: '#888', fontSize: '14px' }}>Waiting for challenger...</div>
          )}
        </div>
      </div>

      {activeBattle.status === 'resolved' && activeBattle.winner && (
        <div style={{ marginTop: '20px', textAlign: 'center', background: '#1A2E1A', borderRadius: '14px', padding: '16px' }}>
          <div style={{ fontSize: '32px' }}>🏆</div>
          <div style={{ fontWeight: 700, color: '#1DB954' }}>
            {activeBattle.winner === 'a' ? activeBattle.track_a.name : activeBattle.track_b?.name} wins!
          </div>
          <div style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>Added to front of queue</div>
        </div>
      )}
    </div>
  );
}

export default function HostPartyPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = params.code?.toUpperCase();

  const [tab, setTab] = useState<Tab>('now-playing');
  const [room, setRoom] = useState<Room | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeVote, setActiveVote] = useState<VoteSession | null>(null);
  const [activeBattle, setActiveBattle] = useState<Battle | null>(null);
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ending, setEnding] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRoomData = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(`/api/rooms/${code}`);
      if (!res.ok) return;
      const data = await res.json();
      setRoom(data.room);
      setGuests(data.guests || []);
      setQueue(data.queue || []);
      setActiveVote(data.activeVote || null);
      setActiveBattle(data.activeBattle || null);
      if (data.room?.current_track) {
        setCurrentTrack(data.room.current_track as CurrentTrack);
        setIsPlaying(data.room.is_playing);
      }
    } catch {
      // ignore
    }
  }, [code]);

  const syncSpotify = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(`/api/rooms/${code}/now-playing`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.track) {
          setCurrentTrack(data.track);
          setIsPlaying(data.isPlaying);
        }
      }
    } catch {
      // ignore
    }
  }, [code]);

  useEffect(() => {
    fetchRoomData();

    // Set up Supabase realtime
    const supabase = getSupabaseClient();

    const channel = supabase
      .channel(`room-${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aux_rooms', filter: `code=eq.${code}` }, payload => {
        if (payload.new && typeof payload.new === 'object' && 'current_track' in payload.new) {
          const r = payload.new as Room;
          setRoom(r);
          if (r.current_track) {
            setCurrentTrack(r.current_track as unknown as CurrentTrack);
            setIsPlaying(r.is_playing);
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aux_guests' }, () => {
        fetchRoomData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aux_queue' }, () => {
        fetchRoomData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aux_vote_sessions' }, () => {
        fetchRoomData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aux_battles' }, () => {
        fetchRoomData();
      })
      .subscribe();

    // Poll every 5s for Spotify sync
    pollingRef.current = setInterval(syncSpotify, 5000);

    return () => {
      supabase.removeChannel(channel);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [code, fetchRoomData, syncSpotify]);

  async function handleRemoveFromQueue(itemId: string) {
    const { supabaseServer: _ } = await import('@/lib/supabase-server').catch(() => ({ supabaseServer: null }));
    // Remove via direct supabase client call
    const supabase = getSupabaseClient();
    await supabase.from('aux_queue').update({ status: 'skipped' }).eq('id', itemId);
    fetchRoomData();
  }

  async function handleMuteToggle(guestId: string, muted: boolean) {
    if (!code) return;
    await fetch(`/api/rooms/${code}/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId, muted }),
    });
    fetchRoomData();
  }

  async function handleVeto() {
    if (!code) return;
    await fetch(`/api/rooms/${code}/veto`, { method: 'POST' });
    fetchRoomData();
  }

  async function handleEndParty() {
    if (!code || !confirm('End the party? This will compute the Wrapped summary.')) return;
    setEnding(true);
    try {
      const res = await fetch(`/api/rooms/${code}/end`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        router.push(`/wrapped/${data.roomId}`);
      }
    } catch {
      setEnding(false);
    }
  }

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code).catch(() => {});
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  return (
    <div style={{ background: '#0A0A0A', minHeight: '100dvh' }}>
      {/* Top bar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: '#111',
          borderBottom: '1px solid #1A1A1A',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 100,
          paddingTop: 'max(12px, env(safe-area-inset-top))',
        }}
      >
        <button
          onClick={copyCode}
          style={{
            background: '#1A1A1A',
            border: 'none',
            color: codeCopied ? '#1DB954' : '#fff',
            borderRadius: '10px',
            padding: '8px 14px',
            fontFamily: 'monospace',
            fontSize: '18px',
            fontWeight: 800,
            letterSpacing: '3px',
            cursor: 'pointer',
          }}
        >
          {codeCopied ? '✓ Copied' : code}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#888', fontSize: '13px' }}>
            👥 {guests.length}
          </span>
          <button
            onClick={handleEndParty}
            disabled={ending}
            style={{
              background: '#FF4444',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '8px 14px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '13px',
              opacity: ending ? 0.7 : 1,
            }}
          >
            {ending ? '...' : 'End Party'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ paddingTop: '64px' }}>
        {tab === 'now-playing' && (
          <NowPlayingTab
            room={room}
            track={currentTrack}
            isPlaying={isPlaying}
            activeVote={activeVote}
            onVeto={handleVeto}
          />
        )}
        {tab === 'queue' && (
          <QueueTab
            queue={queue}
            roomCode={code || ''}
            onRemove={handleRemoveFromQueue}
          />
        )}
        {tab === 'guests' && (
          <GuestsTab
            guests={guests}
            roomCode={code || ''}
            onMuteToggle={handleMuteToggle}
          />
        )}
        {tab === 'battle' && (
          <BattleTab activeBattle={activeBattle} roomCode={code || ''} />
        )}
      </div>

      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}
