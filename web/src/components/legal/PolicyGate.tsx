import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CURRENT_POLICY_VERSION } from '../../lib/legal/policyVersion';
import { LegalAcknowledgementModal } from './LegalAcknowledgementModal';

/** Prompts for policy acceptance when version is missing or outdated. */
export function PolicyGate({ children }: { children: React.ReactNode }) {
  const { user, role, loading, acceptedPolicyVersion } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [user?.id]);

  if (loading || !user || !role || role === 'officer') {
    return <>{children}</>;
  }

  const sessionOk = sessionStorage.getItem('vms_policy_accepted_version') === CURRENT_POLICY_VERSION;
  const dbOk = acceptedPolicyVersion === CURRENT_POLICY_VERSION;
  const needsAck = !dismissed && !sessionOk && !dbOk;

  if (needsAck) {
    return (
      <>
        {children}
        <LegalAcknowledgementModal onAccepted={() => setDismissed(true)} />
      </>
    );
  }

  return <>{children}</>;
}
