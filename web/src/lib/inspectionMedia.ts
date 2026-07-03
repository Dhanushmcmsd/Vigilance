import { supabase } from './supabase';
import {
  dedupeInspectionImageFiles,
  normalizeInspectionImageUrl,
  type InspectionImageFile,
} from './inspectionImages';

const INSPECTION_FILES_BUCKET = 'inspection-files';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface InspectionMediaFile {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  checklist_item_id?: string | null;
  duration_seconds?: number | null;
  file_size_bytes?: number | null;
  uploaded_at?: string | null;
}

export interface InspectionAnswerPhoto {
  checklist_item_id: string | null;
  photo_url: string | null;
}

export function isInspectionVideoFile(file: {
  file_url: string;
  file_name?: string;
  file_type?: string;
}): boolean {
  const type = (file.file_type ?? '').toLowerCase();
  const name = (file.file_name ?? '').toLowerCase();
  const url = (file.file_url ?? '').toLowerCase();
  return type === 'video' || /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(name) || /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(url);
}

export function extractInspectionStoragePath(fileUrl: string): string | null {
  const trimmed = fileUrl.trim();
  if (!trimmed) return null;

  const markers = [
    '/storage/v1/object/public/inspection-files/',
    '/storage/v1/object/sign/inspection-files/',
    '/storage/v1/object/authenticated/inspection-files/',
    '/storage/v1/object/inspection-files/',
  ];

  for (const marker of markers) {
    const index = trimmed.indexOf(marker);
    if (index === -1) continue;
    const path = decodeURIComponent(trimmed.slice(index + marker.length).split('?')[0]?.split('#')[0] ?? '');
    return path || null;
  }

  return null;
}

export async function resolveInspectionMediaUrl(fileUrl: string): Promise<string> {
  const storagePath = extractInspectionStoragePath(fileUrl);
  if (!storagePath) return fileUrl;

  const { data, error } = await supabase.storage
    .from(INSPECTION_FILES_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    if (import.meta.env.DEV) {
      console.warn('[inspectionMedia] signed URL failed, using stored URL', error?.message);
    }
    return fileUrl;
  }

  return data.signedUrl;
}

export async function resolveInspectionMediaUrls<T extends { file_url: string }>(
  files: T[],
): Promise<(T & { resolved_url: string })[]> {
  return Promise.all(
    files.map(async (file) => ({
      ...file,
      resolved_url: await resolveInspectionMediaUrl(file.file_url),
    })),
  );
}

export function collectInspectionImageFiles(
  files: InspectionMediaFile[],
  answers: InspectionAnswerPhoto[] = [],
): InspectionMediaFile[] {
  const dedupedFiles = dedupeInspectionImageFiles(files as InspectionImageFile[]);
  const seen = new Set(dedupedFiles.map((file) => normalizeInspectionImageUrl(file.file_url)));

  const answerImages: InspectionMediaFile[] = [];
  answers.forEach((answer, index) => {
    if (!answer.photo_url) return;
    const key = normalizeInspectionImageUrl(answer.photo_url);
    if (!key || seen.has(key)) return;
    seen.add(key);
    answerImages.push({
      id: `answer:${answer.checklist_item_id ?? 'general'}:${index}`,
      file_url: answer.photo_url,
      file_name: 'Gallery photo',
      file_type: 'image',
      checklist_item_id: answer.checklist_item_id,
    });
  });

  return [...dedupedFiles, ...answerImages];
}

export function collectItemImageAttachments(
  files: InspectionMediaFile[],
  answers: InspectionAnswerPhoto[],
  checklistItemId: string,
): InspectionMediaFile[] {
  return collectInspectionImageFiles(
    files.filter((file) => file.checklist_item_id === checklistItemId),
    answers.filter((answer) => answer.checklist_item_id === checklistItemId),
  );
}

export function collectInspectionVideoFiles(files: InspectionMediaFile[]): InspectionMediaFile[] {
  const seen = new Set<string>();
  return files.filter((file) => {
    if (!isInspectionVideoFile(file)) return false;
    const key = normalizeInspectionImageUrl(file.file_url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function downloadInspectionMediaFile(
  fileUrl: string,
  fileName: string,
): Promise<void> {
  const resolvedUrl = await resolveInspectionMediaUrl(fileUrl);
  const response = await fetch(resolvedUrl);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName || 'inspection-media';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}
