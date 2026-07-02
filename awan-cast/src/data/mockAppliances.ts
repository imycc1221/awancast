import type { Appliance } from '../types';

// Cycle durations are tuned so the short-cycle appliances (everything except the
// EV) finish inside the ~28-minute pre-storm window in the demo mock. This lets
// the scheduler honestly recommend RUN NOW for them and WAIT for the EV, matching
// the recorded video script. The values map to real "quick cycle" / "filter mode"
// settings most appliances ship with.
export const mockAppliances: Appliance[] = [
  // Order matches the Scene 4 voiceover: "Dishwasher: run now. Washing
  // machine: run now. Pool pump: run now. Water heater: run now. EV
  // charger: wait." — so the on-screen scan order matches what's spoken.
  {
    id: 'dishwasher',
    name: 'Dishwasher',
    iconKey: 'dishwasher',
    kwDraw: 1.5,
    durationMin: 20, // quick rinse
    flexibilityHrs: 4,
  },
  {
    id: 'washer',
    name: 'Washing Machine',
    iconKey: 'washer',
    kwDraw: 1.2,
    durationMin: 25, // quick wash
    flexibilityHrs: 3,
  },
  {
    id: 'pool',
    name: 'Pool Pump',
    iconKey: 'pool',
    kwDraw: 1.1,
    durationMin: 25, // filter / skim cycle
    flexibilityHrs: 5,
  },
  {
    id: 'waterheater',
    name: 'Water Heater',
    iconKey: 'waterheater',
    kwDraw: 2.0,
    durationMin: 20, // top-up heat
    flexibilityHrs: 4,
  },
  {
    id: 'ev',
    name: 'EV Charger',
    iconKey: 'ev',
    kwDraw: 7.4,
    durationMin: 120, // full charge — does NOT fit pre-storm, must WAIT
    flexibilityHrs: 6,
  },
];
