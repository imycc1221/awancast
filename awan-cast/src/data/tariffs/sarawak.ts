import type { TariffConfig } from '../../types';

export const sarawak: TariffConfig = {
  region: 'sarawak',
  retailRatesKwh: [{ tierMaxKwh: Infinity, rateRm: 0.2 }],
  exportRateRm: 0.2,
  exportAllowed: true,
  label: 'Sarawak · SEB NEM',
  notes: 'SEB residential · NEM 1:1 credit · NEMSS subsidy up to RM 12k',
};
