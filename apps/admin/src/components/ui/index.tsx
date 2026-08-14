import type * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * The shared primitives.
 *
 * Written once here and reused by every later phase, so a member list in
 * Phase 1 and a reconciliation report in Phase 9 look and behave the same
 * without either of them re-deciding what a button is.
 */

// --- Button ---------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)] shadow-sm',
  secondary: 'surface border border-[var(--color-border)] hover:surface-2 text-[var(--color-fg)]',
  ghost: 'hover:surface-2 text-[var(--color-fg)]',
  danger: 'bg-[var(--color-denied)] text-white hover:opacity-90 shadow-sm',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ className, variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

// --- Card -----------------------------------------------------------------

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'surface rounded-[var(--radius-card)] border border-[var(--color-border)] shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('border-b border-[var(--color-border)] px-5 py-4', className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('font-semibold text-base', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}

// --- Form fields ----------------------------------------------------------

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: generic wrapper; callers pass htmlFor (see Field)
    <label className={cn('block font-medium text-sm', className)} {...props} />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-lg border border-[var(--color-border)] surface px-3 text-sm',
        'placeholder:text-[var(--color-fg-muted)]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-lg border border-[var(--color-border)] surface px-3 text-sm',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  errors?: string[];
  required?: boolean;
  children: React.ReactNode;
}

/** Label + control + hint + field errors, so every form reports failures identically. */
export function Field({ label, htmlFor, hint, errors, required, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-[var(--color-denied)]">*</span> : null}
      </Label>
      {children}
      {hint && !errors?.length ? <p className="text-muted text-xs">{hint}</p> : null}
      {errors?.length ? (
        <p className="text-[var(--color-denied)] text-xs">{errors.join('. ')}</p>
      ) : null}
    </div>
  );
}

// --- Badge ----------------------------------------------------------------

type BadgeTone = 'neutral' | 'primary' | 'success' | 'danger' | 'warning';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'surface-2 text-[var(--color-fg-muted)] border-[var(--color-border)]',
  primary:
    'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20',
  success:
    'bg-[var(--color-granted)]/10 text-[var(--color-granted)] border-[var(--color-granted)]/20',
  danger: 'bg-[var(--color-denied)]/10 text-[var(--color-denied)] border-[var(--color-denied)]/20',
  warning:
    'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/20',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-xs',
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

// --- Avatar ---------------------------------------------------------------

const AVATAR_SIZES = {
  sm: { box: 'h-8 w-8 text-[10px]', px: 32 },
  md: { box: 'h-10 w-10 text-xs', px: 40 },
  lg: { box: 'h-24 w-24 text-2xl', px: 96 },
} as const;

/**
 * A member's photo, or their initials when there is none.
 *
 * A plain <img>, not next/image: there is no images config in next.config.ts,
 * and the optimizer bills per source image — pointless for a 40px avatar in a
 * list of hundreds. Explicit width/height still prevents the layout shift that
 * is next/image's real benefit here.
 */
export function Avatar({
  src,
  name,
  size = 'md',
  className,
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  const { box, px } = AVATAR_SIZES[size];
  const shared = cn(
    'shrink-0 overflow-hidden rounded-full border border-[var(--color-border)]',
    box,
    className,
  );

  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={px}
        height={px}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={cn(shared, 'object-cover')}
      />
    );
  }

  return (
    <span
      className={cn(shared, 'surface-2 text-muted flex items-center justify-center font-medium')}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

// --- Table ----------------------------------------------------------------

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'border-[var(--color-border)] border-b px-4 py-2.5 text-left font-medium text-muted text-xs uppercase tracking-wide',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('border-[var(--color-border)] border-b px-4 py-3 align-middle', className)}
      {...props}
    />
  );
}

// --- Page furniture -------------------------------------------------------

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-muted text-sm">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] border-dashed px-6 py-16 text-center">
      <p className="font-medium">{title}</p>
      {body ? <p className="mt-1 max-w-md text-muted text-sm">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Alert({
  tone = 'warning',
  children,
}: {
  tone?: 'warning' | 'danger' | 'info';
  children: React.ReactNode;
}) {
  const tones = {
    warning:
      'border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
    danger:
      'border-[var(--color-denied)]/30 bg-[var(--color-denied)]/10 text-[var(--color-denied)]',
    info: 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
  };
  return (
    <div className={cn('rounded-lg border px-4 py-3 text-sm', tones[tone])} role="status">
      {children}
    </div>
  );
}
