import type { ReplayScenario } from '../../types';
import { mockForecast } from '../mockForecast';

const issuedAt = new Date('2026-03-10T05:30:00.000Z'); // 13:30 MYT
const forecast = mockForecast('sarawak', issuedAt);

export const sarawakPartial: ReplayScenario = {
  id: 'sarawak-partial',
  title: 'Kuching · Partial cloud',
  region: 'sarawak',
  description: 'Kuching · 10 March 2026 · 1:30 PM. Broken cloud all afternoon; 1:1 NEM export means deferred consumption still earns credit.',
  forecast,
  startTime: issuedAt.toISOString(),
  endTime: new Date(issuedAt.getTime() + 120 * 60_000).toISOString(),
};
