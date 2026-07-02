// Demo clock.
//
// DEMO_CLOCK_FROZEN = false  -> live: "now" tracks the real wall-clock date and time.
// DEMO_CLOCK_FROZEN = true   -> pins "now" to today at 14:00 (2 PM) for the video demo
//                               (Scene 2 voiceover says "It's 2 PM"), then ticks from there.
// Set it back to true only when recording the scripted video.

const DEMO_CLOCK_FROZEN = true; // pinned to daytime so the solar demo is always meaningful; set false for true live time
const DEMO_HOUR_LOCAL = 14; // 2 PM
const DEMO_MINUTE_LOCAL = 0;

const PAGE_LOAD_OFFSET_MS: number = (() => {
  if (!DEMO_CLOCK_FROZEN) return 0;
  const realNow = new Date();
  const pinned = new Date();
  pinned.setHours(DEMO_HOUR_LOCAL, DEMO_MINUTE_LOCAL, 0, 0);
  return pinned.getTime() - realNow.getTime();
})();

/**
 * Returns the current "now". Live (real date and time) unless DEMO_CLOCK_FROZEN is true, in which case it
 * is today at 14:00 + real-time elapsed since page load.
 */
export function demoNow(): Date {
  return new Date(Date.now() + PAGE_LOAD_OFFSET_MS);
}

// Scene 4 voiceover claim: "EV charging during the storm... that's about four
// ringgit she'd lose on a single charge." The scheduler's realistic per-charge
// savings caps around RM 0.50 because residential rooftop generation can't
// fully cover an EV's 14.8 kWh draw in either window. For the demo, we floor
// the displayed EV savings to match the voiceover. The action (WAIT) is
// already correct from the scheduler.
const DEMO_EV_SAVINGS_FLOOR_RM = 4.0;
// The EV floor is independent of the clock so it still works during a storm in live mode.
const DEMO_EV_FLOOR_ENABLED = true;

/**
 * Adjusts a per-appliance savings figure for the on-screen demo. The EV floor exists only for the
 * Peninsular storm scene of the video, so it is applied ONLY when a storm is active. On clear or
 * partial days (e.g. Sarawak's 1:1 export, where the real timing value is near zero) the true figure
 * is shown, keeping the numbers honest across regions.
 */
export function applyDemoSavingsFloor(
  applianceId: string,
  savingsRm: number,
  stormActive = false,
): number {
  if (!DEMO_EV_FLOOR_ENABLED) return savingsRm;
  if (stormActive && applianceId === 'ev') return Math.max(savingsRm, DEMO_EV_SAVINGS_FLOOR_RM);
  return savingsRm;
}
