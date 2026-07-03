import { useEffect, useRef } from 'react';

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    let clickTimer: ReturnType<typeof setTimeout> | null = null;

    const move = (e: MouseEvent) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    };

    const checkTarget = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (cursor.dataset.clicking === 'true') return;

      const clickable = el.closest(
        'a, button, [role="button"], select, label, input[type="submit"], input[type="checkbox"], [data-clickable], summary',
      );
      const isText = el.closest('input[type="text"], input[type="email"], input[type="password"], textarea');

      if (isText) {
        cursor.setAttribute('data-cursor', 'text');
      } else if (clickable) {
        cursor.setAttribute('data-cursor', 'pointer');
      } else {
        cursor.setAttribute('data-cursor', 'default');
      }
    };

    const onDown = () => {
      cursor.setAttribute('data-clicking', 'true');
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        cursor.removeAttribute('data-clicking');
      }, 120);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseover', checkTarget);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseover', checkTarget);
      window.removeEventListener('mousedown', onDown);
      if (clickTimer) clearTimeout(clickTimer);
    };
  }, []);

  return <div ref={cursorRef} id="custom-cursor" data-cursor="default" aria-hidden="true" />;
}
