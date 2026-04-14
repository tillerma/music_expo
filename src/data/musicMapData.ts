/**
 * musicMapData.ts
 *
 * Data layer for the Music Map.
 *
 * SUPABASE MODE (active)
 *   `useMusicMapSupabase` fetches posts → songs → profiles directly from
 *   Supabase, averages each user's audio features, then runs PCA in the
 *   browser to produce 2-D coordinates.
 *
 *   If the Python scheduler (scheduler.py) has already written pre-computed
 *   PCA+UMAP positions to the `map_positions` table, those are used instead
 *   (higher quality, UMAP non-linearities included).
 *
 * DEV MODE (fallback)
 *   `useMusicMapDev` loads generatedMusicMap.json — no network needed.
 *
 * PROD API MODE
 *   `useMusicMapLive` fetches from GET /api/music-map if you add a server.
 */

import { useState, useEffect } from 'react';
import rawData from './generatedMusicMap.json';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  userId:     string;
  songTitle:  string;
  artist:     string;
  albumArt:   string | null;
  spotifyUrl: string | null;
  caption:    string;
  features:   AudioFeatures;
  postedAt:   string;
  postDate:   string;
  tags:       { name: string; count: number }[];
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

// ─── Feature column order (must match Supabase songs schema) ──────────────────

const FEATURE_KEYS: (keyof AudioFeatures)[] = [
  'danceability', 'energy', 'valence', 'acousticness',
  'instrumentalness', 'liveness', 'speechiness', 'tempo', 'loudness',
];

// ─── PCA implementation (no external library needed) ─────────────────────────
//
// Steps:
//   1. Standardise each feature to mean=0, std=1  (mimics sklearn StandardScaler)
//   2. Build the 9×9 covariance matrix
//   3. Extract top-2 eigenvectors via power iteration + deflation
//   4. Project the standardised data onto those 2 components → x, y

function computePCA2D(X: number[][]): [number, number][] {
  const n = X.length;
  if (n < 2) return X.map(() => [0, 0]);

  const d = X[0].length;

  // 1. Standardise
  const means = Array.from({ length: d }, (_, j) =>
    X.reduce((s, r) => s + r[j], 0) / n,
  );
  const stds = Array.from({ length: d }, (_, j) => {
    const v = X.reduce((s, r) => s + (r[j] - means[j]) ** 2, 0) / n;
    return Math.sqrt(v) || 1;
  });
  const Xs = X.map(row => row.map((v, j) => (v - means[j]) / stds[j]));

  // 2. Covariance matrix (d×d)
  const cov: number[][] = Array.from({ length: d }, (_, i) =>
    Array.from({ length: d }, (_, j) =>
      Xs.reduce((s, r) => s + r[i] * r[j], 0) / (n - 1 || 1),
    ),
  );

  // 3. Power iteration for top-2 eigenvectors
  const deflated = cov.map(row => [...row]);
  const pcs: number[][] = [];

  for (let k = 0; k < 2; k++) {
    // Deterministic seed so the map is stable across refreshes
    let v = Array.from({ length: d }, (_, i) => Math.sin(i * 13.7 + k * 7.3));
    let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    v = v.map(x => x / norm);

    for (let iter = 0; iter < 300; iter++) {
      const nv = Array<number>(d).fill(0);
      for (let i = 0; i < d; i++)
        for (let j = 0; j < d; j++)
          nv[i] += deflated[i][j] * v[j];
      norm = Math.sqrt(nv.reduce((s, x) => s + x * x, 0)) || 1;
      v = nv.map(x => x / norm);
    }

    pcs.push(v);

    // Deflate: remove this component so next iteration finds the next one
    const Mv = deflated.map(row => row.reduce((s, m, j) => s + m * v[j], 0));
    const eigenval = v.reduce((s, vi, i) => s + vi * Mv[i], 0);
    for (let i = 0; i < d; i++)
      for (let j = 0; j < d; j++)
        deflated[i][j] -= eigenval * v[i] * v[j];
  }

  const [pc1, pc2] = pcs;
  return Xs.map(row => [
    row.reduce((s, v, i) => s + v * pc1[i], 0),
    row.reduce((s, v, i) => s + v * pc2[i], 0),
  ]);
}

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

// ─── Raw → typed position (used by dev and prod paths) ───────────────────────

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
      userId:     raw.userId,
      songTitle:  raw.songToday.songTitle,
      artist:     raw.songToday.artist,
      albumArt:   raw.songToday.albumArt ?? null,
      spotifyUrl: raw.songToday.spotifyUrl ?? null,
      caption:    raw.songToday.caption ?? mockCaption(raw.userId, raw.songToday.songTitle),
      features:   raw.songToday.features as AudioFeatures,
      postedAt:   raw.songToday.postedAt ?? new Date().toISOString(),
      postDate:   raw.songToday.postDate ?? (raw.songToday.postedAt ?? new Date().toISOString()).slice(0, 10),
      tags:       raw.songToday.tags ?? [],
    },
  };
}

// ─── SUPABASE: live hook with client-side PCA ─────────────────────────────────
/**
 * Fetches real post+song+profile data from Supabase and computes PCA in the
 * browser to position users on the map.
 *
 * Priority:
 *   1. If the `map_positions` table has rows (written by the Python scheduler
 *      which runs full PCA+UMAP), use those — they include UMAP non-linearities.
 *   2. Otherwise, fetch `posts` → `songs` → `profiles`, average each user's
 *      audio features, and run PCA-2D directly in the browser.
 *
 * Refreshes every `refreshIntervalMs` (default 5 minutes).
 */
export function useMusicMapSupabase(
  refreshIntervalMs = 5 * 60 * 1000,
): MapLoadState {
  const [state, setState] = useState<MapLoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function fetchAndCompute() {
      try {
        // ── Priority 1: pre-computed UMAP positions from scheduler ────────────
        // Order by computed_at DESC so the first row we encounter per user is
        // their most-recent entry (the scheduler may insert one row per post).
        const { data: precomputed } = await supabase
          .from('map_positions')
          .select(`
            user_id, x, y, song_title, artist, album_art, caption, features, computed_at,
            profiles!map_positions_user_id_fkey (
              username, display_name, avatar_url
            )
          `)
          .order('computed_at', { ascending: false });

        if (!cancelled && precomputed && precomputed.length > 0) {
          // One node per user: the first row encountered (most recent) wins.
          const seenIds = new Set<string>();
          const positions: UserMapPosition[] = [];

          for (const row of precomputed as any[]) {
            const uid = String(row.user_id ?? '');
            if (!uid || seenIds.has(uid)) continue;
            seenIds.add(uid);
            positions.push({
              user: {
                id:          uid,
                username:    row.profiles?.username    ?? `user_${uid.slice(0, 6)}`,
                displayName: row.profiles?.display_name ?? row.profiles?.username ?? 'Unknown',
                avatarUrl:   row.profiles?.avatar_url  ?? null,
              },
              x: row.x,
              y: row.y,
              songToday: {
                userId:     uid,
                songTitle:  row.song_title ?? '',
                artist:     row.artist     ?? '',
                albumArt:   row.album_art  ?? null,
                spotifyUrl: row.spotify_url ?? null,
                caption:    row.caption    ?? '',
                features:   row.features   as AudioFeatures,
                postedAt:   row.computed_at ?? new Date().toISOString(),
                postDate:   (row.computed_at ?? new Date().toISOString()).slice(0, 10),
                tags:       [],
              },
            });
          }

          setState({ status: 'ready', positions });
          return;
        }

        // ── Priority 2: compute PCA from posts+songs in real time ─────────────
        const { data: posts, error } = await supabase
          .from('posts')
          .select(`
            user_id, caption, created_at, post_date,
            songs!posts_song_id_fkey (
              song_title, artist, album_art, spotify_url, tags,
              danceability, energy, valence, acousticness,
              instrumentalness, liveness, speechiness, tempo, loudness
            ),
            profiles!posts_user_id_fkey (
              id, username, display_name, avatar_url
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (cancelled) return;

        if (!posts || posts.length === 0) {
          setState({ status: 'ready', positions: [] });
          return;
        }

        // Posts arrive newest-first (ORDER BY created_at DESC).
        // We collect:
        //   • latestPost  – the first (most recent) post that has a song, per user
        //   • allFeatures – audio features from ALL posts for that user (for PCA)
        type UserAcc = {
          profile:    any;
          latestPost: any;           // most-recent post with a song
          allFeatures: AudioFeatures[];
        };

        const byUser = new Map<string, UserAcc>();

        for (const post of posts as any[]) {
          const uid = String(post.user_id ?? '');
          if (!uid) continue;

          const song = post.songs as any;

          if (!byUser.has(uid)) {
            // First (most recent) post for this user — use it as the display post
            // even if it has no song; we'll update once we find one with a song.
            byUser.set(uid, { profile: post.profiles, latestPost: post, allFeatures: [] });
          }

          if (song) {
            const acc = byUser.get(uid)!;
            // If the stored latestPost has no song, upgrade to this one
            if (!acc.latestPost.songs) acc.latestPost = post;
            acc.allFeatures.push({
              danceability:     song.danceability     ?? 0,
              energy:           song.energy           ?? 0,
              valence:          song.valence           ?? 0,
              acousticness:     song.acousticness     ?? 0,
              instrumentalness: song.instrumentalness ?? 0,
              liveness:         song.liveness         ?? 0,
              speechiness:      song.speechiness      ?? 0,
              tempo:            song.tempo             ?? 0,
              loudness:         song.loudness          ?? 0,
            });
          }
        }

        // Keep only users that have at least one post with audio features
        const userIds = [...byUser.keys()].filter(uid => byUser.get(uid)!.allFeatures.length > 0);

        // Build feature matrix — one averaged vector per user
        const featureMatrix = userIds.map(uid => {
          const { allFeatures } = byUser.get(uid)!;
          return FEATURE_KEYS.map(k =>
            allFeatures.reduce((s, f) => s + f[k], 0) / allFeatures.length,
          );
        });

        // PCA → 2D coordinates
        const coords = computePCA2D(featureMatrix);

        // One UserMapPosition per user — guaranteed by the Map above
        const positions: UserMapPosition[] = userIds.map((uid, i) => {
          const { profile, latestPost, allFeatures } = byUser.get(uid)!;
          const song = latestPost.songs as any;

          const avgFeatures = Object.fromEntries(
            FEATURE_KEYS.map(k => [
              k,
              allFeatures.reduce((s, f) => s + f[k], 0) / allFeatures.length,
            ]),
          ) as AudioFeatures;

          return {
            user: {
              id:          uid,
              username:    profile?.username    ?? `user_${uid.slice(0, 6)}`,
              displayName: profile?.display_name ?? profile?.username ?? 'Unknown',
              avatarUrl:   profile?.avatar_url  ?? null,
            },
            x: coords[i][0],
            y: coords[i][1],
            songToday: {
              userId:     uid,
              songTitle:  song?.song_title  ?? 'Unknown',
              artist:     song?.artist      ?? 'Unknown',
              albumArt:   song?.album_art   ?? null,
              spotifyUrl: song?.spotify_url ?? null,
              caption:    latestPost.caption ?? '',
              features:   avgFeatures,
              postedAt:   latestPost.created_at ?? new Date().toISOString(),
              postDate:   latestPost.post_date  ?? (latestPost.created_at ?? new Date().toISOString()).slice(0, 10),
              tags:       song?.tags ?? [],
            },
          };
        });

        setState({ status: 'ready', positions });
      } catch (err) {
        if (!cancelled) setState({ status: 'error', message: String(err) });
      }
    }

    fetchAndCompute();
    const interval = setInterval(fetchAndCompute, refreshIntervalMs);
    return () => { cancelled = true; clearInterval(interval); };
  }, [refreshIntervalMs]);

  return state;
}

// ─── DEV: static JSON import ──────────────────────────────────────────────────

const DEV_POSITIONS: UserMapPosition[] = (rawData as any[]).map(d =>
  hydratePosition(d, syntheticUser)
);

/** Dev hook — synchronous, no loading state needed. */
export function useMusicMapDev(): MapLoadState {
  return { status: 'ready', positions: DEV_POSITIONS };
}

// ─── PROD API: live API hook (optional, if you add a backend server) ──────────

export function useMusicMapLive(
  apiUrl = '/api/music-map',
  refreshIntervalMs = 5 * 60 * 1000,
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
        if (!cancelled) setState({ status: 'error', message: String(err) });
      }
    }

    fetchPositions();
    const interval = setInterval(fetchPositions, refreshIntervalMs);
    return () => { cancelled = true; clearInterval(interval); };
  }, [apiUrl, refreshIntervalMs]);

  return state;
}

// ─── Active export ────────────────────────────────────────────────────────────
//   SUPABASE (live data + client-side PCA):  export const useMusicMap = useMusicMapSupabase;
//   DEV (static JSON):                        export const useMusicMap = useMusicMapDev;
//   PROD API (backend server):                export const useMusicMap = useMusicMapLive;
export const useMusicMap = useMusicMapSupabase;

// Legacy sync export for backward compat
export const userMapPositions: UserMapPosition[] = DEV_POSITIONS;
