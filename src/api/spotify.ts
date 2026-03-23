import { getToken } from '../utils/spotifyAuth';
import type { SpotifyUser, SpotifyPlaylist, SpotifyTrack } from '../types';

async function spotifyFetch<T>(endpoint: string): Promise<T> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error(`Spotify API error: ${response.status}`);
  return response.json() as Promise<T>;
}

export const getCurrentUser = () =>
  spotifyFetch<SpotifyUser>('/me');

export const getUserPlaylists = () =>
  spotifyFetch<{ items: SpotifyPlaylist[] }>('/me/playlists');

export const searchTracks = (query: string) =>
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