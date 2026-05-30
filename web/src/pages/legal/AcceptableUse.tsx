import { Link } from 'react-router-dom';
import { LegalPageLayout } from '../../components/legal/LegalPageLayout';
import { COMPANY } from '../../lib/legal/companyConfig';

export default function AcceptableUse() {
  return (
    <LegalPageLayout title="Acceptable Use Policy">
      <p>
        This Acceptable Use Policy applies to all authorised users of {COMPANY.platformName} ({COMPANY.platformAbbrev})
        operated by {COMPANY.legalName}. It supplements the{' '}
        <Link to="/legal/terms" className="text-brand-600 dark:text-brand-400 underline">
          Terms of Use
        </Link>{' '}
        and internal employment / contractor agreements.
      </p>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">Permitted use</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Conducting authorised inspections and vigilance reviews at assigned branches or facilities</li>
        <li>Uploading evidence strictly necessary for operational verification</li>
        <li>Reviewing, approving, or escalating findings within your role</li>
        <li>Exporting data only through approved channels and approvals</li>
        <li>Using location or geofence features only for legitimate field verification during work</li>
      </ul>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">Prohibited conduct</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Sharing credentials or allowing unauthorised access</li>
        <li>Falsifying or backdating inspection records</li>
        <li>Accessing branches, users, or data outside your role</li>
        <li>Bulk scraping, automated exfiltration, or personal archiving of confidential data</li>
        <li>Disabling security controls or interfering with audit logs</li>
        <li>Using the Platform to harass, discriminate, or monitor individuals beyond legitimate work purposes</li>
        <li>Capturing unrelated personal imagery or private information</li>
      </ul>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">Workforce and location data</h2>
      <p>
        Where {COMPANY.platformAbbrev} collects location or device metadata, it is for operational integrity (e.g. branch
        visit validation, field activity confirmation, fraud prevention). Users must not attempt to spoof location or
        circumvent controls. {COMPANY.shortName} does not intend continuous off-duty tracking or private-space monitoring
        through this Platform.
      </p>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">Evidence and media</h2>
      <p>
        Photographs must relate to checklist items and compliance verification. Minimise collection of personal data of
        customers or staff unless necessary and permitted.
      </p>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">Enforcement</h2>
      <p>
        Breaches may result in access revocation, disciplinary proceedings, contractual remedies, and disclosure to
        authorities where required by law.
      </p>
    </LegalPageLayout>
  );
}
