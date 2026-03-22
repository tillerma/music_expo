import { RouterProvider } from 'react-router';
import { router } from './routes';
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    // If Spotify redirected back with a code, store it and clean URL.
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code) {
      // store the code for later exchange (or send to your backend)
      localStorage.setItem('spotify_auth_code', code);
      if (state) localStorage.setItem('spotify_auth_state', state);

      // remove query params but keep the path as '/'
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  return <RouterProvider router={router} />;
}
