import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { Home, Compass, Music, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { handleCallback, isLoggedIn } from '../utils/spotifyAuth';
import { getCurrentUser } from '../api/spotify';
import { allUsers } from '../data/allUsers';
import { setAppCurrentUserId, getAppCurrentUser } from '../data/authUser';


export function Root() {
  const location = useLocation();
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);

  // Prevent unauthenticated users from visiting any page except /login
  useEffect(() => {
    // If not on /login and no current user, redirect to /login
    const isLoginPage = location.pathname === '/login';
    const currentUserId = window.localStorage.getItem('app_current_user_id');
    if (!isLoginPage && !currentUserId) {
      navigate('/login', { replace: true });
      return;
    }
    setAuthReady(true);
  }, [location.pathname, navigate]);

  // Handle Spotify redirect with ?code=...: exchange for token, then check local user DB
  useEffect(() => {
    (async () => {
      try {
        // handleCallback() returns true only if ?code= was in the URL,
        // and internally handles the exchange + URL cleanup + state validation.
        const wasCallback = await handleCallback();

        if (wasCallback || isLoggedIn()) {
          const spotifyProfile = await getCurrentUser();
          const spotifyId = spotifyProfile.id;
          const found = allUsers.find(
            u => u.id === spotifyId || u.username === spotifyId
          );

          if (!found) {
            sessionStorage.setItem(
              'pending_spotify_profile',
              JSON.stringify(spotifyProfile)
            );
            navigate('/create-account');
          } else {
            setAppCurrentUserId(found.id);
            // Store id and username in localStorage for session enforcement
            window.localStorage.setItem('app_current_user_id', found.id);
            window.localStorage.setItem('app_current_username', found.username);
            navigate('/');
          }
        }
      } catch (err) {
        console.error('Error handling Spotify redirect', err);
      }
    })();
  }, [navigate]);

  if (!authReady) {
    return <div>Loading...</div>;
  }

  // ...existing code...
}