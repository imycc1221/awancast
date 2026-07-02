import { describe, it, expect } from 'vitest';
import {
  facilityStatus,
  getFacility,
  mockFacility,
  type FacilitySnapshot,
} from '../src/data/mockFacility';

describe('facilityStatus', () => {
  it('translates the monthly peak into the RP4 capacity charge', () => {
    const s = facilityStatus(mockFacility);
    expect(s.monthChargeRm).toBe(Math.round(842 * 89.27));
  });

  it('reports this month as lower than last month', () => {
    const s = facilityStatus(mockFacility);
    expect(s.vsLastMonthPct).toBe(7);
  });

  it('flags new-peak risk when demand nears the cap', () => {
    const s = facilityStatus(mockFacility);
    expect(s.atRisk).toBe(true);
    expect(s.headroomKw).toBe(820 - 826);
  });

  it('is not at risk when demand is comfortably below the cap', () => {
    const safe: FacilitySnapshot = { ...mockFacility, currentDemandKw: 700 };
    const s = facilityStatus(safe);
    expect(s.atRisk).toBe(false);
    expect(s.headroomKw).toBeGreaterThan(0);
  });
});

describe('getFacility (region-aware)', () => {
  it('returns a distinct site per region', () => {
    const names = new Set([
      getFacility('peninsular').siteName,
      getFacility('sarawak').siteName,
      getFacility('sabah').siteName,
    ]);
    expect(names.size).toBe(3);
  });

  it('marks only Peninsular RP4 as a verified rate, the rest illustrative', () => {
    expect(getFacility('peninsular').illustrativeRate).toBe(false);
    expect(getFacility('peninsular').scheme).toBe('TNB RP4');
    expect(getFacility('sarawak').illustrativeRate).toBe(true);
    expect(getFacility('sabah').illustrativeRate).toBe(true);
  });
});
