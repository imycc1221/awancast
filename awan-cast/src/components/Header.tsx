import { CloudSun, PlayCircle, SlidersHorizontal } from 'lucide-react';
import { LiveClock } from './LiveClock';
import { SunArc } from './SunArc';
import { RegionSwitcher } from './RegionSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { useAppStore, type AppLang } from '../state/useAppStore';
import { useT } from '../lib/i18n';

export function Header() {
  const replayMode = useAppStore((s) => s.replayMode);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const t = useT();

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-hairline bg-bg/85 px-4 py-3 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-2">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
          <CloudSun className="h-5 w-5 text-accent" strokeWidth={1.75} />
        </div>
        <div className="leading-tight">
          <div className="text-[14px] font-semibold tracking-tight">Awan-Cast</div>
          <div className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
            {t('Tropical solar nowcast')}
          </div>
        </div>
      </div>

      <div className="order-3 w-full lg:order-2 lg:mx-auto lg:w-auto">
        <RegionSwitcher />
      </div>

      <div className="order-2 ml-auto flex items-center gap-3 lg:order-3">
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent('AWANCAST_ACTION', { detail: 'EDIT_SETUP' }))
          }
          className="inline-flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">{t('Edit setup')}</span>
        </button>
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent('AWANCAST_ACTION', { detail: 'START_TOUR' }))
          }
          className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/20"
        >
          <PlayCircle className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">{t('Start tour')}</span>
        </button>
        <div className="inline-flex rounded-full border border-hairline p-0.5 text-[11px] font-medium">
          {(['home', 'facility', 'evidence'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-full px-2.5 py-1 capitalize transition-colors ${
                view === v ? 'bg-accent/10 text-accent' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {t(v)}
            </button>
          ))}
        </div>
        <div
          className="inline-flex rounded-full border border-hairline p-0.5 text-[10px] font-semibold"
          role="group"
          aria-label="Language"
        >
          {(['en', 'ms'] as AppLang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`rounded-full px-2 py-0.5 transition-colors ${
                lang === l ? 'bg-accent/10 text-accent' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {l === 'en' ? 'EN' : 'BM'}
            </button>
          ))}
        </div>
        {replayMode && (
          <span className="hidden rounded-full bg-warn-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-warn md:inline">
            Replay
          </span>
        )}
        <div className="hidden items-center gap-2 lg:flex">
          <SunArc />
          <LiveClock />
        </div>
        <div className="lg:hidden">
          <LiveClock />
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
