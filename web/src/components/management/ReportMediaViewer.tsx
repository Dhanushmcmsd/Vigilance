import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { downloadInspectionMediaFile } from '../../lib/inspectionMedia';
import { VideoPlayer } from '../VideoPlayer';

export type ReportMediaViewerItem =
  | {
      kind: 'image';
      id: string;
      url: string;
      fileUrl: string;
      fileName: string;
    }
  | {
      kind: 'video';
      id: string;
      url: string;
      fileUrl: string;
      fileName: string;
    };

export function ReportMediaViewer({
  item,
  onBack,
}: {
  item: ReportMediaViewerItem;
  onBack: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onBack]);

  const handleDownload = async () => {
    try {
      await downloadInspectionMediaFile(item.fileUrl, item.fileName);
    } catch (err) {
      if (import.meta.env.DEV) console.error('[ReportMediaViewer download]', err);
      window.alert(err instanceof Error ? err.message : 'Download failed. Please try again.');
    }
  };

  return createPortal(
    <div className="vms-modal-overlay" role="dialog" aria-modal="true" aria-label="Inspection media viewer">
      <div className="vms-media-viewer">
        <div className="vms-media-viewer-toolbar">
          <button type="button" onClick={onBack} className="vms-modal-btn-ghost">
            <ArrowLeft className="h-4 w-4" />
            Back to report
          </button>
          <button type="button" onClick={() => void handleDownload()} className="vms-modal-btn-primary">
            <Download className="h-3.5 w-3.5" />
            Download {item.kind === 'image' ? 'photo' : 'video'}
          </button>
        </div>

        <div className="vms-media-viewer-body">
          {item.kind === 'image' ? (
            <img src={item.url} alt={item.fileName} className="vms-media-viewer-image" />
          ) : (
            <VideoPlayer fileUrl={item.url} fileName={item.fileName} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
