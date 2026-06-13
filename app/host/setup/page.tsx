'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { SpotifyDevice } from '@/lib/types';

function DeviceIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t.includes('computer')) return <span style={{ fontSize: '32px' }}>💻</span>;
  if (t.includes('phone') || t.includes('mobile')) return <span style={{ fontSize: '32px' }}>📱</span>;
  if (t.includes('speaker')) return <span style={{ fontSize: '32px' }}>🔊</span>;
  if (t.includes('tv') || t.includes('television')) return <span style={{ fontSize: '32px' }}>📺</span>;
  return <span style={{ fontSize: '32px' }}>🎵</span>;
}

export default function HostSetup() {
  const router = useRouter();
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<SpotifyDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  async function fetchDevices() {
    setLoading(true);
    try {
      const res = await fetch('/api/spotify/devices');
      if (res.status === 401) {
        router.push('/');
        return;
      }
      const data = await res.json();
      setDevices(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load devices');
    } finally {
      setLoading(false);
    }
  }

  async function handleStartParty() {
    if (!selectedDevice) return;
    setCreating(true);
    setError('');

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          deviceName: selectedDevice.name,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create room');
        setCreating(false);
        return;
      }

      const data = await res.json();
      setCreatedCode(data.code);
    } catch {
      setError('Something went wrong');
      setCreating(false);
    }
  }

  async function copyCode() {
    if (createdCode) {
      await navigator.clipboard.writeText(createdCode).catch(() => {});
    }
  }

  if (createdCode) {
    return (
      <main style={{ minHeight: '100dvh', background: '#0A0A0A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', maxWidth: '360px', width: '100%' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Party Created!</h2>
          <p style={{ color: '#888', marginBottom: '32px' }}>Share this code with your guests</p>

          <div
            onClick={copyCode}
            style={{
              background: '#111',
              border: '2px solid #1DB954',
              borderRadius: '20px',
              padding: '24px',
              cursor: 'pointer',
              marginBottom: '32px',
            }}
          >
            <div style={{ fontSize: '52px', fontWeight: 900, letterSpacing: '12px', color: '#1DB954', fontFamily: 'monospace' }}>
              {createdCode}
            </div>
            <p style={{ color: '#888', fontSize: '14px', marginTop: '8px' }}>Tap to copy</p>
          </div>

          <button
            onClick={() => router.push(`/host/${createdCode}`)}
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
            }}
          >
            Go to Party →
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100dvh', background: '#0A0A0A', padding: '24px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ paddingTop: '48px', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0 }}>Choose a Device</h1>
          <p style={{ color: '#888', marginTop: '8px' }}>Select where music will play</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#888' }}>
            Loading devices...
          </div>
        ) : devices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎵</div>
            <p style={{ color: '#888', marginBottom: '16px' }}>No devices found</p>
            <p style={{ color: '#555', fontSize: '14px', marginBottom: '24px' }}>
              Open Spotify on your phone, computer, or speaker and try again.
            </p>
            <button
              onClick={fetchDevices}
              style={{
                background: '#1DB954',
                color: '#000',
                border: 'none',
                borderRadius: '14px',
                padding: '14px 28px',
                fontSize: '16px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {devices.map(device => (
                <button
                  key={device.id}
                  onClick={() => setSelectedDevice(device)}
                  style={{
                    background: selectedDevice?.id === device.id ? '#1A2E1A' : '#111',
                    border: `2px solid ${selectedDevice?.id === device.id ? '#1DB954' : '#1A1A1A'}`,
                    borderRadius: '16px',
                    padding: '16px 20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    textAlign: 'left',
                    color: '#fff',
                    width: '100%',
                  }}
                >
                  <DeviceIcon type={device.type} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '17px' }}>{device.name}</div>
                    <div style={{ color: '#888', fontSize: '13px', textTransform: 'capitalize' }}>
                      {device.type.toLowerCase()}
                      {device.is_active && <span style={{ color: '#1DB954', marginLeft: '8px' }}>● Active</span>}
                    </div>
                  </div>
                  {selectedDevice?.id === device.id && (
                    <span style={{ color: '#1DB954', fontSize: '20px' }}>✓</span>
                  )}
                </button>
              ))}
            </div>

            {error && <p style={{ color: '#FF4444', marginBottom: '16px' }}>{error}</p>}

            <button
              onClick={handleStartParty}
              disabled={!selectedDevice || creating}
              style={{
                background: selectedDevice ? '#1DB954' : '#333',
                color: selectedDevice ? '#000' : '#666',
                border: 'none',
                borderRadius: '16px',
                padding: '18px',
                fontSize: '18px',
                fontWeight: 700,
                cursor: selectedDevice ? 'pointer' : 'not-allowed',
                minHeight: '56px',
                width: '100%',
                opacity: creating ? 0.7 : 1,
              }}
            >
              {creating ? 'Starting Party...' : '🎉 Start Party'}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
