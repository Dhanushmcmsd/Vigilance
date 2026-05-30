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

  const invalidateInspectionData = () => {
    queryClient.invalidateQueries({ queryKey: ['inspections'] });
    queryClient.invalidateQueries({ queryKey: ['branch-detail'] });
    queryClient.invalidateQueries({ queryKey: ['pending-count'] });
  };

  realtimeChannel = supabase
    .channel('vms-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inspections' }, (payload) => {
      invalidateInspectionData();
      onNewInspection?.(payload as Record<string, unknown>);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inspection_responses' }, () => {
      invalidateInspectionData();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inspection_files' }, () => {
      invalidateInspectionData();
    })
    .subscribe();

  return realtimeChannel;
}

export function teardownRealtimeSubscription() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}
