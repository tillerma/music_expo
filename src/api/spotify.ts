import { getToken } from '../utils/spotifyAuth';

async function spotifyFetch<T>(endpoint: string): Promise<T> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error(`Spotify API error: ${response.status}`);
  return response.json() as Promise<T>;
}

export const getCurrentUser = () => spotifyFetch<any>('/me');

export const getUserPlaylists = () =>
  spotifyFetch<{ items: any }[]>('/me/playlists');

export const searchTracks = (query: string) =>
  spotifyFetch<{ tracks: { items: any[] } }>(
    `/search?q=${encodeURIComponent(query)}&type=track`
  );

export const getTopTracks = () => spotifyFetch<{ items: any[] }>('/me/top/tracks');