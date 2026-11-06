import React, { useRef, useState, useEffect } from 'react';
import { clsx } from 'clsx';
import {
  AgentBot,
  SamsTheme,
  StationId,
  StationMeta,
  VisorState,
} from '../../types/sams';
import { AgentVisor } from './AgentVisor';
import { BlackDot } from '../ui/BlackDot';

interface IsometricRoomProps {
  activeStation: StationId;
  onSelectStation: (station: StationId) => void;
  bots: AgentBot[];
  onSelectBot: (bot: AgentBot) => void;
  stations: Record<StationId, StationMeta>;
  kanbanCounts: {
    backlog: number;
    in_progress: number;
    review: number;
    done: number;
  };
  isDeskBusy: boolean;
  overrideVisorState: VisorState | null;
  theme?: SamsTheme;
  isDark?: boolean;
}

/**
 * Natural Bot Character with dynamic walking hops, directional lean,
 * shadow breathing, and staggered idle cycles so agents never move like flat pucks.
 */
interface BotCharacterProps {
  bot: AgentBot;
  effectiveVisor: VisorState;
  onClick: () => void;
  staggerIndex: number;
}

const BotCharacter: React.FC<BotCharacterProps> = ({
  bot,
  effectiveVisor,
  onClick,
  staggerIndex,
}) => {
  const prevCoord = useRef<{ x: number; y: number }>({ x: bot.x, y: bot.y });
  const [isWalking, setIsWalking] = useState(false);
  const [tiltDeg, setTiltDeg] = useState(0);

  useEffect(() => {
    const dx = bot.x - prevCoord.current.x;
    const dy = bot.y - prevCoord.current.y;
    const distance = Math.hypot(dx, dy);

    if (distance > 1) {
      setIsWalking(true);
      // Directional lean: tilt forward in direction of motion
      const tilt = dx > 0 ? 5 : dx < 0 ? -5 : dy > 0 ? 2 : -2;
      setTiltDeg(tilt);

      const timer = setTimeout(() => {
        setIsWalking(false);
        setTiltDeg(0);
      }, 1150);

      prevCoord.current = { x: bot.x, y: bot.y };
      return () => clearTimeout(timer);
    }
  }, [bot.x, bot.y]);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        left: `${bot.x}%`,
        top: `${bot.y}%`,
        transition: 'left 1150ms cubic-bezier(0.25, 1, 0.4, 1), top 1150ms cubic-bezier(0.25, 1, 0.4, 1)',
      }}
      aria-label={`${bot.name} (${bot.role}) — currently ${effectiveVisor} at ${bot.station}`}
      className="absolute -translate-x-1/2 -translate-y-1/2 z-10 group flex flex-col items-center cursor-pointer focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 rounded-lg p-1 select-none"
    >
      {/* Persona Floating Tag */}
      <span className="px-2 py-0.5 mb-1 rounded bg-elevated/95 border border-line shadow-2xs text-[10px] font-mono font-semibold text-ink whitespace-nowrap transition-transform group-hover:scale-105">
        {bot.name}
      </span>

      {/* Animated Bot Body Capsule */}
      <div
        className={clsx(
          'flex flex-col items-center transition-transform duration-300 ease-out',
          isWalking ? 'animate-bot-walk' : 'animate-bot-idle'
        )}
        style={{
          transform: `rotate(${tiltDeg}deg)`,
          animationDelay: `${staggerIndex * 0.45}s`,
        }}
      >
        {/* Bot Head Visor */}
        <AgentVisor
          state={effectiveVisor}
          frameColor={bot.bodyColor}
          size="xs"
          decorative={true}
          className="drop-shadow-xs group-hover:scale-110 transition-transform"
        />

        {/* 3D-Shaded Torso */}
        <div
          aria-hidden="true"
          className="w-5.5 h-5 -mt-0.5 rounded-b-xl rounded-t-md border-[1.5px] border-ink shadow-xs transition-colors"
          style={{ backgroundColor: bot.bodyColor }}
        />
      </div>

      {/* Dynamic 2.5D Contact Shadow */}
      <div
        aria-hidden="true"
        className={clsx(
          'w-7 h-2 bg-ink rounded-full -mt-0.5 blur-[0.6px] transition-all',
          isWalking ? 'animate-shadow-walk' : 'animate-shadow-idle'
        )}
        style={{ animationDelay: `${staggerIndex * 0.45}s` }}
      />
    </button>
  );
};

export const IsometricRoom: React.FC<IsometricRoomProps> = ({
  activeStation,
  onSelectStation,
  bots,
  onSelectBot,
  stations,
  kanbanCounts,
  isDeskBusy,
  overrideVisorState,
  theme,
  isDark = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stationRefs = useRef<Record<StationId, HTMLButtonElement | null>>({
    vault: null,
    whiteboard: null,
    kanban: null,
    desk01: null,
    security: null,
  });

  // 2D Spatial Arrow Key Navigation (modern-web-guidance `spatial-navigation`)
  const handleSpatialKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
      return;
    }

    const dirMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    const dir = dirMap[e.key];
    if (!dir) return;

    const target = (e.nativeEvent.composedPath?.()[0] || e.target) as HTMLElement;
    if (!target || target.matches?.(':read-write, select, input[type="range"], [role="slider"]')) {
      return;
    }

    const candidates = (Object.entries(stationRefs.current) as Array<[StationId, HTMLButtonElement | null]>)
      .filter(([, el]) => el !== null && (typeof el.checkVisibility !== 'function' || el.checkVisibility()))
      .map(([id, el]) => ({ id, el: el!, rect: el!.getBoundingClientRect() }));

    const currentEntry = candidates.find((c) => c.el === target);
    if (!currentEntry) return;

    const current = currentEntry.rect;
    const curCenterX = (current.left + current.right) / 2;
    const curCenterY = (current.top + current.bottom) / 2;
    const tolerance = 4;

    const directional = candidates.filter((c) => {
      if (c.id === currentEntry.id) return false;
      const r = c.rect;
      if (dir === 'right') return r.left >= current.right - tolerance;
      if (dir === 'left') return r.right <= current.left + tolerance;
      if (dir === 'down') return r.top >= current.bottom - tolerance;
      return r.bottom <= current.top + tolerance;
    });

    if (directional.length === 0) {
      return;
    }

    const scored = directional.map((c) => {
      const r = c.rect;
      const candCenterX = (r.left + r.right) / 2;
      const candCenterY = (r.top + r.bottom) / 2;

      const isHorizontal = dir === 'left' || dir === 'right';
      const overlapsPerp = isHorizontal
        ? Math.min(current.bottom, r.bottom) > Math.max(current.top, r.top)
        : Math.min(current.right, r.right) > Math.max(current.left, r.left);

      const gap =
        dir === 'right'
          ? Math.max(0, r.left - current.right)
          : dir === 'left'
            ? Math.max(0, current.left - r.right)
            : dir === 'down'
              ? Math.max(0, r.top - current.bottom)
              : Math.max(0, current.top - r.bottom);

      const perpOffset = isHorizontal
        ? Math.abs(candCenterY - curCenterY)
        : Math.abs(candCenterX - curCenterX);

      return { ...c, overlapsPerp, gap, perpOffset };
    });

    const overlapping = scored.filter((s) => s.overlapsPerp);
    let winner = scored[0];

    if (overlapping.length > 0) {
      overlapping.sort((a, b) => a.gap - b.gap || a.perpOffset - b.perpOffset);
      winner = overlapping[0];
    } else {
      const weight = 2.5;
      scored.sort((a, b) => a.gap + weight * a.perpOffset - (b.gap + weight * b.perpOffset));
      winner = scored[0];
    }

    e.preventDefault();
    onSelectStation(winner.id);
    winner.el.focus();
    winner.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const floorFill = isDark ? '#0F172A' : '#FFFFFF';
  const wallLeftFill = isDark ? '#161F30' : '#F1F5F9';
  const wallRightFill = isDark ? '#1E293B' : '#F8FAFC';
  const gridStroke = isDark ? '#3B82F6' : '#2563EB';
  const gridOpacity = isDark ? 0.08 : 0.04;
  const accentStroke = isDark ? '#3B82F6' : '#2563EB';
  const shadowColor = isDark ? '#000000' : '#0F172A';

  return (
    <div
      ref={containerRef}
      onKeyDown={handleSpatialKeyDown}
      className="relative w-full h-full flex items-center justify-center select-none overflow-hidden"
    >
      {/* 2.5D Isometric Vector Diorama Canvas (1120 x 680) */}
      <div className="relative w-full h-full flex items-center justify-center max-h-[calc(100vh-64px)] max-w-full aspect-[16/10]">
        <svg
          viewBox="0 0 1120 680"
          role="img"
          aria-label="SAMS Spacious Isometric Workspace with Vault, Whiteboard, Kanban Wall, Compute Desk 01, and Security Gate"
          className="w-full h-full block"
        >
          <defs>
            <filter id="roomShadowLarge" x="-10%" y="-10%" width="120%" height="125%">
              <feDropShadow dx="0" dy="22" stdDeviation="20" floodColor={shadowColor} floodOpacity="0.18" />
            </filter>
            {/* Isometric Floor Grid Pattern */}
            <pattern id="isoGridLarge" width="48" height="27.6" patternUnits="userSpaceOnUse">
              <path
                d="M 24 0 L 48 13.8 L 24 27.6 L 0 13.8 Z"
                fill="none"
                stroke={gridStroke}
                strokeOpacity={gridOpacity}
                strokeWidth="1"
              />
            </pattern>
          </defs>

          {/* Ambient Ground Shadow */}
          <polygon
            points="560,642 70,410 560,190 1050,422"
            fill={shadowColor}
            fillOpacity="0.08"
            filter="url(#roomShadowLarge)"
          />

          {/* ================= 1. EXPANDED ISOMETRIC WALLS & FLOOR ================= */}
          <g filter="url(#roomShadowLarge)">
            {/* North-West Wall (Back-Left) */}
            <polygon
              points="560,54 80,258 80,398 560,194"
              fill={wallLeftFill}
              stroke="#C9BFB0"
              strokeWidth="1.5"
            />
            {/* North-West Wall Bevel Top */}
            <polygon
              points="560,40 68,252 80,258 560,54"
              fill="#FAF8F4"
              stroke="#C9BFB0"
              strokeWidth="1"
            />

            {/* North-East Wall (Back-Right) */}
            <polygon
              points="560,54 1040,280 1040,420 560,194"
              fill={wallRightFill}
              stroke="#C9BFB0"
              strokeWidth="1.5"
            />
            {/* North-East Wall Bevel Top */}
            <polygon
              points="560,40 1052,274 1040,280 560,54"
              fill="#FAF8F4"
              stroke="#C9BFB0"
              strokeWidth="1"
            />

            {/* Expanded Floor Surface */}
            <polygon
              points="560,194 1040,420 580,642 80,398"
              fill={floorFill}
              stroke="#C9BFB0"
              strokeWidth="1.5"
            />
            {/* Isometric Floor Grid */}
            <polygon
              points="560,194 1040,420 580,642 80,398"
              fill="url(#isoGridLarge)"
            />

            {/* Floor Slab Front-Left & Front-Right Faces */}
            <polygon
              points="80,398 580,642 580,662 80,418"
              fill="#D4CBBF"
              stroke="#B5AB9C"
              strokeWidth="1"
            />
            <polygon
              points="580,642 1040,420 1040,440 580,662"
              fill="#C5BBB0"
              stroke="#B5AB9C"
              strokeWidth="1"
            />
          </g>

          {/* Wall Branding Typography (North-West Wall) */}
          <g transform="translate(195, 255) skewY(-26.5)">
            <text
              x="0"
              y="0"
              fill="#1C1917"
              fillOpacity="0.75"
              fontSize="24"
              fontWeight="800"
              fontFamily="Plus Jakarta Sans, sans-serif"
              letterSpacing="2.5"
            >
              SAMS
            </text>
            <text
              x="0"
              y="18"
              fill="#57534E"
              fillOpacity="0.8"
              fontSize="8.5"
              fontWeight="600"
              fontFamily="JetBrains Mono, monospace"
              letterSpacing="1.4"
            >
              SPATIAL AGENTIC
            </text>
            <text
              x="0"
              y="30"
              fill="#57534E"
              fillOpacity="0.8"
              fontSize="8.5"
              fontWeight="600"
              fontFamily="JetBrains Mono, monospace"
              letterSpacing="1.4"
            >
              MANAGEMENT SYSTEM
            </text>
          </g>

          {/* ================= 2. SPACIOUS LOUNGE AREA & PLANT (WEST CORNER) ================= */}
          {/* Potted Fiddle-Leaf Plant */}
          <g transform="translate(135, 360)">
            <ellipse cx="0" cy="30" rx="18" ry="9" fill="#1C1917" fillOpacity="0.12" />
            <polygon points="-12,10 12,10 9,30 -9,30" fill="#FAF8F4" stroke="#8C857B" strokeWidth="1.5" />
            <ellipse cx="0" cy="10" rx="12" ry="5" fill="#6E4F3A" />
            {/* Lush Leaves */}
            <path d="M 0,10 C -16,-5 -22,-20 -8,-25 C 2,-20 2,-4 0,10" fill="#5F6F52" />
            <path d="M 0,10 C 16,-6 22,-18 10,-26 C -1,-20 0,-4 0,10" fill="#4A593F" />
            <path d="M 0,8 C -8,-14 0,-32 8,-29 C 12,-18 5,-2 0,8" fill="#6F8260" />
          </g>

          {/* Cozy Armchair (Resting Station for Idle Bots) */}
          <g transform="translate(210, 365)">
            <polygon points="0,32 46,11 82,28 36,50" fill="#1C1917" fillOpacity="0.1" />
            {/* Chair Seat & Sides */}
            <polygon points="4,15 44,-5 76,11 36,31" fill="#FAF8F4" stroke="#B8B0A2" strokeWidth="1.5" />
            <polygon points="4,15 4,33 36,49 36,31" fill="#E5DEC9" stroke="#B8B0A2" strokeWidth="1.5" />
            <polygon points="36,31 76,11 76,29 36,49" fill="#D8D1C5" stroke="#B8B0A2" strokeWidth="1.5" />
            {/* Cushioned Backrest */}
            <polygon points="4,-9 44,-29 52,-25 12,-5" fill="#FAF8F4" stroke="#B8B0A2" strokeWidth="1.5" />
            <polygon points="12,-5 52,-25 52,-2 12,18" fill="#EFECE4" stroke="#B8B0A2" strokeWidth="1.5" />
            {/* Coffee Side Table with Ceramic Mug */}
            <ellipse cx="88" cy="32" rx="15" ry="7.5" fill="#D8D1C5" stroke="#8C857B" strokeWidth="1.2" />
            <line x1="88" y1="39.5" x2="88" y2="54" stroke="#57534E" strokeWidth="2.2" />
            <ellipse cx="88" cy="54" rx="10" ry="5" fill="#8C857B" />
          </g>

          {/* ================= 3. STATION 1: VAULT SAFE (NORTH-WEST) ================= */}
          <g
            onClick={() => onSelectStation('vault')}
            className="cursor-pointer group"
            transform="translate(340, 145)"
          >
            {/* Safe Drop Shadow */}
            <polygon points="-10,110 58,76 118,106 50,140" fill="#1C1917" fillOpacity="0.18" />
            {/* Safe Top Surface */}
            <polygon
              points="0,28 58,0 112,26 54,54"
              fill={activeStation === 'vault' ? '#9E9689' : '#8C857B'}
              stroke="#44403C"
              strokeWidth="2"
            />
            {/* Safe Left Face */}
            <polygon
              points="0,28 54,54 54,130 0,104"
              fill="#6E685F"
              stroke="#44403C"
              strokeWidth="2"
            />
            {/* Safe Door Face (Front-Right) */}
            <polygon
              points="54,54 112,26 112,102 54,130"
              fill="#7C756B"
              stroke="#44403C"
              strokeWidth="2"
            />
            {/* Inner Recessed Door Frame */}
            <polygon
              points="60,59 105,37 105,95 60,117"
              fill="#8C857B"
              stroke="#44403C"
              strokeWidth="1.6"
            />
            {/* Chrome Combination Wheel */}
            <ellipse
              cx="82"
              cy="77"
              rx="12"
              ry="15"
              fill="#292524"
              stroke="#FAF8F4"
              strokeWidth="2.2"
            />
            <circle cx="82" cy="77" r="4.5" fill={accentStroke} />
            {/* Heavy Vault Hinges */}
            <rect x="103" y="46" width="4.5" height="9" rx="1.5" fill="#292524" />
            <rect x="103" y="80" width="4.5" height="9" rx="1.5" fill="#292524" />
          </g>

          {/* ================= 4. STATION 2: WHITEBOARD (NORTH-EAST WALL) ================= */}
          <g
            onClick={() => onSelectStation('whiteboard')}
            className="cursor-pointer"
            transform="translate(580, 95)"
          >
            {/* Mounted Glass Whiteboard */}
            <polygon
              points="0,0 155,78 155,162 0,84"
              fill="#FAF8F4"
              stroke={activeStation === 'whiteboard' ? '#1C1917' : '#A8A093'}
              strokeWidth={activeStation === 'whiteboard' ? '2.8' : '2'}
            />
            {/* Architecture Node-Graph Diagram */}
            <g transform="skewY(26.8)" stroke="#57534E" strokeWidth="1.3" fill="none">
              <rect x="18" y="16" width="28" height="13" rx="2" fill="#EFECE4" />
              <rect x="62" y="16" width="30" height="13" rx="2" fill="#EFECE4" />
              <rect x="62" y="38" width="30" height="13" rx="2" fill="#EFECE4" />
              <rect x="110" y="27" width="28" height="15" rx="2" fill={accentStroke} fillOpacity="0.22" stroke={accentStroke} />
              <path d="M 46,22 H 62 M 77,29 V 38 M 92,22 H 110 M 92,44 L 110,35" />
            </g>
          </g>

          {/* ================= 5. STATION 3: KANBAN WALL (EAST WALL) ================= */}
          <g
            onClick={() => onSelectStation('kanban')}
            className="cursor-pointer"
            transform="translate(790, 200)"
          >
            {/* Large Kanban Surface */}
            <polygon
              points="0,0 188,95 188,188 0,93"
              fill="#FAF8F4"
              stroke={activeStation === 'kanban' ? '#1C1917' : '#A8A093'}
              strokeWidth={activeStation === 'kanban' ? '2.8' : '2'}
            />
            {/* 4 Column Dividers & Dynamic Sticky Cards */}
            <g transform="skewY(26.8)">
              <line x1="47" y1="7" x2="47" y2="88" stroke="#D8D1C5" strokeWidth="1.2" />
              <line x1="94" y1="7" x2="94" y2="88" stroke="#D8D1C5" strokeWidth="1.2" />
              <line x1="141" y1="7" x2="141" y2="88" stroke="#D8D1C5" strokeWidth="1.2" />

              <text x="8" y="15" fontSize="6.5" fontFamily="JetBrains Mono" fill="#57534E" fontWeight="700">BACKLOG</text>
              <text x="54" y="15" fontSize="6.5" fontFamily="JetBrains Mono" fill="#57534E" fontWeight="700">ACTIVE</text>
              <text x="101" y="15" fontSize="6.5" fontFamily="JetBrains Mono" fill="#57534E" fontWeight="700">REVIEW</text>
              <text x="149" y="15" fontSize="6.5" fontFamily="JetBrains Mono" fill="#57534E" fontWeight="700">DONE</text>

              {/* Dynamic Miniature Sticky Cards */}
              {Array.from({ length: Math.min(3, Math.max(1, kanbanCounts.backlog)) }).map((_, i) => (
                <rect key={`b-${i}`} x="8" y={22 + i * 18} width="32" height="13" rx="1.8" fill="#E6DEC8" stroke="#C28F42" strokeWidth="0.8" />
              ))}
              {Array.from({ length: Math.min(3, kanbanCounts.in_progress) }).map((_, i) => (
                <rect key={`p-${i}`} x="54" y={22 + i * 18} width="32" height="13" rx="1.8" fill="#F2D9CE" stroke="#B85D3B" strokeWidth="1" />
              ))}
              {Array.from({ length: Math.min(3, kanbanCounts.review) }).map((_, i) => (
                <rect key={`r-${i}`} x="101" y={22 + i * 18} width="32" height="13" rx="1.8" fill="#DCE3D6" stroke="#5F6F52" strokeWidth="0.8" />
              ))}
              {Array.from({ length: Math.min(3, Math.max(1, kanbanCounts.done)) }).map((_, i) => (
                <rect key={`d-${i}`} x="149" y={22 + i * 18} width="32" height="13" rx="1.8" fill="#E2E5E7" stroke="#5C6468" strokeWidth="0.8" />
              ))}
            </g>
          </g>

          {/* ================= 6. STATION 4: DESK 01 — ACTIVE COMPUTE (EXPANSIVE CENTER STAGE) ================= */}
          <g
            onClick={() => onSelectStation('desk01')}
            className="cursor-pointer"
            transform="translate(360, 375)"
          >
            {/* Desk Floor Shadow */}
            <polygon points="-12,82 78,36 210,104 120,150" fill="#1C1917" fillOpacity="0.18" />

            {/* Left Pedestal Leg */}
            <polygon points="8,54 44,36 44,86 8,104" fill="#523A28" stroke="#3B281B" strokeWidth="1.3" />
            <polygon points="44,36 72,50 72,100 44,86" fill="#6E4F3A" stroke="#3B281B" strokeWidth="1.3" />

            {/* Right Pedestal Drawer */}
            <polygon points="120,110 156,92 156,142 120,160" fill="#523A28" stroke="#3B281B" strokeWidth="1.3" />
            <polygon points="156,92 192,110 192,160 156,142" fill="#463020" stroke="#3B281B" strokeWidth="1.3" />

            {/* Spacious Walnut Tabletop */}
            <polygon
              points="0,50 74,13 204,78 130,115"
              fill="#7C5840"
              stroke={activeStation === 'desk01' ? '#1C1917' : '#463020'}
              strokeWidth={activeStation === 'desk01' ? '2.8' : '1.8'}
            />
            {/* Tabletop Edges */}
            <polygon points="0,50 130,115 130,123 0,58" fill="#5C402E" />
            <polygon points="130,115 204,78 204,86 130,123" fill="#463020" />

            {/* Dual Curved High-Res Monitors */}
            {/* Monitor 1 (Left Display) */}
            <g transform="translate(64, -10)">
              <polygon
                points="0,3 50,28 50,66 0,41"
                fill="#161412"
                stroke={isDeskBusy ? accentStroke : '#44403C'}
                strokeWidth="2.2"
              />
              {/* Animated Code Syntax on Monitor 1 */}
              {isDeskBusy ? (
                <g transform="skewY(26.5)" strokeLinecap="round" strokeWidth="2.2">
                  <line x1="7" y1="9" x2="28" y2="9" stroke="#B85D3B" className="animate-pulse" />
                  <line x1="7" y1="16" x2="38" y2="16" stroke="#A3C995" />
                  <line x1="12" y1="23" x2="34" y2="23" stroke="#F5F2EB" strokeOpacity="0.8" />
                  <line x1="7" y1="30" x2="24" y2="30" stroke="#C28F42" />
                </g>
              ) : (
                <circle cx="25" cy="34" r="3" fill="#57534E" opacity="0.5" />
              )}
            </g>

            {/* Monitor 2 (Right Display) */}
            <g transform="translate(118, 17)">
              <polygon
                points="0,3 50,28 50,66 0,41"
                fill="#161412"
                stroke={isDeskBusy ? accentStroke : '#44403C'}
                strokeWidth="2.2"
              />
              {isDeskBusy ? (
                <g transform="skewY(26.5)" strokeLinecap="round" strokeWidth="2.2">
                  <line x1="7" y1="9" x2="36" y2="9" stroke="#5F6F52" />
                  <line x1="9" y1="16" x2="30" y2="16" stroke="#F5F2EB" strokeOpacity="0.8" />
                  <line x1="9" y1="23" x2="40" y2="23" stroke="#B85D3B" className="animate-pulse" />
                  <line x1="7" y1="30" x2="26" y2="30" stroke="#C28F42" />
                </g>
              ) : (
                <circle cx="25" cy="34" r="3" fill="#57534E" opacity="0.5" />
              )}
            </g>

            {/* Keyboard & Artisan Coffee Cup */}
            <polygon points="64,64 96,80 86,86 54,70" fill="#E7E2D8" stroke="#8C857B" strokeWidth="0.9" />
            <ellipse cx="122" cy="87" rx="5" ry="3.2" fill="#FAF8F4" stroke="#57534E" strokeWidth="1.2" />

            {/* Ergonomic Mesh Office Chair */}
            <g transform="translate(30, 75)">
              <ellipse cx="20" cy="38" rx="16" ry="8" fill="#1C1917" fillOpacity="0.22" />
              <line x1="20" y1="22" x2="20" y2="38" stroke="#292524" strokeWidth="3.2" />
              <polygon points="4,15 25,5 40,13 20,23" fill="#FAF8F4" stroke="#8C857B" strokeWidth="1.3" />
              <polygon points="2,-7 20,-16 25,6 7,15" fill="#EFECE4" stroke="#8C857B" strokeWidth="1.3" />
            </g>
          </g>

          {/* ================= 7. STATION 5: SECURITY GATE TURNSTILE (SOUTH-EAST ENTRANCE) ================= */}
          <g
            onClick={() => onSelectStation('security')}
            className="cursor-pointer"
            transform="translate(720, 420)"
          >
            {/* Turnstile Shadow */}
            <polygon points="0,76 54,49 144,94 90,121" fill="#1C1917" fillOpacity="0.15" />

            {/* Pillar 1 */}
            <polygon points="9,27 32,16 49,25 27,36" fill="#B8B0A2" stroke="#44403C" strokeWidth="1.5" />
            <polygon points="9,27 27,36 27,83 9,74" fill="#8C857B" stroke="#44403C" strokeWidth="1.5" />
            <polygon points="27,36 49,25 49,72 27,83" fill="#6E685F" stroke="#44403C" strokeWidth="1.5" />
            {/* ID Scanner */}
            <rect x="31" y="38" width="11" height="9" rx="1.8" fill="#1C1917" />
            <circle cx="36.5" cy="42.5" r="2.2" fill="#5F6F52" />

            {/* Turnstile Metal Arms */}
            <line x1="45" y1="47" x2="85" y2="67" stroke="#44403C" strokeWidth="3.4" strokeLinecap="round" />
            <line x1="45" y1="54" x2="81" y2="74" stroke="#6E685F" strokeWidth="2.8" strokeLinecap="round" />

            {/* Pillar 2 */}
            <polygon points="76,61 99,50 117,59 94,70" fill="#B8B0A2" stroke="#44403C" strokeWidth="1.5" />
            <polygon points="76,61 94,70 94,117 76,108" fill="#8C857B" stroke="#44403C" strokeWidth="1.5" />
            <polygon points="94,70 117,59 117,106 94,117" fill="#6E685F" stroke="#44403C" strokeWidth="1.5" />
          </g>
        </svg>

        {/* ================= 8. NATURAL ANIMATED AGENT BOTS OVERLAY ================= */}
        {bots.map((bot, index) => {
          const effectiveVisor = overrideVisorState || bot.visorState;
          return (
            <BotCharacter
              key={bot.id}
              bot={bot}
              effectiveVisor={effectiveVisor}
              onClick={() => onSelectBot(bot)}
              staggerIndex={index}
            />
          );
        })}
        {/* ================= 9. INTERACTIVE FLOATING CALLOUT BADGES (MATCHING SAMS POSTER) ================= */}
        {/* 1. Whiteboard */}
        <button
          type="button"
          onClick={() => onSelectStation('whiteboard')}
          style={{ left: '50%', top: '13%' }}
          className="absolute -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/90 border border-line shadow-lg backdrop-blur-md hover:border-blue hover:scale-105 transition-all cursor-pointer group z-20"
          title="Whiteboard · Plans & Architecture (Click to open drawer)"
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 group-hover:bg-blue transition-colors" />
          <span className="text-xs font-bold text-ink">Whiteboard</span>
          <span className="hidden sm:inline text-[10px] text-ink-muted">Plans & Architecture</span>
        </button>

        {/* 2. Kanban Wall */}
        <button
          type="button"
          onClick={() => onSelectStation('kanban')}
          style={{ left: '80%', top: '19%' }}
          className="absolute -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/90 border border-line shadow-lg backdrop-blur-md hover:border-blue hover:scale-105 transition-all cursor-pointer group z-20"
          title="Kanban Wall · Work Items (Click to open drawer)"
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 group-hover:bg-blue transition-colors" />
          <span className="text-xs font-bold text-ink">Kanban Wall</span>
          <span className="hidden sm:inline text-[10px] text-ink-muted">Work Items ({kanbanCounts.backlog + kanbanCounts.in_progress})</span>
        </button>

        {/* 3. Vault */}
        <button
          type="button"
          onClick={() => onSelectStation('vault')}
          style={{ left: '23%', top: '27%' }}
          className="absolute -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/90 border border-line shadow-lg backdrop-blur-md hover:border-blue hover:scale-105 transition-all cursor-pointer group z-20"
          title="Vault · Secure Storage (Click to open drawer)"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 group-hover:bg-blue transition-colors" />
          <span className="text-xs font-bold text-ink">Vault</span>
          <span className="hidden sm:inline text-[10px] text-ink-muted">Secure Storage</span>
        </button>

        {/* 4. Desk 01 */}
        <button
          type="button"
          onClick={() => onSelectStation('desk01')}
          style={{ left: '44%', top: '69%' }}
          className="absolute -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/90 border border-line shadow-lg backdrop-blur-md hover:border-blue hover:scale-105 transition-all cursor-pointer group z-20"
          title="Desk 01 · Active Compute (Click to open drawer)"
        >
          <span className={`w-2 h-2 rounded-full ${isDeskBusy ? 'bg-blue animate-pulse' : 'bg-slate-400'}`} />
          <span className="text-xs font-bold text-ink">Desk 01</span>
          <span className="hidden sm:inline text-[10px] text-ink-muted">{isDeskBusy ? 'Active: Compute' : 'Idle'}</span>
        </button>

        {/* 5. Security Gate */}
        <button
          type="button"
          onClick={() => onSelectStation('security')}
          style={{ left: '80%', top: '69%' }}
          className="absolute -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/90 border border-line shadow-lg backdrop-blur-md hover:border-blue hover:scale-105 transition-all cursor-pointer group z-20"
          title="Security Gate · Access Control (Click to open drawer)"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 group-hover:bg-blue transition-colors" />
          <span className="text-xs font-bold text-ink">Security Gate</span>
          <span className="hidden sm:inline text-[10px] text-ink-muted">Access Control</span>
        </button>
      </div>
    </div>
  );
};
