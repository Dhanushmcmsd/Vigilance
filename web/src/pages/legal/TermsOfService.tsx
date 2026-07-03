import { Link } from 'react-router-dom';
import { LegalPageLayout } from '../../components/legal/LegalPageLayout';
import {
  COMPANY,
  PRIVACY_CONTACT_PLACEHOLDER,
  REGISTERED_OFFICE_PLACEHOLDER,
} from '../../lib/legal/companyConfig';

export default function TermsOfService() {
  return (
    <LegalPageLayout title="Terms of Use">
      <p>
        These Terms of Use (&quot;Terms&quot;) govern access to the {COMPANY.platformName} (&quot;{COMPANY.platformAbbrev}
        &quot;, &quot;Platform&quot;) operated by <strong>{COMPANY.legalName}</strong> for authorised internal users in
        connection with operations including {COMPANY.operationalRegion}. By signing in, you agree to these Terms.
      </p>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">1. Authorised access only</h2>
      <p>
        The Platform is for <strong>authorised internal use only</strong>. Access is granted by {COMPANY.shortName} based
        on your role. You must not permit unauthorised persons to use your credentials or access the Platform outside
        approved business purposes.
      </p>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">2. Account responsibility</h2>
      <p>
        You are responsible for safeguarding passwords and devices used to access the Platform. Notify your administrator
        immediately if you suspect compromise or unauthorised use.
      </p>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">3. Acceptable use</h2>
      <p>
        You must comply with the{' '}
        <Link to="/legal/acceptable-use" className="text-brand-600 dark:text-brand-400 underline">
          Acceptable Use Policy
        </Link>
        , employment terms, confidentiality obligations, and applicable law. Prohibited conduct includes falsifying
        records, bypassing security, exfiltrating data, harassment, and misuse of workforce or location data.
      </p>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">4. Accurate submissions</h2>
      <p>
        You must submit inspection and vigilance information accurately and promptly. Deliberate misrepresentation may
        result in disciplinary action and reporting to authorities where required.
      </p>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">5. Operational outputs — no legal advice</h2>
      <p>
        Risk classifications, compliance scores, SLA indicators, alerts, and dashboards are <strong>assistive tools</strong>{' '}
        based on configured rules and submitted data. They do not constitute legal, regulatory, employment, investment,
        or financial advice; do not guarantee compliance with RBI, SEBI, or other requirements; and must not be the sole
        basis for disciplinary or business decisions. Independent verification and qualified review are required.
      </p>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">6. Confidentiality</h2>
      <p>
        Platform data is confidential to {COMPANY.shortName}. You must not disclose exports, screenshots, or reports
        except as authorised by policy or law.
      </p>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">7. Monitoring and audit</h2>
      <p>
        Use of the Platform may be logged and audited for security, fraud prevention, and compliance-support purposes in
        accordance with applicable law and {COMPANY.shortName} internal policies. Monitoring is proportionate and
        work-related — not intended as unrestricted surveillance of private life.
      </p>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">8. Intellectual property</h2>
      <p>
        The Platform software and documentation are proprietary. Inspection data submitted in the course of authorised
        duties belongs to {COMPANY.shortName} subject to applicable law.
      </p>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">9. Suspension</h2>
      <p>
        {COMPANY.shortName} may suspend or revoke access at any time for security, policy breach, role change, or
        business reasons.
      </p>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">10. Availability</h2>
      <p>
        The Platform is provided on an &quot;as is&quot; and &quot;as available&quot; basis. Maintenance, outages, or
        third-party service interruptions may occur.
      </p>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">11. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, {COMPANY.shortName} and its administrators are not liable for indirect,
        consequential, or punitive loss arising from reliance on Platform outputs without independent verification.
      </p>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">12. Governing law</h2>
      <p>
        These Terms are governed by the laws of India. Courts at [jurisdiction — confirm with counsel, e.g. Ernakulam,
        Kerala] shall have exclusive jurisdiction, unless {COMPANY.shortName} specifies otherwise in writing.
      </p>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">13. Contact</h2>
      <p>
        Legal / compliance enquiries: {PRIVACY_CONTACT_PLACEHOLDER}. Registered office: {REGISTERED_OFFICE_PLACEHOLDER}.
        General company website: {COMPANY.website}.
      </p>

      <p className="pt-4 text-sm">
        See also:{' '}
        <Link to="/legal/privacy" className="text-brand-600 dark:text-brand-400 underline">
          Privacy Policy
        </Link>
        .
      </p>
    </LegalPageLayout>
  );
}
