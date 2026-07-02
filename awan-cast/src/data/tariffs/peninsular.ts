import type { TariffConfig } from '../../types';

export const peninsular: TariffConfig = {
  region: 'peninsular',
  retailRatesKwh: [
    { tierMaxKwh: 1500, rateRm: 0.27 },
    { tierMaxKwh: Infinity, rateRm: 0.37 },
  ],
  exportRateRm: 0.16,
  exportAllowed: true,
  label: 'Peninsular · Solar ATAP',
  notes: 'TNB residential · Solar ATAP discounted export, 10-year contract',
};
