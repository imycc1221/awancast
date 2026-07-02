import { useAppStore } from '../state/useAppStore';
import type { Region } from '../types';

const REGIONS: Array<{
  id: Region;
  long: string;
  short: string;
  letter: string;
}> = [
  { id: 'peninsular', long: 'Peninsular', short: 'PEN', letter: 'P' },
  { id: 'sarawak', long: 'Sarawak', short: 'SWK', letter: 'S' },
  { id: 'sabah', long: 'Sabah', short: 'SAB', letter: 'B' },
];

export function RegionSwitcher() {
  const region = useAppStore((s) => s.region);
  const setRegion = useAppStore((s) => s.setRegion);
  const setReplayMode = useAppStore((s) => s.setReplayMode);

  return (
    <div
      role="tablist"
      aria-label="Region"
      data-tour="region"
      className="inline-flex rounded-lg border border-hairline bg-panel p-0.5 text-[11px] font-semibold"
    >
      {REGIONS.map((r) => {
        const active = r.id === region;
        return (
          <button
            key={r.id}
            role="tab"
            aria-selected={active}
            onClick={() => {
              setReplayMode(false);
              setRegion(r.id);
            }}
            className={`relative rounded-md px-3 py-1.5 transition-colors duration-200 ease-apple ${
              active ? 'bg-ink text-panel' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <span className="hidden lg:inline">{r.long}</span>
            <span className="hidden sm:inline lg:hidden">{r.short}</span>
            <span className="sm:hidden">{r.letter}</span>
          </button>
        );
      })}
    </div>
  );
}
