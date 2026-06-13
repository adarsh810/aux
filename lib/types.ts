export interface Host {
  id: string;
  spotify_id: string;
  display_name: string | null;
  avatar_url: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  created_at: string;
}

export interface Room {
  id: string;
  code: string;
  host_id: string;
  status: 'waiting' | 'active' | 'ended';
  device_id: string | null;
  device_name: string | null;
  current_track: SpotifyTrack | null;
  is_playing: boolean;
  current_aux_holder_id: string | null;
  aux_songs_remaining: number;
  vetoes_remaining: number;
  created_at: string;
  ended_at: string | null;
}

export interface Guest {
  id: string;
  room_id: string;
  session_id: string;
  name: string;
  credits: number;
  is_muted: boolean;
  joined_at: string;
}

export interface QueueItem {
  id: string;
  room_id: string;
  track_uri: string;
  track_name: string;
  track_artist: string;
  track_image: string | null;
  track_duration_ms: number | null;
  suggested_by: string | null;
  suggested_by_name: string | null;
  position: number;
  status: 'queued' | 'playing' | 'played' | 'skipped';
  added_at: string;
}

export interface Reaction {
  id: string;
  room_id: string;
  track_uri: string;
  guest_id: string;
  type: 'fire' | 'skull' | 'dance';
  created_at: string;
}

export interface VoteSession {
  id: string;
  room_id: string;
  type: 'skip' | 'challenge' | 'pull_aux';
  initiated_by: string | null;
  target_id: string | null;
  yes_votes: number;
  no_votes: number;
  required: number;
  status: 'active' | 'passed' | 'failed' | 'expired';
  expires_at: string;
  created_at: string;
}

export interface VoteRecord {
  id: string;
  vote_session_id: string;
  guest_id: string;
  vote: boolean;
}

export interface Battle {
  id: string;
  room_id: string;
  track_a: SpotifyTrack;
  track_b: SpotifyTrack | null;
  suggested_by_a: string | null;
  suggested_by_b: string | null;
  votes_a: number;
  votes_b: number;
  winner: 'a' | 'b' | null;
  status: 'waiting_b' | 'voting' | 'resolved';
  expires_at: string | null;
  created_at: string;
}

export interface BattleVote {
  id: string;
  battle_id: string;
  guest_id: string;
  choice: 'a' | 'b';
}

export interface PlayedTrack {
  id: string;
  room_id: string;
  track_uri: string;
  track_name: string | null;
  track_artist: string | null;
  track_image: string | null;
  played_by: string | null;
  played_by_name: string | null;
  fire_count: number;
  skull_count: number;
  dance_count: number;
  played_at: string;
}

export interface WrappedSummary {
  total_guests: number;
  total_tracks: number;
  party_date: string;
  biggest_banger: {
    track_name: string;
    track_artist: string;
    track_image: string | null;
    fire_count: number;
  } | null;
  most_booed: {
    track_name: string;
    track_artist: string;
    track_image: string | null;
    skull_count: number;
  } | null;
  best_taste: {
    guest_name: string;
    avg_score: number;
  } | null;
  worst_taste: {
    guest_name: string;
    avg_score: number;
  } | null;
  power_user: {
    guest_name: string;
    credits_spent: number;
  } | null;
  top_bouncer: {
    guest_name: string;
    skip_votes: number;
  } | null;
  tracks: PlayedTrack[];
}

export interface Wrapped {
  id: string;
  room_id: string;
  host_id: string;
  summary: WrappedSummary;
  created_at: string;
}

export interface SpotifyTrack {
  uri: string;
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string; width: number; height: number }[];
  };
  duration_ms: number;
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  volume_percent: number | null;
}

export interface SpotifyPlayback {
  is_playing: boolean;
  progress_ms: number | null;
  item: SpotifyTrack | null;
  device: SpotifyDevice | null;
}
