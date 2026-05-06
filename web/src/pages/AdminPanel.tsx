import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

type Tab = 'users' | 'checklists' | 'branches' | 'reports';
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

interface ChecklistItem {
  id: string;
  section: string;
  item_text: string;
  item_order: number;
  applicable_to: string;
  is_active: boolean;
}

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
function generatePassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#!';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── AdminPanel ───────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('users');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'users', label: 'Users' },
    { key: 'checklists', label: 'Checklists' },
    { key: 'branches', label: 'Branches' },
    { key: 'reports', label: 'Reports' },
  ];

  return (
    <div className="p-6 space-y-6">
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
        {tab === 'users' && <UsersTab />}
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
function UsersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState('');

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
      const { error } = await supabase.from('user_roles').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const resetPassword = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    },
  });

  const filtered = users.filter(
    u =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input w-80"
        />
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          + Add User
        </button>
      </div>

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
                        onClick={() => {
                          if (window.confirm(`Send password reset to ${u.email}?`)) {
                            resetPassword.mutate(u.email);
                          }
                        }}
                        className="btn-xs btn-xs-blue"
                      >
                        Reset Pwd
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
          onClose={() => { setShowAdd(false); setGeneratedPassword(''); }}
          onCreated={pwd => { setGeneratedPassword(pwd); qc.invalidateQueries({ queryKey: ['admin-users'] }); }}
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

function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (pwd: string) => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'officer', phone: '' });
  const [autoGen, setAutoGen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const pwd = autoGen ? generatePassword() : form.password;
    try {
      const { data, error: authErr } = await supabase.auth.admin.createUser({
        email: form.email,
        password: pwd,
        email_confirm: true,
      });
      if (authErr) throw authErr;
      const userId = data.user?.id;
      if (userId) {
        await supabase.from('user_roles').insert({
          id: userId,
          email: form.email,
          name: form.name,
          role: form.role,
          phone: form.phone,
          is_active: true,
        });
      }
      onCreated(pwd);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full space-y-4">
        <h3 className="font-bold text-xl">Add New User</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className="input w-full" placeholder="Full Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input className="input w-full" placeholder="Email" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <input className="input w-full" placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <select className="input w-full" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            <option value="officer">Officer</option>
            <option value="head">Vigilance Head</option>
            <option value="management">Management</option>
            <option value="admin">Admin</option>
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

  const handleSave = async () => {
    setLoading(true);
    await supabase.from('user_roles').update({ name: form.name, phone: form.phone, role: form.role }).eq('id', user.id);
    setLoading(false);
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
        </select>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary flex-1">{loading ? 'Saving…' : 'Save Changes'}</button>
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const { data: items = [] } = useQuery<ChecklistItem[]>({
    queryKey: ['admin-checklist', subTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('is_active', true)
        .in('applicable_to', subTab === 'Common' ? ['Common'] : [subTab, 'Common'])
        .order('section').order('item_order');
      if (error) throw error;
      return (data ?? []).filter((i: ChecklistItem) => subTab === 'Common' ? i.applicable_to === 'Common' : i.applicable_to === subTab);
    },
  });

  const sections = [...new Set(items.map(i => i.section))];

  const softDelete = async (id: string) => {
    if (!window.confirm('Delete this item? It will be hidden from future inspections.')) return;
    await supabase.from('checklist_items').update({ is_active: false }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['admin-checklist'] });
  };

  const saveEdit = async (id: string) => {
    await supabase.from('checklist_items').update({ item_text: editText }).eq('id', id);
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ['admin-checklist'] });
  };

  const reorder = async (id: string, direction: 'up' | 'down', section: string) => {
    const sectionItems = items.filter(i => i.section === section).sort((a, b) => a.item_order - b.item_order);
    const idx = sectionItems.findIndex(i => i.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sectionItems.length) return;
    const a = sectionItems[idx];
    const b = sectionItems[swapIdx];
    await supabase.from('checklist_items').update({ item_order: b.item_order }).eq('id', a.id);
    await supabase.from('checklist_items').update({ item_order: a.item_order }).eq('id', b.id);
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
                {editingId === item.id ? (
                  <input
                    className="input flex-1"
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onBlur={() => saveEdit(item.id)}
                    autoFocus
                  />
                ) : (
                  <span className="flex-1">{item.item_text}</span>
                )}
                <div className="flex gap-1">
                  <button onClick={() => reorder(item.id, 'up', section)} className="btn-xs">↑</button>
                  <button onClick={() => reorder(item.id, 'down', section)} className="btn-xs">↓</button>
                  <button onClick={() => { setEditingId(item.id); setEditText(item.item_text); }} className="btn-xs">✏</button>
                  <button onClick={() => softDelete(item.id)} className="btn-xs btn-xs-red">🗑</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {showAdd && <AddChecklistItemModal subTab={subTab} sections={sections} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ['admin-checklist'] }); }} />}
    </div>
  );
}

function AddChecklistItemModal({ subTab, sections, onClose, onSaved }: { subTab: string; sections: string[]; onClose: () => void; onSaved: () => void }) {
  const [section, setSection] = useState(sections[0] || '');
  const [newSection, setNewSection] = useState('');
  const [useNew, setUseNew] = useState(false);
  const [itemText, setItemText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    setLoading(true);
    const finalSection = useNew ? newSection : section;
    const { data: existing } = await supabase.from('checklist_items').select('item_order').eq('section', finalSection).order('item_order', { ascending: false }).limit(1);
    const nextOrder = (existing?.[0]?.item_order ?? 0) + 1;
    await supabase.from('checklist_items').insert({ section: finalSection, item_text: itemText, item_order: nextOrder, applicable_to: subTab, is_active: true });
    setLoading(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full space-y-4">
        <h3 className="font-bold text-xl">Add Checklist Item</h3>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useNew} onChange={e => setUseNew(e.target.checked)} /> New section</label>
        {useNew ? (
          <input className="input w-full" placeholder="New section name" value={newSection} onChange={e => setNewSection(e.target.value)} />
        ) : (
          <select className="input w-full" value={section} onChange={e => setSection(e.target.value)}>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <textarea className="input w-full h-20" placeholder="Item text" value={itemText} onChange={e => setItemText(e.target.value)} />
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleAdd} disabled={loading || !itemText} className="btn-primary flex-1">{loading ? 'Adding…' : 'Add Item'}</button>
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
      await supabase.from('branches').update({ is_active }).eq('id', id);
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

function BranchModal({ branch, onClose, onSaved }: { branch?: Branch; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: branch?.name || '',
    branch_type: branch?.branch_type || 'CFC',
    location: branch?.location || '',
    city: branch?.city || '',
    region: branch?.region || '',
    latitude: branch?.latitude?.toString() || '',
    longitude: branch?.longitude?.toString() || '',
    geofence_radius: branch?.geofence_radius?.toString() || '200',
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      ...form,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      geofence_radius: parseInt(form.geofence_radius) || 200,
      is_active: true,
    };
    if (branch) {
      await supabase.from('branches').update(payload).eq('id', branch.id);
    } else {
      await supabase.from('branches').insert(payload);
    }
    setLoading(false);
    onSaved();
  };

  const fields: { key: keyof typeof form; label: string; type?: string; min?: number; max?: number; placeholder?: string }[] = [
    { key: 'name', label: 'Branch Name' },
    { key: 'location', label: 'Location / Address' },
    { key: 'city', label: 'City' },
    { key: 'region', label: 'Region' },
    { key: 'latitude', label: 'Latitude', type: 'number' },
    { key: 'longitude', label: 'Longitude', type: 'number' },
    { key: 'geofence_radius', label: 'Geofence Radius (metres)', type: 'number', min: 50, max: 5000, placeholder: '200' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full space-y-3">
        <h3 className="font-bold text-xl">{branch ? 'Edit Branch' : 'Add Branch'}</h3>
        <select className="input w-full" value={form.branch_type} onChange={e => setForm(f => ({ ...f, branch_type: e.target.value }))}>
          <option value="CFC">CFC</option>
          <option value="Store">Store</option>
        </select>
        {fields.map(f => (
          <input
            key={f.key}
            className="input w-full"
            placeholder={f.placeholder || f.label}
            type={f.type || 'text'}
            min={f.min}
            max={f.max}
            value={form[f.key]}
            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
          />
        ))}
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary flex-1">{loading ? 'Saving…' : 'Save'}</button>
        </div>
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
      .select(`id, created_at, time_in, time_out, compliance_score, risk_level, status, head_comment, general_remarks,
        user_roles(name), branches(name, branch_type, city),
        inspection_responses(checklist_items(section, item_text), response, remarks),
        inspection_files(file_url)`)
      .gte('created_at', from)
      .lte('created_at', to + 'T23:59:59');
    if (branchType !== 'all') q = q.eq('branches.branch_type', branchType);
    if (status !== 'all') q = q.eq('status', status);
    const { data } = await q;
    if (!data) return;
    const rows: string[] = ['Inspection ID,Date,Time In,Time Out,Officer Name,Branch Name,Branch Type,City,Section,Checklist Item,Response,Remarks,General Remarks,Compliance Score,Risk Level,Status,Head Comment,Files'];
    (data as any[]).forEach((insp: any) => {
      const files = (insp.inspection_files ?? []).map((f: any) => f.file_url).join('; ');
      if ((insp.inspection_responses ?? []).length === 0) {
        rows.push(`${insp.id},${insp.created_at?.split('T')[0]},${insp.time_in ?? ''},${insp.time_out ?? ''},${insp.user_roles?.name ?? ''},${insp.branches?.name ?? ''},${insp.branches?.branch_type ?? ''},${insp.branches?.city ?? ''},,,,,,${insp.compliance_score ?? ''},${insp.risk_level ?? ''},${insp.status ?? ''},"${insp.head_comment ?? ''}","${files}"`);
      } else {
        (insp.inspection_responses ?? []).forEach((r: any) => {
          rows.push(`${insp.id},${insp.created_at?.split('T')[0]},${insp.time_in ?? ''},${insp.time_out ?? ''},${insp.user_roles?.name ?? ''},${insp.branches?.name ?? ''},${insp.branches?.branch_type ?? ''},${insp.branches?.city ?? ''},${r.checklist_items?.section ?? ''},"${r.checklist_items?.item_text ?? ''}",${r.response ?? ''},"${r.remarks ?? ''}","${insp.general_remarks ?? ''}",${insp.compliance_score ?? ''},${insp.risk_level ?? ''},${insp.status ?? ''},"${insp.head_comment ?? ''}","${files}"`);
        });
      }
    });
    downloadCSV('vigilance_full_export.csv', rows.join('\n'));
  };

  const exportSummaryCSV = async () => {
    let q = supabase
      .from('inspections')
      .select('id, created_at, compliance_score, risk_level, status, head_comment, user_roles(name), branches(name)')
      .gte('created_at', from)
      .lte('created_at', to + 'T23:59:59');
    if (status !== 'all') q = q.eq('status', status);
    const { data } = await q;
    if (!data) return;
    const rows = ['ID,Date,Branch,Officer,Compliance Score,Risk Level,Status,Head Comment'];
    (data as any[]).forEach((r: any) => {
      rows.push(`${r.id},${r.created_at?.split('T')[0]},${r.branches?.name ?? ''},${r.user_roles?.name ?? ''},${r.compliance_score ?? ''},${r.risk_level ?? ''},${r.status ?? ''},"${r.head_comment ?? ''}"`);
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
