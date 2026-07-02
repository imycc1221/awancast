import { useEffect, useState } from 'react';
import { Circle } from 'lucide-react';
import { useAppStore } from '../state/useAppStore';
import { formatTimeMyt, formatDateMyt } from '../lib/format';
import { demoNow } from '../lib/demoClock';

export function LiveClock() {
  const replayMode = useAppStore((s) => s.replayMode);
  const replayTime = useAppStore((s) => s.replayTime);
  const [now, setNow] = useState<Date>(() => demoNow());

  useEffect(() => {
    if (replayMode) return;
    const id = window.setInterval(() => setNow(demoNow()), 1_000);
    return () => window.clearInterval(id);
  }, [replayMode]);

  const display = replayMode && replayTime ? new Date(replayTime) : now;
  const iso = display.toISOString();

  return (
    <div className="flex items-center gap-2 text-[12px] text-ink-muted">
      <Circle className="h-1.5 w-1.5 fill-success text-success" />
      <span className="tnum">
        {replayMode ? 'Replay · ' : ''}
        <span className="hidden sm:inline">{formatDateMyt(iso)} · </span>
        {formatTimeMyt(iso)}
      </span>
    </div>
  );
}
