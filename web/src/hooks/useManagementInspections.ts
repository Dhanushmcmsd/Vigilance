import { useQuery } from '@tanstack/react-query';
import { fetchManagementInspections } from '../lib/inspectionQueries';

/** Shared inspection dataset for live dashboard + archives. Realtime-invalidated. */
export function useManagementInspections() {
  return useQuery({
    queryKey: ['inspections', 'management'],
    queryFn: fetchManagementInspections,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
