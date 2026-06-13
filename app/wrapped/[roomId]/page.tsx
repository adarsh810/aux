'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Wrapped, WrappedSummary, PlayedTrack } from '@/lib/types';

function Slide({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        transition: 'opacity 0.4s, transform 0.4s',
        opacity: active ? 1 : 0,
        transform: active ? 'scale(1)' : 'scale(0.95)',
        pointerEvents: active ? 'auto' : 'none',
      }}
    >
      {children}
    </div>
  );
}

function TrackCard({ track }: { track: PlayedTrack }) {
  return (
    <div style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: '14px', padding: '12px', display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
      {track.track_image ? (
        <img src={track.track_image} alt="" style={{ width: '48px', height: '48px', borderRadius: '8px', flexShrink: 0 }} />
      ) : (
        <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>🎵</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.track_name || 'Unknown'}</div>
        <div style={{ color: '#888', fontSize: '12px' }}>{track.track_artist || 'Unknown'}</div>
      </div>
      <div style={{ display: 'flex', gap: '6px', fontSize: '12px', flexShrink: 0 }}>
        <span>🔥{track.fire_count}</span>
        <span>💀{track.skull_count}</span>
        <span>🕺{track.dance_count}</span>
      </div>
    </div>
  );
}

export default function WrappedPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = params.roomId;

  const [wrapped, setWrapped] = useState<Wrapped | null>(null);
  const [loading, setLoading] = useState(true);
  const [slide, setSlide] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchWrapped() {
      try {
        const res = await fetch(`/api/wrapped/${roomId}`);
        if (!res.ok) {
          setError('Party summary not found');
          return;
        }
        const data = await res.json();
        setWrapped(data);
      } catch {
        setError('Failed to load summary');
      } finally {
        setLoading(false);
      }
    }
    fetchWrapped();
  }, [roomId]);

  function nextSlide() {
    if (!wrapped) return;
    const totalSlides = 9;
    if (slide < totalSlides - 1) setSlide(s => s + 1);
  }

  function prevSlide() {
    if (slide > 0) setSlide(s => s - 1);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  async function handleShare() {
    const text = `Just had the best party on Aux 🎉 Check out our party recap!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Aux Party Recap', text, url: window.location.href });
      } catch {
        await navigator.clipboard.writeText(window.location.href).catch(() => {});
      }
    } else {
      await navigator.clipboard.writeText(window.location.href).catch(() => {});
      alert('Link copied!');
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <p style={{ color: '#888' }}>Loading party recap...</p>
        </div>
      </div>
    );
  }

  if (error || !wrapped) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '48px' }}>😔</div>
        <p style={{ color: '#FF4444', fontSize: '18px' }}>{error || 'Not found'}</p>
        <button onClick={() => router.push('/')} style={{ background: '#1DB954', color: '#000', border: 'none', borderRadius: '14px', padding: '14px 28px', fontWeight: 700, cursor: 'pointer', fontSize: '16px' }}>
          Go Home
        </button>
      </div>
    );
  }

  const s = wrapped.summary;
  const totalSlides = 9;

  const slides = [
    // Slide 0: Intro
    <div key="intro" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
      <h1 style={{ fontSize: '36px', fontWeight: 900, margin: '0 0 8px', color: '#1DB954' }}>The Party&apos;s Over</h1>
      <p style={{ color: '#888', fontSize: '18px', margin: '0 0 32px' }}>{formatDate(s.party_date)}</p>
      <div style={{ display: 'flex', gap: '24px', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '36px', fontWeight: 900, color: '#1DB954' }}>{s.total_guests}</div>
          <div style={{ color: '#888', fontSize: '14px' }}>Guests</div>
        </div>
        <div style={{ width: '1px', background: '#1A1A1A' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '36px', fontWeight: 900, color: '#1DB954' }}>{s.total_tracks}</div>
          <div style={{ color: '#888', fontSize: '14px' }}>Tracks</div>
        </div>
      </div>
    </div>,

    // Slide 1: Biggest Banger
    <div key="banger" style={{ textAlign: 'center', width: '100%', maxWidth: '320px' }}>
      <div style={{ fontSize: '48px', marginBottom: '8px' }}>🔥</div>
      <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '0 0 24px' }}>Biggest Banger</h2>
      {s.biggest_banger ? (
        <>
          {s.biggest_banger.track_image && (
            <img src={s.biggest_banger.track_image} alt="" style={{ width: '200px', height: '200px', borderRadius: '16px', objectFit: 'cover', marginBottom: '16px' }} />
          )}
          <p style={{ fontWeight: 800, fontSize: '20px', margin: '0 0 4px' }}>{s.biggest_banger.track_name}</p>
          <p style={{ color: '#888', margin: '0 0 12px' }}>{s.biggest_banger.track_artist}</p>
          <p style={{ color: '#1DB954', fontWeight: 700, fontSize: '24px' }}>🔥 {s.biggest_banger.fire_count} fires</p>
        </>
      ) : (
        <p style={{ color: '#888' }}>No reactions recorded</p>
      )}
    </div>,

    // Slide 2: Most Booed
    <div key="booed" style={{ textAlign: 'center', width: '100%', maxWidth: '320px' }}>
      <div style={{ fontSize: '48px', marginBottom: '8px' }}>💀</div>
      <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '0 0 24px' }}>Most Booed</h2>
      {s.most_booed ? (
        <>
          {s.most_booed.track_image && (
            <img src={s.most_booed.track_image} alt="" style={{ width: '200px', height: '200px', borderRadius: '16px', objectFit: 'cover', marginBottom: '16px' }} />
          )}
          <p style={{ fontWeight: 800, fontSize: '20px', margin: '0 0 4px' }}>{s.most_booed.track_name}</p>
          <p style={{ color: '#888', margin: '0 0 12px' }}>{s.most_booed.track_artist}</p>
          <p style={{ color: '#FF4444', fontWeight: 700, fontSize: '24px' }}>💀 {s.most_booed.skull_count} skulls</p>
        </>
      ) : (
        <p style={{ color: '#888' }}>No boos recorded</p>
      )}
    </div>,

    // Slide 3: Best Taste
    <div key="best" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '8px' }}>👑</div>
      <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '0 0 24px' }}>Best Taste</h2>
      {s.best_taste ? (
        <>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#1DB954', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: 900, color: '#000', margin: '0 auto 16px' }}>
            {s.best_taste.guest_name.charAt(0).toUpperCase()}
          </div>
          <p style={{ fontWeight: 800, fontSize: '24px', margin: '0 0 8px' }}>{s.best_taste.guest_name}</p>
          <p style={{ color: '#1DB954', fontWeight: 700 }}>avg vibe score: +{s.best_taste.avg_score.toFixed(1)}</p>
        </>
      ) : (
        <p style={{ color: '#888' }}>Not enough data</p>
      )}
    </div>,

    // Slide 4: Worst Taste
    <div key="worst" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '8px' }}>😈</div>
      <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '0 0 24px' }}>Worst Taste</h2>
      {s.worst_taste ? (
        <>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#FF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: 900, color: '#fff', margin: '0 auto 16px' }}>
            {s.worst_taste.guest_name.charAt(0).toUpperCase()}
          </div>
          <p style={{ fontWeight: 800, fontSize: '24px', margin: '0 0 8px' }}>{s.worst_taste.guest_name}</p>
          <p style={{ color: '#FF4444', fontWeight: 700 }}>avg vibe score: {s.worst_taste.avg_score.toFixed(1)}</p>
        </>
      ) : (
        <p style={{ color: '#888' }}>Not enough data</p>
      )}
    </div>,

    // Slide 5: Power User
    <div key="power" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '8px' }}>💸</div>
      <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '0 0 24px' }}>Power User</h2>
      {s.power_user ? (
        <>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#FFD700', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: 900, color: '#000', margin: '0 auto 16px' }}>
            {s.power_user.guest_name.charAt(0).toUpperCase()}
          </div>
          <p style={{ fontWeight: 800, fontSize: '24px', margin: '0 0 8px' }}>{s.power_user.guest_name}</p>
          <p style={{ color: '#FFD700', fontWeight: 700 }}>spent {s.power_user.credits_spent} credits</p>
        </>
      ) : (
        <p style={{ color: '#888' }}>Not enough data</p>
      )}
    </div>,

    // Slide 6: Top Bouncer
    <div key="bouncer" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '8px' }}>🚫</div>
      <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '0 0 24px' }}>The Bouncer</h2>
      {s.top_bouncer ? (
        <>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: 900, color: '#000', margin: '0 auto 16px' }}>
            {s.top_bouncer.guest_name.charAt(0).toUpperCase()}
          </div>
          <p style={{ fontWeight: 800, fontSize: '24px', margin: '0 0 8px' }}>{s.top_bouncer.guest_name}</p>
          <p style={{ color: '#888', fontWeight: 700 }}>initiated {s.top_bouncer.skip_votes} skip votes</p>
        </>
      ) : (
        <p style={{ color: '#888' }}>No skip votes</p>
      )}
    </div>,

    // Slide 7: Full Track List
    <div key="tracks" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
      <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎶</div>
      <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 16px' }}>All Tracks</h2>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '60vh',
          overflowY: 'auto',
          width: '100%',
        }}
      >
        {s.tracks.length === 0 ? (
          <p style={{ color: '#888' }}>No tracks played</p>
        ) : (
          s.tracks.map((track: PlayedTrack) => (
            <TrackCard key={track.id} track={track} />
          ))
        )}
      </div>
    </div>,

    // Slide 8: Share
    <div key="share" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎊</div>
      <h2 style={{ fontSize: '32px', fontWeight: 900, margin: '0 0 8px', color: '#1DB954' }}>What a party!</h2>
      <p style={{ color: '#888', margin: '0 0 32px', fontSize: '16px' }}>Share your party recap with your crew</p>
      <button
        onClick={handleShare}
        style={{
          background: '#1DB954',
          color: '#000',
          border: 'none',
          borderRadius: '16px',
          padding: '18px 36px',
          fontSize: '18px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'block',
          width: '100%',
          marginBottom: '12px',
        }}
      >
        Share Recap 🔗
      </button>
      <button
        onClick={() => router.push('/')}
        style={{
          background: 'transparent',
          color: '#888',
          border: '1px solid #1A1A1A',
          borderRadius: '16px',
          padding: '16px 36px',
          fontSize: '16px',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        Host Another Party
      </button>
    </div>,
  ];

  return (
    <div
      style={{ background: '#0A0A0A', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}
      onClick={nextSlide}
    >
      {/* Progress dots */}
      <div style={{ position: 'fixed', top: 'max(20px, env(safe-area-inset-top))', left: 0, right: 0, display: 'flex', gap: '4px', padding: '0 16px', zIndex: 10 }}>
        {Array.from({ length: totalSlides }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: '3px',
              borderRadius: '2px',
              background: i <= slide ? '#1DB954' : '#1A1A1A',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      {/* Slides container */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', paddingTop: '48px' }}>
        {slides.map((slideEl, idx) => (
          <Slide key={idx} active={idx === slide}>
            {slideEl}
          </Slide>
        ))}
      </div>

      {/* Navigation hint */}
      {slide < totalSlides - 1 && (
        <div style={{ position: 'fixed', bottom: 'max(24px, env(safe-area-inset-bottom))', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
          <p style={{ color: '#555', fontSize: '13px' }}>Tap to continue</p>
        </div>
      )}

      {/* Back button for prev navigation */}
      {slide > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); prevSlide(); }}
          style={{
            position: 'fixed',
            top: 'max(56px, calc(env(safe-area-inset-top) + 36px))',
            left: '16px',
            background: 'rgba(17,17,17,0.8)',
            border: 'none',
            color: '#888',
            borderRadius: '8px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '14px',
            zIndex: 20,
          }}
        >
          ← Back
        </button>
      )}
    </div>
  );
}
