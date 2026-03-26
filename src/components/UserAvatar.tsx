/**
 * UserAvatar — shows a profile photo, or a coloured initials circle as fallback.
 * Initials: first + last initial of displayName, or first 2 chars of username.
 */
import React from 'react';

// 16 vivid solid colours — bright backgrounds with white text for punchy avatars
const PALETTE = [
  { bg: '#f43f5e', text: '#fff' },  // rose
  { bg: '#8b5cf6', text: '#fff' },  // violet
  { bg: '#f97316', text: '#fff' },  // orange
  { bg: '#06b6d4', text: '#fff' },  // cyan
  { bg: '#ec4899', text: '#fff' },  // pink
  { bg: '#22c55e', text: '#fff' },  // green
  { bg: '#6366f1', text: '#fff' },  // indigo
  { bg: '#eab308', text: '#fff' },  // yellow
  { bg: '#d946ef', text: '#fff' },  // fuchsia
  { bg: '#10b981', text: '#fff' },  // emerald
  { bg: '#ef4444', text: '#fff' },  // red
  { bg: '#3b82f6', text: '#fff' },  // blue
  { bg: '#14b8a6', text: '#fff' },  // teal
  { bg: '#0ea5e9', text: '#fff' },  // sky
];

// Mix two independent hashes so similar short strings spread wider
export function avatarPalette(seed: string) {
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = (Math.imul(h1, 33) ^ c) >>> 0;
    h2 = (Math.imul(h2, 31) + c) >>> 0;
  }
  return PALETTE[((h1 ^ h2) >>> 0) % PALETTE.length];
}

export function initials(displayName?: string, username?: string): string {
  const name = (displayName || username || '?').trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface UserAvatarProps {
  avatarUrl?: string | null;
  displayName?: string;
  username?: string;
  /** Pixel size of the avatar. Default 40. */
  size?: number;
  className?: string;
}

export function UserAvatar({ avatarUrl, displayName, username, size = 40, className = '' }: UserAvatarProps) {
  const seed = username || displayName || '?';
  const p = avatarPalette(seed);
  const letters = initials(displayName, username);

  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
  };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName || username}
        className={`object-cover ${className}`}
        style={baseStyle}
        onError={e => {
          const el = e.currentTarget;
          const parent = el.parentNode;
          if (!parent) return;
          const div = document.createElement('div');
          div.style.cssText = `width:${size}px;height:${size}px;background:${p.bg};color:${p.text};display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.38)}px;font-weight:700;flex-shrink:0;`;
          div.className = el.className;
          div.textContent = letters;
          parent.replaceChild(div, el);
        }}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center select-none font-bold ${className}`}
      style={{
        ...baseStyle,
        background: p.bg,
        color: p.text,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {letters}
    </div>
  );
}
