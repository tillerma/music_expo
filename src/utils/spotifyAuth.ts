// src/utils/spotifyAuth.ts

// ─── Config ───────────────────────────────────────────────
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string;
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI as string;
const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-read-playback-state',
  'playlist-read-private',
];

// Quick runtime validation for environment config.
function ensureClientConfig() {
  const missing = !CLIENT_ID || CLIENT_ID === 'YOUR_CLIENT_ID' || CLIENT_ID.toLowerCase().includes('your client');
  const missingRedirect = !REDIRECT_URI || REDIRECT_URI === 'YOUR_REDIRECT_URI';
  if (missing || missingRedirect) {
    const parts: string[] = [];
    if (missing) parts.push('VITE_SPOTIFY_CLIENT_ID is not set or is a placeholder');
    if (missingRedirect) parts.push('VITE_REDIRECT_URI is not set or is a placeholder');
    const msg = `Spotify auth misconfigured: ${parts.join('; ')}. See README and set these in your .env or host environment.`;
    console.error(msg);
    throw new Error(msg);
  }
}

// ─── PKCE Helpers (Approach 2's spec-correct implementation) ──
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const data = new TextEncoder().encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function generateCodeVerifier(length = 128): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hashed = await sha256(verifier);
  return base64UrlEncode(hashed);
}

// ─── Auth Functions ────────────────────────────────────────
export async function loginWithSpotify(showDialog = false): Promise<void> {
  ensureClientConfig();
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  // Persist verifier for token exchange later
  sessionStorage.setItem('spotify_verifier', verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    show_dialog: String(showDialog), // from Approach 2 — forces re-login prompt if true
  });

  const authUrl = `https://accounts.spotify.com/authorize?${params}`;
  try {
    // eslint-disable-next-line no-console
    console.log('[spotifyAuth] redirecting to Spotify authorize URL:', authUrl, 'CLIENT_ID=', CLIENT_ID);
  } catch (err) {
    // ignore
  }
  window.location.assign(authUrl);
}

export async function exchangeCodeForToken(code: string): Promise<void> {
  const verifier = sessionStorage.getItem('spotify_verifier');
  if (!verifier) throw new Error('No code verifier found in session');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) throw new Error(`Token exchange failed: ${response.status}`);

  const data = await response.json();
  sessionStorage.setItem('spotify_token', data.access_token);

  // Clean up verifier — it's single-use
  sessionStorage.removeItem('spotify_verifier');
}

// ─── Token Helpers ─────────────────────────────────────────
export function getToken(): string | null {
  return sessionStorage.getItem('spotify_token');
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function logout(): void {
  sessionStorage.clear();
}
