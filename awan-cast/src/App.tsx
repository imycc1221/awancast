import { Header } from './components/Header';
import { CloudMap } from './components/CloudMap';
import { PrimaryAction } from './components/PrimaryAction';
import { StormAlertCard } from './components/StormAlertCard';
import { RegimeBanner } from './components/RegimeBanner';
import { ForecastStrip } from './components/ForecastStrip';
import { ApplianceList } from './components/ApplianceList';
import { NetLoadChart } from './components/NetLoadChart';
import { FeedbackHistory } from './components/FeedbackHistory';
import { GuaranteePanel } from './components/GuaranteePanel';
import { SunshineNow } from './components/SunshineNow';
import { SystemCheck } from './components/SystemCheck';
import { MonthlyCard } from './components/MonthlyCard';
import { FacilityDashboard } from './components/FacilityDashboard';
import { EvidenceView } from './components/EvidenceView';
import { StormReplay } from './components/StormReplay';
import { GuidedTour } from './components/GuidedTour';
import { SetupModal } from './components/SetupModal';
import { PanelSkeleton } from './components/PanelSkeleton';
import { useTheme } from './hooks/useTheme';
import { useForecast } from './hooks/useForecast';
import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from './state/useAppStore';
import { useActiveProfile } from './hooks/useProfile';
import { scaleForecast } from './lib/netload';
import { useT } from './lib/i18n';

export default function App() {
  useTheme();
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const profile = useActiveProfile();
  const configured = useAppStore((s) => s.configured);
  const introDismissed = useAppStore((s) => s.introDismissed);
  const dismissIntro = useAppStore((s) => s.dismissIntro);
  const t = useT();
  const [tourActive, setTourActive] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const { data: forecast, isLoading, isError, error } = useForecast();

  // Scale the mock forecast to the household's solar capacity (input layer feeds everything downstream).
  const scaled = useMemo(
    () => (forecast ? scaleForecast(forecast, profile.solarKwp) : undefined),
    [forecast, profile.solarKwp],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'START_TOUR') setTourActive(true);
      if (detail === 'EDIT_SETUP') setSetupOpen(true);
    };
    window.addEventListener('AWANCAST_ACTION', handler);
    return () => window.removeEventListener('AWANCAST_ACTION', handler);
  }, []);

  // First-visit onboarding.
  useEffect(() => {
    if (!configured) setSetupOpen(true);
  }, [configured]);

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <Header />

      <main
        key={view}
        className="view-enter mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 px-4 py-4 lg:grid lg:min-h-0 lg:grid-cols-[1.4fr_1fr] lg:items-stretch lg:gap-3 lg:overflow-hidden lg:px-6 lg:py-3"
      >
        {view === 'evidence' ? (
          <div className="lg:col-span-2 lg:self-start lg:max-h-full lg:overflow-y-auto lg:pr-1">
            <EvidenceView />
          </div>
        ) : forecast && scaled ? (
          view === 'facility' ? (
            <div className="lg:col-span-2 lg:self-start lg:max-h-full lg:overflow-y-auto lg:pr-1">
              <FacilityDashboard forecast={forecast} />
            </div>
          ) : (
            <>
              <div className="order-2 flex min-h-[420px] flex-col lg:order-1 lg:min-h-0">
                <CloudMap forecast={forecast} />
              </div>

              <div className="stagger-children order-1 flex min-h-0 flex-col gap-3 lg:order-2 lg:overflow-y-auto lg:pr-1">
                {!introDismissed && (
                  <div className="flex items-start gap-2 rounded-panel border border-hairline bg-panel px-3 py-2.5">
                    <p className="flex-1 text-[12px] leading-snug text-ink-muted">
                      {t(
                        'Awan-Cast finds the best time to run your appliances on free solar, and warns you before a storm cuts your power.',
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={dismissIntro}
                      aria-label="Dismiss introduction"
                      className="mt-0.5 shrink-0 text-ink-muted transition-colors hover:text-ink"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                <StormAlertCard forecast={scaled} />
                <SunshineNow forecast={scaled} />
                <PrimaryAction forecast={scaled} />
                <RegimeBanner forecast={scaled} />
                <ForecastStrip forecast={scaled} />
                <NetLoadChart forecast={scaled} />
                <ApplianceList forecast={scaled} />
                <SystemCheck />
                <MonthlyCard />
                <FeedbackHistory />
                <GuaranteePanel />
              </div>
            </>
          )
        ) : isLoading ? (
          <>
            <div className="order-2 lg:order-1">
              <PanelSkeleton height={400} />
            </div>
            <div className="order-1 flex flex-col gap-3 lg:order-2">
              <PanelSkeleton height={180} />
              <PanelSkeleton height={70} />
              <PanelSkeleton height={200} />
            </div>
          </>
        ) : isError ? (
          <div className="panel col-span-2 p-6 text-[13px]">
            <div className="label-eyebrow">Forecast unavailable</div>
            <div className="mt-2 text-ink-muted">
              {error instanceof Error ? error.message : 'Unknown error'}. Showing the last-known
              values when they return.
            </div>
          </div>
        ) : null}
      </main>

      <StormReplay />
      <GuidedTour
        active={tourActive}
        onComplete={() => {
          setTourActive(false);
          setView('home');
        }}
      />
      <SetupModal open={setupOpen} onClose={() => setSetupOpen(false)} />
    </div>
  );
}
