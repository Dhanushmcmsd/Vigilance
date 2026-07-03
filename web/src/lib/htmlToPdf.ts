/** Render styled HTML report documents to multi-page PDF blobs in the browser. */

function extractBodyHtml(documentHtml: string): string {
  const match = documentHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match?.[1]?.trim() ?? documentHtml;
}

function extractStyles(documentHtml: string): string {
  const match = documentHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  return match?.[1]?.trim() ?? '';
}

export async function renderHtmlDocumentToPdfBlob(documentHtml: string): Promise<Blob> {
  const bodyHtml = extractBodyHtml(documentHtml);
  const styles = extractStyles(documentHtml);

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-12000px';
  host.style.top = '0';
  host.style.width = '920px';
  host.style.background = '#f8fafc';
  host.style.zIndex = '-1';
  host.innerHTML = `<style>${styles}</style>${bodyHtml}`;
  document.body.appendChild(host);

  try {
    const shell = host.querySelector('.report-shell') as HTMLElement | null;
    const target = shell ?? host;

    const [{ jsPDF }, html2canvasModule] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ]);
    const html2canvas = html2canvasModule.default;

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#f8fafc',
      logging: false,
      width: 920,
      windowWidth: 920,
    });

    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const contentWidth = pageWidth - margin * 2;
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let offsetY = 0;
    let pageIndex = 0;

    while (offsetY < imgHeight) {
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.92),
        'JPEG',
        margin,
        margin - offsetY,
        imgWidth,
        imgHeight,
      );
      offsetY += pageHeight - margin * 2;
      pageIndex += 1;
    }

    return pdf.output('blob');
  } finally {
    host.remove();
  }
}
