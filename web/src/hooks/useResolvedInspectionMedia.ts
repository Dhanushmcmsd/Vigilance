import { useEffect, useState } from 'react';
import { resolveInspectionMediaUrls } from '../lib/inspectionMedia';

export function useResolvedInspectionMedia<T extends { file_url: string }>(
  images: T[],
  videos: T[],
) {
  const [resolvedImages, setResolvedImages] = useState<(T & { resolved_url: string })[]>([]);
  const [resolvedVideos, setResolvedVideos] = useState<(T & { resolved_url: string })[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!images.length && !videos.length) {
      setResolvedImages([]);
      setResolvedVideos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    void Promise.all([resolveInspectionMediaUrls(images), resolveInspectionMediaUrls(videos)])
      .then(([nextImages, nextVideos]) => {
        if (cancelled) return;
        setResolvedImages(nextImages);
        setResolvedVideos(nextVideos);
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedImages(images.map((file) => ({ ...file, resolved_url: file.file_url })));
        setResolvedVideos(videos.map((file) => ({ ...file, resolved_url: file.file_url })));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [images, videos]);

  return { resolvedImages, resolvedVideos, loading };
}
