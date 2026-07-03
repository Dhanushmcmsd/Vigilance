/**
 * Tiny file-saver shim — we don't want to drag the whole `file-saver` package
 * in for a single helper. Uses an anchor + object URL, with a microtask to
 * revoke the URL so Safari has time to start the download.
 */
export function saveAs(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
