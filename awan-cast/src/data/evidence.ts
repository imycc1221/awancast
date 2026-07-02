export interface EvidenceMetric {
  label: string;
  value: string;
  detail: string;
  /** true = measured & CI-backed; false = projection (labelled distinctly in the UI). */
  measured: boolean;
}

export interface EvidenceSection {
  title: string;
  blurb: string;
  metrics: EvidenceMetric[];
}

export const evidenceIntro = {
  thesis:
    'In the Malaysian tropics the dominant source of forecast error is the moment a storm forms. Errors in this storm-onset regime are about three times larger than at other times, so Awan-Cast is built around it.',
  badges: [
    '~31 controlled experiments',
    'Independently cross-model audited',
    'Confidence intervals throughout',
    'Measured vs projected labelled distinctly',
  ],
};

export const evidenceSections: EvidenceSection[] = [
  {
    title: 'Forecasting skill at storm onset',
    blurb:
      'The regime that matters most, measured against a strong smart-persistence baseline on ground-truth irradiance.',
    metrics: [
      {
        label: 'Two-hour onset skill gain',
        value: '+33.5%',
        detail: '95% CI 31.8 to 35.4; wins on 96.6% of 261 test days',
        measured: true,
      },
      {
        label: 'Onset vs average error',
        value: '≈ 3×',
        detail: 'storm-onset error is about three times the all-conditions error',
        measured: true,
      },
    ],
  },
  {
    title: 'The regime-selective gate (core innovation)',
    blurb:
      'Routes the expensive deep model only to storm-onset pixels, so accuracy lands where it matters at a fraction of the cost.',
    metrics: [
      {
        label: 'Benefit captured by the gate',
        value: '92.1%',
        detail: '95% CI 87.6 to 95.8 of the maximum accuracy benefit',
        measured: true,
      },
      {
        label: 'Compute cost of the gate',
        value: '≈ 40%',
        detail: 'near-full accuracy at well under half the cost',
        measured: true,
      },
      {
        label: 'Onset detector',
        value: 'AUC 0.815',
        detail: 'about 2.5× the precision of a naive trigger',
        measured: true,
      },
    ],
  },
  {
    title: 'The deep model beats a strong baseline',
    blurb: 'A deep enhancement model versus the tabular bar, on identical pixels with a paired test.',
    metrics: [
      {
        label: 'Deep advantage (paired)',
        value: '4.19 K',
        detail: '95% CI 2.91 to 5.58; deep wins 100% of resamples',
        measured: true,
      },
      {
        label: 'In-domain pretraining',
        value: 'onset −1.43 K',
        detail: 'self-supervised on our own frames (preliminary)',
        measured: true,
      },
      {
        label: 'Borrowed optical model',
        value: 'onset −0.18 K',
        detail: 'no transfer, as predicted for optical to thermal-IR',
        measured: true,
      },
    ],
  },
  {
    title: 'Trustworthy uncertainty',
    blurb: 'Confidence ranges that hold up during storms, not just on calm days.',
    metrics: [
      {
        label: 'Convective coverage',
        value: '0.86 → 0.94',
        detail: 'regime-conditioned conformal restores honest coverage',
        measured: true,
      },
      {
        label: 'Uncertainty quality',
        value: '0.51 vs 0.16',
        detail: 'predicted-uncertainty-to-error correlation vs a plain ensemble',
        measured: true,
      },
    ],
  },
  {
    title: 'Generalises across Malaysia',
    blurb:
      'The onset benefit holds at three ground-truth sites spanning the Peninsula, Sarawak, and Sabah.',
    metrics: [
      { label: 'Petaling Jaya', value: '+33.5%', detail: 'confidence interval excludes zero', measured: true },
      { label: 'Kuching', value: '+25.8%', detail: 'confidence interval excludes zero', measured: true },
      { label: 'Kota Kinabalu', value: '+28.8%', detail: 'confidence interval excludes zero', measured: true },
    ],
  },
  {
    title: 'Commercial value (RP4 demand charge)',
    blurb: 'A hardened simulation on real commercial interval-meter load and the real Malaysian tariff.',
    metrics: [
      {
        label: 'System saving per site',
        value: '≈ RM 638k/yr',
        detail: 'solar + battery + control vs grid only',
        measured: false,
      },
      {
        label: 'Forecast marginal value',
        value: '≈ RM 55k/yr',
        detail: 'over a competent forecast-blind operator',
        measured: false,
      },
    ],
  },
];

export const evidenceFootnote =
  'Results on NSRDB irradiance and real Himawari imagery are measured with confidence intervals and were independently audited by a second AI model. Commercial figures are projections grounded in real data and the real tariff, not audited savings. Still to come: a live data pipeline, independent pyranometer validation, and a generative nowcaster at scale.';
