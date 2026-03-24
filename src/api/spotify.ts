import { spotifyFetch } from '../utils/spotifyAuth';
import type { SpotifyTrack } from '../types';

// Only public / non-user-scoped endpoints are available with Client Credentials.

export const searchTracks = (query: string) =>
  spotifyFetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track`,
  ).then(r => r.json() as Promise<{ tracks: { items: SpotifyTrack[] } }>);
  spotifyFetch<{ tracks: { items: SpotifyTrack[] } }>(
    `/search?q=${encodeURIComponent(query)}&type=track`
  );

export const getTopTracks = () =>
  spotifyFetch<{ items: SpotifyTrack[] }>('/me/top/tracks');

export const getAudioFeatures = (trackId: string) =>
  spotifyFetch<{
    danceability: number;
    energy: number;
    valence: number;
    acousticness: number;
    instrumentalness: number;
    liveness: number;
    speechiness: number;
    tempo: number;
    loudness: number;
  }>(`/audio-features/${trackId}`);

export const getTrack = (trackId: string) =>
  spotifyFetch<{
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    album: { images: Array<{ url: string }> };
    external_urls: { spotify: string };
  }>(`/tracks/${trackId}`);

export const getAudioFeaturesForTracks = (trackIds: string[]) =>
  spotifyFetch<{
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
    }>
  }>(`/audio-features?ids=${trackIds.join(',')}`);
