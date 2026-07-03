import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchTodayBranchLocks, type BranchLockMap } from '../lib/branchLocks';

/** Subscribes to inspection changes and refreshes today's branch locks. */
export function useBranchLocksRealtime(
  branchTypeId: string | null,
  currentOfficerRolesId: string | null,
) {
  const [locks, setLocks] = useState<BranchLockMap>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!branchTypeId) return;
    setLoading(true);
    const map = await fetchTodayBranchLocks(branchTypeId, currentOfficerRolesId);
    setLocks(map);
    setLoading(false);
  }, [branchTypeId, currentOfficerRolesId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!branchTypeId) return;

    const channel = supabase
      .channel(`branch-locks-${branchTypeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inspections' },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branchTypeId, refresh]);

  return { locks, loading, refresh };
}
