import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Focusable elements inside `root`, in DOM order. Elements without layout boxes are
 *  skipped in the browser; if that leaves nothing (e.g. in jsdom), the raw list is used. */
function focusablesIn(root: HTMLElement): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[hidden], [aria-hidden="true"], [inert]')
  );
  const rendered = all.filter((el) => el.getClientRects().length > 0);
  return rendered.length > 0 ? rendered : all;
}

/** Where focus goes if the element that opened the dialog is gone when it closes. */
function focusFallback() {
  const main = document.querySelector<HTMLElement>('main');
  if (!main) return;
  const hadTabIndex = main.hasAttribute('tabindex');
  if (!hadTabIndex) main.setAttribute('tabindex', '-1');
  main.focus({ preventScroll: true });
  if (!hadTabIndex) main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true });
}

interface Options {
  /** Element to focus when the dialog opens. Defaults to the first focusable element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Keyboard behaviour for a modal dialog or drawer:
 * - moves focus into the dialog when it opens,
 * - closes it on Escape,
 * - keeps Tab / Shift+Tab inside it,
 * - returns focus to the element that opened it (or to <main> if that element is gone).
 */
export function useDialogFocus(
  containerRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  { initialFocusRef }: Options = {}
) {
  // Keep the latest onClose without re-running the effect on every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // StrictMode (dev) runs the effect, its cleanup, then the effect again for a dialog that
  // mounts already open. `runRef` lets the cleanup skip its focus restore when a newer run
  // has started, and `openerRef` keeps the real opener instead of an element in the dialog.
  const runRef = useRef(0);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const runId = ++runRef.current;
    const container = containerRef.current;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!(active && container && container.contains(active))) openerRef.current = active;
    const opener = openerRef.current;

    if (container) {
      const target = initialFocusRef?.current || focusablesIn(container)[0] || container;
      if (target === container && !container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const root = containerRef.current;
      if (!root) return;
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusablesIn(root);
      if (items.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const outside = !active || !root.contains(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Restore after React has finished removing the dialog.
      const restore = () => {
        if (runRef.current !== runId) return; // re-opened (StrictMode re-run): keep focus inside
        if (opener && opener.isConnected && !(opener as HTMLButtonElement).disabled) {
          opener.focus({ preventScroll: true });
        } else {
          focusFallback();
        }
      };
      if (typeof queueMicrotask === 'function') queueMicrotask(restore);
      else restore();
    };
  }, [open, containerRef, initialFocusRef]);
}
