export function formatTimeMyt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-MY', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kuala_Lumpur',
  });
}

export function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-MY', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kuala_Lumpur',
  });
}

export function formatDateMyt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kuala_Lumpur',
  });
}

export function formatRm(value: number): string {
  return `RM ${value.toFixed(2)}`;
}

/** Whole-ringgit with thousand separators, for large figures (e.g. RM 75,165). */
export function formatRm0(value: number): string {
  return `RM ${Math.round(value).toLocaleString('en-MY')}`;
}

export function formatKw(value: number): string {
  return value.toFixed(value >= 10 ? 0 : 1);
}
