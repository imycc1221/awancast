import { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import { Panel } from './Panel';
import { useAppStore } from '../state/useAppStore';
import { monthlyShowcase } from '../lib/sunshine';
import { useT } from '../lib/i18n';

/**
 * The shareable identity stat: how much of the month the home ran on its own roof. Solar owners installed
 * partly to signal — this gives them the screenshot-worthy number. Example month until real data builds.
 */
export function MonthlyCard() {
  const region = useAppStore((s) => s.region);
  const t = useT();
  const m = monthlyShowcase(region);
  const [copied, setCopied] = useState(false);
  const shareText = t('My home ran {pct}% on sunshine this month in {city} — tracked with Awan-Cast.', {
    pct: m.pct,
    city: m.city,
  });

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
      } else {
        await navigator.clipboard?.writeText(shareText);
      }
      setCopied(true);
    } catch {
      // user cancelled the share sheet — nothing to do
    }
  };

  return (
    <Panel label={t('Your month on sunshine')}>
      <div className="flex items-baseline gap-2">
        <span className="tnum text-[30px] font-semibold leading-none tracking-[-0.02em]">{m.pct}%</span>
        <span className="text-[12px] leading-snug text-ink">
          {t('of your daytime power came from your own roof')}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">
        {t('That puts you in the {rank} of solar homes around {city}.', { rank: m.rank, city: m.city })}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] leading-snug text-ink-muted">
          {t('Example month — fills with your real data over time.')}
        </span>
        <button
          type="button"
          onClick={share}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/20"
        >
          <Share2 className="h-3 w-3" strokeWidth={2} />
          {copied ? t('Copied') : t('Share')}
        </button>
      </div>
    </Panel>
  );
}
