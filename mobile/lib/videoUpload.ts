import * as FileSystem from 'expo-file-system';
import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

const BUCKET = 'inspection-files';

export interface VideoUploadResult {
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
}

function encodeStoragePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function uploadBinaryToBucket(
  objectPath: string,
  fileUri: string,
  contentType: string,
): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration for video upload');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  let accessToken = sessionData.session?.access_token ?? null;
  if (!accessToken) {
    const refresh = await supabase.auth.refreshSession();
    accessToken = refresh.data.session?.access_token ?? null;
  }
  if (!accessToken) {
    throw new Error('Session expired while uploading video. Please sign in again.');
  }

  const uploadUrl = `${supabaseUrl}/storage/v1/object/${BUCKET}/${encodeStoragePath(objectPath)}`;
  const headers: Record<string, string> = {
    apikey: supabaseAnonKey,
    'Content-Type': contentType,
    'x-upsert': 'false',
    Authorization: `Bearer ${accessToken}`,
  };

  const uploadOnce = async (httpMethod: 'POST' | 'PUT') =>
    FileSystem.uploadAsync(uploadUrl, fileUri, {
      httpMethod,
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers,
    });

  let response = await uploadOnce('POST');
  if (response.status < 200 || response.status >= 300) {
    const retry = await uploadOnce('PUT');
    if (retry.status >= 200 && retry.status < 300) return;
    const body = ((retry.body || response.body) || '').slice(0, 280);
    throw new Error(`Video storage upload failed (${retry.status}) ${body}`);
  }
}

export async function uploadInspectionVideo(
  localUri: string,
  inspectionId: string,
  checklistItemId: string | null,
  durationSeconds: number,
): Promise<VideoUploadResult> {
  const fileName = `inspection_${inspectionId}_video_${Date.now()}.mp4`;
  const objectPath = `inspections/${inspectionId}/${checklistItemId ?? 'general'}_${Date.now()}_${fileName}`;

  let fileSizeBytes = 0;
  try {
    const blob = await fetch(localUri).then((r) => r.blob());
    fileSizeBytes = blob.size;
  } catch {
    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists && 'size' in info && typeof info.size === 'number') {
      fileSizeBytes = info.size;
    }
  }

  await uploadBinaryToBucket(objectPath, localUri, 'video/mp4');

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

  const { error: insertErr } = await supabase.from('inspection_files').insert({
    inspection_id: inspectionId,
    checklist_item_id: checklistItemId,
    file_url: urlData.publicUrl,
    file_name: fileName,
    file_type: 'video',
    duration_seconds: durationSeconds,
    file_size_bytes: fileSizeBytes || null,
  });

  if (insertErr) {
    throw new Error(`Failed to record video in database: ${insertErr.message}`);
  }

  return {
    fileUrl: urlData.publicUrl,
    fileName,
    fileSizeBytes,
  };
}

export async function deleteInspectionVideo(fileId: string, filePath: string): Promise<void> {
  const { error: dbErr } = await supabase.from('inspection_files').delete().eq('id', fileId);
  if (dbErr) {
    throw new Error(`Failed to delete video record: ${dbErr.message}`);
  }

  const { error: storageErr } = await supabase.storage.from(BUCKET).remove([filePath]);
  if (storageErr) {
    throw new Error(`Failed to delete video file: ${storageErr.message}`);
  }
}
