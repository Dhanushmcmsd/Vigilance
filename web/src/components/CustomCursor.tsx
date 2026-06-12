import { useEffect, useRef } from 'react';

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    const move = (e: MouseEvent) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    };

    const checkTarget = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      const clickable = el.closest(
        'a, button, [role="button"], select, label, input[type="submit"], input[type="checkbox"], [data-clickable]',
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

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseover', checkTarget);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseover', checkTarget);
    };
  }, []);

  return <div ref={cursorRef} id="custom-cursor" data-cursor="default" aria-hidden="true" />;
}
