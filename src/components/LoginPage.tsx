import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { supabase } from '../lib/supabase';
import { setAppCurrentUserId } from '../data/authUser';

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: dbError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username.trim())
        .eq('password', password)
        .maybeSingle();

      if (dbError) throw dbError;

      if (!data) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= 2) {
          navigate('/create-account?message=no-account');
          return;
        }

        setError('Incorrect username or password. You have 1 more attempt.');
      } else {
        setAppCurrentUserId(data.id);
        localStorage.setItem('app_current_user', JSON.stringify(data));
        navigate('/');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .lyra-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: #000;
          font-family: 'Space Mono', monospace;
        }

        .lyra-bg {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          width: 100vw; height: 100vh;
          background: linear-gradient(
            120deg,
            #ff0080, #ff8c00, #ffe000,
            #00e676, #00b0ff, #7c4dff, #ff0080
          );
          background-size: 300% 300%;
          animation: rainbowShift 4s ease infinite;
          opacity: 0.92;
        }

        @keyframes rainbowShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .lyra-stars { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
        .lyra-star {
          position: absolute; color: white;
          animation: floatStar 6s ease-in-out infinite;
          opacity: 0.7; text-shadow: 0 0 10px white;
        }
        .lyra-star:nth-child(1) { top: 8%;  left: 6%;  font-size: 2rem;   animation-delay: 0s;   }
        .lyra-star:nth-child(2) { top: 15%; left: 88%; font-size: 1.2rem; animation-delay: 1s;   }
        .lyra-star:nth-child(3) { top: 72%; left: 5%;  font-size: 1.8rem; animation-delay: 2s;   }
        .lyra-star:nth-child(4) { top: 80%; left: 91%; font-size: 2.2rem; animation-delay: 0.5s; }
        .lyra-star:nth-child(5) { top: 45%; left: 3%;  font-size: 1rem;   animation-delay: 1.5s; }
        .lyra-star:nth-child(6) { top: 5%;  left: 50%; font-size: 1.4rem; animation-delay: 3s;   }
        .lyra-star:nth-child(7) { top: 90%; left: 45%; font-size: 1rem;   animation-delay: 2.5s; }
        .lyra-star:nth-child(8) { top: 55%; left: 95%; font-size: 1.6rem; animation-delay: 0.8s; }

        @keyframes floatStar {
          0%, 100% { transform: translateY(0px)   rotate(0deg);  }
          50%       { transform: translateY(-18px) rotate(20deg); }
        }

        .lyra-card {
          position: relative; z-index: 10;
          display: flex; flex-direction: column; align-items: center; text-align: center;
          padding: 3rem 4rem 3.5rem;
          background: rgba(0, 0, 0, 0.80);
          border: 2px solid #fff; border-radius: 0;
          box-shadow: 8px 8px 0px 0px rgba(0,0,0,1);
          max-width: 460px; width: 90vw;
          animation: cardPop 0.6s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        @keyframes cardPop {
          from { opacity: 0; scale: 0.88; translate: 0 20px; }
          to   { opacity: 1; scale: 1;    translate: 0 0;    }
        }

        .lyra-card::before, .lyra-card::after {
          content: '✦'; position: absolute; font-size: 1.2rem;
          color: rgba(255,255,255,0.5); line-height: 1;
        }
        .lyra-card::before { top: 10px; left: 14px; }
        .lyra-card::after  { bottom: 10px; right: 14px; }

        .lyra-title {
          font-size: clamp(2.2rem, 7vw, 4.2rem);
          line-height: 1.1; letter-spacing: 0.02em; margin: 0 0 1.6rem;
          color: #ffffff; font-weight: 700;
          text-shadow: 0 4px 18px rgba(0,0,0,0.6);
          animation: cardPop 0.8s cubic-bezier(0.34,1.56,0.64,1) 0.1s both;
        }

        .lyra-input {
          width: 100%; margin-bottom: 0.9rem;
          background: rgba(255,255,255,0.08);
          border: 2px solid rgba(255,255,255,0.5);
          color: #fff; padding: 0.7rem 1rem;
          font-size: 0.95rem; font-family: 'Space Mono', monospace;
          outline: none; transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .lyra-input::placeholder { color: rgba(255,255,255,0.4); }
        .lyra-input:focus { border-color: #ffe000; }

        .lyra-btn {
          position: relative;
          font-size: 1rem; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: #000;
          background: linear-gradient(135deg, #ffe000, #ff8c00, #ff0080, #7c4dff, #00b0ff);
          background-size: 300% 300%;
          border: none; border-radius: 0;
          padding: 0.85rem 2.2rem; cursor: pointer;
          width: 100%; margin-top: 0.4rem;
          box-shadow: 4px 4px 0px 0px rgba(0,0,0,1), 0 0 0 2px rgba(255,255,255,0.25);
        }
        .lyra-btn:hover:not(:disabled) {
          translate: -2px -2px;
          box-shadow: 6px 6px 0px 0px rgba(0,0,0,1), 0 0 0 2px rgba(255,255,255,0.4);
        }
        .lyra-btn:active:not(:disabled) {
          translate: 2px 2px;
          box-shadow: 2px 2px 0px 0px rgba(0,0,0,1);
        }
        .lyra-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .lyra-btn-secondary {
          width: 100%; margin-top: 0.7rem;
          background: transparent;
          border: 2px solid rgba(255,255,255,0.5);
          color: #fff; padding: 0.75rem 2.2rem;
          font-size: 0.85rem; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          cursor: pointer; text-decoration: none; display: block;
          text-align: center;
          transition: background 0.15s, border-color 0.15s;
        }
        .lyra-btn-secondary:hover {
          background: rgba(255,255,255,0.1);
          border-color: #fff;
        }

        .lyra-divider {
          width: 200px; height: 2px; margin: 0 auto 1.6rem;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
        }

        .lyra-error {
          margin-top: 0.8rem; font-size: 0.78rem;
          color: #ff6b6b; letter-spacing: 0.05em;
          font-family: 'Space Mono', monospace;
          text-align: left; width: 100%;
        }

        .lyra-tag {
          margin-top: 1.8rem; font-size: 0.65rem;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(255,255,255,0.3); font-family: 'Space Mono', monospace;
        }
      `}</style>

      <div className="lyra-root">
        <div className="lyra-bg" />

        <div className="lyra-stars" aria-hidden="true">
          {(['✦', '★', '✶', '✦', '✸', '★', '✶', '✦'] as const).map((s, i) => (
            <span key={i} className="lyra-star">{s}</span>
          ))}
        </div>

        <div className="lyra-card">
          <h1 className="lyra-title">LYRA</h1>
          <div className="lyra-divider" />

          <form onSubmit={handleLogin} style={{ width: '100%' }}>
            <input
              className="lyra-input"
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
            <input
              className="lyra-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <button className="lyra-btn" type="submit" disabled={loading}>
              {loading ? 'Logging in…' : 'Log In'}
            </button>
          </form>

          <Link to="/create-account" className="lyra-btn-secondary">
            Create Account
          </Link>

          {error && (
            <p className="lyra-error" role="alert">⚠ {error}</p>
          )}

          <p className="lyra-tag">powered by spotify</p>
        </div>
      </div>
    </>
  );
}
