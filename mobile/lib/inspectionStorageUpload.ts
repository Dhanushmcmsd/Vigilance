import * as FileSystem from 'expo-file-system';
import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

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

function normalizeUploadUri(uri: string): string {
  if (uri.startsWith('file://') || uri.startsWith('content://')) return uri;
  return `file://${uri}`;
}

function encodeObjectPath(objectPath: string): string {
  return objectPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function parseStorageErrorBody(body: string | undefined): string {
  if (!body) return 'Unknown storage error';
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string; statusCode?: string };
    return parsed.message || parsed.error || body;
  } catch {
    return body.slice(0, 240);
  }
}

export function getInspectionFilePublicUrl(objectPath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

async function assertLocalFileReadable(localUri: string): Promise<number> {
  const uri = normalizeUploadUri(localUri);
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info.exists) {
    throw new Error('File not found on device. Please capture or select it again.');
  }
  const size = 'size' in info && typeof info.size === 'number' ? info.size : 0;
  if (!size || size <= 0) {
    throw new Error('File is empty. Please capture or select it again.');
  }
  return size;
}

/**
 * Upload via Expo FileSystem (native) instead of supabase-js Blob uploads.
 * Blob uploads intermittently return HTTP 400 / "Network request failed" on Android.
 */
async function uploadLocalFileToInspectionBucket(
  localUri: string,
  objectPath: string,
  contentType: string,
): Promise<string> {
  const uri = normalizeUploadUri(localUri);
  await assertLocalFileReadable(uri);

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    throw new Error('Session expired. Please sign in again.');
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase is not configured on this device.');
  }

  const uploadUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${BUCKET}/${encodeObjectPath(objectPath)}`;
  const result = await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
      'Content-Type': contentType,
      'x-upsert': 'false',
    },
  });

  if (result.status < 200 || result.status >= 300) {
    const detail = parseStorageErrorBody(result.body);
    throw new Error(`Storage upload failed (${result.status}): ${detail}`);
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
  const fileUrl = await uploadLocalFileToInspectionBucket(
    localUri,
    objectPath,
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
  const fileUrl = await uploadLocalFileToInspectionBucket(localUri, objectPath, 'application/octet-stream');

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
  const fileSizeBytes = await assertLocalFileReadable(localUri);
  const fileUrl = await uploadLocalFileToInspectionBucket(
    localUri,
    objectPath,
    resolveVideoContentType(fileName),
  );

  const { error: insertErr } = await supabase.from('inspection_files').insert({
    inspection_id: inspectionId,
    checklist_item_id: checklistItemId,
    file_url: fileUrl,
    file_name: fileName,
    file_type: 'video',
    duration_seconds: durationSeconds,
    file_size_bytes: fileSizeBytes,
  });
  if (insertErr) {
    throw new Error(`Failed to record video in database: ${insertErr.message}`);
  }

  return {
    fileUrl,
    fileName,
    fileSizeBytes,
  };
}
