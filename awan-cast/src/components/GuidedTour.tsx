import { useCallback, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore, type AppView } from '../state/useAppStore';
import type { Region } from '../types';
import './GuidedTour.css';

interface TourStep {
  view: AppView;
  region?: Region;
  target: string;
  title: string;
  content: string;
  pos: 'bottom' | 'right' | 'left';
  fallback?: { top: number; left: number };
}

// Marketing copy under version control: the single source of "what to say" about each feature.
export const TOUR_STEPS: TourStep[] = [
  {
    view: 'home',
    region: 'peninsular',
    target: '[data-tour="region"]',
    title: 'Three schemes, one app',
    content:
      'Awan-Cast covers all three Malaysian rooftop schemes — Solar ATAP in the Peninsula, NEM in Sarawak and SELCO in Sabah. Switch region and the forecast, tariff and advice all change.',
    pos: 'bottom',
  },
  {
    view: 'home',
    region: 'peninsular',
    target: '[data-tour="map"]',
    title: 'Live tropical sky',
    content:
      'A cloud nowcast over your site from Himawari-9 satellite infrared. Tropical storms can cut rooftop solar by over 70% within minutes — predicting that is the whole problem we solve.',
    pos: 'right',
  },
  {
    view: 'home',
    region: 'peninsular',
    target: '[data-tour="storm-alert"]',
    title: 'Storm heads-up',
    content:
      'A calm, early warning when a storm is forming, with what to do: run flexible loads before the dip, hold the EV until after. Storm-onset skill is up 33.5% over a strong baseline.',
    pos: 'left',
    fallback: { top: 90, left: 700 },
  },
  {
    view: 'home',
    region: 'peninsular',
    target: '[data-tour="primary"]',
    title: 'What to do now',
    content:
      'Action and ringgit first, not kilowatts. You run appliances on your own schedule — Awan-Cast just picks the cheapest window today and shows the free-solar value.',
    pos: 'left',
  },
  {
    view: 'home',
    region: 'peninsular',
    target: '[data-tour="forecast-strip"]',
    title: 'Next two hours',
    content:
      'Plain sun-and-cloud icons instead of a chart. The signal dots under each hour show how sure we are — storms honestly get fewer dots, like weak phone reception.',
    pos: 'left',
  },
  {
    view: 'home',
    region: 'peninsular',
    target: '[data-tour="recommendations"]',
    title: 'Advice, not orders',
    content:
      'These run once a day on your schedule; we show the cheapest window for each. Tap Why on any card for a plain explanation — the optimiser decides, the AI only explains, never invents a number.',
    pos: 'left',
  },
  {
    view: 'home',
    region: 'peninsular',
    target: '[data-tour="guarantee"]',
    title: 'A promise, not a hope',
    content:
      'Every range is built to cover reality at least 9 times in 10 — a mathematical guarantee from conformal prediction, measured at 94 out of 100 during storms on real satellite data.',
    pos: 'left',
  },
  {
    view: 'facility',
    region: 'peninsular',
    target: '[data-tour="facility-peak"]',
    title: 'The big money',
    content:
      'For a mall or factory the monthly peak sets the RP4 capacity charge (RM 89.27 per kW). A storm-aware battery shaves it — about RM 638k a year in a hardened simulation on real load data.',
    pos: 'bottom',
  },
  {
    view: 'evidence',
    target: '[data-tour="evidence-gate"]',
    title: 'The core innovation',
    content:
      'The regime-selective gate sends the heavy model only to storm-onset pixels — about 92% of the accuracy benefit at 40% of the compute. Built and validated on a single 6 GB laptop GPU.',
    pos: 'bottom',
  },
  {
    view: 'evidence',
    target: '[data-tour="evidence-intro"]',
    title: 'Proven, not claimed',
    content:
      'Around 31 controlled experiments, every result confidence-interval backed and independently audited by a second AI model. Measured results and projections are labelled distinctly throughout.',
    pos: 'bottom',
  },
];

interface Coords {
  top: number;
  left: number;
  width: number;
  height: number;
  found: boolean;
}

interface Props {
  active: boolean;
  onComplete: () => void;
}

export function GuidedTour({ active, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [coords, setCoords] = useState<Coords | null>(null);
  const setView = useAppStore((s) => s.setView);
  const setRegion = useAppStore((s) => s.setRegion);

  // Returns true if the target element was found and measured, false if it fell back.
  const measureStep = useCallback((idx: number): boolean => {
    const s = TOUR_STEPS[idx];
    if (!s) return false;
    const el = document.querySelector(s.target);
    if (el) {
      // Instant (not smooth) scroll so the element is at its final position before we measure;
      // smooth scrolling causes the highlight ring to land on a mid-scroll position.
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        setCoords({ top: r.top, left: r.left, width: r.width, height: r.height, found: true });
      });
      return true;
    }
    const fb = s.fallback ?? { top: window.innerHeight / 2 - 120, left: window.innerWidth / 2 - 150 };
    setCoords({ top: fb.top, left: fb.left, width: 0, height: 0, found: false });
    return false;
  }, []);

  useEffect(() => {
    if (active) {
      setStep(0);
      setCoords(null);
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const s = TOUR_STEPS[step];
    if (!s) return;
    setCoords(null);
    setView(s.view);
    if (s.region) setRegion(s.region);

    // Retry until the target element exists (handles slow first paint: map tiles, Evidence diagrams),
    // then do one settle re-measure. Fall back to a fixed position if it never appears.
    const timers: number[] = [];
    let attempts = 0;
    const poll = window.setInterval(() => {
      attempts += 1;
      const found = measureStep(step);
      if (found) {
        window.clearInterval(poll);
        timers.push(window.setTimeout(() => measureStep(step), 320));
      } else if (attempts >= 14) {
        window.clearInterval(poll);
        measureStep(step); // writes the fallback coords
      }
    }, 120);

    return () => {
      window.clearInterval(poll);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [step, active, setView, setRegion, measureStep]);

  // Keyboard navigation: Escape closes, arrows move between steps.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onComplete();
      else if (e.key === 'ArrowRight') setStep((p) => Math.min(TOUR_STEPS.length - 1, p + 1));
      else if (e.key === 'ArrowLeft') setStep((p) => Math.max(0, p - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onComplete]);

  useEffect(() => {
    if (!active) return;
    const onMove = () => measureStep(step);
    window.addEventListener('resize', onMove);
    return () => window.removeEventListener('resize', onMove);
  }, [active, step, measureStep]);

  if (!active) return null;
  const s = TOUR_STEPS[step]!;
  const c = coords ?? {
    top: window.innerHeight / 2 - 120,
    left: window.innerWidth / 2 - 150,
    width: 0,
    height: 0,
    found: false,
  };

  const POP_W = 300;
  let popTop: number;
  let popLeft: number;
  if (s.pos === 'bottom') {
    popTop = c.top + (c.height || 0) + 18;
    popLeft = c.left;
  } else if (s.pos === 'right') {
    popTop = c.top;
    popLeft = c.left + (c.width || 0) + 18;
  } else {
    popTop = c.top;
    popLeft = c.left - POP_W - 18;
  }
  popLeft = Math.min(popLeft, window.innerWidth - POP_W - 8);
  popLeft = Math.max(8, popLeft);
  popTop = Math.min(popTop, window.innerHeight - 230);
  popTop = Math.max(8, popTop);

  return (
    <div
      className="tour-overlay"
      onClick={(e) => e.target === e.currentTarget && onComplete()}
    >
      {coords?.found && coords.width > 0 && (
        <div
          className="tour-highlight"
          style={{ top: c.top - 8, left: c.left - 8, width: c.width + 16, height: c.height + 16 }}
        />
      )}

      <div
        className={`tour-popover tour-popover--${s.pos}`}
        style={{ top: popTop, left: popLeft }}
        role="dialog"
        aria-modal="true"
        aria-label={s.title}
        aria-live="polite"
      >
        <button className="tour-close" onClick={onComplete} aria-label="Close tour">
          <X size={16} />
        </button>
        <div className="tour-step-indicator">
          Step {step + 1} of {TOUR_STEPS.length}
        </div>
        <h3 className="tour-title">{s.title}</h3>
        <p className="tour-content">{s.content}</p>
        {!coords?.found && <p className="tour-hint">Loading this view…</p>}

        <div className="tour-footer">
          <button
            className="tour-btn tour-btn--secondary"
            onClick={() => setStep((p) => Math.max(0, p - 1))}
            disabled={step === 0}
          >
            <ChevronLeft size={14} /> Back
          </button>
          {step < TOUR_STEPS.length - 1 ? (
            <button className="tour-btn tour-btn--primary" onClick={() => setStep((p) => p + 1)}>
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button className="tour-btn tour-btn--primary" onClick={onComplete}>
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
