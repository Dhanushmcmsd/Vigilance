import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
  pdf,
} from '@react-pdf/renderer';
import { saveAs } from './pdf-saver';

// Register a single sans-serif fallback. We avoid loading remote fonts so the
// PDF generates offline / inside the browser without network access.

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#111827',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: 1,
    borderBottomColor: '#d1d5db',
    paddingBottom: 12,
    marginBottom: 16,
  },
  brand: { fontSize: 18, fontWeight: 700, color: '#1e3a8a', letterSpacing: 1 },
  brandSub: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  metaLine: { fontSize: 9, color: '#374151', marginTop: 2 },
  h1: { fontSize: 16, fontWeight: 700, marginBottom: 6 },
  h2: { fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 6, color: '#1f2937' },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kpiBox: {
    flex: 1,
    border: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    padding: 8,
  },
  kpiLabel: { fontSize: 8, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 },
  kpiValue: { fontSize: 16, fontWeight: 700, marginTop: 2 },
  table: { width: '100%', border: 1, borderColor: '#e5e7eb', borderRadius: 4, marginTop: 4 },
  tr: { flexDirection: 'row', borderBottom: 1, borderBottomColor: '#f3f4f6' },
  trLast: { flexDirection: 'row' },
  th: { fontSize: 9, fontWeight: 700, padding: 6, backgroundColor: '#f9fafb', color: '#374151' },
  td: { fontSize: 9, padding: 6 },
  pill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, fontSize: 8, fontWeight: 700 },
  pillYes: { backgroundColor: '#dcfce7', color: '#166534' },
  pillNo: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  pillNa: { backgroundColor: '#e5e7eb', color: '#374151' },
  remark: { fontSize: 8, color: '#6b7280', marginTop: 2, fontStyle: 'italic' },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#9ca3af',
    borderTop: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  photo: { width: 140, height: 100, objectFit: 'cover', borderRadius: 4 },
});

export interface InspectionPdfResponse {
  section: string;
  item_text: string;
  response: 'Yes' | 'No' | 'N/A' | string;
  remarks?: string | null;
  risk_level?: 'RED' | 'YELLOW' | 'GREEN' | null;
}

export interface InspectionPdfData {
  id: string;
  branchName: string;
  branchType: string;
  officerName: string;
  city?: string | null;
  inspectionDate: string;
  submittedAt?: string | null;
  timeIn?: string | null;
  timeOut?: string | null;
  complianceScore: number;
  riskLevel: string;
  status: string;
  headComment?: string | null;
  generalRemark?: string | null;
  responses: InspectionPdfResponse[];
  photos?: { url: string; name?: string }[];
}

const responsePillStyle = (r: string) =>
  r === 'Yes' ? styles.pillYes : r === 'No' ? styles.pillNo : styles.pillNa;

/**
 * PDF rendering of a single inspection. Pure presentational component —
 * `generateInspectionPdf()` below is what callers actually invoke.
 */
export function InspectionReportDoc({ data }: { data: InspectionPdfData }) {
  // Group responses by section, preserving original order of first appearance.
  const grouped = new Map<string, InspectionPdfResponse[]>();
  for (const r of data.responses) {
    if (!grouped.has(r.section)) grouped.set(r.section, []);
    grouped.get(r.section)!.push(r);
  }

  return (
    <Document
      title={`Inspection – ${data.branchName} – ${data.inspectionDate}`}
      author="Vigilance Management System"
    >
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>VIGILANCE MS</Text>
            <Text style={styles.brandSub}>Inspection Report</Text>
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text style={styles.metaLine}>Generated: {new Date().toLocaleString('en-IN')}</Text>
            <Text style={styles.metaLine}>Inspection ID: {data.id.slice(0, 8)}</Text>
          </View>
        </View>

        <Text style={styles.h1}>{data.branchName}</Text>
        <Text style={styles.metaLine}>
          {data.branchType}
          {data.city ? ` · ${data.city}` : ''} · Officer: {data.officerName}
        </Text>
        <Text style={styles.metaLine}>
          Inspection date: {data.inspectionDate}
          {data.timeIn || data.timeOut
            ? ` · ${data.timeIn ?? '—'} → ${data.timeOut ?? '—'}`
            : ''}
        </Text>

        {/* KPIs */}
        <View style={[styles.kpiRow, { marginTop: 14 }]}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Compliance</Text>
            <Text style={styles.kpiValue}>{data.complianceScore.toFixed(1)}%</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Risk Level</Text>
            <Text style={styles.kpiValue}>{data.riskLevel.toUpperCase()}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Status</Text>
            <Text style={styles.kpiValue}>{data.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Supervisor comment */}
        {data.headComment ? (
          <View>
            <Text style={styles.h2}>Supervisor Comment</Text>
            <Text>{data.headComment}</Text>
          </View>
        ) : null}

        {/* General remark */}
        {data.generalRemark ? (
          <View>
            <Text style={styles.h2}>General Remarks</Text>
            <Text>{data.generalRemark}</Text>
          </View>
        ) : null}

        {/* Checklist */}
        <Text style={styles.h2}>Checklist Responses</Text>
        {Array.from(grouped.entries()).map(([section, items]) => (
          <View key={section} style={{ marginBottom: 6 }} wrap={false}>
            <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: '#374151' }}>
              {section}
            </Text>
            <View style={styles.table}>
              {/* header row */}
              <View style={styles.tr}>
                <Text style={[styles.th, { flex: 4 }]}>Item</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Response</Text>
                <Text style={[styles.th, { flex: 0.8, textAlign: 'center' }]}>Risk</Text>
              </View>
              {items.map((r, i) => (
                <View
                  key={`${r.section}-${i}`}
                  style={i === items.length - 1 ? styles.trLast : styles.tr}
                >
                  <View style={{ flex: 4, padding: 6 }}>
                    <Text style={{ fontSize: 9 }}>{r.item_text}</Text>
                    {r.remarks ? <Text style={styles.remark}>“{r.remarks}”</Text> : null}
                  </View>
                  <View
                    style={{
                      flex: 1,
                      padding: 6,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={[styles.pill, responsePillStyle(r.response)]}>{r.response}</Text>
                  </View>
                  <Text
                    style={[styles.td, { flex: 0.8, textAlign: 'center', fontWeight: 700 }]}
                  >
                    {r.risk_level ?? '—'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Photos */}
        {data.photos && data.photos.length > 0 && (
          <View break>
            <Text style={styles.h2}>Photos</Text>
            <View style={styles.photoGrid}>
              {data.photos.slice(0, 12).map((p, i) => (
                <Image key={i} src={p.url} style={styles.photo} />
              ))}
            </View>
          </View>
        )}

        {/* Footer (rendered on every page) */}
        <View
          style={styles.footer}
          fixed
          render={({ pageNumber }) => (
            <>
              <Text>Vigilance Management System — CONFIDENTIAL</Text>
              <Text>Page {pageNumber}</Text>
            </>
          )}
        />
      </Page>
    </Document>
  );
}

/**
 * Generate a PDF blob for the given inspection and trigger a browser download.
 * Returns the filename so callers can show "Downloaded foo.pdf" toasts.
 */
export async function generateInspectionPdf(data: InspectionPdfData): Promise<string> {
  const blob = await pdf(<InspectionReportDoc data={data} />).toBlob();
  const safeBranch = data.branchName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const filename = `inspection-${safeBranch}-${data.inspectionDate}.pdf`;
  saveAs(blob, filename);
  return filename;
}
