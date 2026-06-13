'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const router = useRouter();
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [hostLoading, setHostLoading] = useState(false);

  useEffect(() => {
    // Ensure session ID exists
    if (!localStorage.getItem('aux_session_id')) {
      localStorage.setItem('aux_session_id', uuidv4());
    }
  }, []);

  async function handleHostParty() {
    setHostLoading(true);
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        router.push('/host/setup');
      } else {
        window.location.href = '/api/auth/login';
      }
    } catch {
      window.location.href = '/api/auth/login';
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim() || !joinName.trim()) {
      setJoinError('Enter your name and the party code');
      return;
    }

    setJoining(true);
    setJoinError('');

    const sessionId = localStorage.getItem('aux_session_id') || uuidv4();
    localStorage.setItem('aux_session_id', sessionId);

    try {
      const res = await fetch(`/api/rooms/${joinCode.toUpperCase()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: joinName.trim(), sessionId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setJoinError(data.error || 'Failed to join');
        setJoining(false);
        return;
      }

      const data = await res.json();
      localStorage.setItem(`aux_guest_id_${joinCode.toUpperCase()}`, data.guestId);
      router.push(`/room/${joinCode.toUpperCase()}`);
    } catch {
      setJoinError('Something went wrong');
      setJoining(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#0A0A0A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1
          style={{
            fontSize: '72px',
            fontWeight: 900,
            letterSpacing: '-2px',
            color: '#1DB954',
            margin: 0,
            lineHeight: 1,
          }}
        >
          Aux
        </h1>
        <p style={{ color: '#888', fontSize: '18px', marginTop: '12px' }}>
          Everyone&apos;s got the aux.
        </p>
      </div>

      {!showJoin ? (
        <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button
            onClick={handleHostParty}
            disabled={hostLoading}
            style={{
              background: '#1DB954',
              color: '#000',
              border: 'none',
              borderRadius: '16px',
              padding: '18px',
              fontSize: '18px',
              fontWeight: 700,
              cursor: 'pointer',
              minHeight: '56px',
              width: '100%',
              opacity: hostLoading ? 0.7 : 1,
            }}
          >
            {hostLoading ? 'Loading...' : '🎧 Host a Party'}
          </button>

          <button
            onClick={() => setShowJoin(true)}
            style={{
              background: '#111111',
              color: '#fff',
              border: '1px solid #1A1A1A',
              borderRadius: '16px',
              padding: '18px',
              fontSize: '18px',
              fontWeight: 700,
              cursor: 'pointer',
              minHeight: '56px',
              width: '100%',
            }}
          >
            🎉 Join a Party
          </button>
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            maxWidth: '360px',
            background: '#111111',
            border: '1px solid #1A1A1A',
            borderRadius: '20px',
            padding: '24px',
          }}
          className="animate-fade-in"
        >
          <h2 style={{ margin: '0 0 20px', fontSize: '22px', fontWeight: 700 }}>Join a Party</h2>
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              placeholder="Party code (e.g. ABCDEF)"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              maxLength={6}
              style={{ textTransform: 'uppercase', letterSpacing: '4px', fontSize: '22px', textAlign: 'center' }}
              autoFocus
            />
            <input
              type="text"
              placeholder="Your name"
              value={joinName}
              onChange={e => setJoinName(e.target.value.slice(0, 30))}
              maxLength={30}
            />
            {joinError && (
              <p style={{ color: '#FF4444', fontSize: '14px', margin: 0 }}>{joinError}</p>
            )}
            <button
              type="submit"
              disabled={joining}
              style={{
                background: '#1DB954',
                color: '#000',
                border: 'none',
                borderRadius: '14px',
                padding: '16px',
                fontSize: '17px',
                fontWeight: 700,
                cursor: 'pointer',
                minHeight: '52px',
                opacity: joining ? 0.7 : 1,
                marginTop: '4px',
              }}
            >
              {joining ? 'Joining...' : 'Join Party'}
            </button>
            <button
              type="button"
              onClick={() => { setShowJoin(false); setJoinError(''); }}
              style={{
                background: 'transparent',
                color: '#888',
                border: 'none',
                fontSize: '15px',
                cursor: 'pointer',
                padding: '8px',
              }}
            >
              Cancel
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
