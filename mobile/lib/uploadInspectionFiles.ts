import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';
import * as FileSystem from 'expo-file-system';
import type { ItemAttachment } from '../components/ItemAttachments';

function resolveFileType(file: { type?: string; name?: string }): string {
  if (file.type === 'image') return 'image';
  const ext = (file.name ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) return 'image';
  return file.type ?? 'document';
}

function encodeStoragePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function uploadBinaryToInspectionBucket(
  objectPath: string,
  fileUri: string,
  contentType: string,
): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration for file upload');
  }

  let localUri = fileUri;
  if (fileUri.startsWith('http://') || fileUri.startsWith('https://')) {
    const target = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}remote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const downloaded = await FileSystem.downloadAsync(fileUri, target);
    localUri = downloaded.uri;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  let accessToken = sessionData.session?.access_token ?? null;
  if (!accessToken) {
    const refresh = await supabase.auth.refreshSession();
    accessToken = refresh.data.session?.access_token ?? null;
  }
  if (!accessToken) {
    throw new Error('Session expired while uploading. Please sign in again.');
  }

  const uploadUrl = `${supabaseUrl}/storage/v1/object/inspection-files/${encodeStoragePath(objectPath)}`;
  const headers: Record<string, string> = {
    apikey: supabaseAnonKey,
    'Content-Type': contentType,
    'x-upsert': 'false',
    Authorization: `Bearer ${accessToken}`,
  };

  const uploadOnce = async (httpMethod: 'POST' | 'PUT') =>
    FileSystem.uploadAsync(uploadUrl, localUri, {
      httpMethod,
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers,
    });

  let response = await uploadOnce('POST');
  if (response.status < 200 || response.status >= 300) {
    // Some Android devices/proxies reject POST binary bodies for this endpoint.
    // Retry once with PUT before failing the submission.
    const retry = await uploadOnce('PUT');
    if (retry.status >= 200 && retry.status < 300) return;
    const body = ((retry.body || response.body) || '').slice(0, 280);
    throw new Error(`Storage upload failed (${retry.status}) ${body}`);
  }
}

export async function uploadInspectionFiles(
  inspectionId: string,
  itemFiles: Record<string, ItemAttachment[]>,
): Promise<{ successCount: number; failedCount: number; errors: string[] }> {
  const errors: string[] = [];
  let successCount = 0;
  let failedCount = 0;

  const uploadTasks = Object.entries(itemFiles).flatMap(([checklistItemId, attachments]) =>
    attachments.map(async (file) => {
      try {
        const ext = (file.name ?? '').split('.').pop()?.toLowerCase() ?? 'bin';
        const resolvedType = resolveFileType(file);
        const safeName = (file.name ?? `file_${Date.now()}.${ext || 'bin'}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `inspections/${inspectionId}/${checklistItemId}_${Date.now()}_${safeName}`;
        const imageExt = ext === 'jpg' || ext === 'bin' ? 'jpeg' : ext;

        // Resolve contentType before blob creation
        const contentType =
          resolvedType === 'image'
            ? `image/${imageExt}`
            : 'application/octet-stream';

        await uploadBinaryToInspectionBucket(path, file.uri, contentType);

        const { data: urlData } = supabase.storage.from('inspection-files').getPublicUrl(path);
        const { error: insertErr } = await supabase.from('inspection_files').insert({
          inspection_id: inspectionId,
          checklist_item_id: checklistItemId,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: resolvedType,
        });
        if (insertErr) {
          errors.push(`Failed to record ${file.name} in database: ${insertErr.message}`);
          failedCount++;
          return;
        }

        if (resolvedType === 'image') {
          const uploadedAt = new Date().toISOString();
          const { error: upsertErr } = await supabase
            .from('inspection_answers')
            .upsert(
              {
                inspection_id: inspectionId,
                checklist_item_id: checklistItemId,
                question_id: checklistItemId,
                photo_url: urlData.publicUrl,
                photo_uploaded_at: uploadedAt,
              },
              { onConflict: 'inspection_id,checklist_item_id' },
            );
          if (upsertErr) {
            if (__DEV__) console.warn(`Warning: could not record photo metadata for ${file.name}`, upsertErr);
          }
        }
        successCount++;
      } catch (err: any) {
        const msg = err?.message || 'Unknown error';
        errors.push(`Error uploading ${file.name}: ${msg}`);
        failedCount++;
      }
    }),
  );

  await Promise.allSettled(uploadTasks);
  return { successCount, failedCount, errors };
}
