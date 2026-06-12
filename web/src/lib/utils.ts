import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * `cn` — shadcn/ui convention for composing Tailwind class strings.
 * Use this anywhere you need to conditionally combine classes; it both
 * de-duplicates conflicting utilities (via tailwind-merge) and skips
 * falsy values (via clsx).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sortStoresByRecency<
  T extends {
    updated_at?: string | null;
    last_inspection_date?: string | null;
    created_at?: string | null;
  },
>(stores: T[]): T[] {
  return [...stores].sort((a, b) => {
    const dateA = new Date(a.updated_at ?? a.last_inspection_date ?? a.created_at ?? 0).getTime();
    const dateB = new Date(b.updated_at ?? b.last_inspection_date ?? b.created_at ?? 0).getTime();
    return dateB - dateA;
  });
}
