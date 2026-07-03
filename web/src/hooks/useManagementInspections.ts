import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { fetchManagementInspections } from '../lib/inspectionQueries';

/** Shared inspection dataset for live dashboard + archives. Realtime-invalidated. */
export function useManagementInspections() {
  const { user, loading: authLoading } = useAuth();

  return useQuery({
    queryKey: ['inspections', 'management'],
    queryFn: fetchManagementInspections,
    enabled: !authLoading && !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
