import { useEffect, useState } from 'react';
import { resolveInspectionMediaUrl } from '../lib/inspectionMedia';

export function useResolvedMediaMap(urls: string[]) {
  const [resolvedMap, setResolvedMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
    if (!uniqueUrls.length) {
      setResolvedMap({});
      return;
    }

    void Promise.all(
      uniqueUrls.map(async (url) => [url, await resolveInspectionMediaUrl(url)] as const),
    ).then((entries) => {
      if (!cancelled) setResolvedMap(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [urls.join('|')]);

  return resolvedMap;
}
