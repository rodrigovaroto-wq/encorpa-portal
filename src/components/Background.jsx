// Fundo roxo em movimento: ondas de energia que fluem, faixas de luz e orbes que flutuam (pedido do operador, 16/10).
// Tudo em CSS/SVG, sem biblioteca; para quando "reduzir animação" está ligado.
const WAVES = [
  { d: "M0,260 C240,180 420,340 720,250 C1020,160 1200,330 1440,240", w: 2.2, o: 0.55, t: 18 },
  { d: "M0,300 C260,230 460,390 760,300 C1060,210 1220,380 1440,290", w: 1.4, o: 0.4, t: 24 },
  { d: "M0,340 C280,280 500,430 800,350 C1100,270 1260,420 1440,340", w: 1, o: 0.3, t: 30 },
  { d: "M0,600 C300,520 520,700 820,610 C1120,520 1280,680 1440,600", w: 1.8, o: 0.45, t: 22 },
  { d: "M0,650 C320,580 540,740 860,660 C1160,580 1300,730 1440,650", w: 1, o: 0.3, t: 34 },
];

export function Background() {
  return (
    <div className="bg" aria-hidden="true">
      <div className="orb o1" /><div className="orb o2" /><div className="orb o3" />
      <svg className="waves" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="wv" x1="0" x2="1">
            <stop offset="0" stopColor="#7c3aed" stopOpacity="0" />
            <stop offset=".35" stopColor="#a78bfa" />
            <stop offset=".65" stopColor="#e879f9" />
            <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
          </linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {WAVES.map((w, i) => (
          <g key={i} className="wave" style={{ animationDuration: `${w.t}s`, animationDelay: `${-i * 3}s` }}>
            <path d={w.d} stroke="url(#wv)" strokeWidth={w.w} opacity={w.o} fill="none" filter="url(#glow)" />
            <path d={w.d} transform="translate(1440 0)" stroke="url(#wv)" strokeWidth={w.w} opacity={w.o} fill="none" filter="url(#glow)" />
          </g>
        ))}
      </svg>
      <div className="pulse" />
      <div className="grain" />
    </div>
  );
}
