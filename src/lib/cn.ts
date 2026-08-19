import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names so that a caller's utility wins over a component's default
 * for the same property — `cn("px-4", "px-6")` yields "px-6" rather than both.
 * Without this, every variant prop would need its own conditional.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
