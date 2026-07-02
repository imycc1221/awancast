import type { Region } from '../types';

export type TariffPlan = 'solar-atap' | 'sarawak-nem' | 'sabah-selco';

/** A household's setup, captured by the input layer and stored in localStorage. */
export interface HouseholdProfile {
  region: Region;
  solarKwp: number;
  batteryKwh: number; // 0 = none
  /** Owned appliances as catalogue-key -> quantity (0 or absent = not owned). Aircon quantity feeds demand. */
  appliances: Record<string, number>;
  wfhWeekdays: boolean;
  householdSize: number;
  tariffPlan: TariffPlan;
}

/** The mock solar forecast is tuned to roughly a 5 kWp system; profiles scale relative to this. */
export const BASELINE_SOLAR_KWP = 5;

export const TARIFF_LABEL: Record<TariffPlan, string> = {
  'solar-atap': 'Solar ATAP',
  'sarawak-nem': 'SEB NEM',
  'sabah-selco': 'SELCO-PV',
};

/** Three example households, one per region tab, pre-loaded so judges see personalisation immediately. */
export const exampleProfiles: Record<Region, HouseholdProfile> = {
  peninsular: {
    region: 'peninsular',
    solarKwp: 5,
    batteryKwh: 0,
    appliances: { dishwasher: 1, washer: 1, waterheater: 1, pool: 1, ev: 1, aircon: 2, fridge: 1, tv: 1 },
    wfhWeekdays: true,
    householdSize: 4,
    tariffPlan: 'solar-atap',
  },
  sarawak: {
    region: 'sarawak',
    solarKwp: 4,
    batteryKwh: 0,
    appliances: { dishwasher: 1, washer: 1, waterheater: 1, ev: 1, aircon: 1, fridge: 1 },
    wfhWeekdays: false,
    householdSize: 3,
    tariffPlan: 'sarawak-nem',
  },
  sabah: {
    region: 'sabah',
    solarKwp: 8,
    batteryKwh: 10,
    appliances: { dishwasher: 1, washer: 1, waterheater: 1, aircon: 3, fridge: 1, tv: 2 },
    wfhWeekdays: false,
    householdSize: 5,
    tariffPlan: 'sabah-selco',
  },
};
