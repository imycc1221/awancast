import type { Forecast, Region, ReplayScenarioId } from '../types';
import { mockForecast } from '../data/mockForecast';
import { replayScenarios } from '../data/replayScenarios';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const API_URL = import.meta.env.VITE_API_URL ?? '';

export async function fetchForecast(region: Region): Promise<Forecast> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 120));
    return mockForecast(region);
  }
  const res = await fetch(`${API_URL}/forecast?region=${region}`);
  if (!res.ok) throw new Error(`Forecast unavailable (${res.status})`);
  return (await res.json()) as Forecast;
}

export async function loadReplayForecast(id: ReplayScenarioId): Promise<Forecast> {
  await new Promise((r) => setTimeout(r, 60));
  return replayScenarios[id].forecast;
}
