/**
 * MusicMapPage.tsx
 *
 * Interactive music taste map for Lyra.
 *
 * Modes:
 *   "umap"  → positions from the pre-computed PCA/UMAP embedding (default)
 *   "axes"  → user picks X and Y audio features; avatars scatter accordingly
 *
 * Migration notes:
 *   - Replace `userMapPositions` import with an API hook when going live.
 *   - MapPost.caption and MapPost.postedAt are already typed; just populate them.
 *   - `currentUser` import stays the same — just swap mockData for auth context.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useMusicMap, UserMapPosition, AudioFeatures } from '../data/musicMapData';
import { currentUser } from '../data/mockData';
import { X, ZoomIn, ZoomOut, Crosshair, ChevronDown, Music } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const ZOOM_MIN    = 0.35;
const ZOOM_MAX    = 4;
const ZOOM_STEP   = 0.06;       // used only by the +/- buttons
const WHEEL_SENSITIVITY = 400;  // higher = slower wheel/trackpad zoom
                                 // trackpad swipe ≈ ΣdeltaY 60-80 → ~1.17-1.22x
                                 // mouse 1 notch ≈ deltaY 100   → ~1.28x
const AVATAR_SIZE = 28;     // base px at scale=1 — smaller so 100 users fit without overlap
const DRAG_THRESH = 5;

// ─── Feature axis options ─────────────────────────────────────────────────────
type FeatureKey = keyof AudioFeatures;

type AxisOption = { key: FeatureKey; label: string; emoji: string };

const AXIS_OPTIONS: AxisOption[] = [
  { key: 'energy',           label: 'Energy',        emoji: '⚡' },
  { key: 'danceability',     label: 'Danceability',  emoji: '🕺' },
  { key: 'valence',          label: 'Valence',       emoji: '☀' },
  { key: 'acousticness',     label: 'Acousticness',  emoji: '🎸' },
  { key: 'instrumentalness', label: 'Instrumental',  emoji: '🎹' },
  { key: 'speechiness',      label: 'Speechiness',   emoji: '🎤' },
  { key: 'liveness',         label: 'Liveness',      emoji: '🎪' },
];

type MapMode = 'umap' | 'axes';

// ─── Helpers ──────────────────────────────────────────────────────────────────
type Transform = { x: number; y: number; scale: number };

function clampZoom(z: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

function dataToScreen(
  dx: number, dy: number,
  t: Transform,
  w: number, h: number
): { sx: number; sy: number } {
  return {
    sx: w / 2 + dx * t.scale + t.x,
    sy: h / 2 - dy * t.scale + t.y,
  };
}

/** Map a feature value to the [-280, 280] coordinate space */
function featureToCoord(
  positions: UserMapPosition[],
  feature: FeatureKey
): Map<string, number> {
  const vals = positions.map(p => p.songToday.features[feature] ?? 0);
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  const range = max - min || 1;
  const result = new Map<string, number>();
  positions.forEach(p => {
    const norm = ((p.songToday.features[feature] ?? 0) - min) / range; // 0→1
    result.set(p.user.id, (norm * 2 - 1) * 280); // → [-280, 280]
  });
  return result;
}

/** Stable per-user jitter so nodes don't stack when values are identical */
function stableJitter(id: string, range = 60): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ((h % 1000) / 1000 - 0.5) * range * 2;
}

// ─── Anon avatar ──────────────────────────────────────────────────────────────
function AnonAvatar({
  username, size, className,
}: { username: string; size: number; className?: string }) {
  // Pick a colour from a small palette, seeded by username
  const PALETTES = [
    ['#e9d5ff', '#7c3aed'],
    ['#fce7f3', '#be185d'],
    ['#dbeafe', '#1d4ed8'],
    ['#d1fae5', '#065f46'],
    ['#ffedd5', '#c2410c'],
    ['#fef9c3', '#a16207'],
  ];
  let h = 0;
  for (const c of username) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [bg, fg] = PALETTES[h % PALETTES.length];
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div
      className={className}
      style={{
        width: size, height: size,
        borderRadius: '50%',
        background: bg,
        color: fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.35),
        fontWeight: 700,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initials}
    </div>
  );
}

// ─── Axis selector dropdown ───────────────────────────────────────────────────
// Uses fixed positioning for the menu so it escapes any parent stacking context
// (the filter bar sits at z-40 but its children are still clipped by it otherwise).
function AxisDropdown({
  label, value, onChange, exclude,
}: {
  label: string;
  value: FeatureKey;
  onChange: (k: FeatureKey) => void;
  exclude?: FeatureKey;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef  = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = AXIS_OPTIONS.find(o => o.key === value)!;

  const openMenu = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(v => !v);
  };

  const handleSelect = (key: FeatureKey) => {
    onChange(key);
    setOpen(false);
  };

  // Close on outside click — must check BOTH the trigger button and the
  // fixed menu div, because mousedown on a fixed element is outside btnRef.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        !btnRef.current?.contains(t) &&
        !menuRef.current?.contains(t)
      ) {
        setOpen(false);
      }
    };
    // Use capture so we see the event before React's synthetic handlers
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [open]);

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex-shrink-0">
          {label}
        </span>
        <button
          ref={btnRef}
          onClick={openMenu}
          className="flex items-center gap-1 border-2 border-black px-2 py-0.5 text-xs font-bold hover:bg-gray-50 bg-white"
        >
          <span>{current.emoji}</span>
          <span>{current.label}</span>
          <ChevronDown className={`w-3 h-3 transition-transform duration-100 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div
          ref={menuRef}
          className="fixed bg-white border-2 border-black min-w-[160px] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
          style={{ top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
        >
          {AXIS_OPTIONS.filter(o => o.key !== exclude).map(opt => (
            <button
              key={opt.key}
              onMouseDown={e => e.stopPropagation()}
              onClick={() => handleSelect(opt.key)}
              className={[
                'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors',
                'hover:bg-purple-50',
                value === opt.key ? 'bg-purple-50 font-bold' : 'font-medium',
              ].join(' ')}
            >
              <span className="w-4">{opt.emoji}</span>
              <span>{opt.label}</span>
              {value === opt.key && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export function MusicMapPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Data ───────────────────────────────────────────────────────────────────
  // useMusicMap returns { status: 'loading' | 'ready' | 'error', positions? }
  // Swap to useMusicMapLive in musicMapData.ts when your API is ready.
  const mapState = useMusicMap();
  const userMapPositions = mapState.status === 'ready' ? mapState.positions : [];

  // ── Transform state ────────────────────────────────────────────────────────
  const transformRef = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });

  const syncTransform = useCallback((t: Transform) => {
    transformRef.current = t;
    setTransform({ ...t });
  }, []);

  // ── Drag state (refs only — avoids re-renders mid-drag) ────────────────────
  const isDown      = useRef(false);
  const dragStart   = useRef({ x: 0, y: 0 });
  const tAtDragStart = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  const didDrag     = useRef(false);
  const lastPinch   = useRef<number | null>(null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [containerSize, setContainerSize]   = useState({ w: 800, h: 600 });
  const [selectedUser,  setSelectedUser]    = useState<UserMapPosition | null>(null);
  const [hoveredUser,   setHoveredUser]     = useState<UserMapPosition | null>(null);
  const [tooltipPos,    setTooltipPos]      = useState({ x: 0, y: 0 });
  const [mode,          setMode]            = useState<MapMode>('umap');
  const [xAxis,         setXAxis]           = useState<FeatureKey>('energy');
  const [yAxis,         setYAxis]           = useState<FeatureKey>('valence');
  const [isCursorGrab,  setIsCursorGrab]    = useState(false);

  // ── Measure container ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Non-passive wheel (blocks page scroll) ─────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const fx   = e.clientX - rect.left;
      const fy   = e.clientY - rect.top;

      // Normalise deltaY: LINE mode (keyboard/old mouse) = ~20px per tick
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 20;
      if (e.deltaMode === 2) dy *= rect.height;

      // Exponential zoom: factor = e^(-dy/sensitivity)
      // This is continuous and properly handles both trackpads (many small
      // deltas) and mouse wheels (few large deltas) without over-zooming.
      const factor  = Math.exp(-dy / WHEEL_SENSITIVITY);
      const t       = transformRef.current;
      const ns      = clampZoom(t.scale * factor);
      const r       = ns / t.scale;
      syncTransform({ scale: ns, x: fx - r * (fx - t.x), y: fy - r * (fy - t.y) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [syncTransform]);

  // ── Non-passive touchmove (blocks page scroll on iOS) ─────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2 && lastPinch.current !== null) {
        const dx   = e.touches[0].clientX - e.touches[1].clientX;
        const dy   = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = el.getBoundingClientRect();
        const fx   = midX - rect.left;
        const fy   = midY - rect.top;
        const factor = dist / lastPinch.current;
        const t    = transformRef.current;
        const ns   = clampZoom(t.scale * factor);
        const r    = ns / t.scale;
        syncTransform({ scale: ns, x: fx - r * (fx - t.x), y: fy - r * (fy - t.y) });
        lastPinch.current = dist;
      } else if (e.touches.length === 1 && isDown.current) {
        const ddx = e.touches[0].clientX - dragStart.current.x;
        const ddy = e.touches[0].clientY - dragStart.current.y;
        if (!didDrag.current && Math.hypot(ddx, ddy) < DRAG_THRESH) return;
        didDrag.current = true;
        syncTransform({
          ...tAtDragStart.current,
          x: tAtDragStart.current.x + ddx,
          y: tAtDragStart.current.y + ddy,
        });
      }
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, [syncTransform]);

  // ── Zoom controls ──────────────────────────────────────────────────────────
  const zoomAround = useCallback((fx: number, fy: number, factor: number) => {
    const t  = transformRef.current;
    const ns = clampZoom(t.scale * factor);
    const r  = ns / t.scale;
    syncTransform({ scale: ns, x: fx - r * (fx - t.x), y: fy - r * (fy - t.y) });
  }, [syncTransform]);

  const cx = containerSize.w / 2;
  const cy = containerSize.h / 2;
  const zoomIn  = () => zoomAround(cx, cy, 1 + ZOOM_STEP * 3);
  const zoomOut = () => zoomAround(cx, cy, 1 - ZOOM_STEP * 3);

  /**
   * Compute a transform that fits ALL map nodes into the visible container
   * with a given padding fraction (0.1 = 10% padding on each side).
   * Used for the initial view and when no current user is found.
   */
  const fitAllTransform = useCallback((padding = 0.12): Transform => {
    if (userMapPositions.length === 0) return { x: 0, y: 0, scale: 1 };
    const xs = userMapPositions.map(p => p.x);
    const ys = userMapPositions.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const dataW = maxX - minX || 1;
    const dataH = maxY - minY || 1;
    const { w, h } = containerSize;
    const scaleX = (w * (1 - 2 * padding)) / dataW;
    const scaleY = (h * (1 - 2 * padding)) / dataH;
    const scale  = clampZoom(Math.min(scaleX, scaleY, 1.0)); // never start zoomed in
    // Centre of the data bounding box
    const cx_ = (minX + maxX) / 2;
    const cy_ = (minY + maxY) / 2;
    // From dataToScreen: sx = w/2 + dx*scale + tx
    // To put cx_ at screen centre: w/2 + cx_*scale + tx = w/2  →  tx = -cx_*scale
    // Similarly: sy = h/2 - dy*scale + ty → ty = +cy_*scale
    return {
      scale,
      x: -(cx_ * scale),
      y:  (cy_ * scale),
    };
  }, [containerSize]);

  const resetView = useCallback(() => {
    syncTransform(fitAllTransform());
  }, [syncTransform, fitAllTransform]);

  // ── Initial view: fit all nodes, centred on current user ──────────────────
  // Fires once when the container is first measured (not on the default 800×600).
  // Uses fitAllTransform so ALL nodes are visible on load — the current user
  // is highlighted with a ring so they can find themselves in the overview.
  const hasFitted = useRef(false);
  useEffect(() => {
    if (hasFitted.current) return;
    // containerSize starts at 800×600 as a placeholder — skip until real
    if (containerSize.w === 800 && containerSize.h === 600) return;
    hasFitted.current = true;
    syncTransform(fitAllTransform());
  }, [containerSize, fitAllTransform, syncTransform]);

  // ── Mouse handlers ─────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDown.current     = true;
    didDrag.current    = false;
    dragStart.current  = { x: e.clientX, y: e.clientY };
    tAtDragStart.current = { ...transformRef.current };
    setIsCursorGrab(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDown.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (!didDrag.current && Math.hypot(dx, dy) < DRAG_THRESH) return;
    didDrag.current = true;
    syncTransform({
      ...tAtDragStart.current,
      x: tAtDragStart.current.x + dx,
      y: tAtDragStart.current.y + dy,
    });
  };

  const onMouseUp   = () => { isDown.current = false; setIsCursorGrab(false); };
  const onMouseLeave = () => { isDown.current = false; setIsCursorGrab(false); };

  // ── Touch handlers (start/end only — move is native above) ────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinch.current = Math.hypot(dx, dy);
    } else {
      isDown.current    = true;
      didDrag.current   = false;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      tAtDragStart.current = { ...transformRef.current };
    }
  };
  const onTouchEnd = () => { isDown.current = false; lastPinch.current = null; };

  // ── Avatar click / hover ───────────────────────────────────────────────────
  const handleAvatarPointerDown = (e: React.PointerEvent) => {
    // Stop propagation so the map's onMouseDown doesn't fire for avatar clicks
    e.stopPropagation();
  };

  const handleAvatarClick = (e: React.MouseEvent, userPos: UserMapPosition) => {
    e.stopPropagation();
    if (didDrag.current) return;
    setSelectedUser(userPos);
    setHoveredUser(null);
  };

  const handleAvatarMouseEnter = (
    e: React.MouseEvent,
    userPos: UserMapPosition
  ) => {
    setHoveredUser(userPos);
    const rect = containerRef.current!.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleAvatarMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleAvatarMouseLeave = () => setHoveredUser(null);

  const handleVisitProfile = () => {
    if (selectedUser) {
      navigate(`/profile/${selectedUser.user.username}`);
      setSelectedUser(null);
    }
  };

  // ── Reset view on mode/axis change ─────────────────────────────────────────
  useEffect(() => {
    syncTransform(fitAllTransform());
  }, [mode, xAxis, yAxis, syncTransform, fitAllTransform]);

  // ── Compute positions ──────────────────────────────────────────────────────
  const xCoords = useMemo(
    () => mode === 'axes' ? featureToCoord(userMapPositions, xAxis) : null,
    [mode, xAxis]
  );
  const yCoords = useMemo(
    () => mode === 'axes' ? featureToCoord(userMapPositions, yAxis) : null,
    [mode, yAxis]
  );

  const getScreenPos = useCallback((p: UserMapPosition) => {
    let dx: number, dy: number;
    if (mode === 'axes' && xCoords && yCoords) {
      dx = (xCoords.get(p.user.id) ?? 0) + stableJitter(p.user.id + 'x', 12);
      dy = (yCoords.get(p.user.id) ?? 0) + stableJitter(p.user.id + 'y', 12);
    } else {
      dx = p.x;
      dy = p.y;
    }
    return dataToScreen(dx, dy, transform, containerSize.w, containerSize.h);
  }, [mode, xCoords, yCoords, transform, containerSize]);

  // ── Axis labels for scatter mode ───────────────────────────────────────────
  const xLabel = AXIS_OPTIONS.find(o => o.key === xAxis)?.label ?? '';
  const yLabel = AXIS_OPTIONS.find(o => o.key === yAxis)?.label ?? '';

  // ── Loading / error states ────────────────────────────────────────────────
  if (mapState.status === 'loading') {
    return (
      <div className="flex flex-col bg-white" style={{ height: 'calc(100dvh - 64px)' }}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">Loading music map…</p>
          </div>
        </div>
      </div>
    );
  }

  if (mapState.status === 'error') {
    return (
      <div className="flex flex-col bg-white" style={{ height: 'calc(100dvh - 64px)' }}>
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="text-center">
            <p className="font-bold mb-1">Couldn't load the map</p>
            <p className="text-sm text-gray-500">{mapState.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-white"
      style={{
        // Nav bar in Root.tsx is fixed h-16 = 64px. Subtract so map never goes under it.
        height: 'calc(100dvh - 64px)',
      }}
    >

      {/* ── HEADER ── */}
      <div className="bg-white border-b-4 border-black flex-shrink-0 relative" style={{ zIndex: 40 }}>
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none">MUSIC MAP</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">scroll to zoom · drag to pan</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={zoomOut}   className="w-7 h-7 flex items-center justify-center border-2 border-black hover:bg-gray-100" aria-label="Zoom out"><ZoomOut className="w-3.5 h-3.5" /></button>
            <button onClick={resetView} className="w-7 h-7 flex items-center justify-center border-2 border-black hover:bg-gray-100" aria-label="Reset view"><Crosshair className="w-3.5 h-3.5" /></button>
            <button onClick={zoomIn}    className="w-7 h-7 flex items-center justify-center border-2 border-black hover:bg-gray-100" aria-label="Zoom in"><ZoomIn className="w-3.5 h-3.5" /></button>
            <span className="text-[11px] font-mono text-gray-400 w-9 text-right tabular-nums">
              {Math.round(transform.scale * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* ── MODE + AXIS BAR ── */}
      <div className="flex-shrink-0 bg-white border-b-2 border-black relative" style={{ zIndex: 40 }}>
        <div className="px-4 py-2 flex items-center gap-3 flex-wrap">

          {/* Mode toggle */}
          <div className="flex border-2 border-black overflow-hidden flex-shrink-0">
            <button
              onClick={() => setMode('umap')}
              className={`px-3 py-1 text-xs font-bold transition-colors ${
                mode === 'umap' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-50'
              }`}
            >
              ✦ Similarity
            </button>
            <button
              onClick={() => setMode('axes')}
              className={`px-3 py-1 text-xs font-bold border-l-2 border-black transition-colors ${
                mode === 'axes' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-50'
              }`}
            >
              ⊹ Custom axes
            </button>
          </div>

          {/* Axis selectors (only in axes mode) */}
          {mode === 'axes' && (
            <>
              <AxisDropdown
                label="X →"
                value={xAxis}
                onChange={setXAxis}
                exclude={yAxis}
              />
              <AxisDropdown
                label="Y ↑"
                value={yAxis}
                onChange={setYAxis}
                exclude={xAxis}
              />
            </>
          )}

          {mode === 'umap' && (
            <span className="text-[10px] text-gray-400">
              positioned by overall audio similarity
            </span>
          )}
        </div>
      </div>

      {/* ── MAP ── overflow-hidden clips avatars so they never bleed above the filter bar
               or below a native bottom nav. z-index on children is scoped to this context. */}
      <div className="flex-1 relative overflow-hidden min-h-0" style={{ zIndex: 1 }}>
        <div
          ref={containerRef}
          className="absolute inset-0 bg-gradient-to-br from-yellow-50 via-pink-50 to-blue-50"
          style={{ cursor: isCursorGrab ? 'grabbing' : 'grab', touchAction: 'none' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Grid */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.18 }}>
            <defs>
              <pattern
                id="mapgrid"
                width={80 * transform.scale}
                height={80 * transform.scale}
                patternUnits="userSpaceOnUse"
                x={(containerSize.w / 2 + transform.x) % (80 * transform.scale)}
                y={(containerSize.h / 2 + transform.y) % (80 * transform.scale)}
              >
                <path
                  d={`M ${80 * transform.scale} 0 L 0 0 0 ${80 * transform.scale}`}
                  fill="none" stroke="#a78bfa" strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mapgrid)" />
          </svg>

          {/* Axis lines + labels in scatter mode */}
          {mode === 'axes' && (() => {
            const origin = dataToScreen(0, 0, transform, containerSize.w, containerSize.h);
            return (
              <>
                {/* X axis */}
                <div className="absolute pointer-events-none" style={{
                  left: 0, right: 0, top: origin.sy,
                  height: 1,
                  background: 'repeating-linear-gradient(90deg,#a78bfa 0,#a78bfa 5px,transparent 5px,transparent 12px)',
                  opacity: 0.5,
                }} />
                {/* Y axis */}
                <div className="absolute pointer-events-none" style={{
                  top: 0, bottom: 0, left: origin.sx,
                  width: 1,
                  background: 'repeating-linear-gradient(180deg,#a78bfa 0,#a78bfa 5px,transparent 5px,transparent 12px)',
                  opacity: 0.5,
                }} />
                {/* Axis labels */}
                <div className="absolute pointer-events-none text-[10px] font-bold text-purple-400 px-1"
                  style={{ left: containerSize.w - 6, top: origin.sy + 4, transform: 'translateX(-100%)' }}>
                  {xLabel} →
                </div>
                <div className="absolute pointer-events-none text-[10px] font-bold text-purple-400 px-1"
                  style={{ left: origin.sx + 4, top: 4 }}>
                  ↑ {yLabel}
                </div>
              </>
            );
          })()}

          {/* Avatars */}
          {userMapPositions.map((userPos, i) => {
            const { sx, sy } = getScreenPos(userPos);
            const isSelected    = selectedUser?.user.id === userPos.user.id;
            const isCurrentUser = userPos.user.id === currentUser.id;

            // Avatar size scales inversely with zoom so they stay a constant
            // physical size in data-space — zooming in reveals more detail,
            // zooming out keeps the overview readable.
            // Clamped so they never get tiny (<18px) or huge (>52px).
            // Fixed screen-space size — avatars stay the same px size regardless
            // of zoom, exactly like pins on Google Maps. Zooming moves nodes
            // apart (more data-space visible), not shrinks them.
            const baseSize    = isCurrentUser ? Math.round(AVATAR_SIZE * 1.2) : AVATAR_SIZE;
            const size        = isSelected ? Math.round(baseSize * 1.4) : baseSize;

            return (
              <button
                key={`${userPos.user.id}-${i}`}
                className="absolute focus:outline-none group"
                style={{
                  left: sx, top: sy,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isSelected ? 4 : 2,
                  transition: 'left 0.4s cubic-bezier(0.34,1.56,0.64,1), top 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                }}
                onPointerDown={handleAvatarPointerDown}
                onClick={e => handleAvatarClick(e, userPos)}
                onMouseEnter={e => handleAvatarMouseEnter(e, userPos)}
                onMouseMove={handleAvatarMouseMove}
                onMouseLeave={handleAvatarMouseLeave}
              >
                {userPos.user.avatarUrl ? (
                  <img
                    src={userPos.user.avatarUrl}
                    alt={userPos.user.username}
                    draggable={false}
                    className={[
                      'rounded-full object-cover select-none block',
                      'border-2 border-black transition-all duration-150',
                      isCurrentUser ? 'ring-[3px] ring-purple-500 ring-offset-1' : '',
                      isSelected    ? 'scale-110 shadow-lg' : 'hover:scale-105',
                    ].join(' ')}
                    style={{ width: size, height: size }}
                    onError={e => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <AnonAvatar
                    username={userPos.user.username}
                    size={size}
                    className={[
                      'border-2 border-black transition-all duration-150',
                      isCurrentUser ? 'ring-[3px] ring-purple-500 ring-offset-1' : '',
                      isSelected    ? 'scale-110 shadow-lg' : 'hover:scale-105',
                    ].join(' ')}
                  />
                )}

              </button>
            );
          })}

          {/* Hover tooltip */}
          {hoveredUser && !selectedUser && (
            <div
              className="absolute pointer-events-none z-10 bg-white border-2 border-black px-2.5 py-1.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
              style={{
                left: tooltipPos.x + 14,
                top:  tooltipPos.y - 10,
                transform: tooltipPos.x > containerSize.w - 200 ? 'translateX(-110%)' : undefined,
              }}
            >
              <p className="text-[11px] font-bold leading-tight">{hoveredUser.songToday.songTitle}</p>
              <p className="text-[10px] text-gray-500">{hoveredUser.songToday.artist}</p>
              <p className="text-[9px] text-gray-400 mt-0.5">@{hoveredUser.user.username} · click to see post</p>
            </div>
          )}
        </div>
      </div>

      {/* ── POST MODAL ── */}
      {selectedUser && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-white border-4 border-black w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b-2 border-black">
              <div className="flex items-center gap-3">
                {selectedUser.user.avatarUrl ? (
                  <img
                    src={selectedUser.user.avatarUrl}
                    alt={selectedUser.user.username}
                    className="w-10 h-10 rounded-full border-2 border-black object-cover flex-shrink-0"
                  />
                ) : (
                  <AnonAvatar
                    username={selectedUser.user.username}
                    size={40}
                    className="border-2 border-black flex-shrink-0"
                  />
                )}
                <div>
                  <p className="font-bold leading-tight">{selectedUser.user.displayName}</p>
                  <p className="text-xs text-gray-500">@{selectedUser.user.username}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-1 hover:bg-gray-100 border border-black">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Song + caption */}
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center gap-3 bg-purple-50 border-2 border-black px-3 py-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gray-900 border-2 border-black flex-shrink-0 flex items-center justify-center">
                  <Music className="w-4 h-4 text-purple-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold truncate">{selectedUser.songToday.songTitle}</p>
                  <p className="text-sm text-gray-500 truncate">{selectedUser.songToday.artist}</p>
                </div>
              </div>

              {/* Caption */}
              <p className="text-sm text-gray-700 italic leading-relaxed mb-4">
                "{selectedUser.songToday.caption}"
              </p>

              {/* Audio feature bars */}
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                Audio features
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
                {(
                  [
                    ['energy',       selectedUser.songToday.features.energy],
                    ['danceability', selectedUser.songToday.features.danceability],
                    ['valence',      selectedUser.songToday.features.valence],
                    ['acousticness', selectedUser.songToday.features.acousticness],
                  ] as [string, number][]
                ).map(([label, val]) => {
                  const isActive = mode === 'axes' && (label === xAxis || label === yAxis);
                  return (
                    <div key={label}>
                      <div className="flex justify-between mb-0.5">
                        <span className={`text-[9px] uppercase tracking-wider ${isActive ? 'text-purple-600 font-bold' : 'text-gray-400'}`}>
                          {label}
                        </span>
                        <span className="text-[9px] text-gray-500">{Math.round(val * 100)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 border border-black/10 w-full rounded-sm overflow-hidden">
                        <div
                          className={`h-full ${isActive ? 'bg-purple-600' : 'bg-purple-400'}`}
                          style={{ width: `${val * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <div className="px-5 pb-5">
              <button
                onClick={handleVisitProfile}
                className="w-full bg-black text-white border-2 border-black py-2.5 font-bold text-sm hover:bg-gray-800 transition-colors"
              >
                VIEW PROFILE →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
