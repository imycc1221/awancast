import type { Region } from '../types';

export interface FacilitySnapshot {
  siteName: string;
  scheme: string;
  /** When true, the per-kW capacity-charge rate is illustrative (not the verified RP4 figure). */
  illustrativeRate: boolean;
  capChargeRmPerKw: number;
  monthPeakKw: number;
  lastMonthPeakKw: number;
  currentDemandKw: number;
  targetCapKw: number;
  batteryPercent: number;
  batteryDischarging: boolean;
  savingsThisMonthRm: number;
  annualPaceRm: number;
}

/**
 * Region-aware demo facilities. Peninsular uses the verified TNB RP4 capacity charge (RM 89.27/kW) and the
 * hardened-simulation savings figure. Sarawak (SEB) and Sabah (SESB) use the same peak-shaving concept but
 * with illustrative demand-charge rates, since only RP4 is verified in our research.
 */
export const facilities: Record<Region, FacilitySnapshot> = {
  peninsular: {
    siteName: 'KL Retail Mall',
    scheme: 'TNB RP4',
    illustrativeRate: false,
    capChargeRmPerKw: 89.27,
    monthPeakKw: 842,
    lastMonthPeakKw: 905,
    currentDemandKw: 826,
    targetCapKw: 820,
    batteryPercent: 68,
    batteryDischarging: true,
    savingsThisMonthRm: 53200,
    annualPaceRm: 638000,
  },
  sarawak: {
    siteName: 'Kuching Hypermarket',
    scheme: 'SEB',
    illustrativeRate: true,
    capChargeRmPerKw: 35,
    monthPeakKw: 560,
    lastMonthPeakKw: 590,
    currentDemandKw: 548,
    targetCapKw: 540,
    batteryPercent: 61,
    batteryDischarging: true,
    savingsThisMonthRm: 18900,
    annualPaceRm: 226000,
  },
  sabah: {
    siteName: 'Kota Kinabalu Mall',
    scheme: 'SESB',
    illustrativeRate: true,
    capChargeRmPerKw: 42,
    monthPeakKw: 430,
    lastMonthPeakKw: 458,
    currentDemandKw: 421,
    targetCapKw: 416,
    batteryPercent: 57,
    batteryDischarging: true,
    savingsThisMonthRm: 15400,
    annualPaceRm: 185000,
  },
};

export function getFacility(region: Region): FacilitySnapshot {
  return facilities[region];
}

/** Back-compatible default (Peninsular, the verified RP4 site). */
export const mockFacility = facilities.peninsular;

export interface FacilityStatus {
  monthChargeRm: number;
  vsLastMonthPct: number;
  atRisk: boolean;
  headroomKw: number;
}

/** Derive the demand-charge consequence and the live new-peak risk. Pure and deterministic. */
export function facilityStatus(s: FacilitySnapshot): FacilityStatus {
  const monthChargeRm = Math.round(s.monthPeakKw * s.capChargeRmPerKw);
  const vsLastMonthPct = Number(
    (((s.lastMonthPeakKw - s.monthPeakKw) / s.lastMonthPeakKw) * 100).toFixed(0),
  );
  const headroomKw = Math.round(s.targetCapKw - s.currentDemandKw);
  const atRisk = s.currentDemandKw >= s.targetCapKw || s.currentDemandKw >= s.monthPeakKw * 0.98;
  return { monthChargeRm, vsLastMonthPct, atRisk, headroomKw };
}
