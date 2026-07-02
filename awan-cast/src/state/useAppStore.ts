import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Region, ReplayScenarioId } from '../types';
import { exampleProfiles, type HouseholdProfile } from '../data/profiles';
import type { FeedbackEntry } from '../data/feedback';

export type AppView = 'home' | 'facility' | 'evidence';
export type AppLang = 'en' | 'ms';

interface AppState {
  region: Region;
  theme: 'light' | 'dark';
  lang: AppLang;
  view: AppView;
  replayMode: boolean;
  replayScenario: ReplayScenarioId;
  replayTime: string | null;
  profiles: Record<Region, HouseholdProfile>;
  configured: boolean;
  introDismissed: boolean;
  feedback: FeedbackEntry[];
  setRegion: (r: Region) => void;
  setTheme: (t: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setLang: (l: AppLang) => void;
  setView: (v: AppView) => void;
  setReplayScenario: (id: ReplayScenarioId) => void;
  setReplayTime: (t: string | null) => void;
  setReplayMode: (mode: boolean) => void;
  setProfile: (region: Region, p: HouseholdProfile) => void;
  markConfigured: () => void;
  dismissIntro: () => void;
  addFeedback: (e: FeedbackEntry) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      region: 'peninsular',
      theme:
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light',
      lang: 'en',
      view: 'home',
      replayMode: false,
      replayScenario: 'peninsular-storm',
      replayTime: null,
      profiles: exampleProfiles,
      configured: false,
      introDismissed: false,
      feedback: [],
      setRegion: (region) => set({ region }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
      setLang: (lang) => set({ lang }),
      setView: (view) => set({ view }),
      setProfile: (region, p) =>
        set((s) => ({ profiles: { ...s.profiles, [region]: p } })),
      markConfigured: () => set({ configured: true }),
      dismissIntro: () => set({ introDismissed: true }),
      addFeedback: (e) => set((s) => ({ feedback: [e, ...s.feedback].slice(0, 50) })),
      setReplayScenario: (replayScenario) => set({ replayScenario, replayTime: null }),
      setReplayTime: (replayTime) => set({ replayTime }),
      setReplayMode: (replayMode) =>
        set((s) => ({
          replayMode,
          replayTime: replayMode ? s.replayTime : null,
        })),
    }),
    {
      name: 'awan-cast-app-state',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // v1 stored appliances as a string[] plus a separate airconCount; v2 uses a key -> quantity map
      // with aircon folded in. Convert any old shape so rehydration never yields the wrong type.
      migrate: (persisted) => {
        const s = persisted as { profiles?: Record<string, Record<string, unknown>> } | undefined;
        if (s?.profiles) {
          for (const p of Object.values(s.profiles)) {
            if (Array.isArray(p.appliances)) {
              const rec: Record<string, number> = {};
              for (const k of p.appliances as string[]) rec[k] = 1;
              if (typeof p.airconCount === 'number' && p.airconCount > 0) rec['aircon'] = p.airconCount;
              p.appliances = rec;
            }
            delete p.airconCount;
          }
        }
        return persisted as AppState;
      },
      partialize: (s) => ({
        region: s.region,
        theme: s.theme,
        lang: s.lang,
        profiles: s.profiles,
        configured: s.configured,
        introDismissed: s.introDismissed,
        feedback: s.feedback,
      }),
      // Deep-merge each region's stored profile over the current defaults so that adding a field to
      // HouseholdProfile can never leave a rehydrated profile missing keys (which would produce NaN demand).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        const profiles = { ...current.profiles };
        if (p.profiles) {
          (Object.keys(profiles) as Region[]).forEach((r) => {
            profiles[r] = { ...profiles[r], ...p.profiles![r] };
          });
        }
        return { ...current, ...p, profiles };
      },
    },
  ),
);
