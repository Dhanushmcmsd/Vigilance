import { QueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

export function setupRealtimeSubscription(
  onNewInspection?: (payload: Record<string, unknown>) => void
) {
  if (realtimeChannel) return realtimeChannel;

  realtimeChannel = supabase
    .channel('inspections-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'inspections' },
      (payload) => {
        queryClient.invalidateQueries({ queryKey: ['inspections'] });
        queryClient.invalidateQueries({ queryKey: ['inspections-stats'] });
        if (onNewInspection) {
          onNewInspection(payload as Record<string, unknown>);
        }
      }
    )
    .subscribe();

  return realtimeChannel;
}

export function teardownRealtimeSubscription() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}
