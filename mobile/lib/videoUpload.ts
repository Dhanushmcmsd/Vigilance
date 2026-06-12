import { supabase } from './supabase';
import { uploadInspectionVideoFile } from './inspectionStorageUpload';

const BUCKET = 'inspection-files';

export interface VideoUploadResult {
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
}

export async function uploadInspectionVideo(
  localUri: string,
  inspectionId: string,
  checklistItemId: string | null,
  durationSeconds: number,
): Promise<VideoUploadResult> {
  return uploadInspectionVideoFile(localUri, inspectionId, checklistItemId, durationSeconds);
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
