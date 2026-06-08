export interface InspectionImageFile {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  checklist_item_id?: string | null;
}

/** Stable key for comparing the same uploaded file stored in multiple rows. */
export function normalizeInspectionImageUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return url.trim().split('?')[0]?.split('#')[0]?.toLowerCase() ?? '';
  }
}

export function isInspectionImageFile(file: { file_url: string; file_type?: string }): boolean {
  return file.file_type === 'image' || /\.(jpe?g|png|gif|webp|bmp)(\?|#|$)/i.test(file.file_url);
}

/** Remove duplicate image rows that share the same underlying file URL. */
export function dedupeInspectionImageFiles<T extends InspectionImageFile>(files: T[]): T[] {
  const seen = new Set<string>();
  return files.filter((file) => {
    if (!isInspectionImageFile(file)) return false;
    const key = normalizeInspectionImageUrl(file.file_url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
