import { useEffect, useState } from 'react';
import { useAppStore } from '../state/useAppStore';
import { demoNow } from '../lib/demoClock';

export function useCurrentTime(): Date {
  const replayMode = useAppStore((s) => s.replayMode);
  const replayTime = useAppStore((s) => s.replayTime);

  const [now, setNow] = useState<Date>(() => demoNow());

  useEffect(() => {
    if (replayMode) return;
    const id = window.setInterval(() => setNow(demoNow()), 10_000);
    return () => window.clearInterval(id);
  }, [replayMode]);

  if (replayMode && replayTime) return new Date(replayTime);
  return now;
}
