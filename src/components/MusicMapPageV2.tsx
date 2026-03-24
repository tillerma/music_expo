/**
 * MusicMapPageV2.tsx — tag-based music map
 * CLUSTER: UMAP/PCA similarity layout   AXIS: X/Y tag score graph
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useMusicMapV2, MapPoint, Tag, resolveCollisions } from '../data/musicMapDataV2';
import { currentUser } from '../auth/currentUserInfo';
import { X, ZoomIn, ZoomOut, Crosshair } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const ZOOM_MIN          = 0.3;
const ZOOM_MAX          = 6;
const ZOOM_BTN_FACTOR   = 1.25;
const WHEEL_SENSITIVITY = 1200;
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

  const avatar = point.user.avatarUrl ? (
    <img
      src={point.user.avatarUrl}
      alt={point.user.username}
      draggable={false}
      className="select-none block"
      style={baseStyle}
      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  ) : (() => {
    const p = tagPalette(point.user.username);
    return (
      <div style={{
        ...baseStyle,
        background: p.bg, color: p.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.35), fontWeight: 700,
        userSelect: 'none',
      }}>
        {point.user.username.slice(0, 2).toUpperCase()}
      </div>
    );
  })();

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
  const navigate     = useNavigate();
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
  const transformRef = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const syncTransform = useCallback((t: Transform) => {
    transformRef.current = t;
    setTransform({ ...t });
  }, []);

  // ── Drag ───────────────────────────────────────────────────────────────────
  const isDown       = useRef(false);
  const dragStart    = useRef({ x: 0, y: 0 });
  const tAtDragStart = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  const didDrag      = useRef(false);
  const lastPinch    = useRef<number | null>(null);

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
    // sqrt scaling: compresses high scores, spreads low ones → more organic spacing
    const raw: [number, number][] = points.map((_, i) => [
      Math.sqrt(xScores[i] / maxX) * 10 - 5,
      Math.sqrt(yScores[i] / maxY) * 10 - 5,
    ]);
    const resolved = resolveCollisions(raw, 1.1);
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

  // ── Touch pinch/pan ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2 && lastPinch.current !== null) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = el.getBoundingClientRect();
        const fx = midX - rect.left, fy = midY - rect.top;
        const t = transformRef.current;
        const ns = clampZoom(t.scale * dist / lastPinch.current);
        const r = ns / t.scale;
        syncTransform({ scale: ns, x: fx - r * (fx - t.x), y: fy - r * (fy - t.y) });
        lastPinch.current = dist;
      } else if (e.touches.length === 1 && isDown.current) {
        const ddx = e.touches[0].clientX - dragStart.current.x;
        const ddy = e.touches[0].clientY - dragStart.current.y;
        if (!didDrag.current && Math.hypot(ddx, ddy) < DRAG_THRESH) return;
        didDrag.current = true;
        syncTransform({ ...tAtDragStart.current, x: tAtDragStart.current.x + ddx, y: tAtDragStart.current.y + ddy });
      }
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, [syncTransform]);

  // ── Fit all ────────────────────────────────────────────────────────────────
  const fitAllTransform = useCallback((padding = 0.14): Transform => {
    if (points.length === 0) return { x: 0, y: 0, scale: 1 };
    const xs = points.map(p => getCoords(p).x);
    const ys = points.map(p => getCoords(p).y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const dataW = maxX - minX || 1, dataH = maxY - minY || 1;
    const { w, h } = containerSize;
    const scale = clampZoom(Math.min(
      (w * (1 - 2 * padding)) / dataW,
      (h * (1 - 2 * padding)) / dataH,
      1.4,
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

  // ── Mouse ──────────────────────────────────────────────────────────────────
  const onMouseDown  = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDown.current = true; didDrag.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    tAtDragStart.current = { ...transformRef.current };
    setIsCursorGrab(true);
  };
  const onMouseMove  = (e: React.MouseEvent) => {
    if (!isDown.current) return;
    const dx = e.clientX - dragStart.current.x, dy = e.clientY - dragStart.current.y;
    if (!didDrag.current && Math.hypot(dx, dy) < DRAG_THRESH) return;
    didDrag.current = true;
    syncTransform({ ...tAtDragStart.current, x: tAtDragStart.current.x + dx, y: tAtDragStart.current.y + dy });
  };
  const onMouseUp    = () => { isDown.current = false; setIsCursorGrab(false); };
  const onMouseLeave = () => { isDown.current = false; setIsCursorGrab(false); };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastPinch.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    } else {
      isDown.current = true; didDrag.current = false;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      tAtDragStart.current = { ...transformRef.current };
    }
  };
  const onTouchEnd = () => { isDown.current = false; lastPinch.current = null; };

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
    <div className="flex flex-col bg-white" style={{ height: 'calc(100dvh - 64px)' }}>

      {/* ── HEADER ── */}
      <div className="bg-white border-b-4 border-black flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black tracking-tight">MUSIC MAP</h1>
            <p className="text-[11px] text-gray-500 font-medium">
              {points.length} posts · scroll or +/- to zoom
              {algorithm && viewMode === 'cluster' && (
                <span className="ml-2 font-black text-purple-600 uppercase">[{algorithm}]</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* View toggle */}
            <div className="flex border-2 border-black overflow-hidden mr-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <button
                onClick={() => setViewMode('cluster')}
                className={`px-3 py-1.5 text-[11px] font-black tracking-wider transition-colors ${viewMode === 'cluster' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'}`}
              >
                CLUSTER
              </button>
              <button
                onClick={() => setViewMode('axis')}
                className={`px-3 py-1.5 text-[11px] font-black tracking-wider border-l-2 border-black transition-colors ${viewMode === 'axis' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'}`}
              >
                AXIS
              </button>
            </div>
            <button onClick={zoomOut}   className="w-8 h-8 flex items-center justify-center border-2 border-black hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><ZoomOut className="w-4 h-4" /></button>
            <button onClick={resetView} className="w-8 h-8 flex items-center justify-center border-2 border-black hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><Crosshair className="w-4 h-4" /></button>
            <button onClick={zoomIn}    className="w-8 h-8 flex items-center justify-center border-2 border-black hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><ZoomIn className="w-4 h-4" /></button>
            <span className="text-[11px] font-mono font-bold text-gray-500 w-10 text-right tabular-nums">
              {Math.round(transform.scale * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* ── CLUSTER filter bar ── */}
      {viewMode === 'cluster' && globalTags.length > 0 && (
        <div className="flex-shrink-0 bg-white border-b-2 border-black">
          <div className="px-4 py-2 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex-shrink-0">Filter</span>
            {globalTags.map(tag => (
              <TagChip key={tag.name} tag={tag} active={activeTag === tag.name}
                onClick={() => setActiveTag(prev => prev === tag.name ? null : tag.name)} />
            ))}
            {activeTag && (
              <button onClick={() => setActiveTag(null)}
                className="text-[10px] font-bold text-gray-400 hover:text-black underline ml-1">clear</button>
            )}
          </div>
        </div>
      )}

      {/* ── AXIS selectors ── */}
      {viewMode === 'axis' && (
        <div className="flex-shrink-0 bg-white border-b-2 border-black">
          <div className="px-4 py-2 flex items-center gap-4 flex-wrap">
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
      <div className="flex-1 relative overflow-hidden min-h-0">
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
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.15 }}>
            <defs>
              <pattern id="mapgrid2"
                width={80 * transform.scale} height={80 * transform.scale}
                patternUnits="userSpaceOnUse"
                x={(containerSize.w / 2 + transform.x) % (80 * transform.scale)}
                y={(containerSize.h / 2 + transform.y) % (80 * transform.scale)}
              >
                <path d={`M ${80 * transform.scale} 0 L 0 0 0 ${80 * transform.scale}`}
                  fill="none" stroke="#a78bfa" strokeWidth="0.6" />
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

          {/* Tooltip */}
          {hoveredPoint && !selectedPoint && (
            <div
              className="absolute pointer-events-none z-10 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] px-3 py-2"
              style={{
                left: tooltipPos.x + 16, top: tooltipPos.y - 12,
                transform: tooltipPos.x > containerSize.w - 200 ? 'translateX(-110%)' : undefined,
              }}
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
          )}
        </div>
      </div>

      {/* ── DETAIL MODAL ── */}
      {selectedPoint && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setSelectedPoint(null)}
        >
          <div
            className="bg-white border-4 border-black w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
            onClick={e => e.stopPropagation()}
          >
            {/* User header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b-4 border-black bg-gradient-to-r from-pink-100 to-purple-100">
              <div className="flex items-center gap-3">
                {selectedPoint.user.avatarUrl ? (
                  <img src={selectedPoint.user.avatarUrl} alt={selectedPoint.user.username}
                    className="w-12 h-12 rounded-full border-4 border-black object-cover shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
                ) : (
                  <div className="w-12 h-12 rounded-full border-4 border-black bg-purple-200 flex items-center justify-center text-sm font-black">
                    {selectedPoint.user.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-black text-base leading-tight">{selectedPoint.user.displayName}</p>
                  <p className="text-sm text-gray-600 font-medium">@{selectedPoint.user.username}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPoint(null)}
                className="w-8 h-8 flex items-center justify-center border-2 border-black bg-white hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Song card */}
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center gap-0 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden mb-4">
                {selectedPoint.albumArt ? (
                  <img src={selectedPoint.albumArt} alt={selectedPoint.songTitle}
                    className="w-16 h-16 object-cover border-r-4 border-black flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 bg-gray-900 border-r-4 border-black flex-shrink-0 flex items-center justify-center">
                    <span className="text-2xl">🎵</span>
                  </div>
                )}
                <div className="flex-1 min-w-0 px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50">
                  <p className="font-black text-sm truncate">{selectedPoint.songTitle}</p>
                  <p className="text-xs text-gray-600 font-medium truncate">{selectedPoint.artist}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(selectedPoint.postedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {selectedPoint.caption && (
                <p className="text-sm text-gray-700 italic leading-relaxed mb-4 px-1">"{selectedPoint.caption}"</p>
              )}

              {selectedPoint.tags.length > 0 && (
                <div className="mb-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPoint.tags.map(tag => (
                      <TagChip key={tag.name} tag={tag} active={activeTag === tag.name}
                        onClick={() => {
                          setActiveTag(prev => prev === tag.name ? null : tag.name);
                          setSelectedPoint(null);
                          if (viewMode !== 'cluster') setViewMode('cluster');
                        }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 pb-5">
              <button
                onClick={() => { navigate(`/profile/${selectedPoint.user.username}`); setSelectedPoint(null); }}
                className="w-full bg-black text-white border-2 border-black py-3 font-black text-sm hover:bg-gray-800 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5"
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
