import { useState } from 'react';
import { loginWithSpotify } from '../utils/spotifyAuth';

/*
  IMPORTANT: Add these lines to your index.html <head> so fonts load reliably.
  Using @import inside an injected <style> tag is unreliable — <link> tags are preferred.

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bungee&family=Bungee+Shade&family=Space+Mono:ital@0;1&display=swap" rel="stylesheet" />
*/

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      await loginWithSpotify();
      // loginWithSpotify will redirect the browser to Spotify; if it returns,
      // something went wrong (or the function threw) — handle below.
    } catch (err: any) {
      console.error('loginWithSpotify failed', err);
      setError(String(err ?? 'Unknown error'));
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        /* ── Page root ─────────────────────────────────────────── */
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

        /* ── Animated rainbow background ───────────────────────── */
        .lyra-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            120deg,
            #ff0080,
            #ff8c00,
            #ffe000,
            #00e676,
            #00b0ff,
            #7c4dff,
            #ff0080
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

        /* ── CRT scanline overlay ──────────────────────────────── */
        .lyra-scanlines {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.08) 2px,
            rgba(0, 0, 0, 0.08) 4px
          );
          pointer-events: none;
          z-index: 1;
        }

        /* ── Floating star decorations ─────────────────────────── */
        .lyra-stars {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
        }

        .lyra-star {
          position: absolute;
          color: white;
          animation: floatStar 6s ease-in-out infinite;
          opacity: 0.7;
          text-shadow: 0 0 10px white;
        }

        .lyra-star:nth-child(1) { top: 8%;  left: 6%;  font-size: 2rem;   animation-delay: 0s;    }
        .lyra-star:nth-child(2) { top: 15%; left: 88%; font-size: 1.2rem; animation-delay: 1s;    }
        .lyra-star:nth-child(3) { top: 72%; left: 5%;  font-size: 1.8rem; animation-delay: 2s;    }
        .lyra-star:nth-child(4) { top: 80%; left: 91%; font-size: 2.2rem; animation-delay: 0.5s;  }
        .lyra-star:nth-child(5) { top: 45%; left: 3%;  font-size: 1rem;   animation-delay: 1.5s;  }
        .lyra-star:nth-child(6) { top: 5%;  left: 50%; font-size: 1.4rem; animation-delay: 3s;    }
        .lyra-star:nth-child(7) { top: 90%; left: 45%; font-size: 1rem;   animation-delay: 2.5s;  }
        .lyra-star:nth-child(8) { top: 55%; left: 95%; font-size: 1.6rem; animation-delay: 0.8s;  }

        @keyframes floatStar {
          0%, 100% { transform: translateY(0px)   rotate(0deg);  }
          50%       { transform: translateY(-18px) rotate(20deg); }
        }

        /* ── Card ──────────────────────────────────────────────── */
        /*
          Matches LYRA's neobrutalist design language:
          sharp corners + hard black offset shadow, consistent with
          shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] used elsewhere in the app.
        */
        .lyra-card {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 3rem 4rem 3.5rem;
          background: rgba(0, 0, 0, 0.72);
          border: 2px solid #fff;
          border-radius: 0;
          box-shadow: 8px 8px 0px 0px rgba(0, 0, 0, 1);
          max-width: 560px;
          width: 90vw;
          animation: cardPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        @keyframes cardPop {
          from { opacity: 0; scale: 0.88; translate: 0 20px; }
          to   { opacity: 1; scale: 1;    translate: 0 0;    }
        }

        /* Corner decoration glyphs */
        .lyra-card::before,
        .lyra-card::after {
          content: '✦';
          position: absolute;
          font-size: 1.2rem;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1;
        }
        .lyra-card::before { top: 10px;    left: 14px;  }
        .lyra-card::after  { bottom: 10px; right: 14px; }

        /* ── Title ─────────────────────────────────────────────── */
        /*
          FIX: Previously had two separate animation: declarations.
          The second one (cardPop entrance) silently overwrote the first
          (titleShimmer), so the shimmer gradient never animated.
          Both are now combined in one comma-separated animation declaration.
        */
        .lyra-title {
          /* use the app's default font and make it bold and white */
          font-family: var(--default-font-family, ui-sans-serif, system-ui, sans-serif);
          font-size: clamp(2.2rem, 7vw, 4.2rem);
          line-height: 1.1;
          letter-spacing: 0.02em;
          margin: 0;

          color: #ffffff;
          font-weight: 700;
          text-shadow: 0 4px 18px rgba(0,0,0,0.6);

          /* Keep entrance animation but remove color shimmer so text is solid white */
          animation: cardPop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both;
        }

        @keyframes titleShimmer {
          0%   { background-position: 0%   50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0%   50%; }
        }

        /* ── Divider ───────────────────────────────────────────── */
        .lyra-divider {
          width: 200px;
          height: 2px;
          margin: 1.4rem auto;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
          animation: cardPop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
        }

        /* ── Login button ──────────────────────────────────────── */
        .lyra-btn {
          position: relative;
          /* match the title font */
          font-family: var(--default-font-family, ui-sans-serif, system-ui, sans-serif);
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #000;
          background: linear-gradient(135deg, #ffe000, #ff8c00, #ff0080, #7c4dff, #00b0ff);
          background-size: 300% 300%;
          border-width: 0;
          border-radius: 0;
          padding: 1rem 2.6rem;
          cursor: pointer;
          min-width: 220px;
          outline: none;

          /* Neobrutalist hard shadow matches the card and app-wide button style */
          box-shadow:
            4px 4px 0px 0px rgba(0, 0, 0, 1),
            0 0 0 2px rgba(255, 255, 255, 0.25);

        }

        .lyra-btn:hover:not(:disabled) {
          translate: -2px -2px;
          scale: 1.02;
          box-shadow:
            6px 6px 0px 0px rgba(0, 0, 0, 1),
            0 0 0 2px rgba(255, 255, 255, 0.4);
          filter: brightness(1.08);
        }

        .lyra-btn:active:not(:disabled) {
          translate: 2px 2px;
          scale: 0.98;
          box-shadow:
            2px 2px 0px 0px rgba(0, 0, 0, 1),
            0 0 0 2px rgba(255, 255, 255, 0.15);
        }

        .lyra-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ── Button loading dots ───────────────────────────────── */
        .lyra-btn-dots {
          display: inline-flex;
          gap: 4px;
          align-items: center;
          margin-left: 8px;
          vertical-align: middle;
        }

        .lyra-btn-dots span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #fff;
          animation: dotBounce 1s ease-in-out infinite;
        }

        .lyra-btn-dots span:nth-child(2) { animation-delay: 0.15s; }
        .lyra-btn-dots span:nth-child(3) { animation-delay: 0.30s; }

        @keyframes dotBounce {
          0%, 80%, 100% { scale: 0.6; opacity: 0.5; }
          40%            { scale: 1;   opacity: 1;   }
        }

        /* ── Error message ─────────────────────────────────────── */
        .lyra-error {
          margin-top: 1.2rem;
          font-size: 0.78rem;
          color: #ff6b6b;
          letter-spacing: 0.05em;
          font-family: 'Space Mono', monospace;
        }

        /* ── Bottom tag ────────────────────────────────────────── */
        .lyra-tag {
          margin-top: 2rem;
          font-size: 0.65rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.3);
          font-family: 'Space Mono', monospace;
          animation: cardPop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.55s both;
        }
      `}</style>

      <div className="lyra-root">
        {/* Animated rainbow background */}
        <div className="lyra-bg" />

        {/* CRT scanline overlay */}
        <div className="lyra-scanlines" />

        {/* Floating star decorations */}
        <div className="lyra-stars" aria-hidden="true">
          {(['✦', '★', '✶', '✦', '✸', '★', '✶', '✦'] as const).map((s, i) => (
            <span key={i} className="lyra-star">{s}</span>
          ))}
        </div>

        {/* Main card */}
        <div className="lyra-card">
          <h1 className="lyra-title">WELCOME TO LYRA</h1>
          <div className="lyra-divider" />

          <button
            className="lyra-btn"
            onClick={handleLogin}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <>
                Redirecting
                <span className="lyra-btn-dots" aria-hidden="true">
                  <span /><span /><span />
                </span>
              </>
            ) : (
              'Login with Spotify'
            )}
          </button>

          {error && (
            <p className="lyra-error" role="alert">⚠ {error}</p>
          )}

          <p className="lyra-tag">powered by spotify</p>
        </div>
      </div>
    </>
  );
}
