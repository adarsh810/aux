'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase-client';
import type { Room, Guest, QueueItem, VoteSession, Battle, SpotifyTrack } from '@/lib/types';

type Tab = 'now-playing' | 'queue' | 'vote' | 'battle' | 'guests';

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
    { id: 'vote', label: 'Vote', icon: '🗳️' },
    { id: 'battle', label: 'Battle', icon: '⚔️' },
    { id: 'guests', label: 'Guests', icon: '👥' },
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
  track,
  isPlaying,
  auxHolderName,
  credits,
  guestId,
  roomCode,
  activeVote,
  onVoteCast,
}: {
  track: CurrentTrack | null;
  isPlaying: boolean;
  auxHolderName: string | null;
  credits: number;
  guestId: string;
  roomCode: string;
  activeVote: VoteSession | null;
  onVoteCast: (voteSessionId: string, vote: boolean) => void;
}) {
  const [reactions, setReactions] = useState({ fire: 0, skull: 0, dance: 0 });
  const [myReaction, setMyReaction] = useState<string | null>(null);

  useEffect(() => {
    if (!track?.uri) return;
    const uri = track.uri;

    async function fetchCounts() {
      try {
        const res = await fetch(`/api/rooms/${roomCode}/react?trackUri=${encodeURIComponent(uri)}`);
        if (res.ok) {
          const data = await res.json();
          setReactions({ fire: data.fire || 0, skull: data.skull || 0, dance: data.dance || 0 });
        }
      } catch { /* ignore */ }
    }

    fetchCounts();

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`guest-rxn-${roomCode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aux_reactions' }, fetchCounts)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [track?.uri, roomCode]);

  async function sendReaction(type: string) {
    if (!track?.uri) return;
    try {
      const res = await fetch(`/api/rooms/${roomCode}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, guestId, trackUri: track.uri }),
      });
      if (res.ok) {
        const data = await res.json();
        setReactions(data);
        setMyReaction(type);
      }
    } catch {
      // ignore
    }
  }

  const reactionBtns = [
    { type: 'fire', emoji: '🔥', label: 'Fire' },
    { type: 'skull', emoji: '💀', label: 'Boo' },
    { type: 'dance', emoji: '🕺', label: 'Dance' },
  ];

  const voteLabel: Record<string, string> = {
    skip: 'Skip Song',
    challenge: 'Take the Aux',
  };

  return (
    <div style={{ padding: '16px', paddingBottom: '100px' }}>
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

          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', color: '#1DB954', fontWeight: 700 }}>
              {isPlaying ? '▶ NOW PLAYING' : '⏸ PAUSED'}
            </span>
            <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '4px 0' }}>{track.name}</h2>
            <p style={{ color: '#888', margin: 0, fontSize: '16px' }}>{track.artist}</p>
          </div>

          {auxHolderName && (
            <div
              style={{
                background: '#111',
                border: '1px solid #1DB954',
                borderRadius: '12px',
                padding: '10px 14px',
                marginBottom: '20px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>🎧</span>
              <span style={{ fontSize: '14px', color: '#1DB954', fontWeight: 600 }}>{auxHolderName} has the aux</span>
            </div>
          )}

          {/* Reaction buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            {reactionBtns.map(r => (
              <button
                key={r.type}
                onClick={() => sendReaction(r.type)}
                style={{
                  flex: 1,
                  background: myReaction === r.type ? '#1A2E1A' : '#111',
                  border: `2px solid ${myReaction === r.type ? '#1DB954' : '#1A1A1A'}`,
                  borderRadius: '16px',
                  padding: '16px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  minHeight: '64px',
                }}
              >
                <span style={{ fontSize: '32px' }}>{r.emoji}</span>
                <span style={{ color: '#fff', fontSize: '16px', fontWeight: 700 }}>{reactions[r.type as keyof typeof reactions]}</span>
              </button>
            ))}
          </div>

          {/* Active vote overlay */}
          {activeVote && (
            <div
              style={{
                marginTop: '20px',
                background: '#111',
                border: '2px solid #FF4444',
                borderRadius: '20px',
                padding: '20px',
              }}
              className="animate-fade-in"
            >
              <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '16px' }}>
                🗳️ Vote: {voteLabel[activeVote.type] || activeVote.type}
              </p>
              <p style={{ margin: '0 0 12px', color: '#888', fontSize: '13px' }}>
                {activeVote.yes_votes} yes · {activeVote.no_votes} no · need {activeVote.required}
              </p>
              <div style={{ background: '#1A1A1A', borderRadius: '8px', overflow: 'hidden', height: '8px', marginBottom: '16px' }}>
                <div
                  style={{
                    background: '#1DB954',
                    height: '100%',
                    width: `${Math.min(100, (activeVote.yes_votes / Math.max(1, activeVote.required)) * 100)}%`,
                    transition: 'width 0.3s',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => onVoteCast(activeVote.id, true)}
                  style={{ flex: 1, background: '#1DB954', color: '#000', border: 'none', borderRadius: '12px', padding: '14px', fontWeight: 700, cursor: 'pointer', fontSize: '16px' }}
                >
                  ✅ Yes
                </button>
                <button
                  onClick={() => onVoteCast(activeVote.id, false)}
                  style={{ flex: 1, background: '#2A1111', color: '#FF4444', border: '1px solid #FF4444', borderRadius: '12px', padding: '14px', fontWeight: 700, cursor: 'pointer', fontSize: '16px' }}
                >
                  ❌ No
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', paddingTop: '80px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎵</div>
          <p style={{ color: '#888', fontSize: '18px' }}>Waiting for music...</p>
        </div>
      )}
    </div>
  );
}

function QueueTab({
  queue,
  roomCode,
  guestId,
  onAdded,
}: {
  queue: QueueItem[];
  roomCode: string;
  guestId: string;
  onAdded: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [addError, setAddError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(q: string) {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&code=${roomCode}`);
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data : []);
        }
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 400);
  }

  async function addToQueue(track: SpotifyTrack) {
    setAdding(track.uri);
    setAddError('');
    try {
      const res = await fetch(`/api/rooms/${roomCode}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackUri: track.uri,
          trackName: track.name,
          trackArtist: track.artists?.[0]?.name || 'Unknown',
          trackImage: track.album?.images?.[0]?.url || null,
          trackDurationMs: track.duration_ms,
          guestId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAddError(data.error || 'Failed to add');
      } else {
        setSearchQuery('');
        setResults([]);
        onAdded();
      }
    } catch {
      setAddError('Something went wrong');
    } finally {
      setAdding(null);
    }
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '80px' }}>
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Search for a song..."
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      {addError && <p style={{ color: '#FF4444', fontSize: '14px', marginBottom: '12px' }}>{addError}</p>}

      {searching && <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>Searching...</p>}

      {results.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{ color: '#888', fontSize: '13px', marginBottom: '8px' }}>RESULTS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {results.map(track => (
              <button
                key={track.uri}
                onClick={() => addToQueue(track)}
                disabled={adding === track.uri}
                style={{
                  background: '#111',
                  border: '1px solid #1A1A1A',
                  borderRadius: '14px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  color: '#fff',
                  textAlign: 'left',
                  width: '100%',
                  opacity: adding === track.uri ? 0.6 : 1,
                }}
              >
                {track.album?.images?.[0]?.url ? (
                  <img src={track.album.images[0].url} alt="" style={{ width: '44px', height: '44px', borderRadius: '8px', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>🎵</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</div>
                  <div style={{ color: '#888', fontSize: '13px' }}>{track.artists?.[0]?.name}</div>
                </div>
                <span style={{ color: '#1DB954', fontSize: '20px', flexShrink: 0 }}>
                  {adding === track.uri ? '...' : '+'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p style={{ color: '#888', fontSize: '13px', marginBottom: '8px' }}>QUEUE ({queue.length})</p>
        {queue.length === 0 ? (
          <p style={{ color: '#555', textAlign: 'center', paddingTop: '24px' }}>Queue is empty. Search to add songs!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {queue.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  background: '#111',
                  border: '1px solid #1A1A1A',
                  borderRadius: '14px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <span style={{ color: '#555', fontSize: '13px', minWidth: '18px' }}>#{idx + 1}</span>
                {item.track_image ? (
                  <img src={item.track_image} alt="" style={{ width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🎵</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.track_name}</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>{item.track_artist}</div>
                  <div style={{ color: '#555', fontSize: '11px' }}>by {item.suggested_by_name || 'Unknown'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VoteTab({
  credits,
  guestId,
  roomCode,
  activeVote,
  onVoteInitiated,
  onVoteCast,
}: {
  credits: number;
  guestId: string;
  roomCode: string;
  activeVote: VoteSession | null;
  onVoteInitiated: () => void;
  onVoteCast: (voteSessionId: string, vote: boolean) => void;
}) {
  const [initiating, setInitiating] = useState<string | null>(null);
  const [error, setError] = useState('');

  const voteActions = [
    { type: 'skip', label: 'Skip Song', desc: 'Vote to skip the current track', cost: 2, emoji: '⏭️' },
    { type: 'challenge', label: 'Take the Aux', desc: 'Vote to seize control of the music', cost: 3, emoji: '🎧' },
  ];

  async function initVote(type: string, cost: number) {
    if (credits < cost) { setError(`Need ${cost} credits (you have ${credits})`); return; }
    if (activeVote) { setError('A vote is already in progress'); return; }
    setInitiating(type);
    setError('');
    try {
      const res = await fetch(`/api/rooms/${roomCode}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initiate', guestId, type }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to initiate vote');
      } else {
        onVoteInitiated();
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setInitiating(null);
    }
  }

  const voteLabel: Record<string, string> = {
    skip: 'Skip Song',
    challenge: 'Take the Aux',
  };

  return (
    <div style={{ padding: '16px', paddingBottom: '80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>Vote</h2>
        <div style={{ background: '#111', border: '1px solid #1DB954', borderRadius: '10px', padding: '6px 12px', fontSize: '14px', fontWeight: 700, color: '#1DB954' }}>
          💳 {credits} credits
        </div>
      </div>

      {error && <p style={{ color: '#FF4444', marginBottom: '12px', fontSize: '14px' }}>{error}</p>}

      {activeVote && (
        <div
          style={{
            background: '#111',
            border: '2px solid #FF4444',
            borderRadius: '20px',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '16px' }}>
            🗳️ Active Vote: {voteLabel[activeVote.type] || activeVote.type}
          </p>
          <p style={{ margin: '0 0 12px', color: '#888', fontSize: '13px' }}>
            {activeVote.yes_votes} yes · {activeVote.no_votes} no · need {activeVote.required}
          </p>
          <div style={{ background: '#1A1A1A', borderRadius: '8px', overflow: 'hidden', height: '8px', marginBottom: '16px' }}>
            <div
              style={{
                background: '#1DB954',
                height: '100%',
                width: `${Math.min(100, (activeVote.yes_votes / Math.max(1, activeVote.required)) * 100)}%`,
                transition: 'width 0.3s',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => onVoteCast(activeVote.id, true)}
              style={{ flex: 1, background: '#1DB954', color: '#000', border: 'none', borderRadius: '12px', padding: '14px', fontWeight: 700, cursor: 'pointer', fontSize: '16px' }}
            >
              ✅ Yes
            </button>
            <button
              onClick={() => onVoteCast(activeVote.id, false)}
              style={{ flex: 1, background: '#2A1111', color: '#FF4444', border: '1px solid #FF4444', borderRadius: '12px', padding: '14px', fontWeight: 700, cursor: 'pointer', fontSize: '16px' }}
            >
              ❌ No
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {voteActions.map(action => (
          <button
            key={action.type}
            onClick={() => initVote(action.type, action.cost)}
            disabled={!!initiating || !!activeVote || credits < action.cost}
            style={{
              background: '#111',
              border: `1px solid ${credits >= action.cost && !activeVote ? '#1A1A1A' : '#0A0A0A'}`,
              borderRadius: '18px',
              padding: '20px',
              cursor: credits >= action.cost && !activeVote ? 'pointer' : 'not-allowed',
              textAlign: 'left',
              color: credits >= action.cost && !activeVote ? '#fff' : '#555',
              opacity: initiating === action.type ? 0.7 : 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '24px' }}>{action.emoji}</span>
              <span style={{ background: credits >= action.cost && !activeVote ? '#1DB954' : '#222', color: credits >= action.cost && !activeVote ? '#000' : '#555', borderRadius: '8px', padding: '4px 10px', fontSize: '13px', fontWeight: 700 }}>
                {action.cost} credits
              </span>
            </div>
            <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '4px' }}>{action.label}</div>
            <div style={{ color: '#888', fontSize: '13px' }}>{action.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function GuestsTab({ guests, myGuestId }: { guests: Guest[]; myGuestId: string }) {
  return (
    <div style={{ padding: '16px', paddingBottom: '80px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '16px' }}>Party ({guests.length})</h2>
      {guests.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: '48px', color: '#888' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
          <p>No one here yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {guests.map(g => (
            <div
              key={g.id}
              style={{
                background: g.id === myGuestId ? '#1A2E1A' : '#111',
                border: `1px solid ${g.id === myGuestId ? '#1DB954' : '#1A1A1A'}`,
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
                  background: g.id === myGuestId ? '#1DB954' : '#2A2A2A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: g.id === myGuestId ? '#000' : '#888',
                  flexShrink: 0,
                }}
              >
                {g.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {g.name}
                  {g.id === myGuestId && <span style={{ fontSize: '11px', color: '#1DB954', background: '#0D1F0D', padding: '2px 6px', borderRadius: '6px' }}>You</span>}
                  {g.is_muted && <span style={{ fontSize: '11px', color: '#FF4444', background: '#2A1111', padding: '2px 6px', borderRadius: '6px' }}>Muted</span>}
                </div>
                <div style={{ color: '#888', fontSize: '13px' }}>💳 {g.credits} credits</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BattleTab({
  activeBattle,
  roomCode,
  guestId,
  onUpdate,
}: {
  activeBattle: Battle | null;
  roomCode: string;
  guestId: string;
  onUpdate: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeBattle?.expires_at) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((new Date(activeBattle.expires_at!).getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeBattle?.expires_at]);

  function handleSearch(q: string) {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&code=${roomCode}`);
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data : []);
        }
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 400);
  }

  async function startBattle(track: SpotifyTrack) {
    setError('');
    try {
      const res = await fetch(`/api/rooms/${roomCode}/battle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', guestId, trackA: track }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to start battle');
      } else {
        setSearchQuery('');
        setResults([]);
        onUpdate();
      }
    } catch {
      setError('Something went wrong');
    }
  }

  async function submitB(track: SpotifyTrack) {
    if (!activeBattle) return;
    setError('');
    try {
      const res = await fetch(`/api/rooms/${roomCode}/battle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_b', guestId, battleId: activeBattle.id, trackB: track }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to submit track');
      } else {
        setSearchQuery('');
        setResults([]);
        onUpdate();
      }
    } catch {
      setError('Something went wrong');
    }
  }

  async function castBattleVote(choice: 'a' | 'b') {
    if (!activeBattle) return;
    setVoting(true);
    try {
      await fetch(`/api/rooms/${roomCode}/battle/${activeBattle.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, choice }),
      });
      onUpdate();
    } catch { /* ignore */ }
    finally { setVoting(false); }
  }

  if (!activeBattle) {
    return (
      <div style={{ padding: '16px', paddingBottom: '80px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '20px' }}>⚔️ Start a Battle</h2>
        <p style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>Search for a track to challenge someone to a battle. The winner gets added to the queue!</p>

        {error && <p style={{ color: '#FF4444', marginBottom: '12px', fontSize: '14px' }}>{error}</p>}

        <input
          type="text"
          placeholder="Search for your battle track..."
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          style={{ marginBottom: '16px' }}
        />

        {searching && <p style={{ color: '#888', textAlign: 'center' }}>Searching...</p>}

        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {results.map(track => (
              <button
                key={track.uri}
                onClick={() => startBattle(track)}
                style={{
                  background: '#111',
                  border: '1px solid #1A1A1A',
                  borderRadius: '14px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  color: '#fff',
                  textAlign: 'left',
                }}
              >
                {track.album?.images?.[0]?.url ? (
                  <img src={track.album.images[0].url} alt="" style={{ width: '44px', height: '44px', borderRadius: '8px', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>🎵</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</div>
                  <div style={{ color: '#888', fontSize: '13px' }}>{track.artists?.[0]?.name}</div>
                </div>
                <span style={{ color: '#FF4444', fontSize: '16px', fontWeight: 700 }}>⚔️</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>⚔️ Battle</h2>
        {activeBattle.expires_at && (
          <div style={{ background: timeLeft < 10 ? '#FF4444' : '#1DB954', color: '#000', borderRadius: '10px', padding: '6px 12px', fontWeight: 700, fontSize: '14px' }}>
            {timeLeft}s
          </div>
        )}
      </div>

      {error && <p style={{ color: '#FF4444', marginBottom: '12px', fontSize: '14px' }}>{error}</p>}

      {activeBattle.status === 'waiting_b' && activeBattle.suggested_by_a !== guestId ? (
        <>
          <p style={{ color: '#888', marginBottom: '16px', fontSize: '14px' }}>Someone started a battle! Submit your track to challenge them.</p>
          <div style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
            <p style={{ color: '#888', fontSize: '12px', margin: '0 0 8px' }}>THEIR TRACK</p>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {activeBattle.track_a.album?.images?.[0]?.url && (
                <img src={activeBattle.track_a.album.images[0].url} alt="" style={{ width: '48px', height: '48px', borderRadius: '8px' }} />
              )}
              <div>
                <div style={{ fontWeight: 700 }}>{activeBattle.track_a.name}</div>
                <div style={{ color: '#888', fontSize: '13px' }}>{activeBattle.track_a.artists?.[0]?.name}</div>
              </div>
            </div>
          </div>

          <input
            type="text"
            placeholder="Search your challenger track..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            style={{ marginBottom: '12px' }}
          />
          {searching && <p style={{ color: '#888', textAlign: 'center', fontSize: '14px' }}>Searching...</p>}
          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {results.map(track => (
                <button
                  key={track.uri}
                  onClick={() => submitB(track)}
                  style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: '14px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: '#fff', textAlign: 'left' }}
                >
                  {track.album?.images?.[0]?.url ? (
                    <img src={track.album.images[0].url} alt="" style={{ width: '44px', height: '44px', borderRadius: '8px', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>🎵</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</div>
                    <div style={{ color: '#888', fontSize: '13px' }}>{track.artists?.[0]?.name}</div>
                  </div>
                  <span style={{ color: '#1DB954', fontSize: '20px' }}>⚔️</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : activeBattle.status === 'voting' ? (
        <>
          <p style={{ color: '#888', marginBottom: '16px', fontSize: '14px', textAlign: 'center' }}>Vote for your favorite track!</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => castBattleVote('a')}
              disabled={voting}
              style={{ background: '#111', border: '2px solid #1A1A1A', borderRadius: '16px', padding: '16px', cursor: 'pointer', textAlign: 'center', color: '#fff' }}
            >
              {activeBattle.track_a.album?.images?.[0]?.url && (
                <img src={activeBattle.track_a.album.images[0].url} alt="" style={{ width: '100%', aspectRatio: '1', borderRadius: '10px', objectFit: 'cover', marginBottom: '8px' }} />
              )}
              <div style={{ fontWeight: 700, fontSize: '13px' }}>{activeBattle.track_a.name}</div>
              <div style={{ color: '#888', fontSize: '12px' }}>{activeBattle.track_a.artists?.[0]?.name}</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#1DB954', marginTop: '6px' }}>{activeBattle.votes_a}</div>
            </button>

            <div style={{ fontSize: '20px', fontWeight: 900, color: '#888' }}>VS</div>

            <button
              onClick={() => castBattleVote('b')}
              disabled={voting || !activeBattle.track_b}
              style={{ background: '#111', border: '2px solid #1A1A1A', borderRadius: '16px', padding: '16px', cursor: 'pointer', textAlign: 'center', color: '#fff' }}
            >
              {activeBattle.track_b?.album?.images?.[0]?.url && (
                <img src={activeBattle.track_b.album.images[0].url} alt="" style={{ width: '100%', aspectRatio: '1', borderRadius: '10px', objectFit: 'cover', marginBottom: '8px' }} />
              )}
              {activeBattle.track_b ? (
                <>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>{activeBattle.track_b.name}</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>{activeBattle.track_b.artists?.[0]?.name}</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#1DB954', marginTop: '6px' }}>{activeBattle.votes_b}</div>
                </>
              ) : (
                <div style={{ color: '#888', fontSize: '13px' }}>Waiting...</div>
              )}
            </button>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', paddingTop: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏆</div>
          <p style={{ fontWeight: 700, color: '#1DB954', fontSize: '18px' }}>
            {activeBattle.winner === 'a' ? activeBattle.track_a.name : activeBattle.track_b?.name} wins!
          </p>
          <p style={{ color: '#888', fontSize: '14px' }}>Added to front of queue</p>
        </div>
      )}
    </div>
  );
}

export default function GuestRoomPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = params.code?.toUpperCase();

  const [tab, setTab] = useState<Tab>('now-playing');
  const [room, setRoom] = useState<Room | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeVote, setActiveVote] = useState<VoteSession | null>(null);
  const [activeBattle, setActiveBattle] = useState<Battle | null>(null);
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const guestId = typeof window !== 'undefined' ? localStorage.getItem(`aux_guest_id_${code}`) : null;

  const fetchRoomData = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(`/api/rooms/${code}`);
      if (!res.ok) {
        setError('Room not found');
        return;
      }
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

      if (data.room?.status === 'ended') {
        router.push(`/wrapped/${data.room.id}`);
        return;
      }

      // Find current guest
      if (guestId) {
        const g = (data.guests || []).find((g: Guest) => g.id === guestId);
        if (g) setGuest(g);
      }
    } catch {
      setError('Failed to load room');
    }
  }, [code, guestId, router]);

  useEffect(() => {
    if (!code) return;

    const storedGuestId = localStorage.getItem(`aux_guest_id_${code}`);
    if (!storedGuestId) {
      router.push('/');
      return;
    }

    fetchRoomData().finally(() => setLoading(false));

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`guest-room-${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aux_rooms', filter: `code=eq.${code}` }, payload => {
        if (payload.new && typeof payload.new === 'object') {
          const r = payload.new as Room;
          setRoom(r);
          if (r.current_track) {
            setCurrentTrack(r.current_track as unknown as CurrentTrack);
            setIsPlaying(r.is_playing);
          }
          if (r.status === 'ended') {
            router.push(`/wrapped/${r.id}`);
          }
        }
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aux_guests' }, () => {
        fetchRoomData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, fetchRoomData, router]);

  async function handleVoteCast(voteSessionId: string, vote: boolean) {
    if (!guestId || !code) return;
    await fetch(`/api/rooms/${code}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cast', guestId, voteSessionId, vote }),
    });
    fetchRoomData();
  }

  // Find aux holder name
  const auxHolderName = room?.current_aux_holder_id
    ? guests.find(g => g.id === room.current_aux_holder_id)?.name || null
    : null;

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎵</div>
          <p style={{ color: '#888' }}>Loading party...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😔</div>
          <p style={{ color: '#FF4444', fontSize: '18px', marginBottom: '16px' }}>{error}</p>
          <button
            onClick={() => router.push('/')}
            style={{ background: '#1DB954', color: '#000', border: 'none', borderRadius: '14px', padding: '14px 28px', fontWeight: 700, cursor: 'pointer', fontSize: '16px' }}
          >
            Go Home
          </button>
        </div>
      </div>
    );
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#1DB954', fontWeight: 900, fontSize: '20px' }}>Aux</span>
          <span style={{ fontFamily: 'monospace', color: '#555', fontSize: '14px', letterSpacing: '2px' }}>{code}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {guest?.name && <span style={{ color: '#888', fontSize: '13px' }}>{guest.name}</span>}
          <div style={{ background: '#111', border: '1px solid #1DB954', borderRadius: '8px', padding: '4px 10px', fontSize: '13px', fontWeight: 700, color: '#1DB954' }}>
            💳 {guest?.credits ?? 0}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ paddingTop: 'max(68px, calc(env(safe-area-inset-top) + 56px))' }}>
        {tab === 'now-playing' && (
          <NowPlayingTab
            track={currentTrack}
            isPlaying={isPlaying}
            auxHolderName={auxHolderName}
            credits={guest?.credits ?? 0}
            guestId={guestId || ''}
            roomCode={code || ''}
            activeVote={activeVote}
            onVoteCast={handleVoteCast}
          />
        )}
        {tab === 'queue' && (
          <QueueTab
            queue={queue}
            roomCode={code || ''}
            guestId={guestId || ''}
            onAdded={fetchRoomData}
          />
        )}
        {tab === 'vote' && (
          <VoteTab
            credits={guest?.credits ?? 0}
            guestId={guestId || ''}
            roomCode={code || ''}
            activeVote={activeVote}
            onVoteInitiated={fetchRoomData}
            onVoteCast={handleVoteCast}
          />
        )}
        {tab === 'battle' && (
          <BattleTab
            activeBattle={activeBattle}
            roomCode={code || ''}
            guestId={guestId || ''}
            onUpdate={fetchRoomData}
          />
        )}
        {tab === 'guests' && (
          <GuestsTab guests={guests} myGuestId={guestId || ''} />
        )}
      </div>

      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}
