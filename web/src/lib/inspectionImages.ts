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

export function isInspectionImageFile(file: {
  file_url: string;
  file_name?: string;
  file_type?: string;
}): boolean {
  const type = (file.file_type ?? '').toLowerCase();
  const name = (file.file_name ?? '').toLowerCase();
  const url = (file.file_url ?? '').toLowerCase();
  return (
    type === 'image' ||
    /\.(jpe?g|png|gif|webp|bmp|heic|heif)(\?|#|$)/i.test(name) ||
    /\.(jpe?g|png|gif|webp|bmp|heic|heif)(\?|#|$)/i.test(url)
  );
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
