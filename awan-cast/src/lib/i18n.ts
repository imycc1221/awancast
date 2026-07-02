import { useCallback } from 'react';
import { useAppStore } from '../state/useAppStore';

export type Lang = 'en' | 'ms';

/**
 * Bahasa Malaysia dictionary, keyed by the English source string. Written as natural Malaysian BM
 * (localised idioms — cerah, mendung, ribut, jimat — not transliterations), per the UX research rule that
 * BM is first-class. Missing keys fall back to English, so an untranslated string can never crash the UI.
 * Scope: household surfaces (Home view + setup). Facility and Evidence stay English by design (facility
 * managers and judges).
 */
const MS: Record<string, string> = {
  // Header
  'Tropical solar nowcast': 'Ramalan solar tropika',
  'Edit setup': 'Ubah tetapan',
  'Start tour': 'Mula lawatan',
  home: 'utama',
  facility: 'fasiliti',
  evidence: 'bukti',

  // Intro
  'Awan-Cast finds the best time to run your appliances on free solar, and warns you before a storm cuts your power.':
    'Awan-Cast mencari masa terbaik untuk menggunakan perkakas anda dengan solar percuma, dan memberi amaran sebelum ribut memotong bekalan anda.',

  // SunshineNow
  'Right now': 'Sekarang',
  'of your home is running on sunshine': 'rumah anda berjalan dengan cahaya matahari',
  'With power to spare. ': 'Masih ada lebihan kuasa. ',
  'Topping up from the grid. ': 'Menambah dari grid. ',
  'No storm expected in the next two hours.': 'Tiada ribut dijangka dalam dua jam ini.',
  'Storm watch {time} — your plan is ready below.': 'Pantauan ribut {time} — pelan anda tersedia di bawah.',
  'Storm passing — your solar will recover soon.': 'Ribut sedang berlalu — solar anda akan pulih sebentar lagi.',

  // PrimaryAction
  'What to do now': 'Apa nak buat sekarang',
  'A storm is on the way — act now': 'Ribut menghampiri — bertindak sekarang',
  'A good time to run a flexible load': 'Masa sesuai untuk menggunakan perkakas',
  'Better to wait for now': 'Lebih baik tunggu dahulu',
  'RUN NOW': 'GUNA SEKARANG',
  'WAIT UNTIL {time}': 'TUNGGU {time}',
  'WAIT {time}': 'TUNGGU {time}',
  'free solar': 'solar percuma',
  'you save': 'anda jimat',
  'Free solar': 'Solar percuma',
  'Good timing on these is worth roughly {rm}/month — and the storm watch protects the rest.':
    'Masa yang tepat bernilai kira-kira {rm}/sebulan — dan pantauan ribut melindungi selebihnya.',
  'You run these on your own schedule — we just pick the cheapest window today.':
    'Anda guna ikut jadual sendiri — kami cuma pilih waktu paling jimat hari ini.',
  'Tell us which appliances you own, and we will find their cheapest solar windows every day.':
    'Beritahu kami perkakas yang anda ada, dan kami akan cari waktu solar paling jimat setiap hari.',
  'Add appliances': 'Tambah perkakas',

  // ApplianceCard / list
  Recommendations: 'Cadangan',
  'You run these on your own schedule. When you need one, this is the cheapest window today.':
    'Anda guna ikut jadual sendiri. Bila perlu, inilah waktu paling jimat hari ini.',
  'No schedulable appliances in your setup yet.': 'Belum ada perkakas boleh jadual dalam tetapan anda.',
  'Good window now, best before {time}': 'Waktu baik sekarang, terbaik sebelum {time}',
  'Best window {a}–{b}': 'Waktu terbaik {a}–{b}',
  'On solar': 'Guna solar',
  saved: 'dijimat',
  Accept: 'Terima',
  Reschedule: 'Jadual semula',
  Skip: 'Langkau',
  'Why?': 'Kenapa?',
  'too noisy': 'terlalu bising',
  'not home': 'tiada di rumah',
  'prefer later': 'nanti sahaja',
  'cost concern': 'isu kos',
  other: 'lain-lain',
  'Logged: you accepted this.': 'Direkod: anda terima.',
  'Logged: you skipped this.': 'Direkod: anda langkau.',
  'Logged: you rescheduled this.': 'Direkod: anda jadual semula.',
  'Illustrative tariff.': 'Tarif ilustrasi.',

  // ExplainPanel
  'Tell me less': 'Tutup',
  "This is the reason behind Awan-Cast's recommendation.": 'Inilah sebab di sebalik cadangan Awan-Cast.',
  'This explanation is AI-generated to help you understand the forecast; it does not change the recommendation.':
    'Penjelasan ini dijana oleh AI untuk membantu anda memahami ramalan; ia tidak mengubah cadangan.',

  // Scheduler reasons (static strings)
  'No export is allowed on your scheme, so every unit of solar you use yourself counts.':
    'Skim anda tidak membenarkan eksport, jadi setiap unit solar yang anda guna sendiri berbaloi.',
  'Solar is strong now and a storm is approaching. Run before the storm arrives.':
    'Solar kuat sekarang dan ribut menghampiri. Guna sebelum ribut tiba.',
  "Solar generation is at or above the appliance's draw — running now uses your own power.":
    'Penjanaan solar melebihi keperluan perkakas — guna sekarang bermakna guna kuasa sendiri.',
  'Generation will be higher and cheaper in this window, so waiting saves the most.':
    'Penjanaan lebih tinggi dan murah pada waktu itu, jadi menunggu paling menjimatkan.',

  // Regime + confidence
  'Clear skies': 'Langit cerah',
  'Partial cloud': 'Berawan sebahagian',
  'Storm building': 'Ribut sedang terbentuk',
  'Severe storm': 'Ribut kuat',
  'High confidence': 'Keyakinan tinggi',
  'Good confidence': 'Keyakinan baik',
  'Fair confidence': 'Keyakinan sederhana',
  'Low confidence': 'Keyakinan rendah',

  // ForecastStrip
  'Next 2 hours': '2 jam seterusnya',
  Now: 'Sekarang',
  'Strong sun': 'Matahari terik',
  'Some sun': 'Cerah berawan',
  Cloudy: 'Mendung',
  'Very cloudy': 'Sangat mendung',
  Storm: 'Ribut',
  'More dots means more certain. Storms are naturally the hardest hours to time.':
    'Lebih banyak titik bermaksud lebih pasti. Ribut memang waktu paling sukar dijangka.',

  // NetLoadChart
  'Free-solar windows': 'Waktu solar percuma',
  "Solar minus your home's predicted demand. Green is genuine surplus you can use for free; grey is when the home draws from the grid.":
    'Solar tolak jangkaan penggunaan rumah anda. Hijau ialah lebihan sebenar yang boleh diguna percuma; kelabu ialah masa rumah menarik dari grid.',
  Solar: 'Solar',
  'Home demand (typical day)': 'Penggunaan rumah (hari biasa)',
  'Home demand': 'Penggunaan rumah',
  'Free surplus': 'Lebihan percuma',
  'From grid': 'Dari grid',

  // StormAlertCard
  'Heads up': 'Perhatian',
  'A cloudy spell is likely around {start} to {end}. Your solar will dip for about {mins} minutes, then recover.':
    'Cuaca mendung dijangka sekitar {start} hingga {end}. Solar anda akan menurun kira-kira {mins} minit, kemudian pulih.',
  'Run {names} now, before {time}.': 'Guna {names} sekarang, sebelum {time}.',
  'Hold off the {name} until about {time}.': 'Tangguhkan {name} sehingga kira-kira {time}.',
  'We are at {conf} about this.': '{conf} tentang perkara ini.',
  and: 'dan',
  'Tell me more': 'Terangkan lagi',
  'Clouds are building up nearby, which is how afternoon storms usually start here. We have left a little buffer in the timing because storms are hard to time exactly.':
    'Awan sedang berkumpul berhampiran — begitulah ribut petang biasanya bermula di sini. Kami sediakan sedikit penampan masa kerana ribut sukar dijangka dengan tepat.',

  // SystemCheck
  'System check': 'Semakan sistem',
  "Your system produced {pct}% of what this week's weather allowed — performing as it should.":
    'Sistem anda menghasilkan {pct}% daripada potensi cuaca minggu ini — berfungsi seperti sepatutnya.',
  "Your system produced {pct}% of what this week's weather allowed — {missing}% is missing. Worth checking: dusty panels or an inverter fault.":
    'Sistem anda menghasilkan {pct}% daripada potensi cuaca minggu ini — {missing}% hilang. Patut disemak: panel berhabuk atau masalah inverter.',
  HEALTHY: 'SIHAT',
  CHECK: 'SEMAK',
  'Example reading — in deployment this connects to your inverter and watches your investment automatically.':
    'Bacaan contoh — dalam penggunaan sebenar ia disambung ke inverter anda dan memantau pelaburan anda secara automatik.',

  // MonthlyCard
  'Your month on sunshine': 'Bulan anda dengan cahaya matahari',
  'of your daytime power came from your own roof': 'kuasa siang anda datang dari bumbung sendiri',
  'That puts you in the {rank} of solar homes around {city}.':
    'Anda dalam {rank} rumah solar sekitar {city}.',
  'Example month — fills with your real data over time.':
    'Bulan contoh — akan diisi dengan data sebenar anda dari semasa ke semasa.',
  Share: 'Kongsi',
  Copied: 'Disalin',
  'My home ran {pct}% on sunshine this month in {city} — tracked with Awan-Cast.':
    'Rumah saya berjalan {pct}% dengan cahaya matahari bulan ini di {city} — dipantau dengan Awan-Cast.',

  // FeedbackHistory
  'Your actions': 'Tindakan anda',
  'Saved from advice you accepted': 'Jimat daripada nasihat yang anda terima',
  'Override rate': 'Kadar penolakan',
  "The share of advice you did not accept. Over weeks this is what a deployed system learns from to fit your habits. Savings are estimates from the optimiser's numbers at the time you accepted.":
    'Peratusan nasihat yang anda tidak terima. Dari minggu ke minggu, inilah yang sistem pelajari untuk menyesuaikan tabiat anda. Jimatan ialah anggaran daripada angka pengoptimum semasa anda menerima.',
  Accepted: 'Diterima',
  Skipped: 'Dilangkau',
  Rescheduled: 'Dijadual semula',

  // GuaranteePanel
  'Our promise': 'Janji kami',
  'When we show a range, reality lands inside it': 'Apabila kami tunjukkan julat, realiti berada di dalamnya',
  'at least 9 times out of 10': 'sekurang-kurangnya 9 daripada 10 kali',
  '. That is a mathematical property of how the range is built — not a hope.':
    '. Itu sifat matematik cara julat ini dibina — bukan harapan.',
  'Measured on real data: 94 out of 100 during storms, and our storm warnings beat the standard method on 96.6% of 261 test days.':
    'Diukur pada data sebenar: 94 daripada 100 semasa ribut, dan amaran ribut kami mengatasi kaedah biasa pada 96.6% daripada 261 hari ujian.',
  'How can you promise that?': 'Bagaimana boleh janji begitu?',
  'Before showing a range, Awan-Cast checks how far off its recent forecasts were, and widens the range until it would have covered at least 9 of the last 10. Storms automatically get wider ranges. Statisticians call this conformal prediction — the promise holds by construction, however strange the weather gets.':
    'Sebelum menunjukkan julat, Awan-Cast menyemak sejauh mana ramalan terkininya tersasar, dan melebarkan julat sehingga ia meliputi sekurang-kurangnya 9 daripada 10 yang terkini. Ribut diberi julat lebih lebar secara automatik. Ahli statistik memanggilnya conformal prediction — janji ini terpakai walau seganjil mana pun cuaca.',
  'See the evidence': 'Lihat bukti',

  // CloudMap
  'Live cloud · Himawari-9': 'Awan langsung · Himawari-9',
  'Sky now': 'Langit sekarang',

  // SetupModal
  'Your home': 'Rumah anda',
  'Set up Awan-Cast': 'Sediakan Awan-Cast',
  'Awan-Cast tailors its advice to your home. This stays in your browser — no account needed.':
    'Awan-Cast menyesuaikan nasihatnya dengan rumah anda. Semuanya kekal dalam pelayar anda — tiada akaun diperlukan.',
  'Not sure about any of this? Use a typical Malaysian home': 'Tak pasti? Guna profil rumah Malaysia biasa',
  'You can fine-tune everything later from Edit setup.':
    'Anda boleh laraskan semuanya kemudian melalui Ubah tetapan.',
  'Solar size (kWp)': 'Saiz solar (kWp)',
  'Battery (kWh)': 'Bateri (kWh)',
  People: 'Penghuni',
  Small: 'Kecil',
  Typical: 'Biasa',
  Large: 'Besar',
  None: 'Tiada',
  Big: 'Besar',
  'Tariff scheme': 'Skim tarif',
  'set by your region': 'ikut wilayah anda',
  'Appliances you own': 'Perkakas yang anda ada',
  '{n} selected': '{n} dipilih',
  'Search appliances…': 'Cari perkakas…',
  'No matches.': 'Tiada padanan.',
  'schedulable': 'boleh dijadualkan',
  'Work from home on weekdays (raises daytime demand)':
    'Bekerja dari rumah pada hari bekerja (menambah penggunaan siang)',
  Cancel: 'Batal',
  'Save setup': 'Simpan tetapan',

  // Appliance catalogue
  Dishwasher: 'Mesin basuh pinggan',
  'Washing machine': 'Mesin basuh',
  'Clothes dryer': 'Pengering baju',
  'Water heater': 'Pemanas air',
  'Pool pump': 'Pam kolam',
  'Water pump': 'Pam air',
  'EV charger': 'Pengecas EV',
  'Air conditioner': 'Penghawa dingin',
  Fan: 'Kipas',
  Refrigerator: 'Peti sejuk',
  Microwave: 'Ketuhar gelombang mikro',
  Oven: 'Ketuhar',
  'Rice cooker': 'Periuk nasi',
  'Electric kettle': 'Cerek elektrik',
  Television: 'Televisyen',
  Computer: 'Komputer',
  'Wi-Fi router': 'Penghala Wi-Fi',
  Lighting: 'Lampu',
  Kitchen: 'Dapur',
  Laundry: 'Dobi',
  Water: 'Air',
  Vehicle: 'Kenderaan',
  Cooling: 'Penyejukan',
  Electronics: 'Elektronik',
};

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  let out = s;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

/** Translate an English source string into the active language (falls back to English). */
export function translate(lang: Lang, s: string, vars?: Record<string, string | number>): string {
  return interpolate(lang === 'ms' ? MS[s] ?? s : s, vars);
}

/** Hook form: `const t = useT()` then `t('Right now')`. */
export function useT() {
  const lang = useAppStore((s) => s.lang);
  return useCallback(
    (s: string, vars?: Record<string, string | number>) => translate(lang, s, vars),
    [lang],
  );
}
