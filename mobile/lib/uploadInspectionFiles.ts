import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';
import type { ItemAttachment } from '../components/ItemAttachments';

function resolveFileType(file: { type?: string; name?: string }): string {
  if (file.type === 'image') return 'image';
  const ext = (file.name ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) return 'image';
  return file.type ?? 'document';
}

function base64ToUint8Array(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const output: number[] = [];

  for (let i = 0; i < clean.length; i += 4) {
    const e1 = chars.indexOf(clean[i]);
    const e2 = chars.indexOf(clean[i + 1]);
    const e3 = chars.indexOf(clean[i + 2]);
    const e4 = chars.indexOf(clean[i + 3]);

    const c1 = (e1 << 2) | (e2 >> 4);
    output.push(c1);

    if (clean[i + 2] !== '=') {
      const c2 = ((e2 & 15) << 4) | (e3 >> 2);
      output.push(c2);
    }
    if (clean[i + 3] !== '=') {
      const c3 = ((e3 & 3) << 6) | e4;
      output.push(c3);
    }
  }

  return new Uint8Array(output);
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
        const path = `inspections/${inspectionId}/${checklistItemId}_${Date.now()}_${file.name}`;
        const imageExt = ext === 'jpg' || ext === 'bin' ? 'jpeg' : ext;

        // Resolve contentType before blob creation
        const contentType =
          resolvedType === 'image'
            ? `image/${imageExt}`
            : 'application/octet-stream';

        let blob: Blob;
        try {
          const base64 = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const byteArray = base64ToUint8Array(base64);
          blob = new Blob([byteArray], { type: contentType });
        } catch {
          // fallback for http/https URIs (non-camera files)
          blob = await (await fetch(file.uri)).blob();
        }

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('inspection-files')
          .upload(path, blob, { contentType });
        if (uploadErr || !uploadData) {
          const errMsg = uploadErr?.message || 'Upload failed';
          errors.push(`Failed to upload ${file.name}: ${errMsg}`);
          failedCount++;
          return;
        }
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
            console.warn(`Warning: could not record photo metadata for ${file.name}`, upsertErr);
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
