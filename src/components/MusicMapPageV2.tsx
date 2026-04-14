/**
 * MusicMapPageV2.tsx — tag-based music map
 * CLUSTER: UMAP/PCA similarity layout   AXIS: X/Y tag score graph
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router';
import { useMusicMapV2, MapPoint, Tag, resolveCollisions } from '../data/musicMapDataV2';
import { currentUser } from '../auth/currentUserInfo';
import { UserAvatar, avatarPalette, initials } from './UserAvatar';
import { ZoomIn, ZoomOut, Crosshair } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const ZOOM_MIN          = 3;
const ZOOM_MAX          = 300;
const ZOOM_BTN_FACTOR   = 1.3;
const WHEEL_SENSITIVITY = 800;
const DOT_SIZE          = 36;
const DRAG_THRESH       = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────
type Transform = { x: number; y: number; scale: number };

function clampZoom(z: number) { return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)); }

function dataToScreen(dx: number, dy: number, t: Transform, w: number, h: number) {
  return { sx: w / 2 + dx * t.scale + t.x, sy: h / 2 - dy * t.scale + t.y };
}


// ─── Tag colour ───────────────────────────────────────────────────────────────
const TAG_PALETTE = [
  { bg: '#e9d5ff', text: '#6b21a8', border: '#a855f7' },
  { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
  { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
  { bg: '#fce7f3', text: '#9d174d', border: '#ec4899' },
  { bg: '#ffedd5', text: '#9a3412', border: '#f97316' },
  { bg: '#fef9c3', text: '#854d0e', border: '#eab308' },
  { bg: '#cffafe', text: '#164e63', border: '#06b6d4' },
  { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
  { bg: '#f5f3ff', text: '#4c1d95', border: '#8b5cf6' },
  { bg: '#f0fdf4', text: '#14532d', border: '#22c55e' },
];
function tagPalette(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

// ─── Tag chip ─────────────────────────────────────────────────────────────────

function TagChip({ tag, onClick, active }: { tag: Tag; onClick?: () => void; active?: boolean }) {
  const p = tagPalette(tag.name);
  return (
    <button
      onClick={onClick}
      className="font-bold"
      style={{
        background: active ? p.text : p.bg,
        color: active ? '#fff' : p.text,
        border: `2px solid ${p.border}`,
        padding: '3px 10px',
        fontSize: 11,
        cursor: onClick ? 'pointer' : 'default',
        outline: 'none',
        boxShadow: active ? `2px 2px 0px 0px ${p.border}` : undefined,
      }}
    >
      {tag.name}
    </button>
  );
}

// ─── User avatar dot ──────────────────────────────────────────────────────────
function UserDot({ point, size, selected, highlighted, dimmed, isCurrentUser }: {
  point: MapPoint; size: number;
  selected: boolean; highlighted: boolean; dimmed: boolean; isCurrentUser: boolean;
}) {
  const baseStyle: React.CSSProperties = {
    width: size, height: size,
    borderRadius: '50%',
    border: isCurrentUser ? '3px solid #7c3aed' : '3px solid black',
    outline: selected ? '3px solid #7c3aed' : highlighted ? '3px solid #10b981' : undefined,
    outlineOffset: 2,
    opacity: dimmed ? 0.15 : 1,
    transform: selected ? 'scale(1.2)' : undefined,
    transition: 'opacity 0.2s, transform 0.15s',
    flexShrink: 0,
    objectFit: 'cover' as const,
    boxShadow: isCurrentUser
      ? '0 0 0 4px rgba(124,58,237,0.35), 0 0 14px 6px rgba(124,58,237,0.25), 3px 3px 0px 0px rgba(0,0,0,1)'
      : selected ? '3px 3px 0px 0px rgba(0,0,0,1)' : '2px 2px 0px 0px rgba(0,0,0,1)',
  };

  const p = avatarPalette(point.user.username);
  const letters = initials(point.user.displayName, point.user.username);

  const avatar = point.user.avatarUrl ? (
    <img
      src={point.user.avatarUrl}
      alt={point.user.username}
      draggable={false}
      className="select-none block"
      style={baseStyle}
      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  ) : (
    <div style={{
      ...baseStyle,
      background: p.bg, color: p.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.35), fontWeight: 700,
      userSelect: 'none',
    }}>
      {letters}
    </div>
  );

  if (!isCurrentUser) return avatar;

  // Wrap with pulsing ring for current user
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Pulsing outer ring */}
      <div className="absolute animate-ping" style={{
        inset: -8, borderRadius: '50%',
        border: '2px solid rgba(124,58,237,0.6)',
        animationDuration: '2s',
      }} />
      {/* Static ring */}
      <div className="absolute" style={{
        inset: -5, borderRadius: '50%',
        border: '2px solid #7c3aed',
        boxShadow: '0 0 10px 3px rgba(124,58,237,0.3)',
      }} />
      {avatar}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export function MusicMapPageV2() {
  const containerRef = useRef<HTMLDivElement>(null);

  const mapState  = useMusicMapV2();
  const points    = mapState.status === 'ready' ? mapState.points  : [];
  const allTags   = mapState.status === 'ready' ? mapState.allTags : [];
  const algorithm = mapState.status === 'ready' ? mapState.algorithm : null;

  // ── View mode ──────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'cluster' | 'axis'>('cluster');
  const [xTag, setXTag] = useState('');
  const [yTag, setYTag] = useState('');
  useEffect(() => {
    if (allTags.length >= 2 && !xTag && !yTag) {
      setXTag(allTags[0].name);
      setYTag(allTags[1].name);
    }
  }, [allTags, xTag, yTag]);

  // ── Transform ──────────────────────────────────────────────────────────────
  const transformRef = useRef<Transform>({ x: 0, y: 0, scale: 40 });
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 40 });
  const syncTransform = useCallback((t: Transform) => {
    transformRef.current = t;
    setTransform({ ...t });
  }, []);

  // ── Pointer tracking (mouse + touch via Pointer Events API) ───────────────
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragStart      = useRef({ x: 0, y: 0 });
  const tAtDragStart   = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  const didDrag        = useRef(false);
  const lastPinchDist  = useRef<number | null>(null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [hoveredPoint,  setHoveredPoint]  = useState<MapPoint | null>(null);
  const [tooltipPos,    setTooltipPos]    = useState({ x: 0, y: 0 });
  const [activeTag,     setActiveTag]     = useState<string | null>(null);
  const [isCursorGrab,  setIsCursorGrab]  = useState(false);

  const globalTags = useMemo<Tag[]>(() => allTags.slice(0, 10), [allTags]);

  // ── Axis coords ────────────────────────────────────────────────────────────
  const axisCoords = useMemo<Map<string, { ax: number; ay: number }>>(() => {
    const result = new Map<string, { ax: number; ay: number }>();
    if (!xTag && !yTag) return result;
    const score = (pt: MapPoint, tag: string) => pt.tags.find(t => t.name === tag)?.count ?? 0;
    const xScores = points.map(p => score(p, xTag));
    const yScores = points.map(p => score(p, yTag));
    const maxX = Math.max(...xScores, 1);
    const maxY = Math.max(...yScores, 1);

    const raw: [number, number][] = points.map((_, i) => [
      Math.sqrt(xScores[i] / maxX) * 10 - 5,
      Math.sqrt(yScores[i] / maxY) * 10 - 5,
    ]);
    const resolved = resolveCollisions(raw, 1.2, 30);
    points.forEach((p, i) => result.set(p.id, { ax: resolved[i][0], ay: resolved[i][1] }));
    return result;
  }, [points, xTag, yTag]);

  const getCoords = useCallback((p: MapPoint) => {
    if (viewMode === 'axis') {
      const ac = axisCoords.get(p.id);
      return { x: ac?.ax ?? 0, y: ac?.ay ?? 0 };
    }
    return { x: p.x, y: p.y };
  }, [viewMode, axisCoords]);

  // ── Container size ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setContainerSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Prevent browser pinch-zoom anywhere on page ────────────────────────────
  useEffect(() => {
    const prevent = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    document.addEventListener('wheel', prevent, { passive: false });
    return () => document.removeEventListener('wheel', prevent);
  }, []);

  // ── Map wheel zoom (non-passive, fires on map area) ────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 20;
      if (e.deltaMode === 2) dy *= rect.height;
      const factor = Math.exp(-dy / WHEEL_SENSITIVITY);
      const fx = e.clientX - rect.left;
      const fy = e.clientY - rect.top;
      const t = transformRef.current;
      const ns = clampZoom(t.scale * factor);
      const r = ns / t.scale;
      syncTransform({ scale: ns, x: fx - r * (fx - t.x), y: fy - r * (fy - t.y) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [syncTransform]);

  // ── Keyboard zoom (+/-) ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      const cx = containerSize.w / 2;
      const cy = containerSize.h / 2;
      const t = transformRef.current;
      if (e.key === '+' || e.key === '=' || (e.ctrlKey && e.key === '=')) {
        e.preventDefault();
        const ns = clampZoom(t.scale * ZOOM_BTN_FACTOR);
        const r = ns / t.scale;
        syncTransform({ scale: ns, x: cx - r * (cx - t.x), y: cy - r * (cy - t.y) });
      } else if (e.key === '-' || (e.ctrlKey && e.key === '-')) {
        e.preventDefault();
        const ns = clampZoom(t.scale / ZOOM_BTN_FACTOR);
        const r = ns / t.scale;
        syncTransform({ scale: ns, x: cx - r * (cx - t.x), y: cy - r * (cy - t.y) });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [containerSize, syncTransform]);

  // (touch handled via Pointer Events below)

  // ── Fit all ────────────────────────────────────────────────────────────────
  const fitAllTransform = useCallback((padding = 0.14): Transform => {
    if (points.length === 0) return { x: 0, y: 0, scale: 40 };
    const xs = points.map(p => getCoords(p).x);
    const ys = points.map(p => getCoords(p).y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const dataW = maxX - minX || 1, dataH = maxY - minY || 1;
    const rect = containerRef.current?.getBoundingClientRect();
    const w = rect?.width ?? containerSize.w;
    const h = rect?.height ?? containerSize.h;
    // scale = pixels per data unit; no arbitrary cap, just clamp to zoom limits
    const scale = clampZoom(Math.min(
      (w * (1 - 2 * padding)) / dataW,
      (h * (1 - 2 * padding)) / dataH,
    ));
    return { scale, x: -((minX + maxX) / 2 * scale), y: (minY + maxY) / 2 * scale };
  }, [containerSize, points, getCoords]);

  const resetView = useCallback(() => syncTransform(fitAllTransform()), [syncTransform, fitAllTransform]);

  const zoomAround = useCallback((fx: number, fy: number, factor: number) => {
    const t = transformRef.current;
    const ns = clampZoom(t.scale * factor);
    const r = ns / t.scale;
    syncTransform({ scale: ns, x: fx - r * (fx - t.x), y: fy - r * (fy - t.y) });
  }, [syncTransform]);
  const midX = containerSize.w / 2, midY = containerSize.h / 2;
  const zoomIn  = () => zoomAround(midX, midY, ZOOM_BTN_FACTOR);
  const zoomOut = () => zoomAround(midX, midY, 1 / ZOOM_BTN_FACTOR);

  const hasFitted = useRef(false);
  useEffect(() => {
    if (hasFitted.current || (containerSize.w === 800 && containerSize.h === 600)) return;
    hasFitted.current = true;
    syncTransform(fitAllTransform());
  }, [containerSize, fitAllTransform, syncTransform]);

  useEffect(() => { hasFitted.current = false; }, [viewMode]);

  // ── Pointer events — handles mouse + touch + stylus uniformly ─────────────
  // touch-action:none on the canvas tells the browser to hand all touch input
  // here instead of scrolling/zooming the page — works on iOS Safari & Android.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 1) {
      didDrag.current = false;
      dragStart.current = { x: e.clientX, y: e.clientY };
      tAtDragStart.current = { ...transformRef.current };
      lastPinchDist.current = null;
      setIsCursorGrab(true);
    } else if (activePointers.current.size === 2) {
      const pts = [...activePointers.current.values()];
      lastPinchDist.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2 && lastPinchDist.current !== null) {
      const pts = [...activePointers.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const rect = containerRef.current!.getBoundingClientRect();
      const fx = midX - rect.left, fy = midY - rect.top;
      const t = transformRef.current;
      const ns = clampZoom(t.scale * dist / lastPinchDist.current);
      const r = ns / t.scale;
      syncTransform({ scale: ns, x: fx - r * (fx - t.x), y: fy - r * (fy - t.y) });
      lastPinchDist.current = dist;
    } else if (activePointers.current.size === 1) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (!didDrag.current && Math.hypot(dx, dy) < DRAG_THRESH) return;
      didDrag.current = true;
      syncTransform({ ...tAtDragStart.current, x: tAtDragStart.current.x + dx, y: tAtDragStart.current.y + dy });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) lastPinchDist.current = null;
    if (activePointers.current.size === 0) setIsCursorGrab(false);
  };

  const handleDotClick  = (e: React.MouseEvent, pt: MapPoint) => { e.stopPropagation(); if (!didDrag.current) { setSelectedPoint(pt); setHoveredPoint(null); } };
  const handleDotEnter  = (e: React.MouseEvent, pt: MapPoint) => { setHoveredPoint(pt); const r = containerRef.current!.getBoundingClientRect(); setTooltipPos({ x: e.clientX - r.left, y: e.clientY - r.top }); };
  const handleDotMove   = (e: React.MouseEvent)                => { const r = containerRef.current!.getBoundingClientRect(); setTooltipPos({ x: e.clientX - r.left, y: e.clientY - r.top }); };
  const handleDotLeave  = ()                                   => setHoveredPoint(null);

  // ── Loading / error ────────────────────────────────────────────────────────
  if (mapState.status === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center gap-3">
        <div className="w-5 h-5 border-4 border-black border-t-transparent rounded-full animate-spin" />
        <span className="font-bold">Building music map…</span>
      </div>
    );
  }
  if (mapState.status === 'error') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-8">
        <p className="text-red-600 font-bold text-center border-4 border-red-600 p-4 shadow-[4px_4px_0px_0px_rgba(220,38,38,1)]">{mapState.message}</p>
      </div>
    );
  }
  if (points.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-8">
        <div className="text-center border-4 border-black p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-bold text-lg mb-2">No map data yet</p>
          <p className="text-sm text-gray-500">Post songs to start building the map.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white" style={{ height: 'calc(100dvh - 64px)', overflow: 'hidden', touchAction: 'none' }}>

      {/* ── HEADER ── */}
      <div className="bg-white border-b-4 border-black flex-shrink-0">
        <div className="px-3 py-2 sm:px-4 sm:py-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black tracking-tight">MUSIC MAP</h1>
            <p className="text-[10px] text-gray-500 font-medium">
              {points.length} {points.length === 1 ? 'user' : 'users'}
              {algorithm && viewMode === 'cluster' && (
                <span className="ml-1 font-black text-purple-600 uppercase">[{algorithm}]</span>
              )}
            </p>
          </div>
          {/* View toggle */}
          <div className="flex border-2 border-black overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex-shrink-0">
            <button
              onClick={() => setViewMode('cluster')}
              className={`px-3 py-1.5 text-[11px] font-black tracking-wider transition-colors ${viewMode === 'cluster' ? 'bg-black text-white' : 'bg-white text-black active:bg-gray-100'}`}
            >
              CLUSTER
            </button>
            <button
              onClick={() => setViewMode('axis')}
              className={`px-3 py-1.5 text-[11px] font-black tracking-wider border-l-2 border-black transition-colors ${viewMode === 'axis' ? 'bg-black text-white' : 'bg-white text-black active:bg-gray-100'}`}
            >
              AXIS
            </button>
          </div>
        </div>
      </div>

      {/* ── CLUSTER filter bar ── */}
      {viewMode === 'cluster' && globalTags.length > 0 && (
        <div className="flex-shrink-0 bg-white border-b-2 border-black">
          <div className="px-3 sm:px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex-shrink-0">Filter</span>
            {globalTags.map(tag => (
              <div key={tag.name} className="flex-shrink-0">
                <TagChip tag={tag} active={activeTag === tag.name}
                  onClick={() => setActiveTag(prev => prev === tag.name ? null : tag.name)} />
              </div>
            ))}
            {activeTag && (
              <button onClick={() => setActiveTag(null)}
                className="text-[10px] font-bold text-gray-400 hover:text-black underline ml-1 flex-shrink-0">clear</button>
            )}
          </div>
        </div>
      )}

      {/* ── AXIS selectors ── */}
      {viewMode === 'axis' && (
        <div className="flex-shrink-0 bg-white border-b-2 border-black">
          <div className="px-3 sm:px-4 py-2 flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
            {[['X axis', xTag, setXTag], ['Y axis', yTag, setYTag]].map(([label, val, setter]) => (
              <div key={label as string} className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label as string}</span>
                <select
                  value={val as string}
                  onChange={e => (setter as (v: string) => void)(e.target.value)}
                  className="text-xs font-bold border-2 border-black px-2 py-1 bg-yellow-50 focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  {allTags.map(t => (
                    <option key={t.name} value={t.name}>{t.name} ({t.count})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MAP CANVAS ── */}
      <div className="flex-1 relative overflow-hidden min-h-0" style={{ touchAction: 'none' }}>
        <div
          ref={containerRef}
          className="absolute inset-0 bg-gradient-to-br from-yellow-50 via-pink-50 to-blue-50"
          style={{ cursor: isCursorGrab ? 'grabbing' : 'grab', touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* Grid — fixed 80px screen-space grid, shifts with pan */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.12 }}>
            <defs>
              <pattern id="mapgrid2"
                width={80} height={80}
                patternUnits="userSpaceOnUse"
                x={(containerSize.w / 2 + transform.x) % 80}
                y={(containerSize.h / 2 + transform.y) % 80}
              >
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#a78bfa" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mapgrid2)" />
          </svg>

          {/* Axis lines (axis mode) */}
          {viewMode === 'axis' && (() => {
            const o = dataToScreen(0, 0, transform, containerSize.w, containerSize.h);
            return (
              <>
                <div className="absolute pointer-events-none" style={{ left: 0, right: 0, top: o.sy, borderTop: '2px dashed rgba(0,0,0,0.25)' }} />
                <div className="absolute pointer-events-none" style={{ top: 0, bottom: 0, left: o.sx, borderLeft: '2px dashed rgba(0,0,0,0.25)' }} />
                <div className="absolute pointer-events-none font-black text-[9px] uppercase text-gray-400"
                  style={{ bottom: containerSize.h - o.sy + 10, right: 12 }}>
                  ← low {xTag} &nbsp;·&nbsp; high {xTag} →
                </div>
                <div className="absolute pointer-events-none font-black text-[9px] uppercase text-gray-400"
                  style={{ left: o.sx + 10, top: 10, writingMode: 'vertical-rl' }}>
                  ↑ high {yTag}
                </div>
              </>
            );
          })()}

          {/* Dots */}
          {points.map(pt => {
            const { x, y } = getCoords(pt);
            const { sx, sy } = dataToScreen(x, y, transform, containerSize.w, containerSize.h);
            const isSelected    = selectedPoint?.id === pt.id;
            const isCurrentUserNode = pt.user.id === currentUser.id;
            const hasTag        = !activeTag || pt.tags.some(t => t.name === activeTag);
            const dimmed        = viewMode === 'cluster' && !!activeTag && !hasTag;
            const highlighted   = viewMode === 'cluster' && !!activeTag && hasTag;
            const size          = isSelected ? Math.round(DOT_SIZE * 1.35) : DOT_SIZE;

            return (
              <button
                key={pt.id}
                className="absolute focus:outline-none"
                style={{
                  left: sx, top: sy,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isSelected ? 4 : 2,
                  transition: 'left 0.35s cubic-bezier(0.34,1.56,0.64,1), top 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                }}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => handleDotClick(e, pt)}
                onMouseEnter={e => handleDotEnter(e, pt)}
                onMouseMove={handleDotMove}
                onMouseLeave={handleDotLeave}
              >
                <UserDot point={pt} size={size} selected={isSelected} highlighted={highlighted} dimmed={dimmed} isCurrentUser={isCurrentUserNode} />
              </button>
            );
          })}

          {/* Tooltip — clamped to all four edges */}
          {hoveredPoint && !selectedPoint && (() => {
            const TW = 204, TH = 88;
            const tipLeft = tooltipPos.x + 20 + TW > containerSize.w
              ? tooltipPos.x - TW - 8
              : tooltipPos.x + 20;
            const tipTop = Math.max(4, Math.min(tooltipPos.y - 12, containerSize.h - TH - 4));
            return (
              <div
                className="absolute pointer-events-none z-10 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] px-3 py-2"
                style={{ left: tipLeft, top: tipTop, width: TW }}
              >
                <p className="text-[12px] font-black leading-tight">{hoveredPoint.songTitle}</p>
                <p className="text-[10px] text-gray-500 font-medium">{hoveredPoint.artist}</p>
                <p className="text-[10px] font-bold text-gray-400">@{hoveredPoint.user.username}</p>
                {hoveredPoint.tags.length > 0 && (
                  <p className="text-[9px] text-gray-400 mt-0.5 font-medium">
                    {hoveredPoint.tags.slice(0, 3).map(t => t.name).join(' · ')}
                  </p>
                )}
              </div>
            );
          })()}
        </div>

        {/* ── FLOATING ZOOM CONTROLS ── */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10 pointer-events-none">
          <button
            onClick={zoomIn}
            className="w-10 h-10 flex items-center justify-center bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] hover:bg-gray-100 pointer-events-auto transition-transform"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            className="w-10 h-10 flex items-center justify-center bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] hover:bg-gray-100 pointer-events-auto transition-transform"
          >
            <Crosshair className="w-4 h-4" />
          </button>
          <button
            onClick={zoomOut}
            className="w-10 h-10 flex items-center justify-center bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] hover:bg-gray-100 pointer-events-auto transition-transform"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-mono font-bold text-gray-500 text-center tabular-nums mt-0.5">
            {Math.round(transform.scale * 100)}%
          </span>
        </div>
      </div>

      {/* ── DETAIL MODAL ── */}
      {selectedPoint && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPoint(null)}
        >
          <div
            className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
            onClick={e => e.stopPropagation()}
          >
            {/* User row */}
            <div className="flex items-center gap-3 mb-4">
              <Link to={`/profile/${selectedPoint.user.username}`} onClick={() => setSelectedPoint(null)}>
                <UserAvatar
                  avatarUrl={selectedPoint.user.avatarUrl}
                  displayName={selectedPoint.user.displayName}
                  username={selectedPoint.user.username}
                  size={44}
                  className="border-2 border-black flex-shrink-0"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <p className="font-bold leading-tight">{selectedPoint.user.displayName}</p>
                <Link
                  to={`/profile/${selectedPoint.user.username}`}
                  className="text-sm text-gray-600 hover:underline font-medium"
                  onClick={() => setSelectedPoint(null)}
                >
                  @{selectedPoint.user.username}
                </Link>
              </div>
            </div>

            {/* Date */}
            <div className="flex items-center gap-2 mb-4 text-sm">
              <span className="font-bold text-black">
                {new Date(selectedPoint.postDate || selectedPoint.postedAt).toLocaleDateString('default', {
                  month: 'long', day: 'numeric', year: 'numeric',
                }).toUpperCase()}
              </span>
            </div>

            {/* Album art + song info — matches calendar popup proportions */}
            <div className="flex gap-4 mb-4">
              {selectedPoint.albumArt ? (
                <img
                  src={selectedPoint.albumArt}
                  alt={selectedPoint.songTitle}
                  className="w-32 h-32 border-2 border-black object-cover shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex-shrink-0"
                />
              ) : (
                <div className="w-32 h-32 border-2 border-black bg-gray-100 flex items-center justify-center flex-shrink-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <span className="text-4xl">🎵</span>
                </div>
              )}
              <div className="flex flex-col justify-center min-w-0">
                <p className="font-bold mb-1 text-black">{selectedPoint.songTitle}</p>
                <p className="text-sm text-gray-600 mb-3 font-medium">{selectedPoint.artist}</p>
                {selectedPoint.spotifyUrl && (
                  <a
                    href={selectedPoint.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 font-bold underline"
                  >
                    OPEN IN SPOTIFY
                  </a>
                )}
              </div>
            </div>

            {/* Caption */}
            {selectedPoint.caption && (
              <p className="text-black mb-4">{selectedPoint.caption}</p>
            )}

            {/* Tags */}
            {selectedPoint.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {selectedPoint.tags.map(tag => (
                  <TagChip key={tag.name} tag={tag} active={activeTag === tag.name}
                    onClick={() => {
                      setActiveTag(prev => prev === tag.name ? null : tag.name);
                      setSelectedPoint(null);
                      if (viewMode !== 'cluster') setViewMode('cluster');
                    }} />
                ))}
              </div>
            )}

            {/* Close — matches calendar popup */}
            <button
              onClick={() => setSelectedPoint(null)}
              className="w-full bg-gray-200 border-2 border-black px-4 py-2 font-bold hover:bg-gray-300 transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
