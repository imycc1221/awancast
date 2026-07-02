import type { HouseholdProfile } from './profiles';

/**
 * Cold-start priors. Each cohort is a representative daily household load shape (kW by hour), based on
 * published Malaysian residential consumption patterns (TNB / SEDA typical profiles): low overnight, a
 * morning bump, a midday plateau, and a sharp evening peak, with tropical aircon load added in the hot
 * hours. Magnitudes are representative (illustrative), not household-specific measurements — consistent
 * with the project's citation-integrity standard. They give the scheduler a real demand curve from day one.
 */
export interface Cohort {
  id: string;
  label: string;
  source: string;
  /** Baseline (non-aircon) household draw in kW at each hour 0..23. */
  hourlyKw: number[];
}

export const COHORTS: Record<string, Cohort> = {
  apartment: {
    id: 'apartment',
    label: 'Small apartment, 2 people',
    source: 'Representative Malaysian residential profile (TNB/SEDA typical), illustrative',
    hourlyKw: [
      0.2, 0.2, 0.2, 0.2, 0.2, 0.25, 0.4, 0.6, 0.5, 0.4, 0.35, 0.35, 0.4, 0.4, 0.35, 0.35, 0.4, 0.6, 0.9,
      1.1, 1.0, 0.8, 0.5, 0.3,
    ],
  },
  family: {
    id: 'family',
    label: 'Bungalow/terrace, 4+ people, EV and pool',
    source: 'Representative Malaysian residential profile (TNB load study typical), illustrative',
    hourlyKw: [
      0.4, 0.4, 0.35, 0.35, 0.4, 0.5, 0.9, 1.2, 1.0, 0.8, 0.7, 0.7, 0.8, 0.8, 0.75, 0.75, 0.9, 1.3, 1.9,
      2.2, 2.0, 1.6, 1.0, 0.6,
    ],
  },
  wfh: {
    id: 'wfh',
    label: 'Terrace, work-from-home, aircon-heavy',
    source: 'Representative Malaysian residential profile (WFH daytime-elevated), illustrative',
    hourlyKw: [
      0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.7, 1.0, 1.3, 1.5, 1.6, 1.6, 1.6, 1.6, 1.5, 1.5, 1.5, 1.6, 1.9, 2.0,
      1.8, 1.4, 0.9, 0.5,
    ],
  },
};

/** Match a household profile to the closest cohort. */
export function matchCohort(profile: HouseholdProfile): Cohort {
  if (profile.wfhWeekdays) return COHORTS.wfh!;
  const owns = (k: string) => (profile.appliances[k] ?? 0) > 0;
  const heavy = profile.householdSize >= 4 || owns('pool') || owns('ev');
  return heavy ? COHORTS.family! : COHORTS.apartment!;
}

function interpHourly(hourlyKw: number[], hourFloat: number): number {
  const h = ((hourFloat % 24) + 24) % 24;
  const i = Math.floor(h);
  const frac = h - i;
  const a = hourlyKw[i] ?? 0;
  const b = hourlyKw[(i + 1) % 24] ?? a;
  return a + frac * (b - a);
}

/** Extra tropical aircon load (kW) by hour, driven by the household's aircon count. */
function airconKw(hour: number, count: number): number {
  const c = Number.isFinite(count) ? count : 0;
  if (c <= 0) return 0;
  if (hour >= 11 && hour < 23) return c * 0.7;
  if (hour >= 9) return c * 0.35;
  return c * 0.1;
}

/** Local Malaysia (Asia/Kuala_Lumpur) hour-of-day as a float, so demand aligns with the MYT-labelled UI. */
function mytHourFloat(atMs: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(atMs));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return (h % 24) + m / 60;
}

/** Predicted household demand (kW) at a given instant, from the cohort prior plus aircon load. */
export function demandKwAt(cohort: Cohort, count: number, atMs: number): number {
  const hourFloat = mytHourFloat(atMs);
  const base = interpHourly(cohort.hourlyKw, hourFloat);
  return Number((base + airconKw(Math.floor(hourFloat), count)).toFixed(3));
}

// The cohort baselines are whole-home aggregates that already include a TYPICAL home's hidden loads
// (one fridge, one TV, one router, standby, plugs, lights). The inventory delta adjusts around that
// typical home using the setup's quantities, so extra or missing always-on loads shift the curve.
// Wattages are representative duty-cycle averages, consistent with the illustrative-prior labelling.
const TYPICAL_INVENTORY: Record<string, number> = { fridge: 1, tv: 1, computer: 1, router: 1, fan: 2 };

interface InventoryLoad {
  kw: number;
  from: number; // active hours [from, to)
  to: number;
  standbyKw?: number;
}

const INVENTORY_LOAD: Record<string, InventoryLoad> = {
  fridge: { kw: 0.12, from: 0, to: 24 }, // compressor duty-cycle average, always on
  tv: { kw: 0.08, from: 18, to: 23, standbyKw: 0.01 },
  computer: { kw: 0.08, from: 9, to: 22, standbyKw: 0.005 },
  fan: { kw: 0.045, from: 10, to: 23 },
  router: { kw: 0.01, from: 0, to: 24 },
};

/** kW adjustment for owning more or fewer always-on/hidden loads than the typical home. */
export function inventoryDeltaKw(appliances: Record<string, number>, atMs: number): number {
  const hour = Math.floor(mytHourFloat(atMs));
  let delta = 0;
  for (const [key, load] of Object.entries(INVENTORY_LOAD)) {
    const qty = appliances[key] ?? 0;
    const diff = qty - (TYPICAL_INVENTORY[key] ?? 0);
    if (diff === 0) continue;
    const active = hour >= load.from && hour < load.to;
    delta += diff * (active ? load.kw : load.standbyKw ?? 0);
  }
  return Number(delta.toFixed(3));
}
