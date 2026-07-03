/**
 * Shared TanStack Query client for the mobile app.
 *
 * Defaults tuned for an offline-first field-officer use case:
 *   - retry: 2 (network blips are common, but don't burn battery)
 *   - staleTime: 60s (avoid refetch storms when navigating between screens)
 *   - gcTime: 30m (keep checklists / branches around so drafts work offline)
 *   - refetchOnReconnect: true (paired with useNetworkSync for write flushes)
 *   - refetchOnWindowFocus: false (mobile doesn't have window focus)
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 15_000),
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});
