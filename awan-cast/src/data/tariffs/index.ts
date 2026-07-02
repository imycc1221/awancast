import type { Region, TariffConfig } from '../../types';
import { peninsular } from './peninsular';
import { sarawak } from './sarawak';
import { sabah } from './sabah';

export const tariffs: Record<Region, TariffConfig> = {
  peninsular,
  sarawak,
  sabah,
};

export function getTariff(region: Region): TariffConfig {
  return tariffs[region];
}
