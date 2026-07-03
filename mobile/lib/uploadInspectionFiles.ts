import type { ItemAttachment } from '../components/ItemAttachments';
import {
  uploadInspectionDocumentFile,
  uploadInspectionImageFile,
} from './inspectionStorageUpload';

export async function uploadInspectionFiles(
  inspectionId: string,
  itemFiles: Record<string, ItemAttachment[]>,
): Promise<{ successCount: number; failedCount: number; errors: string[] }> {
  const errors: string[] = [];
  let successCount = 0;
  let failedCount = 0;

  const uploadTasks = Object.entries(itemFiles).flatMap(([checklistItemId, attachments]) =>
    attachments
      .filter((file) => !file.fileUrl)
      .map(async (file) => {
        try {
          if (file.type === 'image') {
            await uploadInspectionImageFile(file.uri, inspectionId, checklistItemId, file.name);
          } else {
            await uploadInspectionDocumentFile(file.uri, inspectionId, checklistItemId, file.name);
          }
          successCount++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Error uploading ${file.name}: ${msg}`);
          failedCount++;
        }
      }),
  );

  await Promise.allSettled(uploadTasks);
  return { successCount, failedCount, errors };
}
