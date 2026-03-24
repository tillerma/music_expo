import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import { getToken } from '../utils/spotifyAuth';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, isLoading: true });

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      // 1. Get the logged-in Spotify user's ID
      const res = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        console.error('Failed to fetch Spotify user:', res.status);
        setIsLoading(false);
        return;
      }

      const spotifyUser = await res.json();
      // spotifyUser.id is the Spotify user ID (e.g. "ishanid")

      // 2. Look up the Supabase profile — try username first, then id
      let profile: any = null;

      const byUsername = await supabase
        .from('profiles')
        .select('*')
        .eq('username', spotifyUser.id)
        .maybeSingle();

      if (byUsername.data) {
        profile = byUsername.data;
      } else {
        const byId = await supabase
          .from('profiles')
          .select('*')
          .eq('id', spotifyUser.id)
          .maybeSingle();
        profile = byId.data ?? null;
      }

      if (!profile) {
        console.warn('No Supabase profile found for Spotify user:', spotifyUser.id);
        setIsLoading(false);
        return;
      }

      setUser({
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name ?? spotifyUser.display_name ?? profile.username,
        bio: profile.bio ?? '',
        avatarUrl: profile.avatar_url ?? spotifyUser.images?.[0]?.url ?? '',
        followers: profile.followers ?? 0,
        following: profile.following ?? 0,
      });

      setIsLoading(false);
    }

    loadUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
