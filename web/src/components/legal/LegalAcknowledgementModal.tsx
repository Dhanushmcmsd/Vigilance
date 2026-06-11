import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { COMPANY } from '../../lib/legal/companyConfig';
import { CURRENT_POLICY_VERSION } from '../../lib/legal/policyVersion';

interface LegalAcknowledgementModalProps {
  onAccepted: () => void;
}

export function LegalAcknowledgementModal({ onAccepted }: LegalAcknowledgementModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!agreed) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('record_my_policy_acceptance', {
        p_version: CURRENT_POLICY_VERSION,
      });
      if (rpcError) throw rpcError;
      sessionStorage.setItem('vms_policy_accepted_version', CURRENT_POLICY_VERSION);
      onAccepted();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save acknowledgement';
      setError(message);
      return;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-lg rounded-xl border bg-white dark:bg-gray-900 shadow-xl p-6 space-y-4"
        role="dialog"
        aria-labelledby="policy-ack-title"
      >
        <h2 id="policy-ack-title" className="text-lg font-semibold text-gray-900 dark:text-white">
          Policy acknowledgement
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Before using {COMPANY.platformName}, confirm that you are an authorised user of {COMPANY.legalName} and that
          you have read and agree to the current internal policies:
        </p>
        <ul className="text-sm space-y-1">
          <li>
            <Link to="/legal/terms" className="text-brand-600 dark:text-brand-400 underline" target="_blank">
              Terms of Use
            </Link>
          </li>
          <li>
            <Link to="/legal/privacy" className="text-brand-600 dark:text-brand-400 underline" target="_blank">
              Privacy Policy
            </Link>
          </li>
          <li>
            <Link to="/legal/acceptable-use" className="text-brand-600 dark:text-brand-400 underline" target="_blank">
              Acceptable Use
            </Link>
          </li>
        </ul>
        <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 rounded border-gray-300"
          />
          <span>
            I am authorised to access this system. I agree to the Terms of Use and Privacy Policy (version{' '}
            {CURRENT_POLICY_VERSION}).
          </span>
        </label>
        {error && (
          <p className="text-xs text-amber-700 dark:text-amber-400" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={!agreed || submitting}
          onClick={() => void handleAccept()}
          className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Continue to dashboard'}
        </button>
      </div>
    </div>
  );
}
