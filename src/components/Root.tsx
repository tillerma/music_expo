import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { Home, Compass, Music, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { handleCallback, isLoggedIn, storeSpotifyUserId, getSpotifyUserId } from '../utils/spotifyAuth';
import { getCurrentUser } from '../api/spotify';
import { allUsers } from '../data/allUsers';
import { setAppCurrentUserId } from '../data/authUser';

export function Root() {
  const location = useLocation();

  // Only block rendering while processing an actual OAuth callback (?code= in URL).
  // Normal page loads and returning users render immediately without a loading flash.
  const [authReady, setAuthReady] = useState(
    () => !new URLSearchParams(window.location.search).has('code')
  );

  const navItems = [
    { path: '/', icon: Home, label: 'Feed' },
    { path: '/explore', icon: Compass, label: 'Music Map' },
    { path: '/playlists', icon: Music, label: 'Playlists' },
    { path: '/profile/musiclover', icon: User, label: 'Profile' },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const wasCallback = await handleCallback();

        if (wasCallback) {
          // Fresh OAuth callback: exchange succeeded, fetch the Spotify profile
          // and route to the correct page.
          const spotifyProfile = await getCurrentUser();
          const spotifyId = spotifyProfile.id;

          // Store Spotify user ID immediately for all pages to use.
          storeSpotifyUserId(spotifyId);

          const found = allUsers.find(
            u => u.id === spotifyId || u.username === spotifyId
          );

          if (!found) {
            sessionStorage.setItem('pending_spotify_profile', JSON.stringify(spotifyProfile));
            navigate('/create-account');
          } else {
            setAppCurrentUserId(found.id);
            navigate('/');
          }
        } else if (isLoggedIn() && !getSpotifyUserId()) {
          // Returning user whose Spotify ID isn't cached yet — fetch and store it
          // without navigating away from the current page.
          try {
            const spotifyProfile = await getCurrentUser();
            storeSpotifyUserId(spotifyProfile.id);
            const found = allUsers.find(
              u => u.id === spotifyProfile.id || u.username === spotifyProfile.id
            );
            if (found) setAppCurrentUserId(found.id);
          } catch {
            // Token may be stale; silently ignore so the user can continue browsing.
          }
        }
      } catch (err) {
        console.error('Auth error in Root', err);
      } finally {
        setAuthReady(true);
      }
    })();
  }, [navigate]);

if (!authReady) {
  return <div>Loading...</div>;
}

  return (
  <div className={location.pathname === '/login' ? 'min-h-screen bg-black text-white' : 'min-h-screen bg-white text-black'}>
      <div className="max-w-2xl mx-auto pb-20">
        <Outlet />
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-black">
        <div className="max-w-2xl mx-auto flex justify-around items-center h-16 px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  active ? 'text-black' : 'text-gray-400'
                }`}
              >
                <Icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}