/**
 * musicMapData.ts
 *
 * Data layer for the Music Map.
 *
 * DEV MODE (right now)
 *   Imports generatedMusicMap.json at build time — no server needed.
 *
 * PRODUCTION MODE (when you go live)
 *   The `useMusicMap` hook fetches from GET /api/music-map, which your
 *   backend serves from the database. No code changes needed in MusicMapPage —
 *   just swap the import at the bottom of this file.
 *
 * The Python script (generate_music_map.py) runs as a background job on your
 *   server and writes coordinates back to the DB. The frontend never calls it
 *   directly — it only reads the result via the API endpoint.
 */

import { useState, useEffect } from 'react';
import rawData from './generatedMusicMap.json';

// ─── Types (shared between dev and prod) ──────────────────────────────────────

export type AudioFeatures = {
  danceability:     number;
  energy:           number;
  valence:          number;
  acousticness:     number;
  instrumentalness: number;
  liveness:         number;
  speechiness:      number;
  tempo:            number;
  loudness:         number;
};

export type MapPost = {
  userId:    string;
  songTitle: string;
  artist:    string;
  caption:   string;
  features:  AudioFeatures;
  postedAt:  string;
};

export type MapUser = {
  id:          string;
  username:    string;
  displayName: string;
  avatarUrl:   string | null;
};

export type UserMapPosition = {
  user:      MapUser;
  x:         number;
  y:         number;
  songToday: MapPost;
};

export type MapLoadState =
  | { status: 'loading' }
  | { status: 'ready';   positions: UserMapPosition[] }
  | { status: 'error';   message: string };

// ─── Synthetic user fallback (dev only) ───────────────────────────────────────

const ANON_NAMES = [
  'wavecatcher', 'basshead',   'melodica',   'groovebot',  'sinewave',
  'chordcrush',  'tempohead',  'subfreq',    'pitchpine',  'loophole',
  'beatsync',    'reverbcat',  'trackmind',  'vinyljinn',  'soundbyte',
  'ritardando',  'cadenzio',   'arpeggist',  'leitmotif',  'coda_kid',
  'dropbeat',    'fadeout',    'cuttime',    'halfstep',   'modwheel',
  'glissando',   'tremolux',   'waveform',   'sidechain',  'lofi_haus',
  'chromatic9',  'sustain_',   'flangehead', 'notewise',   'beatcraft',
  'overtone_',   'bassclef',   'arpwave',    'mixdown',    'audionaut',
  'polyrhythm',  'distortion', 'pitchdeck',  'synthpulse', 'resampler',
  'drumnbass',   'vocalchop',  'patchbay',   'kickdrum',   'hifiuser',
];

const MOCK_CAPTIONS = [
  'this one has been on repeat all week',
  'found this gem at 2am, no regrets',
  'the bridge in this song destroys me every time',
  'perfect for a rainy tuesday honestly',
  'my roommate hates that i play this so loud',
  'this is what healing sounds like',
  'cannot stop thinking about the production on this',
  'three years later and it still hits different',
  'played this at sunrise and cried a little',
  'underrated. i said what i said.',
];

function syntheticUser(userId: string): MapUser {
  const num = parseInt(userId.replace(/\D/g, ''), 10) || 0;
  const name = ANON_NAMES[(num - 1) % ANON_NAMES.length] ?? `user_${num}`;
  return {
    id:          userId,
    username:    name,
    displayName: name.charAt(0).toUpperCase() + name.slice(1),
    avatarUrl:   null,
  };
}

function mockCaption(userId: string, songTitle: string): string {
  let h = 0;
  for (const c of userId + songTitle) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return MOCK_CAPTIONS[h % MOCK_CAPTIONS.length];
}

// ─── Raw → typed position (used by both dev and prod paths) ──────────────────

export function hydratePosition(
  raw: any,
  resolveUser: (id: string) => MapUser,
): UserMapPosition {
  const user = resolveUser(raw.userId);
  return {
    user,
    x: raw.x,
    y: raw.y,
    songToday: {
      userId:    raw.userId,
      songTitle: raw.songToday.songTitle,
      artist:    raw.songToday.artist,
      caption:   raw.songToday.caption ?? mockCaption(raw.userId, raw.songToday.songTitle),
      features:  raw.songToday.features as AudioFeatures,
      postedAt:  raw.songToday.postedAt ?? new Date().toISOString(),
    },
  };
}

// ─── DEV: static JSON import ──────────────────────────────────────────────────
// This is what runs right now. Switch to `useMusicMapLive` when the API exists.

const DEV_POSITIONS: UserMapPosition[] = (rawData as any[]).map(d =>
  hydratePosition(d, syntheticUser)
);

/** Dev hook — synchronous, no loading state needed. */
export function useMusicMapDev(): MapLoadState {
  return { status: 'ready', positions: DEV_POSITIONS };
}

// ─── PROD: live API hook ──────────────────────────────────────────────────────
/**
 * Fetches map positions from your backend API.
 *
 * Your backend endpoint (GET /api/music-map) should return:
 * {
 *   positions: Array<{
 *     userId:    string,
 *     x:         number,
 *     y:         number,
 *     songToday: { songTitle, artist, caption, features, postedAt }
 *   }>,
 *   users: Array<{
 *     id, username, displayName, avatarUrl
 *   }>,
 *   computedAt: string   // ISO timestamp of last recompute
 * }
 *
 * The hook re-fetches every `refreshIntervalMs` (default 5 minutes).
 * MusicMapPage smoothly animates nodes to new positions when data refreshes.
 */
export function useMusicMapLive(
  apiUrl = '/api/music-map',
  refreshIntervalMs = 5 * 60 * 1000,  // 5 minutes
): MapLoadState {
  const [state, setState] = useState<MapLoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function fetchPositions() {
      try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (cancelled) return;

        // Build a user lookup map from the response
        const userMap = new Map<string, MapUser>(
          (data.users ?? []).map((u: any) => [u.id, {
            id:          u.id,
            username:    u.username,
            displayName: u.displayName,
            avatarUrl:   u.avatarUrl ?? null,
          }])
        );

        const resolveUser = (id: string): MapUser =>
          userMap.get(id) ?? syntheticUser(id);

        const positions = (data.positions ?? []).map((raw: any) =>
          hydratePosition(raw, resolveUser)
        );

        setState({ status: 'ready', positions });
      } catch (err) {
        if (!cancelled) {
          setState({ status: 'error', message: String(err) });
        }
      }
    }

    fetchPositions();
    const interval = setInterval(fetchPositions, refreshIntervalMs);
    return () => { cancelled = true; clearInterval(interval); };
  }, [apiUrl, refreshIntervalMs]);

  return state;
}

// ─── Active export ────────────────────────────────────────────────────────────
// Swap this one line when going live:
//   DEV:  export const useMusicMap = useMusicMapDev;
//   PROD: export const useMusicMap = useMusicMapLive;
export const useMusicMap = useMusicMapDev;

// Legacy sync export for backward compat during migration
// (MusicMapPage currently reads this directly — update it to use the hook)
export const userMapPositions: UserMapPosition[] = DEV_POSITIONS;
