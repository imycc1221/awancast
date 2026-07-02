import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Plus, Minus } from 'lucide-react';
import { useAppStore } from '../state/useAppStore';
import { useActiveProfile } from '../hooks/useProfile';
import {
  TARIFF_LABEL,
  exampleProfiles,
  type HouseholdProfile,
  type TariffPlan,
} from '../data/profiles';
import { APPLIANCE_CATALOG } from '../data/applianceCatalog';
import { useT } from '../lib/i18n';
import type { Region } from '../types';

/** The tariff scheme is fixed by the region (not independently chosen). */
const REGION_TO_PLAN: Record<Region, TariffPlan> = {
  peninsular: 'solar-atap',
  sarawak: 'sarawak-nem',
  sabah: 'sabah-selco',
};

interface Props {
  open: boolean;
  onClose: () => void;
}

/** The input layer: a one-time (editable) household setup. Stored in the browser, no accounts. */
export function SetupModal({ open, onClose }: Props) {
  const region = useAppStore((s) => s.region);
  const profile = useActiveProfile();
  const setProfile = useAppStore((s) => s.setProfile);
  const markConfigured = useAppStore((s) => s.markConfigured);

  const [form, setForm] = useState<HouseholdProfile>(profile);
  const [query, setQuery] = useState('');
  const t = useT();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setForm(profile);
      setQuery('');
    }
  }, [open, profile]);

  // Escape to close + a simple focus trap while the dialog is open.
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      const el = dialogRef.current;
      if (e.key === 'Tab' && el) {
        const f = el.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (f.length === 0) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return APPLIANCE_CATALOG;
    return APPLIANCE_CATALOG.filter((c) => `${c.name} ${c.category}`.toLowerCase().includes(q));
  }, [query]);

  const ownedCount = Object.values(form.appliances).filter((n) => n > 0).length;

  if (!open) return null;

  const qtyOf = (key: string) => form.appliances[key] ?? 0;
  const setQty = (key: string, n: number) => {
    setForm((f) => {
      const appliances = { ...f.appliances };
      if (n <= 0) delete appliances[key];
      else appliances[key] = n;
      return { ...f, appliances };
    });
  };

  const save = () => {
    setProfile(region, { ...form, region, tariffPlan: REGION_TO_PLAN[region] });
    markConfigured();
    onClose();
  };

  const field = 'w-full rounded-lg border border-hairline bg-panel-nested px-2.5 py-1.5 text-[13px]';

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="panel flex max-h-[90vh] w-full max-w-md flex-col p-5 outline-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Household setup"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="label-eyebrow">{t('Your home')}</div>
            <h2 className="mt-1 text-[16px] font-semibold tracking-tight">{t('Set up Awan-Cast')}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <p className="mt-1 text-[11px] leading-snug text-ink-muted">
          {t('Awan-Cast tailors its advice to your home. This stays in your browser — no account needed.')}
        </p>

        <button
          type="button"
          onClick={() => {
            setProfile(region, { ...exampleProfiles[region], region });
            markConfigured();
            onClose();
          }}
          className="mt-3 w-full rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/20"
        >
          {t('Not sure about any of this? Use a typical Malaysian home')}
        </button>
        <div className="mt-2 text-center text-[10px] text-ink-muted">
          {t('You can fine-tune everything later from Edit setup.')}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <label className="text-[12px]">
            <span className="text-ink-muted">{t('Solar size (kWp)')}</span>
            <input
              type="number"
              min={1}
              step={0.5}
              className={field}
              value={form.solarKwp}
              onChange={(e) => setForm((f) => ({ ...f, solarKwp: Number(e.target.value) || 0 }))}
            />
            <span className="mt-1.5 flex gap-1">
              {(
                [
                  ['Small', 2],
                  ['Typical', 5],
                  ['Large', 8],
                ] as const
              ).map(([lbl, v]) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, solarKwp: v }))}
                  className={`rounded-full border px-1.5 py-0.5 text-[9px] ${
                    form.solarKwp === v
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-hairline text-ink-muted hover:text-ink'
                  }`}
                >
                  {t(lbl)}
                </button>
              ))}
            </span>
          </label>
          <label className="text-[12px]">
            <span className="text-ink-muted">{t('Battery (kWh)')}</span>
            <input
              type="number"
              min={0}
              step={1}
              className={field}
              value={form.batteryKwh}
              onChange={(e) => setForm((f) => ({ ...f, batteryKwh: Number(e.target.value) || 0 }))}
            />
            <span className="mt-1.5 flex gap-1">
              {(
                [
                  ['None', 0],
                  ['Small', 5],
                  ['Big', 10],
                ] as const
              ).map(([lbl, v]) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, batteryKwh: v }))}
                  className={`rounded-full border px-1.5 py-0.5 text-[9px] ${
                    form.batteryKwh === v
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-hairline text-ink-muted hover:text-ink'
                  }`}
                >
                  {t(lbl)}
                </button>
              ))}
            </span>
          </label>
          <label className="text-[12px]">
            <span className="text-ink-muted">{t('People')}</span>
            <input
              type="number"
              min={1}
              step={1}
              className={field}
              value={form.householdSize}
              onChange={(e) => setForm((f) => ({ ...f, householdSize: Number(e.target.value) || 1 }))}
            />
          </label>
        </div>

        <div className="mt-3 text-[12px]">
          <span className="text-ink-muted">{t('Tariff scheme')}</span>
          <div className={`${field} flex items-center justify-between`}>
            <span>{TARIFF_LABEL[REGION_TO_PLAN[region]]}</span>
            <span className="text-[10px] text-ink-muted">{t('set by your region')}</span>
          </div>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col text-[12px]">
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">{t('Appliances you own')}</span>
            <span className="text-[10px] text-ink-muted">{t('{n} selected', { n: ownedCount })}</span>
          </div>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder={t('Search appliances…')}
              className={`${field} pl-8`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="mt-2 min-h-[8rem] flex-1 overflow-y-auto rounded-lg border border-hairline">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-ink-muted">{t('No matches.')}</div>
            ) : (
              filtered.map((c, idx) => {
                const Icon = c.icon;
                const qty = qtyOf(c.key);
                return (
                  <div
                    key={c.key}
                    className={`flex items-center gap-2.5 px-2.5 py-2 ${idx > 0 ? 'border-t border-hairline' : ''}`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        qty > 0 ? 'bg-accent/10 text-accent' : 'bg-panel-nested text-ink-muted'
                      }`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.7} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-ink">{t(c.name)}</div>
                      <div className="text-[10px] text-ink-muted">
                        {t(c.category)}
                        {c.flexible ? ` · ${t('schedulable')}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Fewer ${c.name}`}
                        onClick={() => setQty(c.key, qty - 1)}
                        disabled={qty === 0}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-hairline text-ink-muted disabled:opacity-30 hover:text-ink"
                      >
                        <Minus className="h-3 w-3" strokeWidth={2.2} />
                      </button>
                      <span className="tnum w-4 text-center text-[12px] font-semibold">{qty}</span>
                      <button
                        type="button"
                        aria-label={`More ${c.name}`}
                        onClick={() => setQty(c.key, qty + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-hairline text-ink-muted hover:text-ink"
                      >
                        <Plus className="h-3 w-3" strokeWidth={2.2} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={form.wfhWeekdays}
            onChange={(e) => setForm((f) => ({ ...f, wfhWeekdays: e.target.checked }))}
          />
          <span>{t('Work from home on weekdays (raises daytime demand)')}</span>
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-hairline px-3.5 py-1.5 text-[12px] font-medium text-ink-muted hover:text-ink"
          >
            {t('Cancel')}
          </button>
          <button
            onClick={save}
            className="rounded-full bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-[color:var(--on-accent)]"
          >
            {t('Save setup')}
          </button>
        </div>
      </div>
    </div>
  );
}
