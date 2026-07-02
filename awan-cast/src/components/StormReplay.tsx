import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, ChevronDown, History } from 'lucide-react';
import { useAppStore } from '../state/useAppStore';
import { replayScenarioList, replayScenarios } from '../data/replayScenarios';
import { formatTimeMyt, formatDateMyt } from '../lib/format';
import type { ReplayScenarioId } from '../types';

const TICK_MS = 1000;
const ADVANCE_MIN = 1;

export function StormReplay() {
  const replayMode = useAppStore((s) => s.replayMode);
  const setReplayMode = useAppStore((s) => s.setReplayMode);
  const replayScenarioId = useAppStore((s) => s.replayScenario);
  const setReplayScenario = useAppStore((s) => s.setReplayScenario);
  const replayTime = useAppStore((s) => s.replayTime);
  const setReplayTime = useAppStore((s) => s.setReplayTime);
  const setRegion = useAppStore((s) => s.setRegion);

  const [playing, setPlaying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const scenario = replayScenarios[replayScenarioId];
  const startMs = useMemo(() => Date.parse(scenario.startTime), [scenario.startTime]);
  const endMs = useMemo(() => Date.parse(scenario.endTime), [scenario.endTime]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menuOpen]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const current = replayTime ? Date.parse(replayTime) : startMs;
      const next = current + ADVANCE_MIN * 60_000;
      if (next > endMs) {
        setPlaying(false);
        setReplayTime(endMs ? new Date(endMs).toISOString() : null);
        return;
      }
      setReplayTime(new Date(next).toISOString());
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, replayTime, startMs, endMs, setReplayTime]);

  const enableReplay = useCallback(() => {
    setReplayMode(true);
    setRegion(scenario.region);
    if (!replayTime) setReplayTime(scenario.startTime);
  }, [setReplayMode, setRegion, scenario.region, scenario.startTime, replayTime, setReplayTime]);

  const exitReplay = useCallback(() => {
    setPlaying(false);
    setReplayMode(false);
  }, [setReplayMode]);

  const pickScenario = (id: ReplayScenarioId) => {
    const next = replayScenarios[id];
    setReplayScenario(id);
    setRegion(next.region);
    setReplayTime(next.startTime);
    setReplayMode(true);
    setMenuOpen(false);
  };

  const currentMs = replayTime ? Date.parse(replayTime) : startMs;
  const progress = endMs === startMs ? 0 : (currentMs - startMs) / (endMs - startMs);

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ratio = Number(e.target.value) / 1000;
    const ms = startMs + ratio * (endMs - startMs);
    setReplayTime(new Date(ms).toISOString());
  };

  if (!replayMode) {
    return (
      <div className="hidden border-t border-hairline bg-panel/60 px-4 py-2 backdrop-blur md:flex">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
          <History className="h-4 w-4 text-ink-muted" strokeWidth={1.6} />
          <span className="text-[12px] text-ink-muted">
            Replay an archived storm — drives the entire dashboard offline.
          </span>
          <button
            onClick={enableReplay}
            className="ml-auto rounded-md border border-hairline bg-panel px-3 py-1.5 text-[12px] font-semibold transition-colors hover:bg-panel-nested"
          >
            Enter replay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden border-t border-hairline bg-panel/85 px-4 py-2.5 backdrop-blur md:block">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
        <button
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pause replay' : 'Play replay'}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-panel transition-transform active:scale-95"
        >
          {playing ? (
            <Pause className="h-4 w-4" strokeWidth={2} />
          ) : (
            <Play className="h-4 w-4 translate-x-[1px]" strokeWidth={2} />
          )}
        </button>

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-md border border-hairline bg-panel px-2.5 py-1.5 text-[12px] font-semibold transition-colors hover:bg-panel-nested"
          >
            <span>{scenario.title}</span>
            <ChevronDown className="h-3 w-3 text-ink-muted" strokeWidth={1.75} />
          </button>
          {menuOpen && (
            <div className="absolute bottom-full left-0 z-40 mb-2 w-72 rounded-lg border border-hairline bg-panel p-1 shadow-hairline">
              {replayScenarioList.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickScenario(s.id)}
                  className={`w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-panel-nested ${
                    s.id === replayScenarioId ? 'bg-panel-nested' : ''
                  }`}
                >
                  <div className="text-[12px] font-semibold">{s.title}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-ink-muted">
                    {s.description}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="hidden text-[11px] text-ink-muted lg:block">
          {formatDateMyt(scenario.startTime)}
        </div>

        <div className="flex flex-1 items-center gap-3">
          <span className="tnum w-12 shrink-0 text-right text-[11px] text-ink-muted">
            {formatTimeMyt(scenario.startTime)}
          </span>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(progress * 1000)}
            onChange={onScrub}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-hairline accent-ink"
            aria-label="Replay scrubber"
          />
          <span className="tnum w-12 shrink-0 text-[11px] text-ink-muted">
            {formatTimeMyt(scenario.endTime)}
          </span>
        </div>

        <span className="tnum w-16 text-right text-[12px] font-semibold">
          {formatTimeMyt(new Date(currentMs).toISOString())}
        </span>

        <button
          onClick={exitReplay}
          className="rounded-md border border-hairline bg-panel px-2.5 py-1.5 text-[11px] font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
