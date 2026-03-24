// src/utils/spotifyAuth.ts
//
// Uses the Client Credentials flow — no user login required.
// This allows access to public Spotify data (search, track info, etc.)
// without any per-user OAuth dance.

const CLIENT_ID = '669e4625669541ed99d9a6fb12c76d81';
const CLIENT_SECRET = '16fc1e8362474358878dc77296003060';

const TOKEN_KEY = 'spotify_access_token';
const EXPIRES_KEY = 'spotify_token_expires_at';

// ─── Token Management ─────────────────────────────────────────────────────────

async function fetchClientCredentialsToken(): Promise<void> {
  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      `Spotify token error (${response.status}): ${body.error_description ?? body.error ?? response.statusText}`,
    );
  }

  const data = await response.json();
  localStorage.setItem(TOKEN_KEY, data.access_token);
  // Subtract 60s buffer for clock skew
  const expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  localStorage.setItem(EXPIRES_KEY, String(expiresAt));
}

/**
 * Returns a valid Spotify access token, fetching a new one if needed.
 * Called automatically by spotifyFetch — you rarely need this directly.
 */
export async function getValidToken(): Promise<string> {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = Number(localStorage.getItem(EXPIRES_KEY));
  const isExpired = !token || (Number.isFinite(expiresAt) && Date.now() >= expiresAt);

  if (isExpired) {
    await fetchClientCredentialsToken();
    const newToken = localStorage.getItem(TOKEN_KEY);
    if (!newToken) throw new Error('Failed to obtain Spotify token.');
    return newToken;
  }

  return token;
}

// ─── App Auth Helpers ─────────────────────────────────────────────────────────
// These check whether the user is logged in to the *app* (not Spotify).

/** Returns true if a user is currently logged in to the app. */
export function isLoggedIn(): boolean {
  return !!localStorage.getItem('app_current_user_id');
}

/** Log the current user out and clear all cached session data. */
export function logout(): void {
  localStorage.removeItem('app_current_user_id');
  localStorage.removeItem('app_current_user');
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

// ─── Authenticated Fetch Wrapper ──────────────────────────────────────────────

/**
 * Fetch wrapper that automatically injects the Spotify Bearer token,
 * handles token expiry, and retries on 401 / 429.
 */
export async function spotifyFetch(
  url: string,
  options: RequestInit = {},
  retries = 3,
): Promise<Response> {
  // getValidToken() reuses the cached token until it expires (~1 hour).
  // Do NOT call fetchClientCredentialsToken() directly here — that would
  // hit Spotify's token endpoint on every API call and trigger throttling.
  const token = await getValidToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  // 401 — token was revoked or expired between the check and this call.
  if (response.status === 401  && retries > 0) {
    localStorage.removeItem(TOKEN_KEY); // force a fresh token next call
    return spotifyFetch(url, options, retries - 1);
  }

  // 429 — rate limited.
  if (response.status === 429 && retries > 0) {
    const retryAfter = Number(response.headers.get('Retry-After') ?? 1);
    const delay =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.pow(2, 4 - retries) * 1000; // 1s, 2s, 4s
    await new Promise((resolve) => setTimeout(resolve, delay));
    return spotifyFetch(url, options, retries - 1);
  }

  if (!response.ok) {
    const body = await response.clone().json().catch(() => null);
    const message = body?.error?.message ?? response.statusText ?? 'Unknown error';
    throw new Error(`Spotify API error ${response.status}: ${message}`);
  }

  return response;
}
