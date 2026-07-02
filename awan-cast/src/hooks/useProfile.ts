import { useAppStore } from '../state/useAppStore';
import { exampleProfiles, type HouseholdProfile } from '../data/profiles';

/** The active household profile, always defined (falls back to the region's example if ever missing). */
export function useActiveProfile(): HouseholdProfile {
  return useAppStore((s) => s.profiles[s.region] ?? exampleProfiles[s.region]);
}
