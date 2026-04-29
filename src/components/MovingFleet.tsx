/**
 * MovingFleet — animated SVG silhouettes of construction equipment that
 * roll across a gravel band. Pure CSS animations, no JS rerenders.
 */
export const MovingFleet = ({ className = "" }: { className?: string }) => {
  return (
    <div className={`relative w-full h-32 sm:h-40 overflow-hidden ${className}`}>
      {/* Ground */}
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/80 to-transparent" />
      <div
        className="absolute inset-x-0 bottom-0 h-2 opacity-60"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, hsl(33 40% 35%) 0 6px, hsl(28 30% 22%) 6px 14px)",
        }}
      />

      {/* Excavator (left, mostly stationary, arm moves) */}
      <div className="absolute bottom-2 left-4 sm:left-10 origin-bottom-right">
        <svg width="90" height="70" viewBox="0 0 90 70" className="opacity-90">
          <g fill="hsl(var(--maple))">
            <rect x="20" y="42" width="50" height="14" rx="2" />
            <rect x="32" y="28" width="22" height="16" rx="2" />
          </g>
          <g className="origin-[58px_44px] animate-arm" style={{ transformOrigin: "58px 44px" }}>
            <rect x="56" y="20" width="30" height="6" rx="2" fill="hsl(var(--maple))" transform="rotate(-25 58 44)" />
            <polygon points="80,8 92,14 86,22" fill="hsl(var(--maple-deep))" transform="rotate(-25 58 44)" />
          </g>
          <g fill="hsl(0 0% 8%)">
            <rect x="14" y="56" width="62" height="8" rx="3" />
          </g>
        </svg>
      </div>

      {/* Dump truck — rolls left to right */}
      <div className="absolute bottom-3 animate-truck-roll">
        <svg width="170" height="80" viewBox="0 0 170 80">
          {/* Dust */}
          <g className="animate-dust">
            <circle cx="6" cy="64" r="10" fill="hsl(38 25% 70% / 0.35)" />
            <circle cx="20" cy="58" r="14" fill="hsl(38 25% 70% / 0.25)" />
            <circle cx="-8" cy="62" r="8" fill="hsl(38 25% 70% / 0.3)" />
          </g>
          {/* Bed */}
          <polygon points="55,12 150,12 158,42 50,42" fill="hsl(var(--maple))" />
          <rect x="55" y="12" width="95" height="6" fill="hsl(var(--maple-deep))" />
          {/* Gravel pile */}
          <path d="M60 12 Q80 2 100 8 T140 10 L150 12 Z" fill="hsl(28 25% 25%)" />
          {/* Cab */}
          <rect x="120" y="22" width="38" height="22" rx="3" fill="hsl(222 45% 22%)" />
          <rect x="126" y="26" width="14" height="10" rx="1" fill="hsl(222 95% 70%)" opacity="0.8" />
          {/* Chassis */}
          <rect x="48" y="42" width="115" height="10" fill="hsl(0 0% 6%)" />
          {/* Wheels */}
          <g fill="hsl(0 0% 4%)">
            <circle cx="70" cy="58" r="10" />
            <circle cx="95" cy="58" r="10" />
            <circle cx="148" cy="58" r="10" />
          </g>
          <g fill="hsl(220 15% 60%)" className="origin-center">
            <circle cx="70" cy="58" r="3.5" />
            <circle cx="95" cy="58" r="3.5" />
            <circle cx="148" cy="58" r="3.5" />
          </g>
        </svg>
      </div>

      {/* Bulldozer — rolls right to left, slower */}
      <div className="absolute bottom-3 animate-truck-roll-slow">
        <svg width="130" height="70" viewBox="0 0 130 70">
          {/* Blade */}
          <path d="M4 22 L18 22 L22 52 L0 52 Z" fill="hsl(var(--maple-deep))" />
          {/* Body */}
          <rect x="20" y="26" width="70" height="22" rx="3" fill="hsl(var(--maple))" />
          {/* Cab */}
          <rect x="40" y="10" width="34" height="18" rx="2" fill="hsl(222 45% 22%)" />
          <rect x="46" y="14" width="12" height="10" fill="hsl(222 95% 70%)" opacity="0.8" />
          {/* Tracks */}
          <rect x="18" y="46" width="84" height="14" rx="6" fill="hsl(0 0% 5%)" />
          <g fill="hsl(220 15% 30%)">
            <circle cx="28" cy="53" r="5" />
            <circle cx="48" cy="53" r="5" />
            <circle cx="68" cy="53" r="5" />
            <circle cx="88" cy="53" r="5" />
          </g>
        </svg>
      </div>
    </div>
  );
};
