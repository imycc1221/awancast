import { useCurrentTime } from '../hooks/useCurrentTime';

const DAWN = 7; // MYT sunrise, close enough year-round at these latitudes
const DUSK = 19.25;

function mytHourFloat(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return (h % 24) + m / 60;
}

/**
 * The signature mark: today's solar arc with the sun at its live position. The product's whole premise
 * (solar time, not clock time) in one small glyph. Pure SVG, updates with the shared clock.
 */
export function SunArc() {
  const now = useCurrentTime();
  const h = mytHourFloat(now);
  const t = Math.min(1, Math.max(0, (h - DAWN) / (DUSK - DAWN)));
  const isDay = h >= DAWN && h <= DUSK;

  // Semicircle: centre (32, 24), r 18. t sweeps left horizon -> apex -> right horizon.
  const x = 32 - 18 * Math.cos(Math.PI * t);
  const y = 24 - 18 * Math.sin(Math.PI * t);

  return (
    <svg
      viewBox="0 0 64 28"
      className="h-6 w-14"
      aria-label={isDay ? 'Sun position across today' : 'Night — sun below the horizon'}
      role="img"
    >
      <title>
        {isDay
          ? "The sun's position in today's sky — sunrise on the left, sunset on the right"
          : 'Night — the sun is below the horizon'}
      </title>
      <line x1="6" y1="24" x2="58" y2="24" stroke="var(--hairline)" strokeWidth="1.5" />
      <path
        d="M 14 24 A 18 18 0 0 1 50 24"
        fill="none"
        stroke="var(--hairline)"
        strokeWidth="1.5"
        strokeDasharray="2.5 3"
      />
      {isDay ? (
        <>
          <circle cx={x} cy={y} r="5.5" fill="var(--sun)" opacity="0.25" />
          <circle cx={x} cy={y} r="3" fill="var(--sun)" />
        </>
      ) : (
        <circle cx={h < DAWN ? 14 : 50} cy="24" r="2.5" fill="var(--ink-muted)" opacity="0.7" />
      )}
    </svg>
  );
}
