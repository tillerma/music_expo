// src/utils/spotifyAuth.ts

// ─── Config ───────────────────────────────────────────────────────────────────

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string;
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI as string;

// Only request the scopes your app actually needs.
// Remove scopes here if your feature set doesn't require them.
const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-read-playback-state',
  'playlist-read-private',
];

// Storage keys — centralised so they're easy to audit / change.
const STORAGE_KEYS = {
  codeVerifier: 'spotify_code_verifier',
  state: 'spotify_auth_state',
  accessToken: 'spotify_access_token',
  refreshToken: 'spotify_refresh_token',
  expiresAt: 'spotify_token_expires_at',
} as const;

// ─── Config Validation ────────────────────────────────────────────────────────

function ensureClientConfig(): void {
  const badId =
    !CLIENT_ID ||
    CLIENT_ID === 'YOUR_CLIENT_ID' ||
    CLIENT_ID.toLowerCase().includes('your');
  const badRedirect =
    !REDIRECT_URI || REDIRECT_URI === 'YOUR_REDIRECT_URI';

  if (badId || badRedirect) {
    const issues: string[] = [];
    if (badId) issues.push('VITE_SPOTIFY_CLIENT_ID is missing or is a placeholder');
    if (badRedirect) issues.push('VITE_REDIRECT_URI is missing or is a placeholder');
    throw new Error(
      `Spotify auth misconfigured: ${issues.join('; ')}. ` +
        'See README and set these in your .env or host environment.',
    );
  }

  // Spotify requires HTTPS redirect URIs in production.
  // http://127.0.0.1 is the only allowed HTTP URI (for local dev).
  // http://localhost is NOT allowed — use 127.0.0.1 instead.
  // See: https://developer.spotify.com/documentation/web-api/concepts/redirect_uri
  if (
    REDIRECT_URI.startsWith('http://') &&
    !REDIRECT_URI.startsWith('http://127.0.0.1')
  ) {
    console.warn(
      '[spotifyAuth] VITE_REDIRECT_URI uses an insecure HTTP scheme. ' +
        'Spotify only allows http://127.0.0.1 for local development. ' +
        'Use HTTPS in production.',
    );
  }
}

// ─── PKCE Helpers ─────────────────────────────────────────────────────────────
// Implementation follows Spotify's documented approach exactly:
// https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

/**
 * Generate a cryptographically random code verifier string.
 * Spotify recommends using the alphanumeric character set (length 43–128).
 * We use 64 characters as shown in the official tutorial.
 */
function generateCodeVerifier(length = 64): string {
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

/** SHA-256 hash of a plain string, returned as an ArrayBuffer. */
async function sha256(plain: string): Promise<ArrayBuffer> {
  const data = new TextEncoder().encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

/** Base64url-encode an ArrayBuffer (no padding, URL-safe chars). */
function base64UrlEncode(input: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/** Derive the PKCE code challenge from a verifier string. */
async function generateCodeChallenge(verifier: string): Promise<string> {
  return base64UrlEncode(await sha256(verifier));
}

/** Generate a random opaque state string for CSRF protection. */
function generateState(length = 32): string {
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Auth Flow ────────────────────────────────────────────────────────────────

/**
 * Initiate the PKCE authorization flow.
 *
 * Generates a code verifier + challenge, stores the verifier and a CSRF state
 * value in localStorage, then redirects the browser to Spotify's /authorize
 * endpoint.
 *
 * @param showDialog  When true, Spotify will always show the consent screen
 *                    even if the user has already granted permission.
 */
export async function loginWithSpotify(showDialog = false): Promise<void> {
  ensureClientConfig();

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();

  // Persist verifier and state — both are needed when the callback arrives.
  localStorage.setItem(STORAGE_KEYS.codeVerifier, verifier);
  localStorage.setItem(STORAGE_KEYS.state, state);

  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.search = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    ...(showDialog ? { show_dialog: 'true' } : {}),
  }).toString();

  window.location.href = authUrl.toString();
}

/**
 * Handle the OAuth callback: validate state, then exchange the authorization
 * code for tokens.
 *
 * Call this on the page that Spotify redirects back to.
 *
 * @returns true if the exchange succeeded, false if there was no code in the
 *          URL (e.g. the user is visiting the page for the first time).
 * @throws  if Spotify returned an error parameter, or if the state is invalid,
 *          or if the token exchange request fails.
 */
export async function handleCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);

  // No code or error → not a callback URL; nothing to do.
  if (!params.has('code') && !params.has('error')) return false;

  const error = params.get('error');
  if (error) {
    // Clean up pending state so a fresh login attempt can proceed.
    localStorage.removeItem(STORAGE_KEYS.codeVerifier);
    localStorage.removeItem(STORAGE_KEYS.state);
    throw new Error(`Spotify authorization denied: ${error}`);
  }

  // CSRF guard: verify returned state matches what we stored.
  const returnedState = params.get('state');
  const storedState = localStorage.getItem(STORAGE_KEYS.state);
  if (!returnedState || returnedState !== storedState) {
    localStorage.removeItem(STORAGE_KEYS.codeVerifier);
    localStorage.removeItem(STORAGE_KEYS.state);
    throw new Error(
      'State mismatch — possible CSRF attack. Authorization aborted.',
    );
  }

  const code = params.get('code');
  if (!code) throw new Error('No authorization code found in callback URL.');

  await exchangeCodeForToken(code);

  // Remove code from the browser's address bar so it can't be reused.
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete('code');
  cleanUrl.searchParams.delete('state');
  window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search);

  return true;
}

/**
 * Exchange an authorization code for an access + refresh token pair.
 * Stores the tokens in localStorage.
 */
async function exchangeCodeForToken(code: string): Promise<void> {
  ensureClientConfig();

  const verifier = localStorage.getItem(STORAGE_KEYS.codeVerifier);
  if (!verifier) throw new Error('No code verifier found in storage.');

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

  // Clean up single-use values regardless of outcome.
  localStorage.removeItem(STORAGE_KEYS.codeVerifier);
  localStorage.removeItem(STORAGE_KEYS.state);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      `Token exchange failed (${response.status}): ` +
        (body.error_description ?? body.error ?? response.statusText),
    );
  }

  storeTokenResponse(await response.json());
}

// ─── Token Refresh ────────────────────────────────────────────────────────────

/**
 * Use the stored refresh token to obtain a new access token.
 * Per the Spotify docs, a new refresh token may or may not be included in the
 * response — always update storage when one is present.
 */
export async function refreshAccessToken(): Promise<void> {
  ensureClientConfig();

  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refreshToken) throw new Error('No refresh token available. User must log in again.');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  });

  if (!response.ok) {
    // Refresh tokens can be revoked by the user or expire after extended inactivity.
    // Clear storage so the app can prompt a fresh login.
    if (response.status === 400 || response.status === 401) {
      logout();
    }
    const body = await response.json().catch(() => ({}));
    throw new Error(
      `Token refresh failed (${response.status}): ` +
        (body.error_description ?? body.error ?? response.statusText),
    );
  }

  storeTokenResponse(await response.json());
}

// ─── Token Storage Helpers ────────────────────────────────────────────────────

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

function storeTokenResponse(data: SpotifyTokenResponse): void {
  localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);

  if (data.expires_in) {
    // Subtract 60 s to account for clock skew / network latency.
    const expiresAt = Date.now() + (data.expires_in - 60) * 1000;
    localStorage.setItem(STORAGE_KEYS.expiresAt, String(expiresAt));
  }

  // A new refresh token is not always included; only overwrite when present.
  if (data.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
  }
}

// ─── Public Token API ─────────────────────────────────────────────────────────

/**
 * Return a valid access token, automatically refreshing it if it has expired.
 * This is the preferred function for callers that need to make API requests.
 *
 * @throws if no tokens are stored (user not logged in) or if the refresh fails.
 */
export async function getValidToken(): Promise<string> {
  const token = localStorage.getItem(STORAGE_KEYS.accessToken);
  const expiresAtRaw = localStorage.getItem(STORAGE_KEYS.expiresAt);

  if (!token) {
    throw new Error('No access token found. User must log in.');
  }

  const expiresAt = Number(expiresAtRaw);
  const isExpired = Number.isFinite(expiresAt) && Date.now() >= expiresAt;

  if (isExpired) {
    await refreshAccessToken();
    const newToken = localStorage.getItem(STORAGE_KEYS.accessToken);
    if (!newToken) throw new Error('Token refresh did not produce a new token.');
    return newToken;
  }

  return token;
}

/** Returns true if a (non-expired) access token is present in storage. */
export function isLoggedIn(): boolean {
  const token = localStorage.getItem(STORAGE_KEYS.accessToken);
  const expiresAtRaw = localStorage.getItem(STORAGE_KEYS.expiresAt);

  if (!token) return false;

  const expiresAt = Number(expiresAtRaw);
  if (Number.isFinite(expiresAt) && Date.now() >= expiresAt) {
    // Token is expired, but we may still have a refresh token — consider the
    // user "logged in" if one is present, since getValidToken() can recover.
    return !!localStorage.getItem(STORAGE_KEYS.refreshToken);
  }

  return true;
}

/** Clear all Spotify tokens and session data from storage. */
export function logout(): void {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

// ─── Authenticated Fetch Wrapper ──────────────────────────────────────────────

/**
 * Make an authenticated request to the Spotify Web API.
 *
 * Handles:
 *   • Automatic Bearer token injection
 *   • Token refresh on 401
 *   • Rate-limit (429) with exponential backoff, respecting Retry-After header
 *   • Meaningful error messages from the Spotify error body
 *
 * @param url      Full Spotify API URL (e.g. 'https://api.spotify.com/v1/me')
 * @param options  Standard fetch RequestInit options (method, body, etc.)
 * @param retries  Internal — how many retries remain (default 3)
 */
export async function spotifyFetch(
  url: string,
  options: RequestInit = {},
  retries = 3,
): Promise<Response> {
  const token = await getValidToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  // 401 — token may have been revoked between the expiry check and this call.
  if (response.status === 401 && retries > 0) {
    await refreshAccessToken();
    return spotifyFetch(url, options, retries - 1);
  }

  // 429 — rate limited. Respect Retry-After, then back off exponentially.
  if (response.status === 429 && retries > 0) {
    const retryAfter = Number(response.headers.get('Retry-After') ?? 1);
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.pow(2, 4 - retries) * 1000; // 1 s, 2 s, 4 s
    await new Promise((resolve) => setTimeout(resolve, delay));
    return spotifyFetch(url, options, retries - 1);
  }

  if (!response.ok) {
    // Attempt to surface the Spotify error message to the caller.
    const body = await response.clone().json().catch(() => null);
    const message =
      body?.error?.message ?? response.statusText ?? 'Unknown error';
    throw new Error(`Spotify API error ${response.status}: ${message}`);
  }

  return response;
}