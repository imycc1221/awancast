# Awan-Cast

> Tropical solar nowcasting and tariff-aware appliance scheduling for Malaysian rooftop solar.
>
> SEDA Innovation Challenge 2026 · Category B · Scope 6 · Team "Da House" · Asia Pacific University.

This repository contains the **web dashboard** — the visible face of Awan-Cast. The full project also covers a Python backend (Himawari-9 ingest, optical-flow nowcast, LightGBM correction) which lives in separate sub-projects.

## What the dashboard does

- Shows current rooftop generation (`kW`) and the next two hours of forecast, with a confidence band that **widens visibly when a convective storm is approaching** — honest about uncertainty.
- Plots cloud motion over Malaysia and pins your home, so you can *see* the storm closing in.
- Recommends when to run flexible appliances (washer, dishwasher, EV charger) and how much RM you save by timing them right.
- Switches between Malaysia's three rooftop-solar regimes with one click:
  - **Peninsular · Solar ATAP** — TNB, discounted export.
  - **Sarawak · SEB NEM** — 1:1 export credit (+ NEMSS subsidy).
  - **Sabah · SELCO-PV** — no export allowed; every kWh must be self-consumed.
- Bundles three **storm-replay scenarios** so the booth demo runs entirely offline.

## Quickstart

```bash
pnpm install          # or npm install
pnpm dev              # Vite dev server on http://localhost:5173
pnpm build            # static dist/ for deployment
pnpm preview          # serve dist/ locally
pnpm test             # Vitest
pnpm typecheck        # tsc --noEmit
```

The dev server ships with `VITE_USE_MOCK=true`. No backend is required — the canonical 2:05 PM Petaling Jaya storm scenario is bundled.

## Architecture

```
┌──────────────────────────────────────────────┐
│  React 18 + Vite + TypeScript + Tailwind     │
└──────────────────────────────────────────────┘
   │
   ├── components/    UI tiles, max 150 LoC each
   ├── data/          mock forecast · scheduler · tariff configs · replay scenarios
   ├── state/         Zustand (region, theme, replay)
   ├── lib/api.ts     single seam — mock today, FastAPI tomorrow
   └── hooks/         useForecast (TanStack Query), useTheme, useCurrentTime
```

Switching from mock to a real backend is one flag in `.env`:

```
VITE_USE_MOCK=false
VITE_API_URL=https://api.awan-cast.example
```

Everything else stays the same.

## The scheduler

`src/data/scheduler.ts` is a **pure function** — `recommend(forecast, appliances, tariff) → Recommendation[]`. It is the reference implementation that ports byte-for-byte to Python on the backend when the FastAPI service is ready. Tested in `tests/scheduler.test.ts`.

## Design language

**Apple "Pro Dashboard" (macOS Sonoma widgets-style).** Light grey base, white nested panels, hairline borders, no gradients, no shadows except a 1px elevation. Tabular numerals on all numeric data. **No emojis** — Lucide React icons only.

Full design tokens and rationale: [`docs/superpowers/specs/2026-05-15-awan-cast-frontend-design.md`](../docs/superpowers/specs/2026-05-15-awan-cast-frontend-design.md).

## Reproducibility & licensing

- Code: **Apache-2.0**.
- Tariff numbers are illustrative for the prototype — verify against current SEDA / TNB / SEB / SESB publications before final submission.
- Map base tiles: © OpenStreetMap · CartoDB.
- Cloud overlay attribution: Himawari-9 © JAXA. The prototype ships a stylised overlay; the production system ingests live Himawari frames via [data/fetch_nsrdb.py](../data/fetch_nsrdb.py) and a JAXA P-Tree / AWS Open Data Registry pipeline (out of scope for v1 frontend).

## Project context

- Main project design: [`../awan-cast-design.md`](../awan-cast-design.md)
- Stage 1 video plan: [`../stage1_video_plan.md`](../stage1_video_plan.md)
- Data acquisition guide: [`../data/DATA_GUIDE.md`](../data/DATA_GUIDE.md)
