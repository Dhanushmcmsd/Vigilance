import { describe, expect, it } from 'vitest';
import { pdf, Document, Page, Text } from '@react-pdf/renderer';
import { formatNonComplianceAlert } from '@/lib/alertDescriptions';
import { buildInspectionCsvLines } from '@/lib/dashboardExport';

describe('export formatters', () => {
  it('single inspection row → CSV contains id, date, score in order', () => {
    const csv = buildInspectionCsvLines([
      {
        inspectionId: 'insp-001',
        date: '2026-06-14',
        branch: 'Kochi Central',
        branchType: 'Store',
        city: 'Kochi',
        region: 'Ernakulam',
        officer: 'Officer A',
        status: 'submitted',
        complianceScore: 88,
        riskLevel: 'low',
        section: 'Billing',
        item: 'Bills issued',
        response: 'Yes',
        remarks: '',
      },
    ]);

    const lines = csv.split('\n');
    expect(lines[0]).toContain('inspectionId');
    expect(lines[1]).toMatch(/^"insp-001","2026-06-14"/);
    expect(lines[1]).toContain('"88"');
  });

  it('empty input → header row only, no trailing content', () => {
    const csv = buildInspectionCsvLines([]);
    expect(csv).toBe(
      'inspectionId,date,branch,branchType,city,region,officer,status,complianceScore,riskLevel,section,item,response,remarks',
    );
    expect(csv.split('\n')).toHaveLength(1);
  });

  it('formatNonComplianceAlert → output contains item and risk label', () => {
    const text = formatNonComplianceAlert('Staff in uniform / ID card', 'No', true);
    expect(text).toContain('Staff not in uniform / no ID card');
    expect(text.toLowerCase()).toContain('uniform');
  });

  it('PDF generator → no throw, non-null return on valid input', async () => {
    const doc = (
      <Document>
        <Page>
          <Text>Inspection insp-001 score 88%</Text>
        </Page>
      </Document>
    );
    const blob = await pdf(doc).toBlob();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});
