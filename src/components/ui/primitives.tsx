import { cva, type VariantProps } from "class-variance-authority";
import type {
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The labelled attribute cell that makes up the grid on an asset card. On the
 * reference site every fact about an asset is one of these, which is what makes
 * two listings comparable at a glance.
 */
export function AttributeCell({
  label,
  value,
  emphasis = false,
  tone = "default",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  /** Used for the asking price, which is the one cell that carries a tint. */
  emphasis?: boolean;
  tone?: "default" | "success" | "danger" | "muted";
  className?: string;
}) {
  const valueTone = {
    default: "text-ink",
    success: "text-success",
    danger: "text-danger",
    muted: "text-muted",
  }[tone];

  return (
    <div
      className={cn(
        "min-w-0 px-3 py-2",
        emphasis
          ? "rounded-[var(--radius-cell)] border border-brand-border bg-panel"
          : "border-line",
        className,
      )}
    >
      <div className="truncate text-[13px] font-medium text-muted">{label}</div>
      <div
        className={cn(
          "truncate text-[15px] font-semibold tabular",
          emphasis ? "text-brand" : valueTone,
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badges and chips
// ---------------------------------------------------------------------------

const badge = cva(
  "inline-flex items-center gap-1 rounded-full text-[12px] font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-panel text-muted border border-line",
        brand: "bg-brand-soft text-brand border border-brand-border",
        success: "bg-success-soft text-success border border-success/20",
        danger: "bg-danger-soft text-danger border border-danger/20",
        warning: "bg-warning-soft text-warning border border-warning/20",
        ink: "bg-ink text-white",
      },
      size: {
        sm: "px-2 py-0.5",
        md: "px-3 py-1 text-[13px]",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>;

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone, size }), className)} {...props} />;
}

/** The "Included" pills under an asset card. */
export function Chip({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-line bg-panel px-3 py-1 " +
          "text-[13px] font-medium text-ink",
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

const control =
  "w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink " +
  "placeholder:text-faint transition-colors hover:border-line-strong " +
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 " +
  "disabled:cursor-not-allowed disabled:bg-panel disabled:text-faint " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-28 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(control, "h-11 cursor-pointer appearance-none pr-9", className)}
      {...props}
    />
  );
}

/**
 * Label + control + error, wired together by id so that clicking the label
 * focuses the field and a screen reader announces the error with it.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | string[];
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const messages = error === undefined ? [] : Array.isArray(error) ? error : [error];

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-[14px] font-semibold text-ink">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>
      {children}
      {hint && messages.length === 0 ? (
        <p className="text-[13px] text-muted">{hint}</p>
      ) : null}
      {messages.length > 0 ? (
        <p id={`${id}-error`} className="text-[13px] font-medium text-danger">
          {messages.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page furniture
// ---------------------------------------------------------------------------

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-tight text-ink">{title}</h1>
        {description ? (
          <p className="mt-1 text-[15px] text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * Empty states are a requirement, not decoration: every list in this app has one,
 * so that "no results" never looks like "the page is broken".
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-panel px-6 py-14 text-center">
      {icon ? <div className="mb-3 flex justify-center text-faint">{icon}</div> : null}
      <p className="text-[17px] font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-md text-[15px] text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
