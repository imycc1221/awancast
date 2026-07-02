import {
  WashingMachine,
  UtensilsCrossed,
  Car,
  AirVent,
  Waves,
  Flame,
  CloudSun,
  Cloud,
  CloudLightning,
  CloudHail,
  type LucideIcon,
} from 'lucide-react';
import type { ApplianceIconKey, Regime } from '../types';

export const applianceIcons: Record<ApplianceIconKey, LucideIcon> = {
  washer: WashingMachine,
  dishwasher: UtensilsCrossed,
  ev: Car,
  ac: AirVent,
  pool: Waves,
  waterheater: Flame,
};

export const regimeIcons: Record<Regime, LucideIcon> = {
  stable: CloudSun,
  partial: Cloud,
  convective: CloudLightning,
  severe: CloudHail,
};

export const regimeCopy: Record<Regime, { title: string; tone: 'success' | 'warn' | 'danger' }> = {
  stable: { title: 'Clear skies', tone: 'success' },
  partial: { title: 'Partial cloud', tone: 'success' },
  convective: { title: 'Storm building', tone: 'warn' },
  severe: { title: 'Severe storm', tone: 'danger' },
};
