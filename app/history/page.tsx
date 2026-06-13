'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Wrapped } from '@/lib/types';

export default function HistoryPage() {
  const router = useRouter();
  const [parties, setParties] = useState<Wrapped[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch('/api/history');
        if (res.status === 401) {
          router.push('/');
          return;
        }
        if (!res.ok) {
          setError('Failed to load history');
          return;
        }
        const data = await res.json();
        setParties(Array.isArray(data) ? data : []);
      } catch {
        setError('Something went wrong');
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [router]);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎵</div>
          <p style={{ color: '#888' }}>Loading history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#FF4444', marginBottom: '16px' }}>{error}</p>
          <button onClick={() => router.push('/')} style={{ background: '#1DB954', color: '#000', border: 'none', borderRadius: '14px', padding: '14px 28px', fontWeight: 700, cursor: 'pointer', fontSize: '16px' }}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0A0A0A', padding: '24px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ paddingTop: '48px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => router.push('/host/setup')}
            style={{ background: 'none', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
          >
            ←
          </button>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0 }}>Party History</h1>
        </div>

        {parties.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: '64px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
            <p style={{ color: '#888', fontSize: '18px', marginBottom: '8px' }}>No parties yet</p>
            <p style={{ color: '#555', fontSize: '14px', marginBottom: '24px' }}>Host your first party to see the recap here!</p>
            <button
              onClick={() => router.push('/host/setup')}
              style={{ background: '#1DB954', color: '#000', border: 'none', borderRadius: '14px', padding: '14px 28px', fontWeight: 700, cursor: 'pointer', fontSize: '16px' }}
            >
              Host a Party
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {parties.map(party => (
              <button
                key={party.id}
                onClick={() => router.push(`/wrapped/${party.room_id}`)}
                style={{
                  background: '#111',
                  border: '1px solid #1A1A1A',
                  borderRadius: '18px',
                  padding: '20px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: '#fff',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '6px' }}>
                      🎉 {formatDate(party.created_at)}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', color: '#888', fontSize: '13px' }}>
                      <span>👥 {party.summary.total_guests} guests</span>
                      <span>🎵 {party.summary.total_tracks} tracks</span>
                    </div>
                    {party.summary.biggest_banger && (
                      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>🔥</span>
                        <span style={{ color: '#888', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                          {party.summary.biggest_banger.track_name}
                        </span>
                      </div>
                    )}
                  </div>
                  <span style={{ color: '#1DB954', fontSize: '20px' }}>→</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
