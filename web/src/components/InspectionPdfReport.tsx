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
import { isCompliantResponse } from '../lib/checklistScoring';

Font.registerHyphenationCallback((word) => [word]);

const BRAND = '#1e3a5f';
const MUTED = '#64748b';
const BORDER = '#e2e8f0';

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  coverBand: {
    backgroundColor: BRAND,
    marginHorizontal: -40,
    marginTop: -44,
    paddingHorizontal: 40,
    paddingTop: 36,
    paddingBottom: 28,
    marginBottom: 20,
  },
  coverTitle: { fontSize: 22, fontWeight: 700, color: '#ffffff', letterSpacing: 0.5 },
  coverSubtitle: { fontSize: 11, color: '#cbd5e1', marginTop: 6 },
  coverMeta: { fontSize: 9, color: '#e2e8f0', marginTop: 14, lineHeight: 1.5 },
  docRef: {
    fontSize: 8,
    color: MUTED,
    textAlign: 'right',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  executiveBox: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#f8fafc',
  },
  executiveTitle: { fontSize: 10, fontWeight: 700, color: BRAND, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  kpiRow: { flexDirection: 'row' },
  kpi: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 4, padding: 8, backgroundColor: '#ffffff' },
  kpiLabel: { fontSize: 7, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8 },
  kpiValue: { fontSize: 14, fontWeight: 700, marginTop: 4, color: BRAND },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: BRAND,
    marginTop: 14,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  itemCardFail: { borderColor: '#fecaca', backgroundColor: '#fffbfb' },
  itemCardPass: { borderColor: '#bbf7d0', backgroundColor: '#fafdfa' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  itemText: { fontSize: 9, fontWeight: 600, flex: 1, paddingRight: 8, lineHeight: 1.4 },
  statusPill: { fontSize: 8, fontWeight: 700, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  pillPass: { backgroundColor: '#dcfce7', color: '#166534' },
  pillFail: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  pillNa: { backgroundColor: '#f1f5f9', color: '#475569' },
  remark: { fontSize: 8, color: MUTED, fontStyle: 'italic', marginTop: 4, lineHeight: 1.4 },
  evidenceLabel: { fontSize: 7, color: MUTED, marginTop: 8, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap' },
  photo: { width: 120, height: 86, objectFit: 'cover', borderRadius: 3, borderWidth: 1, borderColor: BORDER },
  docChip: { fontSize: 7, color: '#334155', backgroundColor: '#f1f5f9', padding: 4, borderRadius: 3, marginTop: 4 },
  footer: {
    position: 'absolute',
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  h2: { fontSize: 10, fontWeight: 700, marginTop: 10, marginBottom: 4, color: '#334155' },
  body: { fontSize: 9, lineHeight: 1.5, color: '#334155' },
});

export interface InspectionPdfAttachment {
  url: string;
  name?: string;
  type?: 'image' | 'document';
}

export interface InspectionPdfResponse {
  section: string;
  item_text: string;
  response: 'Yes' | 'No' | 'N/A' | string;
  remarks?: string | null;
  risk_level?: 'RED' | 'YELLOW' | 'GREEN' | null;
  trigger_on_no?: boolean;
  attachments?: InspectionPdfAttachment[];
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
  /** Legacy flat photo list — prefer per-response attachments */
  photos?: { url: string; name?: string }[];
}

export interface GenerateInspectionPdfOptions {
  filenamePrefix?: string;
  documentTitle?: string;
}

function statusForItem(r: InspectionPdfResponse): 'pass' | 'fail' | 'na' {
  if (!r.response || r.response === 'N/A') return 'na';
  const trigger = r.trigger_on_no ?? true;
  return isCompliantResponse(r.response, trigger) ? 'pass' : 'fail';
}

function formatRef(id: string, date: string) {
  return `VMS-AUD-${date.replace(/-/g, '')}-${id.slice(0, 8).toUpperCase()}`;
}

function sanitizePdfText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizePdfData(data: InspectionPdfData): InspectionPdfData {
  return {
    ...data,
    branchName: sanitizePdfText(data.branchName) || 'Unknown',
    branchType: sanitizePdfText(data.branchType) || '—',
    officerName: sanitizePdfText(data.officerName) || '—',
    city: data.city ? sanitizePdfText(data.city) : data.city,
    inspectionDate: sanitizePdfText(data.inspectionDate),
    riskLevel: sanitizePdfText(data.riskLevel) || 'low',
    status: sanitizePdfText(data.status) || 'submitted',
    headComment: data.headComment ? sanitizePdfText(data.headComment) : null,
    generalRemark: data.generalRemark ? sanitizePdfText(data.generalRemark) : null,
    responses: data.responses.map((response) => ({
      ...response,
      section: sanitizePdfText(response.section) || 'General',
      item_text: sanitizePdfText(response.item_text) || 'Checklist item',
      response: sanitizePdfText(response.response) || '—',
      remarks: response.remarks ? sanitizePdfText(response.remarks) : null,
    })),
  };
}

export function InspectionReportDoc({ data }: { data: InspectionPdfData }) {
  const grouped = new Map<string, InspectionPdfResponse[]>();
  for (const r of data.responses) {
    if (!grouped.has(r.section)) grouped.set(r.section, []);
    grouped.get(r.section)!.push(r);
  }

  const failCount = data.responses.filter((r) => statusForItem(r) === 'fail').length;
  const passCount = data.responses.filter((r) => statusForItem(r) === 'pass').length;
  const hasAnyEvidence = data.responses.some((r) => (r.attachments?.length ?? 0) > 0);

  return (
    <Document
      title={`Store Audit — ${data.branchName} — ${data.inspectionDate}`}
      author="Vigilance Management System"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.coverBand}>
          <Text style={styles.coverTitle}>STORE COMPLIANCE AUDIT REPORT</Text>
          <Text style={styles.coverSubtitle}>Vigilance Management System · Confidential</Text>
          <Text style={styles.coverMeta}>
            {data.branchName}
            {data.city ? ` · ${data.city}` : ''}
            {'\n'}
            {data.branchType} · Officer: {data.officerName}
            {'\n'}
            Inspection date: {data.inspectionDate}
            {data.timeIn || data.timeOut ? ` · ${data.timeIn ?? '—'} – ${data.timeOut ?? '—'}` : ''}
            {data.submittedAt ? `\nSubmitted: ${new Date(data.submittedAt).toLocaleString('en-IN')}` : ''}
          </Text>
        </View>

        <Text style={styles.docRef}>{formatRef(data.id, data.inspectionDate)}</Text>

        <View style={styles.executiveBox}>
          <Text style={styles.executiveTitle}>Executive summary</Text>
          <View style={styles.kpiRow}>
            <View style={[styles.kpi, { marginRight: 8 }]}>
              <Text style={styles.kpiLabel}>Compliance score</Text>
              <Text style={styles.kpiValue}>{data.complianceScore.toFixed(1)}%</Text>
            </View>
            <View style={[styles.kpi, { marginRight: 8 }]}>
              <Text style={styles.kpiLabel}>Overall risk</Text>
              <Text style={styles.kpiValue}>{data.riskLevel.toUpperCase()}</Text>
            </View>
            <View style={[styles.kpi, { marginRight: 8 }]}>
              <Text style={styles.kpiLabel}>Findings</Text>
              <Text style={styles.kpiValue}>
                {failCount} NC · {passCount} OK
              </Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Status</Text>
              <Text style={styles.kpiValue}>{data.status.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={[styles.body, { marginTop: 8 }]}>
            This report documents a structured field audit of retail operations, statutory controls,
            and store security. Non-conformances (NC) are derived from each question's expected
            compliant answer. Photographic evidence is shown inline where provided by the inspecting officer.
          </Text>
        </View>

        {data.headComment ? (
          <View>
            <Text style={styles.h2}>Supervisor review</Text>
            <Text style={styles.body}>{data.headComment}</Text>
          </View>
        ) : null}

        {data.generalRemark ? (
          <View>
            <Text style={styles.h2}>General observations</Text>
            <Text style={styles.body}>{data.generalRemark}</Text>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Detailed audit findings</Text>

        {Array.from(grouped.entries()).map(([section, items]) => (
          <View key={section}>
            <Text style={styles.sectionTitle}>{section}</Text>
            {items.map((r, i) => {
              const status = statusForItem(r);
              const images = (r.attachments ?? []).filter(
                (a) => a.type !== 'document' && /\.(jpe?g|png|webp|gif)$/i.test(a.url),
              );
              const docs = (r.attachments ?? []).filter((a) => a.type === 'document' || !/\.(jpe?g|png|webp|gif)$/i.test(a.url));

              return (
                <View
                  key={`${section}-${i}`}
                  style={[
                    styles.itemCard,
                    status === 'fail' ? styles.itemCardFail : status === 'pass' ? styles.itemCardPass : {},
                  ]}
                  wrap={false}
                >
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemText}>{r.item_text}</Text>
                    <Text
                      style={[
                        styles.statusPill,
                        status === 'pass' ? styles.pillPass : status === 'fail' ? styles.pillFail : styles.pillNa,
                      ]}
                    >
                      {status === 'pass'
                        ? 'COMPLIANT'
                        : status === 'fail'
                          ? 'NON-CONFORMANCE'
                          : 'N/A'}
                      {' · '}
                      {r.response}
                    </Text>
                  </View>
                  {r.risk_level ? (
                    <Text style={{ fontSize: 7, color: MUTED, marginBottom: 2 }}>
                      Risk classification: {r.risk_level}
                    </Text>
                  ) : null}
                  {r.remarks ? <Text style={styles.remark}>Officer remark: {r.remarks}</Text> : null}
                  {images.length > 0 && (
                    <View>
                      <Text style={styles.evidenceLabel}>Photographic evidence</Text>
                      <View style={styles.photoRow}>
                        {images.map((p, pi) => (
                          <Image key={pi} src={p.url} style={[styles.photo, { marginRight: 6, marginBottom: 6 }]} />
                        ))}
                      </View>
                    </View>
                  )}
                  {docs.length > 0 && (
                    <View>
                      <Text style={styles.evidenceLabel}>Supporting documents</Text>
                      {docs.map((d, di) => (
                        <Text key={di} style={styles.docChip}>
                          {d.name ?? `Document ${di + 1}`}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {!hasAnyEvidence && data.photos && data.photos.length > 0 && (
          <View break>
            <Text style={styles.sectionTitle}>Unassigned attachments</Text>
            <View style={styles.photoRow}>
              {data.photos.slice(0, 12).map((p, i) => (
                <Image key={i} src={p.url} style={[styles.photo, { marginRight: 6, marginBottom: 6 }]} />
              ))}
            </View>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>Vigilance Management System · CONFIDENTIAL · For internal audit use only</Text>
          <Text>Page 1</Text>
        </View>
      </Page>
    </Document>
  );
}

function BrowserInspectionReportDoc({
  data,
  documentTitle = 'STORE COMPLIANCE AUDIT REPORT',
}: {
  data: InspectionPdfData;
  documentTitle?: string;
}) {
  const grouped = new Map<string, InspectionPdfResponse[]>();
  for (const r of data.responses) {
    const section = r.section || 'General';
    if (!grouped.has(section)) grouped.set(section, []);
    grouped.get(section)!.push(r);
  }

  const failCount = data.responses.filter((r) => statusForItem(r) === 'fail').length;
  const passCount = data.responses.filter((r) => statusForItem(r) === 'pass').length;
  const photoEvidence = data.photos ?? [];

  return (
    <Document
      title={`${documentTitle} — ${data.branchName} — ${data.inspectionDate}`}
      author="Vigilance Management System"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.coverBand}>
          <Text style={styles.coverTitle}>{documentTitle}</Text>
          <Text style={styles.coverSubtitle}>Vigilance Management System · Confidential</Text>
          <Text style={styles.coverMeta}>
            {data.branchName}
            {data.city ? ` · ${data.city}` : ''}
            {'\n'}
            {data.branchType} · Officer: {data.officerName}
            {'\n'}
            Inspection date: {data.inspectionDate}
            {data.timeIn || data.timeOut ? ` · ${data.timeIn ?? '—'} – ${data.timeOut ?? '—'}` : ''}
            {data.submittedAt ? `\nSubmitted: ${new Date(data.submittedAt).toLocaleString('en-IN')}` : ''}
          </Text>
        </View>

        <Text style={styles.docRef}>{formatRef(data.id, data.inspectionDate)}</Text>

        <View style={styles.executiveBox}>
          <Text style={styles.executiveTitle}>Executive summary</Text>
          <View style={styles.kpiRow}>
            <View style={[styles.kpi, { marginRight: 8 }]}>
              <Text style={styles.kpiLabel}>Compliance score</Text>
              <Text style={styles.kpiValue}>{data.complianceScore.toFixed(1)}%</Text>
            </View>
            <View style={[styles.kpi, { marginRight: 8 }]}>
              <Text style={styles.kpiLabel}>Overall risk</Text>
              <Text style={styles.kpiValue}>{data.riskLevel.toUpperCase()}</Text>
            </View>
            <View style={[styles.kpi, { marginRight: 8 }]}>
              <Text style={styles.kpiLabel}>Findings</Text>
              <Text style={styles.kpiValue}>
                {failCount} NC · {passCount} OK
              </Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Status</Text>
              <Text style={styles.kpiValue}>{data.status.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {data.headComment ? (
          <View>
            <Text style={styles.h2}>Supervisor review</Text>
            <Text style={styles.body}>{data.headComment}</Text>
          </View>
        ) : null}

        {data.generalRemark ? (
          <View>
            <Text style={styles.h2}>General observations</Text>
            <Text style={styles.body}>{data.generalRemark}</Text>
          </View>
        ) : null}
      </Page>

      {Array.from(grouped.entries()).map(([section, items]) => (
        <Page key={section} size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>{section}</Text>
          {items.map((r, index) => {
            const status = statusForItem(r);
            return (
              <View
                key={`${section}-${index}`}
                style={[
                  styles.itemCard,
                  status === 'fail' ? styles.itemCardFail : status === 'pass' ? styles.itemCardPass : {},
                ]}
              >
                <View style={styles.itemHeader}>
                  <Text style={styles.itemText}>{r.item_text}</Text>
                  <Text
                    style={[
                      styles.statusPill,
                      status === 'pass' ? styles.pillPass : status === 'fail' ? styles.pillFail : styles.pillNa,
                    ]}
                  >
                    {r.response}
                  </Text>
                </View>
                {r.remarks ? <Text style={styles.remark}>Officer remark: {r.remarks}</Text> : null}
              </View>
            );
          })}
          <View style={styles.footer} fixed>
            <Text>Vigilance Management System · CONFIDENTIAL</Text>
            <Text>{section}</Text>
          </View>
        </Page>
      ))}

      {photoEvidence.length > 0 ? (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Photo evidence</Text>
          <View style={styles.photoRow}>
            {photoEvidence.map((photo, index) => (
              <Image
                key={`${photo.url.slice(0, 48)}-${index}`}
                src={photo.url}
                style={[styles.photo, { marginRight: 6, marginBottom: 6 }]}
              />
            ))}
          </View>
          <View style={styles.footer} fixed>
            <Text>Vigilance Management System · CONFIDENTIAL</Text>
            <Text>Photo evidence</Text>
          </View>
        </Page>
      ) : null}
    </Document>
  );
}

function MinimalInspectionReportDoc({ data }: { data: InspectionPdfData }) {
  return (
    <Document title={`Audit Report - ${data.branchName}`}>
      <Page size="A4" style={{ padding: 24, fontSize: 10, fontFamily: 'Helvetica', color: '#0f172a' }}>
        <Text style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Store Compliance Audit Report</Text>
        <Text>Store: {data.branchName}</Text>
        <Text>Branch Type: {data.branchType}</Text>
        <Text>Officer: {data.officerName}</Text>
        <Text>Inspection Date: {data.inspectionDate}</Text>
        <Text>Submitted At: {data.submittedAt ?? '-'}</Text>
        <Text>Compliance Score: {data.complianceScore.toFixed(1)}%</Text>
        <Text>Overall Risk: {data.riskLevel}</Text>
        <Text>Status: {data.status}</Text>

        <View style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Checklist Summary</Text>
          {data.responses.slice(0, 120).map((response, index) => (
            <View key={`${response.section}-${index}`} style={{ marginBottom: 6, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
              <Text>{response.section || 'General'} - {response.item_text || 'Checklist item'}</Text>
              <Text>Response: {response.response || '-'}</Text>
              {response.remarks ? <Text>Remark: {response.remarks}</Text> : null}
            </View>
          ))}
        </View>

        {data.generalRemark ? (
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>General Remark</Text>
            <Text>{data.generalRemark}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

function withoutImageEvidence(data: InspectionPdfData): InspectionPdfData {
  return {
    ...data,
    responses: data.responses.map((response) => ({
      ...response,
      attachments: (response.attachments ?? []).filter((item) => item.type === 'document'),
    })),
    photos: [],
  };
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  if (url.startsWith('data:')) return url;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function embedImagesForPdf(data: InspectionPdfData): Promise<InspectionPdfData> {
  const embeddedPhotos: NonNullable<InspectionPdfData['photos']> = [];
  const seenPhotoUrls = new Set<string>();

  for (const photo of data.photos ?? []) {
    const embedded = await fetchImageAsDataUrl(photo.url);
    if (!embedded || seenPhotoUrls.has(embedded)) continue;
    seenPhotoUrls.add(embedded);
    embeddedPhotos.push({ ...photo, url: embedded });
  }

  const responses = await Promise.all(
    data.responses.map(async (response) => {
      const attachments: InspectionPdfAttachment[] = [];
      for (const attachment of response.attachments ?? []) {
        if (attachment.type === 'document') {
          attachments.push(attachment);
          continue;
        }
        const embedded = await fetchImageAsDataUrl(attachment.url);
        if (embedded) attachments.push({ ...attachment, url: embedded });
      }
      return { ...response, attachments };
    }),
  );

  return { ...data, photos: embeddedPhotos, responses };
}

function dataUrlImageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
}

async function renderPdfBlob(
  data: InspectionPdfData,
  options?: GenerateInspectionPdfOptions,
): Promise<Blob> {
  return pdf(<BrowserInspectionReportDoc data={data} documentTitle={options?.documentTitle} />).toBlob();
}

async function renderMinimalPdfBlob(data: InspectionPdfData): Promise<Blob> {
  return pdf(<MinimalInspectionReportDoc data={data} />).toBlob();
}

async function renderJsPdfBlob(
  data: InspectionPdfData,
  options?: GenerateInspectionPdfOptions,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const maxWidth = 515;
  let y = 48;
  const pageHeight = doc.internal.pageSize.getHeight();
  const title = options?.documentTitle ?? 'STORE COMPLIANCE AUDIT REPORT';

  const ensureSpace = (height = 16) => {
    if (y + height > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeLine = (text: string, options?: { bold?: boolean; size?: number; gap?: number }) => {
    const size = options?.size ?? 10;
    const gap = options?.gap ?? size + 4;
    doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      ensureSpace(gap);
      doc.text(line, margin, y);
      y += gap;
    }
  };

  writeLine(title, { bold: true, size: 16, gap: 20 });
  writeLine(`${data.branchName} · ${data.inspectionDate}`, { bold: true, size: 12, gap: 16 });
  writeLine(`Officer: ${data.officerName} · Status: ${data.status}`);
  writeLine(`Compliance: ${data.complianceScore.toFixed(1)}% · Risk: ${data.riskLevel.toUpperCase()}`);
  if (data.timeIn || data.timeOut) writeLine(`Time: ${data.timeIn ?? '—'} – ${data.timeOut ?? '—'}`);
  if (data.headComment) {
    y += 6;
    writeLine('Supervisor review', { bold: true, size: 11, gap: 14 });
    writeLine(data.headComment);
  }
  if (data.generalRemark) {
    y += 6;
    writeLine('General observations', { bold: true, size: 11, gap: 14 });
    writeLine(data.generalRemark);
  }

  const grouped = new Map<string, InspectionPdfResponse[]>();
  for (const r of data.responses) {
    const section = r.section || 'General';
    if (!grouped.has(section)) grouped.set(section, []);
    grouped.get(section)!.push(r);
  }

  for (const [section, items] of grouped.entries()) {
    y += 8;
    writeLine(section.toUpperCase(), { bold: true, size: 11, gap: 14 });
    for (const item of items) {
      const remark = item.remarks ? ` — ${item.remarks}` : '';
      writeLine(`• ${item.item_text}: ${item.response}${remark}`, { gap: 12 });
    }
  }

  const photos = data.photos ?? [];
  if (photos.length > 0) {
    doc.addPage();
    y = margin;
    writeLine('PHOTO EVIDENCE', { bold: true, size: 11, gap: 16 });
    for (const photo of photos) {
      if (!photo.url.startsWith('data:')) continue;
      ensureSpace(130);
      try {
        doc.addImage(photo.url, dataUrlImageFormat(photo.url), margin, y, 170, 120);
        y += 130;
        if (photo.name) writeLine(photo.name, { gap: 10 });
      } catch {
        writeLine(photo.name ? `Photo: ${photo.name}` : 'Photo attachment', { gap: 12 });
      }
    }
  }

  return doc.output('blob');
}

function downloadBlob(
  blob: Blob,
  data: InspectionPdfData,
  filenamePrefix = 'audit-report',
): string {
  const safeBranch = data.branchName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const filename = `${filenamePrefix}-${safeBranch}-${data.inspectionDate}.pdf`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1000);
  return filename;
}

export async function generateInspectionPdf(
  data: InspectionPdfData,
  options?: GenerateInspectionPdfOptions,
): Promise<string> {
  const sanitized = sanitizePdfData(data);
  let withImages = sanitized;

  try {
    withImages = await embedImagesForPdf(sanitized);
  } catch (error) {
    console.warn('[PDF] Could not embed images, continuing with text-only export:', error);
  }

  const attempts: Array<{ label: string; run: () => Promise<Blob> }> = [
    { label: 'browser-layout-with-images', run: () => renderPdfBlob(withImages, options) },
    { label: 'browser-layout-text-only', run: () => renderPdfBlob(withoutImageEvidence(sanitized), options) },
    { label: 'minimal-layout-text-only', run: () => renderMinimalPdfBlob(withoutImageEvidence(sanitized)) },
    { label: 'jspdf-with-images', run: () => renderJsPdfBlob(withImages, options) },
    { label: 'jspdf-text-only', run: () => renderJsPdfBlob(withoutImageEvidence(sanitized), options) },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const blob = await attempt.run();
      if (!blob || blob.size === 0) {
        throw new Error(`PDF engine "${attempt.label}" returned an empty file.`);
      }
      return downloadBlob(blob, sanitized, options?.filenamePrefix);
    } catch (error) {
      lastError = error;
      console.error(`[PDF] ${attempt.label} failed:`, error);
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : 'Failed to generate PDF. Please try again.';
  throw new Error(message);
}
