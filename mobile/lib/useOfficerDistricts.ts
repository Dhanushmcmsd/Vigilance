import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

/** Districts assigned to the logged-in officer via district_assignments. */
export function useOfficerDistricts(userRolesId: string | null) {
  return useQuery<string[]>({
    queryKey: ['officer-districts', userRolesId],
    enabled: !!userRolesId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('district_assignments')
        .select('district')
        .eq('officer_id', userRolesId!);
      if (error) throw error;
      return [...new Set((data ?? []).map((r) => r.district).filter(Boolean))];
    },
  });
}
