import type { ReplayScenario } from '../../types';
import { mockForecast } from '../mockForecast';

const issuedAt = new Date('2026-04-22T03:00:00.000Z'); // 11:00 MYT
const forecast = mockForecast('sabah', issuedAt);

export const sabahClear: ReplayScenario = {
  id: 'sabah-clear',
  title: 'KK · Clear sky · SELCO',
  region: 'sabah',
  description: 'Kota Kinabalu · 22 April 2026 · 11:00 AM. Clear skies; SELCO-PV blocks export, so every kWh must be self-consumed. The killer case.',
  forecast,
  startTime: issuedAt.toISOString(),
  endTime: new Date(issuedAt.getTime() + 120 * 60_000).toISOString(),
};
