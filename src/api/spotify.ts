import { spotifyFetch } from '../utils/spotifyAuth';
import type { SpotifyTrack } from '../types';

const BASE = 'https://api.spotify.com/v1';

export const searchTracks = (query: string) =>
  spotifyFetch(
    `${BASE}/search?q=${encodeURIComponent(query)}&type=track`,
  ).then(r => r.json() as Promise<{ tracks: { items: SpotifyTrack[] } }>);

export const getTopTracks = () =>
  spotifyFetch(`${BASE}/me/top/tracks`)
    .then(r => r.json() as Promise<{ items: SpotifyTrack[] }>);

export const getAudioFeatures = (trackId: string) =>
  spotifyFetch(`${BASE}/audio-features/${trackId}`)
    .then(r => r.json() as Promise<{
      danceability: number;
      energy: number;
      valence: number;
      acousticness: number;
      instrumentalness: number;
      liveness: number;
      speechiness: number;
      tempo: number;
      loudness: number;
    }>);

export const getTrack = (trackId: string) =>
  spotifyFetch(`${BASE}/tracks/${trackId}`)
    .then(r => r.json() as Promise<{
      id: string;
      name: string;
      artists: Array<{ name: string }>;
      album: { images: Array<{ url: string }> };
      external_urls: { spotify: string };
    }>);

export const getAudioFeaturesForTracks = (trackIds: string[]) =>
  spotifyFetch(`${BASE}/audio-features?ids=${trackIds.join(',')}`)
    .then(r => r.json() as Promise<{
      audio_features: Array<{
        id: string;
        danceability: number;
        energy: number;
        valence: number;
        acousticness: number;
        instrumentalness: number;
        liveness: number;
        speechiness: number;
        tempo: number;
        loudness: number;
      }>;
    }>);
