import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

const CursorContext = createContext({ enabled: false });
export const useCursor = () => useContext(CursorContext);

function shouldEnableCustomCursor(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.matchMedia('(pointer: fine)').matches) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (window.matchMedia('(pointer: coarse)').matches) return false;
  if (window.matchMedia('(hover: none)').matches) return false;
  return true;
}

function isModalOpen(): boolean {
  return Boolean(
    document.querySelector('[role="dialog"], [aria-modal="true"], .fixed.inset-0.z-50'),
  );
}

/**
 * Premium golden cursor — native OS cursor remains; overlay uses pointer-events: none.
 * Pauses over modals and stays below dialog z-index.
 */
export function CursorProvider({ children }: { children: ReactNode }) {
  const [enabled] = useState(() => shouldEnableCustomCursor());
  const glowRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef({ x: -200, y: -200 });
  const currentRef = useRef({ x: -200, y: -200 });
  const rafRef = useRef<number>(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    document.documentElement.classList.add('vms-custom-cursor');

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      targetRef.current = { x: e.clientX, y: e.clientY };
    };

    const onOver = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const interactive = target?.closest(
        'a, button, input, textarea, select, label, [role="button"], [data-cursor="pointer"]',
      );
      document.documentElement.classList.toggle('vms-cursor-hover', Boolean(interactive));
    };

    const tick = () => {
      pausedRef.current = isModalOpen();
      const hidden = pausedRef.current;

      if (glowRef.current && ringRef.current) {
        glowRef.current.style.opacity = hidden ? '0' : '0.85';
        ringRef.current.style.opacity = hidden ? '0' : '1';
      }

      if (!hidden) {
        const t = targetRef.current;
        const c = currentRef.current;
        c.x += (t.x - c.x) * 0.22;
        c.y += (t.y - c.y) * 0.22;
        const transform = `translate3d(${c.x}px, ${c.y}px, 0) translate(-50%, -50%)`;
        glowRef.current?.style.setProperty('transform', transform);
        ringRef.current?.style.setProperty('transform', transform);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('mouseover', onOver, { passive: true });
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      document.documentElement.classList.remove('vms-custom-cursor', 'vms-cursor-hover');
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseover', onOver);
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled]);

  return (
    <CursorContext.Provider value={{ enabled }}>
      {children}
      {enabled && (
        <>
          <div ref={glowRef} className="vms-cursor-glow" aria-hidden />
          <div ref={ringRef} className="vms-cursor-ring" aria-hidden />
        </>
      )}
    </CursorContext.Provider>
  );
}
