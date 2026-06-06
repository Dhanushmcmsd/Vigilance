import { supabase } from './supabase';
import type { ItemAttachment } from '../components/ItemAttachments';

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
        const ext = file.name.split('.').pop() ?? 'bin';
        const path = `inspections/${inspectionId}/${checklistItemId}_${Date.now()}_${file.name}`;
        const blob = await (await fetch(file.uri)).blob();
        const contentType =
          file.type === 'image'
            ? `image/${ext === 'jpg' ? 'jpeg' : ext}`
            : 'application/octet-stream';
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
          file_type: file.type,
        });
        if (insertErr) {
          errors.push(`Failed to record ${file.name} in database: ${insertErr.message}`);
          failedCount++;
          return;
        }

        if (file.type === 'image') {
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
