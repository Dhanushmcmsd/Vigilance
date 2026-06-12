import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';

const BUCKET = 'inspection-files';

function sanitizeFileName(name: string, fallbackExt = 'bin'): string {
  const trimmed = name.trim() || `file_${Date.now()}.${fallbackExt}`;
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function resolveImageContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? 'jpg';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'heif') return 'image/heif';
  return 'image/jpeg';
}

function resolveVideoContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? 'mp4';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'webm') return 'video/webm';
  return 'video/mp4';
}

function buildObjectPath(inspectionId: string, checklistItemId: string, fileName: string): string {
  return `inspections/${inspectionId}/${checklistItemId}_${Date.now()}_${sanitizeFileName(fileName)}`;
}

export function getInspectionFilePublicUrl(objectPath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

async function readLocalFileBlob(uri: string): Promise<Blob> {
  try {
    const response = await fetch(uri);
    if (response.ok) {
      return await response.blob();
    }
  } catch {
    // Fall back to base64 read for devices where fetch(file://) is unreliable.
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const byteCharacters = atob(base64);
  const byteNumbers = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([byteNumbers]);
}

async function uploadBlobToInspectionBucket(
  objectPath: string,
  blob: Blob,
  contentType: string,
): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, blob, {
    contentType,
    upsert: false,
  });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
  return getInspectionFilePublicUrl(objectPath);
}

async function recordInspectionImage(
  inspectionId: string,
  checklistItemId: string,
  fileUrl: string,
  fileName: string,
): Promise<void> {
  const { error: insertErr } = await supabase.from('inspection_files').insert({
    inspection_id: inspectionId,
    checklist_item_id: checklistItemId,
    file_url: fileUrl,
    file_name: fileName,
    file_type: 'image',
  });
  if (insertErr) {
    throw new Error(`Failed to record photo in database: ${insertErr.message}`);
  }

  const uploadedAt = new Date().toISOString();
  const { error: upsertErr } = await supabase.from('inspection_answers').upsert(
    {
      inspection_id: inspectionId,
      checklist_item_id: checklistItemId,
      question_id: checklistItemId,
      photo_url: fileUrl,
      photo_uploaded_at: uploadedAt,
    },
    { onConflict: 'inspection_id,checklist_item_id' },
  );
  if (upsertErr && __DEV__) {
    console.warn('[inspectionStorageUpload] photo metadata upsert warning', upsertErr.message);
  }
}

export async function uploadInspectionImageFile(
  localUri: string,
  inspectionId: string,
  checklistItemId: string,
  fileName: string,
): Promise<{ fileUrl: string; fileName: string }> {
  const safeName = sanitizeFileName(fileName, 'jpg');
  const objectPath = buildObjectPath(inspectionId, checklistItemId, safeName);
  const blob = await readLocalFileBlob(localUri);
  const fileUrl = await uploadBlobToInspectionBucket(
    objectPath,
    blob,
    resolveImageContentType(safeName),
  );
  await recordInspectionImage(inspectionId, checklistItemId, fileUrl, safeName);
  return { fileUrl, fileName: safeName };
}

export async function uploadInspectionDocumentFile(
  localUri: string,
  inspectionId: string,
  checklistItemId: string,
  fileName: string,
): Promise<{ fileUrl: string; fileName: string }> {
  const safeName = sanitizeFileName(fileName, 'pdf');
  const objectPath = buildObjectPath(inspectionId, checklistItemId, safeName);
  const blob = await readLocalFileBlob(localUri);
  const fileUrl = await uploadBlobToInspectionBucket(objectPath, blob, 'application/octet-stream');

  const { error: insertErr } = await supabase.from('inspection_files').insert({
    inspection_id: inspectionId,
    checklist_item_id: checklistItemId,
    file_url: fileUrl,
    file_name: safeName,
    file_type: 'document',
  });
  if (insertErr) {
    throw new Error(`Failed to record document in database: ${insertErr.message}`);
  }

  return { fileUrl, fileName: safeName };
}

export async function uploadInspectionVideoFile(
  localUri: string,
  inspectionId: string,
  checklistItemId: string | null,
  durationSeconds: number,
  sourceFileName?: string,
): Promise<{ fileUrl: string; fileName: string; fileSizeBytes: number }> {
  const ext = sourceFileName?.split('.').pop()?.toLowerCase() || localUri.split('.').pop()?.toLowerCase() || 'mp4';
  const fileName = sanitizeFileName(
    sourceFileName ?? `inspection_${inspectionId}_video_${Date.now()}.${ext}`,
    ext,
  );
  const objectPath = buildObjectPath(inspectionId, checklistItemId ?? 'general', fileName);
  const blob = await readLocalFileBlob(localUri);
  const fileUrl = await uploadBlobToInspectionBucket(
    objectPath,
    blob,
    resolveVideoContentType(fileName),
  );

  const { error: insertErr } = await supabase.from('inspection_files').insert({
    inspection_id: inspectionId,
    checklist_item_id: checklistItemId,
    file_url: fileUrl,
    file_name: fileName,
    file_type: 'video',
    duration_seconds: durationSeconds,
    file_size_bytes: blob.size || null,
  });
  if (insertErr) {
    throw new Error(`Failed to record video in database: ${insertErr.message}`);
  }

  return {
    fileUrl,
    fileName,
    fileSizeBytes: blob.size,
  };
}
