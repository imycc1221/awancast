import { useQuery } from '@tanstack/react-query';
import { fetchForecast, loadReplayForecast } from '../lib/api';
import { useAppStore } from '../state/useAppStore';
import type { Forecast } from '../types';

export function useForecast() {
  const region = useAppStore((s) => s.region);
  const replayMode = useAppStore((s) => s.replayMode);
  const replayScenario = useAppStore((s) => s.replayScenario);

  return useQuery<Forecast>({
    queryKey: ['forecast', replayMode ? `replay:${replayScenario}` : `live:${region}`],
    queryFn: () => (replayMode ? loadReplayForecast(replayScenario) : fetchForecast(region)),
    refetchInterval: replayMode ? false : 30_000,
    staleTime: 25_000,
  });
}
