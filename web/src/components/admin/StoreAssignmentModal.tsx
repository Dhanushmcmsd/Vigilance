import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface BranchRow {
  id: string;
  branch_name: string;
  location: string | null;
  city: string | null;
  region: string | null;
  assigned_officer_id: string | null;
}

interface OfficerInfo {
  id: string;
  name: string;
  user_id: string | null;
}

export function StoreAssignmentModal({
  officer,
  district,
  onClose,
  onSaved,
}: {
  officer: OfficerInfo;
  district: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [assignedSearch, setAssignedSearch] = useState('');
  const [availableSearch, setAvailableSearch] = useState('');
  const [pendingAssigned, setPendingAssigned] = useState<Set<string>>(new Set());
  const [pendingAvailable, setPendingAvailable] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: branches = [], refetch } = useQuery<BranchRow[]>({
    queryKey: ['all-branches-assignment'],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('branches')
        .select('id, branch_name, location, city, region, assigned_officer_id')
        .eq('is_active', true)
        .order('region', { ascending: true })
        .order('branch_name', { ascending: true });
      if (err) throw err;
      return data ?? [];
    },
  });

  const officerUserId = officer.user_id;

  const assignedStores = useMemo(() => {
    return branches.filter((b) => {
      if (pendingAvailable.has(b.id)) return false;
      if (pendingAssigned.has(b.id)) return true;
      return b.assigned_officer_id === officerUserId;
    });
  }, [branches, officerUserId, pendingAssigned, pendingAvailable]);

  const availableStores = useMemo(() => {
    return branches.filter((b) => {
      if (pendingAssigned.has(b.id)) return false;
      if (pendingAvailable.has(b.id)) return true;
      return b.assigned_officer_id !== officerUserId;
    });
  }, [branches, officerUserId, pendingAssigned, pendingAvailable]);

  const filterBranches = (list: BranchRow[], query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (b) =>
        b.branch_name.toLowerCase().includes(q) ||
        (b.city ?? '').toLowerCase().includes(q) ||
        (b.location ?? '').toLowerCase().includes(q) ||
        (b.region ?? '').toLowerCase().includes(q),
    );
  };

  const groupedAvailableStores = useMemo(() => {
    const filtered = filterBranches(availableStores, availableSearch);
    const groups = new Map<string, BranchRow[]>();
    filtered.forEach((store) => {
      const key = store.region ?? 'Unassigned';
      const list = groups.get(key) ?? [];
      list.push(store);
      groups.set(key, list);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [availableStores, availableSearch]);

  const markRemove = (branchId: string) => {
    setPendingAvailable((prev) => new Set(prev).add(branchId));
    setPendingAssigned((prev) => {
      const next = new Set(prev);
      next.delete(branchId);
      return next;
    });
  };

  const markAssign = (branchId: string) => {
    setPendingAssigned((prev) => new Set(prev).add(branchId));
    setPendingAvailable((prev) => {
      const next = new Set(prev);
      next.delete(branchId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!officerUserId) {
      setError('Officer account is not linked to an auth user.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { data: authData } = await supabase.auth.getUser();
      const adminId = authData.user?.id ?? null;

      for (const branchId of pendingAssigned) {
        const branch = branches.find((b) => b.id === branchId);
        if (!branch) continue;
        const fromOfficerId = branch.assigned_officer_id;

        await supabase
          .from('branches')
          .update({
            assigned_officer_id: officerUserId,
            assigned_officer_name: officer.name,
          })
          .eq('id', branchId);

        await supabase.from('store_officer_assignments').insert({
          branch_id: branchId,
          from_officer_id: fromOfficerId,
          to_officer_id: officerUserId,
          assigned_by: adminId,
          notes: `Assigned to ${officer.name}`,
        });

        await supabase.from('notifications').insert({
          recipient_id: officerUserId,
          type: 'store_assigned',
          title: 'New Store Assigned',
          body: `${branch.branch_name} has been assigned to you`,
          link: '/officer',
        });
      }

      for (const branchId of pendingAvailable) {
        const branch = branches.find((b) => b.id === branchId);
        if (!branch) continue;

        await supabase
          .from('branches')
          .update({ assigned_officer_id: null, assigned_officer_name: null })
          .eq('id', branchId);

        await supabase.from('store_officer_assignments').insert({
          branch_id: branchId,
          from_officer_id: officerUserId,
          to_officer_id: null,
          assigned_by: adminId,
          notes: `Removed from ${officer.name}`,
        });
      }

      setPendingAssigned(new Set());
      setPendingAvailable(new Set());
      await refetch();
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-modal)', color: 'var(--text-primary)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg" style={{ color: 'var(--text-heading)' }}>
            Manage Stores — {officer.name}
          </h3>
          <button type="button" onClick={onClose} className="admin-btn-secondary" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
          <div
            className="flex flex-col min-h-0 rounded-xl p-3"
            style={{ border: '1px solid var(--border-color)' }}
          >
            <h4 className="font-semibold text-sm mb-2" style={{ color: 'var(--text-heading)' }}>
              Currently Assigned Stores
            </h4>
            <input
              className="input w-full mb-2"
              placeholder="Search assigned stores..."
              value={assignedSearch}
              onChange={(e) => setAssignedSearch(e.target.value)}
            />
            <div className="overflow-y-auto flex-1 space-y-2">
              {filterBranches(assignedStores, assignedSearch).map((store) => (
                <div
                  key={store.id}
                  className="flex items-center justify-between gap-2 rounded-lg p-2"
                  style={{ border: '1px solid var(--border-color)' }}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{store.branch_name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {store.location || store.city || store.region || district}
                    </p>
                  </div>
                  <button type="button" className="admin-btn-destructive" onClick={() => markRemove(store.id)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div
            className="flex flex-col min-h-0 rounded-xl p-3"
            style={{ border: '1px solid var(--border-color)' }}
          >
            <h4 className="font-semibold text-sm mb-2" style={{ color: 'var(--text-heading)' }}>
              Available Stores (All Districts)
            </h4>
            <input
              className="input w-full mb-2"
              placeholder="Search by name, city, or district..."
              value={availableSearch}
              onChange={(e) => setAvailableSearch(e.target.value)}
            />
            <div className="overflow-y-auto flex-1 space-y-2">
              {groupedAvailableStores.map(([districtName, stores]) => (
                <div key={districtName}>
                  <div className="district-group-label">{districtName}</div>
                  {stores.map((store) => (
                    <div
                      key={store.id}
                      className="flex items-center justify-between gap-2 rounded-lg p-2 mb-2"
                      style={{ border: '1px solid var(--border-color)' }}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{store.branch_name}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                          {store.location || store.city || districtName}
                        </p>
                      </div>
                      <button type="button" className="admin-btn-primary" onClick={() => markAssign(store.id)}>
                        Assign
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}

        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onClose} className="admin-btn-secondary flex-1">
            Close
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="admin-btn-primary flex-1"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
