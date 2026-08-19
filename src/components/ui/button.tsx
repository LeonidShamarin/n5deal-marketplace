import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The pill button from the reference site: fully rounded, 600 weight, and a
 * blue-tinted shadow under the primary variant rather than a neutral grey one.
 */
const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors " +
    "disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white shadow-[var(--shadow-brand)] hover:bg-brand-hover",
        outline: "border border-brand bg-white text-brand hover:bg-brand-soft",
        dark: "bg-ink text-white hover:bg-ink/90",
        subtle: "bg-panel text-ink border border-line hover:bg-white hover:border-line-strong",
        danger: "bg-danger text-white hover:bg-danger/90",
        dangerOutline: "border border-danger/40 bg-white text-danger hover:bg-danger-soft",
        ghost: "text-muted hover:text-ink hover:bg-panel",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-base",
        lg: "h-12 px-6 text-base",
        icon: "h-9 w-9 p-0",
      },
      full: {
        true: "w-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & { children?: ReactNode };

export function Button({ className, variant, size, full, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size, full }), className)} {...props} />;
}

export { button as buttonStyles };
