import type { LucideIcon } from 'lucide-react';
import {
  WashingMachine,
  UtensilsCrossed,
  Car,
  AirVent,
  Waves,
  Flame,
  Refrigerator,
  Tv,
  Microwave,
  Fan,
  Lightbulb,
  Laptop,
  Router,
  Droplets,
  Shirt,
  CookingPot,
  Coffee,
  Utensils,
  Plug,
} from 'lucide-react';
import type { Appliance } from '../types';

export interface CatalogAppliance {
  key: string;
  name: string;
  category: string;
  icon: LucideIcon;
  /** Flexible = schedulable to solar windows. Non-flexible items are owned for profile completeness. */
  flexible: boolean;
  kwDraw?: number;
  durationMin?: number;
  flexibilityHrs?: number;
}

/**
 * A comprehensive catalogue of common Malaysian household appliances, each with its own icon. Flexible
 * appliances carry scheduling parameters and appear as recommendations; the rest are captured for a
 * complete profile (aircon count feeds the demand model).
 */
export const APPLIANCE_CATALOG: CatalogAppliance[] = [
  { key: 'dishwasher', name: 'Dishwasher', category: 'Kitchen', icon: UtensilsCrossed, flexible: true, kwDraw: 1.5, durationMin: 20, flexibilityHrs: 4 },
  { key: 'washer', name: 'Washing machine', category: 'Laundry', icon: WashingMachine, flexible: true, kwDraw: 1.2, durationMin: 25, flexibilityHrs: 3 },
  { key: 'dryer', name: 'Clothes dryer', category: 'Laundry', icon: Shirt, flexible: true, kwDraw: 2.5, durationMin: 40, flexibilityHrs: 3 },
  { key: 'waterheater', name: 'Water heater', category: 'Water', icon: Flame, flexible: true, kwDraw: 2.0, durationMin: 20, flexibilityHrs: 4 },
  { key: 'pool', name: 'Pool pump', category: 'Water', icon: Waves, flexible: true, kwDraw: 1.1, durationMin: 25, flexibilityHrs: 5 },
  { key: 'waterpump', name: 'Water pump', category: 'Water', icon: Droplets, flexible: true, kwDraw: 0.75, durationMin: 30, flexibilityHrs: 6 },
  { key: 'ev', name: 'EV charger', category: 'Vehicle', icon: Car, flexible: true, kwDraw: 7.4, durationMin: 120, flexibilityHrs: 6 },
  { key: 'aircon', name: 'Air conditioner', category: 'Cooling', icon: AirVent, flexible: false },
  { key: 'fan', name: 'Fan', category: 'Cooling', icon: Fan, flexible: false },
  { key: 'fridge', name: 'Refrigerator', category: 'Kitchen', icon: Refrigerator, flexible: false },
  { key: 'microwave', name: 'Microwave', category: 'Kitchen', icon: Microwave, flexible: false },
  { key: 'oven', name: 'Oven', category: 'Kitchen', icon: CookingPot, flexible: false },
  { key: 'ricecooker', name: 'Rice cooker', category: 'Kitchen', icon: Utensils, flexible: false },
  { key: 'kettle', name: 'Electric kettle', category: 'Kitchen', icon: Coffee, flexible: false },
  { key: 'tv', name: 'Television', category: 'Electronics', icon: Tv, flexible: false },
  { key: 'computer', name: 'Computer', category: 'Electronics', icon: Laptop, flexible: false },
  { key: 'router', name: 'Wi-Fi router', category: 'Electronics', icon: Router, flexible: false },
  { key: 'lighting', name: 'Lighting', category: 'Lighting', icon: Lightbulb, flexible: false },
];

const ICON_BY_KEY: Record<string, LucideIcon> = Object.fromEntries(
  APPLIANCE_CATALOG.map((c) => [c.key, c.icon]),
);

/** The icon for an appliance key (falls back to a plug for anything unknown). */
export function catalogIcon(key: string): LucideIcon {
  return ICON_BY_KEY[key] ?? Plug;
}

/** Build the schedulable Appliance list from the owned quantities (any flexible appliance with qty > 0). */
export function flexibleAppliancesFor(owned: Record<string, number>): Appliance[] {
  return APPLIANCE_CATALOG.filter((c) => c.flexible && (owned[c.key] ?? 0) > 0).map((c) => ({
    id: c.key,
    name: c.name,
    iconKey: c.key,
    kwDraw: c.kwDraw ?? 1,
    durationMin: c.durationMin ?? 30,
    flexibilityHrs: c.flexibilityHrs ?? 4,
  }));
}
