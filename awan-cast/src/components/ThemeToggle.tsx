import { Sun, Moon } from 'lucide-react';
import { useAppStore } from '../state/useAppStore';

export function ThemeToggle() {
  const theme = useAppStore((s) => s.theme);
  const toggle = useAppStore((s) => s.toggleTheme);
  const Icon = theme === 'light' ? Sun : Moon;

  return (
    <button
      type="button"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      onClick={toggle}
      className="hidden h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-panel text-ink-muted transition-colors duration-200 ease-apple hover:text-ink md:inline-flex"
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} />
    </button>
  );
}
