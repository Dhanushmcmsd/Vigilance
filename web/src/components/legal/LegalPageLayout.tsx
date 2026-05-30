import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { COMPANY } from '../../lib/legal/companyConfig';
import { POLICY_LAST_UPDATED } from '../../lib/legal/policyVersion';
import { LegalFooter } from './LegalFooter';
import { InternalUseNotice } from './InternalUseNotice';

export function LegalPageLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link to="/login" className="text-sm font-semibold text-brand-600 dark:text-brand-400">
              {COMPANY.platformAbbrev} — {COMPANY.shortName}
            </Link>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{COMPANY.legalName}</p>
          </div>
          <LegalFooter />
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <InternalUseNotice />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-6 mb-2">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Last updated: {POLICY_LAST_UPDATED} · Internal enterprise policy
        </p>
        <article className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-gray-700 dark:text-gray-300 leading-relaxed">
          {children}
        </article>
        <footer className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800 space-y-3">
          <InternalUseNotice />
          <LegalFooter />
        </footer>
      </main>
    </div>
  );
}
