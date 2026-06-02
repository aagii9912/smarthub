'use client';

import { X, type LucideIcon } from 'lucide-react';

export interface StatusOption {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

interface OrderStatusModalProps {
  open: boolean;
  title: string;
  /** Currently active status — its button is highlighted and disabled. */
  currentStatus?: string | null;
  statusOptions: StatusOption[];
  cancelLabel: string;
  onSelect: (status: string) => void;
  onClose: () => void;
}

/**
 * Захиалгын төлөв солих popup цонх.
 * Нэг товшилтоор нээгдэж, төлвийг сонгоход шууд хаагдана.
 * Нэг захиалга (single) болон бөөнөөр (bulk) солиход хоёуланд нь ашиглагдана.
 */
export function OrderStatusModal({
  open,
  title,
  currentStatus,
  statusOptions,
  cancelLabel,
  onSelect,
  onClose,
}: OrderStatusModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl border border-white/[0.08] w-full max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground tracking-[-0.02em]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-white/40 hover:text-foreground hover:bg-white/[0.06] transition-colors"
            aria-label={cancelLabel}
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {statusOptions.map((status) => {
            const Icon = status.icon;
            const isActive = currentStatus === status.value;

            return (
              <button
                key={status.value}
                onClick={() => onSelect(status.value)}
                disabled={isActive}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-[13px] font-medium transition-all tracking-[-0.01em] border ${
                  isActive
                    ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_14%,transparent)] border-[var(--brand-indigo)]/40 text-[var(--brand-indigo)] cursor-default'
                    : 'bg-[var(--panel-bg,#0F0B2E)] border-white/[0.06] text-white/70 hover:bg-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${status.color}`} />
                <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                <span className="truncate">{status.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-2.5 text-[13px] text-white/40 hover:text-foreground transition-colors tracking-[-0.01em]"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
