import { COMPANY } from '../../lib/legal/companyConfig';

/** Compact internal-use banner for login and authenticated shells */
export function InternalUseNotice({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const isDark = variant === 'dark';
  return (
    <p
      className={`text-[11px] leading-relaxed ${isDark ? 'text-muted' : 'text-gray-500 dark:text-gray-400'}`}
    >
      <span className="font-medium">For authorized internal use only.</span> Operated by {COMPANY.legalName} (
      {COMPANY.operationalRegion}). Unauthorised access is prohibited.
    </p>
  );
}
