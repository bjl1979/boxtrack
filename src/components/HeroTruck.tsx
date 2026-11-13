/** Original illustration: a BoxTrack moving truck driving into the sunset. Inline SVG so it works offline. */
export function HeroTruck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 30 390 290" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label="Moving truck at sunset">
      <defs>
        <linearGradient id="ht-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d1513" />
          <stop offset="0.35" stopColor="#5a2c1a" />
          <stop offset="0.62" stopColor="#c4612c" />
          <stop offset="0.72" stopColor="#f3a35a" />
        </linearGradient>
        <radialGradient id="ht-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff1d6" />
          <stop offset="0.45" stopColor="#ffd08f" />
          <stop offset="1" stopColor="#f3a35a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ht-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#161618" stopOpacity="0" />
          <stop offset="1" stopColor="#161618" />
        </linearGradient>
        <linearGradient id="ht-trailer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f4f4" />
          <stop offset="1" stopColor="#c9c9cc" />
        </linearGradient>
        <linearGradient id="ht-cab" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f39a55" />
          <stop offset="1" stopColor="#d9661f" />
        </linearGradient>
      </defs>

      <rect width="390" height="340" fill="url(#ht-sky)" />
      <circle cx="300" cy="200" r="90" fill="url(#ht-sun)" />
      <circle cx="300" cy="200" r="30" fill="#fff0d2" opacity="0.95" />
      <g fill="#7a3a1f" opacity="0.55">
        <ellipse cx="80" cy="95" rx="70" ry="9" />
        <ellipse cx="150" cy="120" rx="55" ry="6" />
        <ellipse cx="320" cy="130" rx="60" ry="7" />
      </g>

      {/* Far hills and skyline */}
      <path d="M0 212 C40 196 80 200 120 206 S210 194 250 204 330 198 390 206 V240 H0Z" fill="#4a2617" />
      <g fill="#2f1a12">
        <rect x="18" y="196" width="10" height="24" />
        <rect x="30" y="188" width="14" height="32" />
        <rect x="46" y="200" width="8" height="20" />
        <rect x="340" y="190" width="12" height="30" />
        <rect x="354" y="198" width="9" height="22" />
        <rect x="365" y="184" width="13" height="36" />
      </g>

      {/* Road */}
      <rect y="226" width="390" height="114" fill="#1c1c1e" />
      <rect y="240" width="390" height="56" fill="#29292c" />
      <path d="M0 270 H390" stroke="#f39a55" strokeWidth="3" strokeDasharray="22 18" opacity="0.6" />

      {/* Motion lines */}
      <g stroke="#f7b77c" strokeWidth="3" strokeLinecap="round" opacity="0.55">
        <path d="M2 178 H28" />
        <path d="M8 200 H32" />
        <path d="M0 222 H24" />
      </g>

      {/* Truck */}
      <ellipse cx="190" cy="288" rx="160" ry="8" fill="#000" opacity="0.45" />
      <rect x="40" y="140" width="196" height="118" rx="8" fill="url(#ht-trailer)" />
      <rect x="40" y="228" width="196" height="10" fill="#ea7a2f" />
      <g transform="translate(62 168)">
        <path d="M18 0 36 9v20L18 38 0 29V9z" fill="#ea7a2f" />
        <path d="M18 0 36 9 18 18 0 9z" fill="#f7b77c" />
        <path d="M18 18v20" stroke="#b4531a" strokeWidth="2" />
        <text x="46" y="26" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="20" fill="#2a2a2d" letterSpacing="1">
          BOXTRACK
        </text>
      </g>
      <rect x="36" y="258" width="290" height="10" rx="3" fill="#232325" />
      <path d="M242 258 V172 Q242 160 254 160 H292 Q303 160 309 171 L330 214 Q334 222 334 232 V258 Z" fill="url(#ht-cab)" />
      <path d="M284 172 H296 Q301 172 303 177 L318 208 H284 Z" fill="#1f2b35" />
      <path d="M288 176 H294 L300 190 H288 Z" fill="#ffffff" opacity="0.18" />
      <path d="M276 214 V250" stroke="#b4531a" strokeWidth="2" />
      <rect x="264" y="222" width="8" height="3" rx="1.5" fill="#7a3510" />
      <rect x="327" y="234" width="8" height="8" rx="2" fill="#ffe2b0" />
      <rect x="318" y="250" width="20" height="9" rx="3" fill="#2f2f32" />
      <g>
        {[82, 122, 290].map((x) => (
          <g key={x}>
            <circle cx={x} cy="270" r="18" fill="#111" />
            <circle cx={x} cy="270" r="8" fill="#8b8b92" />
            <circle cx={x} cy="270" r="3" fill="#2f2f32" />
          </g>
        ))}
      </g>

      <rect y="270" width="390" height="50" fill="url(#ht-fade)" />
    </svg>
  );
}
