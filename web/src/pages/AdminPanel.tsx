import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { supabase } from '../lib/supabase';
import { branchSchema, type BranchFormValues } from '../lib/schemas';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../components/ui/form';
import { AccountRequestsTab, usePendingAccountRequestCount } from './admin/AccountRequestsTab';
import type { PrefillNewUser } from '../types/accountRequest';

type Tab = 'users' | 'account-requests' | 'checklists' | 'branches' | 'reports';
type ChecklistSubTab = 'CFC' | 'Store' | 'Common';

// ─── Types ───────────────────────────────────────────────────────────────────
interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string;
  is_active: boolean;
  created_at: string;
}

type RiskLevel = 'RED' | 'YELLOW' | 'GREEN';

interface ChecklistItem {
  id: string;
  section: string;
  item_text: string;
  item_order: number;
  /** Derived view of branch_type_id: 'CFC' | 'Store' | 'Common' (= branch_type_id IS NULL). */
  applicable_to: ChecklistSubTab;
  branch_type_id: string | null;
  is_active: boolean;
  risk_classification?: RiskClassificationRow | null;
}

interface BranchTypeRow {
  id: string;
  type_name: 'CFC' | 'Store' | string;
}

interface RiskClassificationRow {
  id?: string;
  checklist_item_id: string;
  risk_level: RiskLevel;
  trigger_on_no: boolean;
  statutory_act: string | null;
  legal_notes: string | null;
  requires_photo: boolean;
  min_remark_chars: number;
}

const RISK_PILL: Record<RiskLevel, string> = {
  RED: 'bg-red-100 text-red-700 border border-red-200',
  YELLOW: 'bg-amber-100 text-amber-700 border border-amber-200',
  GREEN: 'bg-green-100 text-green-700 border border-green-200',
};

const RISK_TEXT: Record<RiskLevel, string> = {
  RED: 'text-red-600',
  YELLOW: 'text-amber-600',
  GREEN: 'text-green-600',
};

interface Branch {
  id: string;
  name: string;
  branch_type: string;
  location: string;
  city: string;
  region: string;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
  geofence_radius: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Password generation lives in the `admin-create-user` Edge Function — the
// browser must never see / generate auth credentials directly.

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── AdminPanel ───────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('users');
  const [userPrefill, setUserPrefill] = useState<PrefillNewUser | null>(null);
  const { data: pendingRequestCount = 0 } = usePendingAccountRequestCount();

  const tabs: { key: Tab; label: string }[] = [
    { key: 'users', label: 'Users' },
    {
      key: 'account-requests',
      label: pendingRequestCount > 0 ? `Requests (${pendingRequestCount})` : 'Requests',
    },
    { key: 'checklists', label: 'Checklists' },
    { key: 'branches', label: 'Branches' },
    { key: 'reports', label: 'Reports' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium rounded-t transition-colors ${
              tab === t.key
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'users' && (
          <UsersTab
            prefill={userPrefill}
            onClearPrefill={() => setUserPrefill(null)}
          />
        )}
        {tab === 'account-requests' && (
          <AccountRequestsTab
            onApprove={(prefill) => {
              setUserPrefill(prefill);
              setTab('users');
            }}
          />
        )}
        {tab === 'checklists' && <ChecklistsTab />}
        {tab === 'branches' && <BranchesTab />}
        {tab === 'reports' && <ReportsTab />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — USERS
// ══════════════════════════════════════════════════════════════════════════════
function UsersTab({
  prefill,
  onClearPrefill,
}: {
  prefill: PrefillNewUser | null;
  onClearPrefill: () => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState('');

  React.useEffect(() => {
    if (prefill) {
      setShowAdd(true);
    }
  }, [prefill]);

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id, email, name, role, phone, is_active, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // Soft delete pattern: when deactivating, also stamp deleted_at so we
      // can distinguish "temporarily disabled" from "removed from the org"
      // when running audit queries later. Re-activating clears it.
      const { error } = await supabase
        .from('user_roles')
        .update({ is_active, deleted_at: is_active ? null : new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const exportUsersCsv = () => {
    const header = ['name', 'email', 'role', 'phone', 'status', 'created_at'];
    const rows = filtered.map((u) =>
      [
        u.name,
        u.email,
        u.role,
        u.phone ?? '',
        u.is_active ? 'active' : 'inactive',
        u.created_at,
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-64"
          />
          <select
            className="input w-40"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by role"
          >
            <option value="all">All roles</option>
            <option value="officer">Officer</option>
            <option value="head">Head</option>
            <option value="management">Management</option>
            <option value="admin">Admin</option>
            <option value="audit">Audit</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={exportUsersCsv} className="btn-secondary">
            Export CSV
          </button>
          <button type="button" onClick={() => setShowAdd(true)} className="btn-primary">
            + Add User
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Password resets are handled by an administrator — set a new password when creating or editing a user, or share credentials securely.
      </p>

      {isLoading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Name', 'Email', 'Role', 'Phone', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="td text-center text-gray-400 py-8">
                    No users match your search.
                  </td>
                </tr>
              )}
              {filtered.map(u => (
                <tr key={u.id} className="tr">
                  <td className="td font-medium">{u.name}</td>
                  <td className="td text-gray-500">{u.email}</td>
                  <td className="td">
                    <span className="badge-role">{u.role}</span>
                  </td>
                  <td className="td text-gray-500">{u.phone || '—'}</td>
                  <td className="td">
                    <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="td text-gray-400">{formatDate(u.created_at)}</td>
                  <td className="td">
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => setEditUser(u)} className="btn-xs">Edit</button>
                      <button
                        onClick={() => toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                        className={`btn-xs ${u.is_active ? 'btn-xs-red' : 'btn-xs-green'}`}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          window.alert(
                            `To reset access for ${u.email}, set a new password via "Edit" or create a replacement account. Self-service email reset is disabled.`,
                          );
                        }}
                        className="btn-xs btn-xs-blue"
                      >
                        Reset help
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddUserModal
          prefill={prefill}
          onClose={() => {
            setShowAdd(false);
            setGeneratedPassword('');
            onClearPrefill();
          }}
          onCreated={(pwd) => {
            setGeneratedPassword(pwd);
            qc.invalidateQueries({ queryKey: ['admin-users'] });
            onClearPrefill();
          }}
        />
      )}

      {generatedPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-lg">User Created!</h3>
            <p className="text-sm text-gray-500">Share this password securely with the new user:</p>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 font-mono text-lg text-center select-all">
              {generatedPassword}
            </div>
            <button onClick={() => setGeneratedPassword('')} className="btn-primary w-full">
              Done
            </button>
          </div>
        </div>
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); qc.invalidateQueries({ queryKey: ['admin-users'] }); }}
        />
      )}
    </div>
  );
}

function AddUserModal({
  prefill,
  onClose,
  onCreated,
}: {
  prefill: PrefillNewUser | null;
  onClose: () => void;
  onCreated: (pwd: string) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: prefill?.name ?? '',
    email: prefill?.email ?? '',
    password: '',
    role: 'officer',
    phone: '',
  });
  const [autoGen, setAutoGen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (prefill) {
      setForm({
        name: prefill.name,
        email: prefill.email,
        password: '',
        role: 'officer',
        phone: '',
      });
      setAutoGen(true);
    }
  }, [prefill]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    // User provisioning is delegated to the `admin-create-user` Edge
    // Function: `supabase.auth.admin` requires the service-role key, which
    // must never live in browser bundles. The edge function does the auth
    // creation + user_roles row atomically (with rollback) and returns the
    // password — either the one we passed, or one it auto-generated.
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke<{
        user_id: string;
        password: string;
        generated: boolean;
      }>('admin-create-user', {
        body: {
          email: form.email.trim().toLowerCase(),
          name: form.name.trim(),
          role: form.role,
          phone: form.phone.trim() || undefined,
          password: autoGen ? undefined : form.password,
        },
      });
      if (invokeErr) throw invokeErr;
      if (!data?.user_id) throw new Error('User creation failed.');

      if (prefill?.requestId) {
        const { data: authData } = await supabase.auth.getUser();
        await supabase
          .from('account_requests')
          .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: authData.user?.id ?? null,
          })
          .eq('id', prefill.requestId);
        void qc.invalidateQueries({ queryKey: ['account-requests'] });
        void qc.invalidateQueries({ queryKey: ['admin-pending-request-count'] });
      }

      onCreated(data.password);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full space-y-4">
        <h3 className="font-bold text-xl">Add New User</h3>
        {prefill && (
          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            Pre-filled from an approved access request. Set role and password, then create the account.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className="input w-full" placeholder="Full Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input className="input w-full" placeholder="Email" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <input className="input w-full" placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <select className="input w-full" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            <option value="officer">Officer</option>
            <option value="head">Vigilance Head</option>
            <option value="management">Management</option>
            <option value="admin">Admin</option>
            <option value="audit">Audit</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoGen} onChange={e => setAutoGen(e.target.checked)} />
            Auto-generate password
          </label>
          {!autoGen && (
            <input className="input w-full" placeholder="Password" type="password" required={!autoGen} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Creating…' : 'Create User'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '', role: user.role });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setLoading(true);
    setError('');
    const { error: updateError } = await supabase
      .from('user_roles')
      .update({ name: form.name, phone: form.phone, role: form.role })
      .eq('id', user.id);
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full space-y-4">
        <h3 className="font-bold text-xl">Edit User</h3>
        <input className="input w-full" placeholder="Full Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input className="input w-full" placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        <select className="input w-full" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
          <option value="officer">Officer</option>
          <option value="head">Head</option>
          <option value="management">Management</option>
          <option value="admin">Admin</option>
          <option value="audit">Audit</option>
        </select>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="button" onClick={() => void handleSave()} disabled={loading} className="btn-primary flex-1">{loading ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — CHECKLISTS
// ══════════════════════════════════════════════════════════════════════════════
function ChecklistsTab() {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<ChecklistSubTab>('CFC');
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);

  // Branch types are stable — fetch once and reuse for filtering + inserts.
  const { data: branchTypes = [] } = useQuery<BranchTypeRow[]>({
    queryKey: ['admin-branch-types'],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('branch_types').select('id, type_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const branchTypeIdByName = useMemo(() => {
    const map: Record<string, string> = {};
    branchTypes.forEach((bt) => {
      map[bt.type_name] = bt.id;
    });
    return map;
  }, [branchTypes]);

  const branchTypeNameById = useMemo(() => {
    const map: Record<string, string> = {};
    branchTypes.forEach((bt) => {
      map[bt.id] = bt.type_name;
    });
    return map;
  }, [branchTypes]);

  const cfcId = branchTypeIdByName.CFC;
  const storeId = branchTypeIdByName.Store;

  const { data: items = [] } = useQuery<ChecklistItem[]>({
    queryKey: ['admin-checklist', subTab, cfcId, storeId],
    enabled: branchTypes.length > 0,
    queryFn: async () => {
      // checklist_templates uses branch_type_id; NULL means "applies to all types"
      // (the schema.sql convention) — i.e. our Common bucket.
      const targetTypeId =
        subTab === 'CFC' ? cfcId : subTab === 'Store' ? storeId : null;

      let query = supabase
        .from('checklist_templates')
        .select(`
          id, section, item_text, item_order, branch_type_id, is_active,
          risk_classifications:risk_classifications!risk_classifications_checklist_item_id_fkey (
            id, risk_level, trigger_on_no, statutory_act, legal_notes,
            requires_photo, min_remark_chars
          )
        `)
        .eq('is_active', true);

      // Show items targeted at the selected type PLUS Common (branch_type_id IS NULL).
      if (subTab === 'Common') {
        query = query.is('branch_type_id', null);
      } else if (targetTypeId) {
        query = query.or(`branch_type_id.eq.${targetTypeId},branch_type_id.is.null`);
      }

      const { data, error } = await query
        .order('section', { ascending: true })
        .order('item_order', { ascending: true });
      if (error) throw error;

      return (data ?? []).map((i: any): ChecklistItem => {
        const rc = Array.isArray(i.risk_classifications) ? i.risk_classifications[0] : i.risk_classifications;
        const typeName = i.branch_type_id ? branchTypeNameById[i.branch_type_id] : 'Common';
        return {
          id: i.id,
          section: i.section,
          item_text: i.item_text,
          item_order: i.item_order,
          branch_type_id: i.branch_type_id,
          applicable_to: (typeName === 'CFC' || typeName === 'Store' ? typeName : 'Common') as ChecklistSubTab,
          is_active: i.is_active,
          risk_classification: rc
            ? {
                id: rc.id,
                checklist_item_id: i.id,
                risk_level: rc.risk_level,
                trigger_on_no: !!rc.trigger_on_no,
                statutory_act: rc.statutory_act ?? null,
                legal_notes: rc.legal_notes ?? null,
                requires_photo: !!rc.requires_photo,
                min_remark_chars: rc.min_remark_chars ?? 0,
              }
            : null,
        };
      });
    },
  });

  const sections = [...new Set(items.map(i => i.section))];

  const softDelete = async (id: string) => {
    if (!window.confirm('Delete this item? It will be hidden from future inspections.')) return;
    // Soft delete — past inspection_responses still reference this row.
    await supabase
      .from('checklist_templates')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('id', id);
    qc.invalidateQueries({ queryKey: ['admin-checklist'] });
  };

  const reorder = async (id: string, direction: 'up' | 'down', section: string) => {
    const sectionItems = items.filter(i => i.section === section).sort((a, b) => a.item_order - b.item_order);
    const idx = sectionItems.findIndex(i => i.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sectionItems.length) return;
    const a = sectionItems[idx];
    const b = sectionItems[swapIdx];
    await supabase.from('checklist_templates').update({ item_order: b.item_order }).eq('id', a.id);
    await supabase.from('checklist_templates').update({ item_order: a.item_order }).eq('id', b.id);
    qc.invalidateQueries({ queryKey: ['admin-checklist'] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['CFC', 'Store', 'Common'] as ChecklistSubTab[]).map(t => (
            <button key={t} onClick={() => setSubTab(t)} className={`btn-xs ${subTab === t ? 'bg-blue-600 text-white' : ''}`}>{t}</button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">+ Add Item</button>
      </div>
      <p className="text-xs text-yellow-600 dark:text-yellow-400">ℹ Changes only affect future inspections.</p>

      {sections.map(section => (
        <div key={section} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 font-semibold text-sm">{section}</div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.filter(i => i.section === section).sort((a, b) => a.item_order - b.item_order).map(item => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="text-gray-400 w-6 text-right">{item.item_order}</span>
                <span className="flex-1">{item.item_text}</span>
                <span className="w-24 text-center">
                  {item.risk_classification?.risk_level ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${RISK_PILL[item.risk_classification.risk_level]}`}>
                      {item.risk_classification.risk_level}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide">unset</span>
                  )}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => reorder(item.id, 'up', section)} className="btn-xs">↑</button>
                  <button onClick={() => reorder(item.id, 'down', section)} className="btn-xs">↓</button>
                  <button onClick={() => setEditingItem(item)} className="btn-xs">✏</button>
                  <button type="button" onClick={() => softDelete(item.id)} className="btn-xs btn-xs-red" aria-label="Delete item">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {showAdd && (
        <AddChecklistItemModal
          subTab={subTab}
          sections={sections}
          branchTypeIdByName={branchTypeIdByName}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ['admin-checklist'] });
          }}
        />
      )}

      {editingItem && (
        <EditChecklistItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null);
            qc.invalidateQueries({ queryKey: ['admin-checklist'] });
          }}
        />
      )}
    </div>
  );
}

// ── Shared risk-fields block ─────────────────────────────────────────────────
interface RiskFieldsValue {
  riskLevel: RiskLevel;
  statutoryAct: string;
  legalNotes: string;
  triggerOnNo: boolean;
  requiresPhoto: boolean;
  minRemarkChars: number;
}

const DEFAULT_RISK_FIELDS: RiskFieldsValue = {
  riskLevel: 'GREEN',
  statutoryAct: '',
  legalNotes: '',
  triggerOnNo: false,
  requiresPhoto: false,
  minRemarkChars: 0,
};

function RiskFieldsBlock({
  value,
  onChange,
}: {
  value: RiskFieldsValue;
  onChange: (next: RiskFieldsValue) => void;
}) {
  const handleRiskChange = (next: RiskLevel) => {
    // Auto-adjust min remark chars: 50 on RED, 0 on YELLOW/GREEN.
    const nextMin = next === 'RED' ? Math.max(50, value.minRemarkChars) : 0;
    onChange({ ...value, riskLevel: next, minRemarkChars: nextMin });
  };

  const showStatutory = value.riskLevel === 'RED' || value.riskLevel === 'YELLOW';

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
      <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Risk Classification</h4>

      <div>
        <label className="label">Risk Level</label>
        <select
          className={`input w-full font-semibold ${RISK_TEXT[value.riskLevel]}`}
          value={value.riskLevel}
          onChange={e => handleRiskChange(e.target.value as RiskLevel)}
        >
          <option value="GREEN" className="text-green-600 font-bold">GREEN — Informational</option>
          <option value="YELLOW" className="text-amber-600 font-bold">YELLOW — Operational</option>
          <option value="RED" className="text-red-600 font-bold">RED — Statutory / Critical</option>
        </select>
      </div>

      {showStatutory && (
        <>
          <div>
            <label className="label">Statutory Act</label>
            <input
              className="input w-full"
              placeholder="e.g. FSSAI Act 2006 Sec 26"
              value={value.statutoryAct}
              onChange={e => onChange({ ...value, statutoryAct: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Legal Notes</label>
            <textarea
              className="input w-full h-16"
              placeholder="Optional context shown to the supervisor"
              value={value.legalNotes}
              onChange={e => onChange({ ...value, legalNotes: e.target.value })}
            />
          </div>
        </>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.triggerOnNo}
          onChange={e => onChange({ ...value, triggerOnNo: e.target.checked })}
        />
        Fire alert when officer answers NO (compliance items)
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.requiresPhoto}
          onChange={e => onChange({ ...value, requiresPhoto: e.target.checked })}
        />
        Requires photo evidence (in-app camera only)
      </label>

      <div>
        <label className="label">Min Remark Characters</label>
        <input
          className="input w-full"
          type="number"
          min={0}
          value={value.minRemarkChars}
          onChange={e => onChange({ ...value, minRemarkChars: Number(e.target.value) || 0 })}
        />
        {value.riskLevel === 'RED' && value.minRemarkChars < 50 && (
          <p className="text-xs text-red-600 mt-1">
            RED items typically require at least 50 characters of explanation.
          </p>
        )}
      </div>
    </div>
  );
}

function buildRiskPayload(checklistItemId: string, fields: RiskFieldsValue) {
  return {
    checklist_item_id: checklistItemId,
    risk_level: fields.riskLevel,
    trigger_on_no: fields.triggerOnNo,
    statutory_act: fields.statutoryAct.trim() || null,
    legal_notes: fields.legalNotes.trim() || null,
    requires_photo: fields.requiresPhoto,
    min_remark_chars: Math.max(0, Number(fields.minRemarkChars) || 0),
  };
}

// ── Edit modal ───────────────────────────────────────────────────────────────
function EditChecklistItemModal({
  item,
  onClose,
  onSaved,
}: {
  item: ChecklistItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = item.risk_classification;
  const [itemText, setItemText] = useState(item.item_text);
  const [section, setSection] = useState(item.section);
  const [risk, setRisk] = useState<RiskFieldsValue>({
    riskLevel: existing?.risk_level ?? 'GREEN',
    statutoryAct: existing?.statutory_act ?? '',
    legalNotes: existing?.legal_notes ?? '',
    triggerOnNo: existing?.trigger_on_no ?? false,
    requiresPhoto: existing?.requires_photo ?? false,
    minRemarkChars: existing?.min_remark_chars ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // 1. Persist base item edits (text + section) on checklist_templates.
      const { error: itemErr } = await supabase
        .from('checklist_templates')
        .update({ item_text: itemText, section })
        .eq('id', item.id);
      if (itemErr) throw itemErr;

      // 2. Upsert the risk_classifications row (FK → checklist_templates.id).
      const { error: rcErr } = await supabase
        .from('risk_classifications')
        .upsert(buildRiskPayload(item.id, risk), { onConflict: 'checklist_item_id' });
      if (rcErr) throw rcErr;

      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-xl">Edit Checklist Item</h3>

        <div>
          <label className="label">Section</label>
          <input className="input w-full" value={section} onChange={e => setSection(e.target.value)} />
        </div>

        <div>
          <label className="label">Item text</label>
          <textarea
            className="input w-full h-20"
            value={itemText}
            onChange={e => setItemText(e.target.value)}
          />
        </div>

        <RiskFieldsBlock value={risk} onChange={setRisk} />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving || !itemText.trim()} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddChecklistItemModal({
  subTab,
  sections,
  branchTypeIdByName,
  onClose,
  onSaved,
}: {
  subTab: ChecklistSubTab;
  sections: string[];
  branchTypeIdByName: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [section, setSection] = useState(sections[0] || '');
  const [newSection, setNewSection] = useState('');
  const [useNew, setUseNew] = useState(false);
  const [itemText, setItemText] = useState('');
  const [risk, setRisk] = useState<RiskFieldsValue>({ ...DEFAULT_RISK_FIELDS });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    setLoading(true);
    setError('');
    try {
      const finalSection = useNew ? newSection.trim() : section;
      if (!finalSection) {
        throw new Error('Please pick or enter a section');
      }
      // Common items map to branch_type_id = NULL (schema convention).
      const branchTypeId =
        subTab === 'Common' ? null : branchTypeIdByName[subTab] ?? null;

      const { data: existing } = await supabase
        .from('checklist_templates')
        .select('item_order')
        .eq('section', finalSection)
        .order('item_order', { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.item_order ?? 0) + 1;

      // 1. Create the checklist_templates row, returning its id.
      const { data: inserted, error: insertErr } = await supabase
        .from('checklist_templates')
        .insert({
          section: finalSection,
          item_text: itemText,
          item_order: nextOrder,
          branch_type_id: branchTypeId,
          is_active: true,
        })
        .select('id')
        .single();
      if (insertErr || !inserted) throw insertErr ?? new Error('Insert failed');

      // 2. Upsert its risk_classifications row (FK → checklist_templates.id).
      const { error: rcErr } = await supabase
        .from('risk_classifications')
        .upsert(buildRiskPayload(inserted.id, risk), { onConflict: 'checklist_item_id' });
      if (rcErr) throw rcErr;

      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-xl">Add Checklist Item</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useNew} onChange={e => setUseNew(e.target.checked)} /> New section
        </label>
        {useNew ? (
          <input
            className="input w-full"
            placeholder="New section name"
            value={newSection}
            onChange={e => setNewSection(e.target.value)}
          />
        ) : (
          <select className="input w-full" value={section} onChange={e => setSection(e.target.value)}>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <textarea
          className="input w-full h-20"
          placeholder="Item text"
          value={itemText}
          onChange={e => setItemText(e.target.value)}
        />

        <RiskFieldsBlock value={risk} onChange={setRisk} />

        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleAdd}
            disabled={loading || !itemText.trim()}
            className="btn-primary flex-1"
          >
            {loading ? 'Adding…' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — BRANCHES
// ══════════════════════════════════════════════════════════════════════════════
function BranchesTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ['admin-branches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('*').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleBranch = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // Soft delete pattern matches users/checklist_templates: deactivating
      // stamps deleted_at, re-activating clears it. Past inspections keep
      // their FK reference either way.
      await supabase
        .from('branches')
        .update({ is_active, deleted_at: is_active ? null : new Date().toISOString() })
        .eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-branches'] }),
  });

  const activeBranches = branches.filter(b => b.is_active && b.latitude && b.longitude);
  const mapBounds = activeBranches.length > 0
    ? `${Math.min(...activeBranches.map(b => b.latitude!))-0.1},${Math.min(...activeBranches.map(b => b.longitude!))-0.1},${Math.max(...activeBranches.map(b => b.latitude!))+0.1},${Math.max(...activeBranches.map(b => b.longitude!))+0.1}`
    : '8.0,76.5,12.5,77.5';

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="btn-primary">+ Add Branch</button>
      </div>

      {/* OpenStreetMap embed */}
      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 h-56">
        <iframe
          title="Branch Map"
          width="100%"
          height="100%"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapBounds}&layer=mapnik`}
          style={{ border: 0 }}
          loading="lazy"
        />
      </div>

      {isLoading ? <p className="text-gray-500">Loading…</p> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Branch Name', 'Type', 'Location', 'City', 'Region', 'Status', 'Actions'].map(h => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {branches.map(b => (
                <tr key={b.id} className="tr">
                  <td className="td font-medium">{b.name}</td>
                  <td className="td"><span className="badge badge-blue">{b.branch_type}</span></td>
                  <td className="td text-gray-500 max-w-xs truncate">{b.location}</td>
                  <td className="td">{b.city}</td>
                  <td className="td">{b.region}</td>
                  <td className="td">
                    <span className={`badge ${b.is_active ? 'badge-green' : 'badge-red'}`}>{b.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="td">
                    <div className="flex gap-2">
                      <button onClick={() => setEditBranch(b)} className="btn-xs">Edit</button>
                      <button onClick={() => toggleBranch.mutate({ id: b.id, is_active: !b.is_active })} className={`btn-xs ${b.is_active ? 'btn-xs-red' : 'btn-xs-green'}`}>
                        {b.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <BranchModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ['admin-branches'] }); }} />}
      {editBranch && <BranchModal branch={editBranch} onClose={() => setEditBranch(null)} onSaved={() => { setEditBranch(null); qc.invalidateQueries({ queryKey: ['admin-branches'] }); }} />}
    </div>
  );
}

/**
 * BranchModal — zod-validated, react-hook-form-driven.
 *
 * Pattern reference: this is the canonical example we want every other admin
 * form (users, checklist items, ...) to follow. See `web/src/lib/schemas.ts`
 * for the zod schema and `components/ui/form.tsx` for the shadcn wrappers.
 */
function BranchModal({
  branch,
  onClose,
  onSaved,
}: {
  branch?: Branch;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: branch?.name ?? '',
      branch_type: (branch?.branch_type as 'CFC' | 'Store') ?? 'CFC',
      location: branch?.location ?? '',
      city: branch?.city ?? '',
      region: branch?.region ?? '',
      latitude: branch?.latitude ?? undefined,
      longitude: branch?.longitude ?? undefined,
      geofence_radius: branch?.geofence_radius ?? 200,
    },
  });

  const [submitError, setSubmitError] = useState<string | null>(null);

  const onSubmit = async (values: BranchFormValues) => {
    setSubmitError(null);
    const payload = {
      name: values.name,
      branch_type: values.branch_type,
      location: values.location ?? null,
      city: values.city ?? null,
      region: values.region ?? null,
      latitude: values.latitude ?? null,
      longitude: values.longitude ?? null,
      geofence_radius: values.geofence_radius,
      is_active: true,
    };
    const op = branch
      ? supabase.from('branches').update(payload).eq('id', branch.id)
      : supabase.from('branches').insert(payload);
    const { error } = await op;
    if (error) {
      setSubmitError(error.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-xl mb-4">{branch ? 'Edit Branch' : 'Add Branch'}</h3>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Branch name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Aluva CFC" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="branch_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <select className="input w-full h-10" {...field}>
                        <option value="CFC">CFC</option>
                        <option value="Store">Store</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="geofence_radius"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Geofence radius (m)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={50}
                        max={5000}
                        step={50}
                        placeholder="200"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>How close officers must be to start an inspection.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Door #, street, landmark" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="Kochi" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region</FormLabel>
                    <FormControl>
                      <Input placeholder="Ernakulam" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="10.1076"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="76.3475"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {submitError && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
                {submitError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4 — REPORTS
// ══════════════════════════════════════════════════════════════════════════════
function ReportsTab() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [branchType, setBranchType] = useState('all');
  const [status, setStatus] = useState('all');

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [inspRes, usersRes, branchRes, filesRes] = await Promise.all([
        supabase.from('inspections').select('id', { count: 'exact', head: true }),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }),
        supabase.from('branches').select('id', { count: 'exact', head: true }),
        supabase.from('inspection_files').select('id', { count: 'exact', head: true }),
      ]);
      return {
        inspections: inspRes.count ?? 0,
        users: usersRes.count ?? 0,
        branches: branchRes.count ?? 0,
        files: filesRes.count ?? 0,
      };
    },
  });

  const { data: dailyCounts = [] } = useQuery({
    queryKey: ['admin-daily'],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from('inspections')
        .select('created_at')
        .gte('created_at', since.toISOString());
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        const d = r.created_at.split('T')[0];
        map[d] = (map[d] || 0) + 1;
      });
      return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
    },
  });

  const exportFullCSV = async () => {
    let q = supabase
      .from('inspections')
      .select(
        `id, inspection_date, submitted_at, compliance_score, risk_level, status,
        user_roles:officer_id ( name ),
        branches:branch_id ( branch_name, city, branch_types:branch_type_id ( type_name ) ),
        inspection_responses ( response, remarks, checklist_templates:checklist_item_id ( section, item_text ) ),
        inspection_files ( file_url )`,
      )
      .gte('inspection_date', from)
      .lte('inspection_date', to);
    if (status !== 'all') q = q.eq('status', status);
    const { data: exportRows, error } = await q;
    if (error || !exportRows) return;

    const rows: string[] = [
      'Inspection ID,Date,Officer,Branch,Branch Type,City,Section,Item,Response,Remarks,Compliance Score,Risk Level,Status,Files',
    ];

    type ExportRow = {
      id: string;
      inspection_date?: string;
      compliance_score?: number;
      risk_level?: string;
      status?: string;
      user_roles?: { name?: string } | null;
      branches?: {
        branch_name?: string;
        city?: string;
        branch_types?: { type_name?: string } | { type_name?: string }[] | null;
      } | null;
      inspection_responses?: {
        response?: string;
        remarks?: string;
        checklist_templates?: { section?: string; item_text?: string } | null;
      }[];
      inspection_files?: { file_url?: string }[];
    };

    (exportRows as ExportRow[]).forEach((insp) => {
      const branch = insp.branches;
      const typeRel = branch?.branch_types;
      const typeName = Array.isArray(typeRel) ? typeRel[0]?.type_name : typeRel?.type_name;
      if (branchType !== 'all' && typeName !== branchType) return;

      const files = (insp.inspection_files ?? []).map((f) => f.file_url).join('; ');
      const base = [
        insp.id,
        insp.inspection_date ?? '',
        insp.user_roles?.name ?? '',
        branch?.branch_name ?? '',
        typeName ?? '',
        branch?.city ?? '',
      ];

      const responses = insp.inspection_responses ?? [];
      if (responses.length === 0) {
        rows.push(
          [...base, '', '', '', '', insp.compliance_score ?? '', insp.risk_level ?? '', insp.status ?? '', `"${files}"`].join(','),
        );
      } else {
        responses.forEach((r) => {
          const ct = r.checklist_templates;
          rows.push(
            [
              ...base,
              ct?.section ?? '',
              `"${(ct?.item_text ?? '').replace(/"/g, '""')}"`,
              r.response ?? '',
              `"${(r.remarks ?? '').replace(/"/g, '""')}"`,
              insp.compliance_score ?? '',
              insp.risk_level ?? '',
              insp.status ?? '',
              `"${files}"`,
            ].join(','),
          );
        });
      }
    });
    downloadCSV('vigilance_full_export.csv', rows.join('\n'));
  };

  const exportSummaryCSV = async () => {
    let q = supabase
      .from('inspections')
      .select(
        `id, inspection_date, compliance_score, risk_level, status,
        user_roles:officer_id ( name ),
        branches:branch_id ( branch_name )`,
      )
      .gte('inspection_date', from)
      .lte('inspection_date', to);
    if (status !== 'all') q = q.eq('status', status);
    const { data: exportRows, error } = await q;
    if (error || !exportRows) return;

    const rows = ['ID,Date,Branch,Officer,Compliance Score,Risk Level,Status'];
    (exportRows as { id: string; inspection_date?: string; compliance_score?: number; risk_level?: string; status?: string; user_roles?: { name?: string } | null; branches?: { branch_name?: string } | null }[]).forEach((r) => {
      rows.push(
        `${r.id},${r.inspection_date ?? ''},${r.branches?.branch_name ?? ''},${r.user_roles?.name ?? ''},${r.compliance_score ?? ''},${r.risk_level ?? ''},${r.status ?? ''}`,
      );
    });
    downloadCSV('vigilance_summary.csv', rows.join('\n'));
  };

  return (
    <div className="space-y-8">
      {/* Section A */}
      <div className="space-y-4">
        <h2 className="font-semibold text-lg">Export Data</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div>
            <label className="label">Branch Type</label>
            <select className="input" value={branchType} onChange={e => setBranchType(e.target.value)}>
              <option value="all">All</option>
              <option value="CFC">CFC</option>
              <option value="Store">Store</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={exportFullCSV} className="btn-primary">Export Full CSV</button>
          <button onClick={exportSummaryCSV} className="btn-secondary">Export Summary CSV</button>
        </div>
      </div>

      {/* Section B */}
      <div className="space-y-4">
        <h2 className="font-semibold text-lg">System Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Inspections', value: stats?.inspections },
            { label: 'Total Users', value: stats?.users },
            { label: 'Total Branches', value: stats?.branches },
            { label: 'Total Files', value: stats?.files },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{s.value ?? '—'}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <h3 className="font-medium">Last 30 Days — Daily Inspection Counts</h3>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="th">Date</th>
                <th className="th">Inspections</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {dailyCounts.map(r => (
                <tr key={r.date} className="tr">
                  <td className="td">{r.date}</td>
                  <td className="td font-semibold">{r.count}</td>
                </tr>
              ))}
              {dailyCounts.length === 0 && (
                <tr><td colSpan={2} className="td text-center text-gray-400">No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
