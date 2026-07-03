import { COMPANY } from '../../lib/legal/companyConfig';

/** Operational disclaimer for dashboards, risk outputs, and management views. */
export function ComplianceDisclaimer({ className = '' }: { className?: string }) {
  const isLight = className.includes('gray-') || className.includes('amber-50') || className.includes('slate-');
  return (
    <div
      className={`text-xs leading-relaxed rounded-md border px-3 py-2.5 space-y-1.5 ${className}`}
      style={
        isLight
          ? undefined
          : {
              borderColor: 'rgba(255,255,255,0.08)',
              backgroundColor: 'rgba(255,255,255,0.02)',
              color: 'rgba(245,245,240,0.55)',
            }
      }
      role="note"
    >
      <p>
        <span className="font-medium text-inherit">Internal use.</span> {COMPANY.platformName} insights, alerts, risk
        indicators, and compliance scores support operational review and escalation for {COMPANY.shortName}. They do
        not constitute legal, regulatory, employment, investment, or financial advice, and are not a sole basis for
        disciplinary or business decisions.
      </p>
      <p className="opacity-90">
        Platform use may be logged for security, audit, fraud prevention, and compliance-support purposes in accordance
        with applicable law and {COMPANY.shortName} internal policies.
      </p>
    </div>
  );
}
