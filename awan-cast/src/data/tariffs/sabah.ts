import type { TariffConfig } from '../../types';

export const sabah: TariffConfig = {
  region: 'sabah',
  retailRatesKwh: [{ tierMaxKwh: Infinity, rateRm: 0.34 }],
  exportRateRm: null,
  exportAllowed: false,
  label: 'Sabah · SELCO-PV',
  notes: 'SESB SELCO-PV · self-consumption only · no export allowed',
};
