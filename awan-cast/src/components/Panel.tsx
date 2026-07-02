import type { ReactNode } from 'react';

interface PanelProps {
  label?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: 'normal' | 'tight' | 'flush';
  dataTour?: string;
}

const PADDING: Record<NonNullable<PanelProps['padding']>, string> = {
  normal: 'p-4 lg:p-5',
  tight: 'p-3 lg:p-4',
  flush: 'p-0',
};

export function Panel({ label, action, children, className = '', padding = 'normal', dataTour }: PanelProps) {
  return (
    <section data-tour={dataTour} className={`panel ${PADDING[padding]} ${className}`}>
      {(label || action) && (
        <header className="mb-3 flex items-center justify-between">
          {label && <div className="label-eyebrow">{label}</div>}
          {action && <div className="flex items-center gap-2">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
