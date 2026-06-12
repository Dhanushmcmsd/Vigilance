import React, { useState } from 'react';
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
import { KeralaBranchMap } from '../components/admin/KeralaBranchMap';
import { DistrictOfficersPanel } from '../components/admin/DistrictOfficersPanel';
import { ChecklistAdminTab } from '../components/admin/ChecklistAdminTab';
import type { PrefillNewUser } from '../types/accountRequest';
import { KERALA_DISTRICT_NAMES } from '../lib/storeRegions';

type Tab = 'users' | 'account-requests' | 'checklists' | 'branches' | 'reports';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface UserRow {
  id: string;
  user_id: string | null;
  email: string;
  name: string;
  role: string;
  phone: string;
  is_active: boolean;
  created_at: string;
}

interface Branch {
  id: string;
  branch_name: string;
  branch_type_id: string;
  branch_type?: string;
  location: string;
  city: string;
  region: string;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
  geofence_radius: number;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Password generation lives in the `admin-create-user` Edge Function â€” the
// browser must never see / generate auth credentials directly.

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// â”€â”€â”€ AdminPanel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        {tab === 'checklists' && <ChecklistAdminTab />}
        {tab === 'branches' && <BranchesTab />}
        {tab === 'reports' && <ReportsTab />}
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TAB 1 â€” USERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
        .select('id, user_id, email, name, role, phone, is_active, created_at')
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
            placeholder="Search by name or email..."
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
        Password resets are handled by an administrator - set a new password when creating or editing a user, or share credentials securely.
      </p>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Name', 'Email', 'Role', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="td text-center text-gray-400 py-8">
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
    // password â€” either the one we passed, or one it auto-generated.
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
          <input
            className="input w-full"
            placeholder="Email"
            type="email"
            required
            readOnly={!!prefill}
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
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
            <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Creatingâ€¦' : 'Create User'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    password: '',
    phone: user.phone || '',
    role: user.role,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: pendingRequest } = useQuery({
    queryKey: ['pending-request-for-email', user.email],
    queryFn: async () => {
      const { data, error: reqErr } = await supabase
        .from('account_requests')
        .select('id')
        .eq('email', user.email.toLowerCase())
        .eq('status', 'pending')
        .maybeSingle();
      if (reqErr) throw reqErr;
      return data;
    },
  });

  const emailReadonly = !!pendingRequest;

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke<{
        user_id?: string;
        error?: string;
      }>('admin-update-user', {
        body: {
          user_roles_id: user.id,
          email: form.email.trim().toLowerCase(),
          name: form.name.trim(),
          role: form.role,
          phone: form.phone.trim() || undefined,
          password: form.password.trim() || undefined,
        },
      });
      if (invokeErr) throw invokeErr;
      if (data?.error) throw new Error(data.error);
      if (!data?.user_id) throw new Error('User update failed.');
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full space-y-4">
        <h3 className="font-bold text-xl">Edit User</h3>
        <input className="input w-full" placeholder="Full Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input
          className="input w-full"
          placeholder="Email"
          type="email"
          readOnly={emailReadonly}
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        />
        {emailReadonly && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Email is locked while a pending access request exists for this address.
          </p>
        )}
        <input
          className="input w-full"
          placeholder="Leave blank to keep current password"
          type="password"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
        />
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
          <button type="button" onClick={() => void handleSave()} disabled={loading} className="btn-primary flex-1">{loading ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TAB 3 â€” BRANCHES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function BranchesTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ['admin-branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select(
          `id, branch_name, branch_type_id, location, city, region, latitude, longitude,
           geofence_radius, is_active,
           branch_types:branch_type_id ( type_name )`,
        )
        .order('branch_name');
      if (error) throw error;
      return (data ?? []).map((row) => {
        const typeRel = (row as { branch_types?: { type_name?: string } | { type_name?: string }[] | null }).branch_types;
        const typeName = Array.isArray(typeRel) ? typeRel[0]?.type_name : typeRel?.type_name;
        return {
          ...(row as Branch),
          branch_type: typeName ?? 'Store',
        };
      });
    },
  });

  const toggleBranch = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('branches')
        .update({ is_active, deleted_at: is_active ? null : new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-branches'] }),
    onError: (err: Error) => window.alert(err.message || 'Failed to update branch.'),
  });

  return (
    <div className="space-y-6">
      <KeralaBranchMap onAddBranch={() => setShowAdd(true)} />
      <DistrictOfficersPanel />

      {isLoading ? (
        <p className="text-gray-500">Loading branches...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Branch Name', 'Location', 'City', 'District', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {branches.map((b) => (
                <tr key={b.id} className="tr">
                  <td className="td font-medium">{b.branch_name}</td>
                  <td className="td text-gray-500 max-w-xs truncate">{b.location}</td>
                  <td className="td">{b.city}</td>
                  <td className="td">{b.region}</td>
                  <td className="td">
                    <span className={`badge ${b.is_active ? 'badge-green' : 'badge-red'}`}>
                      {b.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditBranch(b)} className="btn-xs">Edit</button>
                      <button
                        type="button"
                        onClick={() => toggleBranch.mutate({ id: b.id, is_active: !b.is_active })}
                        className={`btn-xs ${b.is_active ? 'btn-xs-red' : 'btn-xs-green'}`}
                      >
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

      {showAdd && (
        <BranchModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ['admin-branches'] });
          }}
        />
      )}
      {editBranch && (
        <BranchModal
          branch={editBranch}
          onClose={() => setEditBranch(null)}
          onSaved={() => {
            setEditBranch(null);
            qc.invalidateQueries({ queryKey: ['admin-branches'] });
          }}
        />
      )}
    </div>
  );
}

/**
 * BranchModal â€” zod-validated, react-hook-form-driven.
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
  const { data: storeTypeId } = useQuery({
    queryKey: ['admin-store-branch-type-id'],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branch_types')
        .select('id')
        .eq('type_name', 'Store')
        .single();
      if (error) throw error;
      return data.id as string;
    },
  });

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: branch?.branch_name ?? '',
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
    if (!storeTypeId) {
      setSubmitError('Store branch type not loaded yet.');
      return;
    }
    setSubmitError(null);
    const payload = {
      branch_name: values.name,
      branch_type_id: storeTypeId,
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
                    <FormLabel>District</FormLabel>
                    <FormControl>
                      <select className="input w-full" {...field} value={field.value ?? ''}>
                        <option value="">Select district</option>
                        {KERALA_DISTRICT_NAMES.map((district) => (
                          <option key={district} value={district}>
                            {district}
                          </option>
                        ))}
                      </select>
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
                {form.formState.isSubmitting ? 'Savingâ€¦' : 'Save'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TAB 4 â€” REPORTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
      (data ?? []).forEach((r: { created_at: string }) => {
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
    if (error || !exportRows) {
      window.alert(error?.message || 'Export failed.');
      return;
    }

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
    if (error || !exportRows) {
      window.alert(error?.message || 'Export failed.');
      return;
    }

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
              <p className="text-3xl font-bold text-blue-600">{s.value ?? 'â€”'}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <h3 className="font-medium">Last 30 Days â€” Daily Inspection Counts</h3>
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
