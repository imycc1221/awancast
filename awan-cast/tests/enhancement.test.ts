import { describe, it, expect } from 'vitest';
import { matchCohort, demandKwAt, COHORTS } from '../src/data/cohorts';
import { APPLIANCE_CATALOG, flexibleAppliancesFor, catalogIcon } from '../src/data/applianceCatalog';
import { scaleForecast, computeNetLoad, demandFnFor } from '../src/lib/netload';
import { exampleProfiles, type HouseholdProfile } from '../src/data/profiles';
import { overrideRate, type FeedbackEntry } from '../src/data/feedback';
import { recommend } from '../src/data/scheduler';
import { mockAppliances } from '../src/data/mockAppliances';
import { mockForecast } from '../src/data/mockForecast';
import { getTariff } from '../src/data/tariffs';

const FROZEN = new Date('2026-05-15T06:05:00.000Z'); // 2 PM MYT

describe('cold-start cohorts', () => {
  it('matches work-from-home households to the WFH cohort', () => {
    expect(matchCohort(exampleProfiles.peninsular).id).toBe('wfh');
  });

  it('matches a small, no-EV, no-pool household to the apartment cohort', () => {
    const small: HouseholdProfile = {
      ...exampleProfiles.sarawak,
      wfhWeekdays: false,
      householdSize: 2,
      appliances: { dishwasher: 1, washer: 1 },
    };
    expect(matchCohort(small).id).toBe('apartment');
  });

  it('demand rises with aircon count', () => {
    const noAc = demandKwAt(COHORTS.family!, 0, FROZEN.getTime());
    const withAc = demandKwAt(COHORTS.family!, 3, FROZEN.getTime());
    expect(withAc).toBeGreaterThan(noAc);
  });

  it('demand stays finite when the aircon count is missing (rehydration safety)', () => {
    const v = demandKwAt(COHORTS.family!, NaN as unknown as number, FROZEN.getTime());
    expect(Number.isFinite(v)).toBe(true);
  });

  it('hidden always-on loads adjust demand around the typical home (extra fridge = +0.12 kW)', () => {
    const base = exampleProfiles.sarawak;
    const twoFridges = { ...base, appliances: { ...base.appliances, fridge: 2 } };
    const dBase = demandFnFor(base)(FROZEN.getTime());
    const dTwo = demandFnFor(twoFridges)(FROZEN.getTime());
    expect(dTwo).toBeCloseTo(dBase + 0.12, 2);
  });

  it('demand never reaches zero — a home always has some hidden draw', () => {
    const bare = { ...exampleProfiles.sarawak, appliances: {} };
    expect(demandFnFor(bare)(FROZEN.getTime())).toBeGreaterThan(0);
  });
});

describe('appliance catalog', () => {
  it('has a comprehensive mix with an icon on every entry', () => {
    expect(APPLIANCE_CATALOG.length).toBeGreaterThan(10);
    expect(APPLIANCE_CATALOG.some((c) => c.flexible)).toBe(true);
    expect(APPLIANCE_CATALOG.some((c) => !c.flexible)).toBe(true);
    for (const c of APPLIANCE_CATALOG) expect(c.icon).toBeTruthy();
  });

  it('schedules only owned flexible appliances (qty > 0)', () => {
    const apps = flexibleAppliancesFor({ ev: 1, fridge: 2, aircon: 3 });
    expect(apps.map((a) => a.id)).toEqual(['ev']); // fridge/aircon are non-flexible base loads
    expect(apps[0]!.kwDraw).toBeGreaterThan(0);
  });

  it('resolves an icon for known and unknown keys', () => {
    expect(catalogIcon('dishwasher')).toBeTruthy();
    expect(catalogIcon('does-not-exist')).toBeTruthy();
  });
});

describe('net-load', () => {
  it('scales the forecast to the household solar size', () => {
    const f = mockForecast('sabah', FROZEN);
    const scaled = scaleForecast(f, 10); // baseline is 5 kWp -> factor 2
    expect(scaled.points[0]!.kw).toBeCloseTo(f.points[0]!.kw * 2, 1);
  });

  it('surplus and grid are mutually exclusive at each point', () => {
    const f = scaleForecast(mockForecast('peninsular', FROZEN), 5);
    const net = computeNetLoad(f, demandFnFor(exampleProfiles.peninsular));
    for (const p of net) {
      expect(p.surplusKw === 0 || p.gridKw === 0).toBe(true);
      expect(Number((p.solarKw - p.demandKw).toFixed(2))).toBeCloseTo(p.surplusKw - p.gridKw, 2);
    }
  });
});

describe('scheduler is net-load aware', () => {
  it('a large baseline demand removes free-solar value', () => {
    const f = mockForecast('sabah', FROZEN);
    const tariff = getTariff('sabah');
    const gross = recommend(f, mockAppliances, tariff, FROZEN);
    const netted = recommend(f, mockAppliances, tariff, FROZEN, () => 100); // 100 kW demand eats all solar
    const sum = (rs: ReturnType<typeof recommend>) =>
      rs.reduce((s, r) => s + (r.solarValueRm ?? 0), 0);
    expect(sum(gross)).toBeGreaterThan(0);
    expect(sum(netted)).toBeCloseTo(0, 2);
  });
});

describe('feedback override rate', () => {
  it('is the share of non-accepted responses', () => {
    const entries: FeedbackEntry[] = [
      { id: '1', ts: 1, applianceId: 'ev', applianceName: 'EV', action: 'accept', recommendedAction: 'wait', savingsRm: 4 },
      { id: '2', ts: 2, applianceId: 'washer', applianceName: 'Washer', action: 'reject', recommendedAction: 'run-now', savingsRm: 0 },
    ];
    expect(overrideRate(entries)).toBe(0.5);
    expect(overrideRate([])).toBe(0);
  });
});
