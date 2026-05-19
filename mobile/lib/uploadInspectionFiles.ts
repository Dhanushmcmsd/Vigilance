import { supabase } from './supabase';
import type { ItemAttachment } from '../components/ItemAttachments';

export async function uploadInspectionFiles(
  inspectionId: string,
  itemFiles: Record<string, ItemAttachment[]>,
): Promise<void> {
  for (const [checklistItemId, attachments] of Object.entries(itemFiles)) {
    for (const file of attachments) {
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
      if (uploadErr || !uploadData) continue;
      const { data: urlData } = supabase.storage.from('inspection-files').getPublicUrl(path);
      await supabase.from('inspection_files').insert({
        inspection_id: inspectionId,
        checklist_item_id: checklistItemId,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_type: file.type,
      });
    }
  }
}
