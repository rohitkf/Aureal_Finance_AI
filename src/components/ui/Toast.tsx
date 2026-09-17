import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';

/* eslint-disable react-refresh/only-export-components -- the toast provider and its hook belong together. */

type ToastTone = 'success' | 'info' | 'danger';

interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

const ToastContext = createContext<{ push: (t: Omit<Toast, 'id'>) => void } | null>(null);

const TONE_STYLES: Record<ToastTone, { icon: IconName; className: string }> = {
  success: { icon: 'check-circle', className: 'text-success' },
  info: { icon: 'info', className: 'text-primary' },
  danger: { icon: 'alert', className: 'text-danger' },
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-24 z-[120] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end"
        >
          {toasts.map((t) => {
            const tone = TONE_STYLES[t.tone];
            return (
              <div
                key={t.id}
                className="plate pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3.5 p-4"
              >
                <Icon name={tone.icon} size={18} className={cn('mt-0.5 shrink-0', tone.className)} />
                <div className="min-w-0">
                  <p className="text-body-md font-semibold text-text">{t.title}</p>
                  {t.description && <p className="text-body-sm text-muted">{t.description}</p>}
                </div>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx.push;
};
