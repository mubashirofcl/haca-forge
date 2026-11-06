import { StrictMode, useRef, useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { useDialogFocus } from '../useDialogFocus';

/** Opener button + a dialog with three focusable controls. */
function Harness({ onCloseSpy, removeOpenerOnClose = false }: { onCloseSpy?: () => void; removeOpenerOnClose?: boolean }) {
  const [open, setOpen] = useState(false);
  const [showOpener, setShowOpener] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    onCloseSpy?.();
    setOpen(false);
    if (removeOpenerOnClose) setShowOpener(false);
  };
  useDialogFocus(dialogRef, open, close, { initialFocusRef: closeRef });

  return (
    <main>
      {showOpener && (
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
      )}
      <button type="button">Behind the dialog</button>
      {open && (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Preview">
          <button ref={closeRef} type="button" onClick={close}>
            Close
          </button>
          <input aria-label="Field" />
          <button type="button">Last</button>
        </div>
      )}
    </main>
  );
}

/** A dialog component that is mounted only while open (the GroupModal / ShareToChatModal pattern). */
function MountedDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true, onClose);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Mounted">
      <button type="button" onClick={onClose}>
        Close mounted
      </button>
    </div>
  );
}

function MountedHarness() {
  const [open, setOpen] = useState(false);
  return (
    <main>
      <button type="button" onClick={() => setOpen(true)}>
        Open mounted
      </button>
      {open && <MountedDialog onClose={() => setOpen(false)} />}
    </main>
  );
}

const flush = () => act(() => Promise.resolve());

function openDialog() {
  const opener = screen.getByRole('button', { name: 'Open' });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

afterEach(() => cleanup());

describe('useDialogFocus', () => {
  it('moves focus to the initial focus element when the dialog opens', () => {
    render(<Harness />);
    openDialog();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  });

  it('closes on Escape', () => {
    const spy = vi.fn();
    render(<Harness onCloseSpy={spy} />);
    openDialog();
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps Tab and Shift+Tab inside the dialog', () => {
    render(<Harness />);
    openDialog();
    const first = screen.getByRole('button', { name: 'Close' });
    const last = screen.getByRole('button', { name: 'Last' });

    // Tab from the last control wraps to the first
    last.focus();
    const tab = fireEvent.keyDown(last, { key: 'Tab' });
    expect(tab).toBe(false); // default prevented
    expect(document.activeElement).toBe(first);

    // Shift+Tab from the first control wraps to the last
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    // Focus that escaped to the page is pulled back in
    screen.getByRole('button', { name: 'Behind the dialog' }).focus();
    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('returns focus to the element that opened the dialog', async () => {
    render(<Harness />);
    const opener = openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await flush();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('falls back to <main> when the opener no longer exists', async () => {
    render(<Harness removeOpenerOnClose />);
    openDialog();
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    await flush();
    expect(screen.queryByRole('button', { name: 'Open' })).toBeNull();
    expect(document.activeElement).toBe(document.querySelector('main'));
  });

  it('keeps focus inside and restores the opener under StrictMode for a dialog mounted open', async () => {
    render(
      <StrictMode>
        <MountedHarness />
      </StrictMode>
    );
    const opener = screen.getByRole('button', { name: 'Open mounted' });
    opener.focus();
    fireEvent.click(opener);
    await flush();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close mounted' }));
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    await flush();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
