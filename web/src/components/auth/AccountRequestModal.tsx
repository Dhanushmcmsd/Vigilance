import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AccountRequestFormValues } from '../../types/accountRequest';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NOTE = 200;

interface AccountRequestModalProps {
  open: boolean;
  onClose: () => void;
}

export function AccountRequestModal({ open, onClose }: AccountRequestModalProps) {
  const [form, setForm] = useState<AccountRequestFormValues>({
    full_name: '',
    email: '',
    designation: '',
    branch_hint: '',
    note: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const full_name = form.full_name.trim();
    const email = form.email.trim().toLowerCase();
    const designation = form.designation.trim() || null;
    const branch_hint = form.branch_hint.trim() || null;
    const note = form.note.trim().slice(0, MAX_NOTE) || null;

    if (full_name.length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError('Please enter a valid work email address.');
      return;
    }

    setSubmitting(true);
    const { error: insertErr } = await supabase.from('account_requests').insert({
      full_name,
      email,
      designation,
      branch_hint,
      note,
      status: 'pending',
    });
    setSubmitting(false);

    if (insertErr) {
      if (insertErr.code === '23505') {
        setError('A pending request already exists for this email. Please wait for admin review.');
      } else {
        setError(insertErr.message || 'Could not submit your request. Please try again later.');
      }
      return;
    }

    setSuccess(true);
  };

  const handleClose = () => {
    setSuccess(false);
    setError(null);
    setForm({ full_name: '', email: '', designation: '', branch_hint: '', note: '' });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-request-title"
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="account-request-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            Request account access
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              Your request has been submitted. An administrator will review it shortly.
            </p>
            <button type="button" onClick={handleClose} className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg">
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Accounts are created by an administrator. Submit your details and an admin will contact you if approved.
            </p>
            <input
              className="input w-full"
              placeholder="Full name *"
              required
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            />
            <input
              className="input w-full"
              placeholder="Work email *"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <input
              className="input w-full"
              placeholder="Designation / role hint (optional)"
              value={form.designation}
              onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
            />
            <input
              className="input w-full"
              placeholder="Branch or location (optional)"
              value={form.branch_hint}
              onChange={(e) => setForm((f) => ({ ...f, branch_hint: e.target.value }))}
            />
            <textarea
              className="input w-full min-h-[80px] resize-y"
              placeholder="Brief note (optional, max 200 characters)"
              maxLength={MAX_NOTE}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={handleClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="btn-primary flex-1">
                {submitting ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
