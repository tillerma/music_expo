import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { Home, Compass, Music, User } from 'lucide-react';
import { useEffect } from 'react';
import { exchangeCodeForToken } from '../utils/spotifyAuth';
import { getCurrentUser } from '../api/spotify';
import { allUsers } from '../data/allUsers';
import { setAppCurrentUserId } from '../data/authUser';

export function Root() {
  const location = useLocation();

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

  // Handle Spotify redirect with ?code=...: exchange for token, then check local user DB
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    (async () => {
      try {
        // Exchange code for token (stores spotify_token in sessionStorage)
        await exchangeCodeForToken(code);

        // Remove code from URL
        params.delete('code');
        const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
        window.history.replaceState({}, '', newUrl);

        // Fetch Spotify profile
        const spotifyProfile = await getCurrentUser();
        const spotifyId = (spotifyProfile as any).id;

        // Check local DB for a user with this id or username
        const found = allUsers.find(u => u.id === spotifyId || u.username === spotifyId);
        if (!found) {
          // Store spotify profile temporarily and redirect to create-account
          sessionStorage.setItem('pending_spotify_profile', JSON.stringify(spotifyProfile));
          navigate('/create-account');
        } else {
          // Existing user — mark as current and navigate to feed
          setAppCurrentUserId(found.id);
          navigate('/');
        }
      } catch (err) {
        console.error('Error handling Spotify redirect', err);
        // Still remove code param so user isn't stuck
        params.delete('code');
        const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
        window.history.replaceState({}, '', newUrl);
      }
    })();
  }, [navigate]);

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