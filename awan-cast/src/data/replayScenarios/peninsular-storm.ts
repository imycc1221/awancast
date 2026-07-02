import type { ReplayScenario } from '../../types';
import { mockForecast } from '../mockForecast';

const issuedAt = new Date('2026-05-15T06:05:00.000Z'); // 14:05 MYT
const forecast = mockForecast('peninsular', issuedAt);

export const peninsularStorm: ReplayScenario = {
  id: 'peninsular-storm',
  title: 'PJ · Afternoon storm',
  region: 'peninsular',
  description: 'Petaling Jaya · 15 May 2026 · 2:05 PM. A tropical thunderstorm collapses output for 45 minutes from 3:15 PM.',
  forecast,
  startTime: issuedAt.toISOString(),
  endTime: new Date(issuedAt.getTime() + 120 * 60_000).toISOString(),
};
