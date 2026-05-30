import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { AccountRequestRow, PrefillNewUser } from '../../types/accountRequest';

type RequestFilter = 'pending' | 'history';

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface AccountRequestsTabProps {
  onApprove: (prefill: PrefillNewUser) => void;
}

export function AccountRequestsTab({ onApprove }: AccountRequestsTabProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState<RequestFilter>('pending');
  const [rejecting, setRejecting] = useState<AccountRequestRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: requests = [], isLoading } = useQuery<AccountRequestRow[]>({
    queryKey: ['account-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_requests')
        .select('*')
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === 'pending').length,
    [requests],
  );

  const visible = useMemo(() => {
    if (filter === 'pending') return requests.filter((r) => r.status === 'pending');
    return requests.filter((r) => r.status !== 'pending');
  }, [requests, filter]);

  const reviewMutation = useMutation({
    mutationFn: async (args: {
      id: string;
      status: 'approved' | 'rejected';
      rejection_reason?: string | null;
    }) => {
      const { error } = await supabase
        .from('account_requests')
        .update({
          status: args.status,
          rejection_reason: args.rejection_reason ?? null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id ?? null,
        })
        .eq('id', args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['account-requests'] });
      qc.invalidateQueries({ queryKey: ['admin-pending-request-count'] });
    },
  });

  const handleReject = async () => {
    if (!rejecting) return;
    await reviewMutation.mutateAsync({
      id: rejecting.id,
      status: 'rejected',
      rejection_reason: rejectReason.trim() || null,
    });
    setRejecting(null);
    setRejectReason('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {pendingCount} pending request{pendingCount === 1 ? '' : 's'}. No email is sent — review here and create users manually.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${
              filter === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            Pending {pendingCount > 0 ? `(${pendingCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setFilter('history')}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${
              filter === 'history' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            History
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading requests…</p>
      ) : visible.length === 0 ? (
        <p className="text-gray-500 py-8 text-center">
          {filter === 'pending' ? 'No pending account requests.' : 'No reviewed requests yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Name', 'Email', 'Designation', 'Branch', 'Note', 'Submitted', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="th">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {visible.map((r) => (
                <tr key={r.id} className="tr">
                  <td className="td font-medium">{r.full_name}</td>
                  <td className="td text-gray-500">{r.email}</td>
                  <td className="td text-gray-500">{r.designation || '—'}</td>
                  <td className="td text-gray-500">{r.branch_hint || '—'}</td>
                  <td className="td text-gray-500 max-w-[200px] truncate" title={r.note ?? undefined}>
                    {r.note || '—'}
                  </td>
                  <td className="td text-gray-400 whitespace-nowrap">{formatWhen(r.submitted_at)}</td>
                  <td className="td">
                    <span
                      className={`badge ${
                        r.status === 'pending'
                          ? 'badge-blue'
                          : r.status === 'approved'
                            ? 'badge-green'
                            : 'badge-red'
                      }`}
                    >
                      {r.status}
                    </span>
                    {r.rejection_reason && (
                      <p className="text-xs text-gray-400 mt-1 max-w-[160px]" title={r.rejection_reason}>
                        {r.rejection_reason}
                      </p>
                    )}
                  </td>
                  <td className="td">
                    {r.status === 'pending' ? (
                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          className="btn-xs btn-xs-green"
                          onClick={() =>
                            onApprove({
                              name: r.full_name,
                              email: r.email,
                              branchHint: r.branch_hint ?? undefined,
                              requestId: r.id,
                            })
                          }
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn-xs btn-xs-red"
                          onClick={() => {
                            setRejecting(r);
                            setRejectReason('');
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {r.reviewed_at ? formatWhen(r.reviewed_at) : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-bold text-lg">Reject request</h3>
            <p className="text-sm text-gray-500">
              {rejecting.full_name} ({rejecting.email})
            </p>
            <textarea
              className="input w-full min-h-[72px]"
              placeholder="Optional reason (shown in history only)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setRejecting(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
                disabled={reviewMutation.isPending}
                onClick={() => void handleReject()}
              >
                {reviewMutation.isPending ? 'Rejecting…' : 'Confirm reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Badge count for admin nav — exported for AdminPanel tab label. */
export function usePendingAccountRequestCount() {
  return useQuery({
    queryKey: ['admin-pending-request-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('account_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
}
