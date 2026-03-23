import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { exchangeCodeForToken } from '../utils/spotifyAuth';

export function CallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code  = params.get('code');
    const error = params.get('error');

    if (error || !code) {
      console.error('Spotify auth error:', error);
      navigate('/login', { replace: true });
      return;
    }

    exchangeCodeForToken(code)
      .then(() => navigate('/', { replace: true }))
      .catch((err) => {
        console.error('Token exchange failed:', err);
        navigate('/login', { replace: true });
      });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-white font-bold tracking-widest animate-pulse">CONNECTING TO SPOTIFY…</p>
    </div>
  );
}
