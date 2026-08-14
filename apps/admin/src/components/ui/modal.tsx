'use client';

import { useEffect, useRef } from 'react';
import { Alert, Button } from './index';

/**
 * A dialog built on the native <dialog> element.
 *
 * showModal() gives focus trapping, Escape-to-close, inertness of the rest of
 * the page and a ::backdrop for free — all of which the two hand-rolled overlays
 * this replaces were missing.
 *
 * Lives in its own file rather than ui/index.tsx: that file has no 'use client'
 * directive, which is what lets Card, Table and Badge render as server
 * components on every page. One directive at its top would pull all of them into
 * the client bundle everywhere.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    // Fires for Escape as well as close(), so the parent's state cannot drift
    // out of sync with what is on screen.
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      className="surface m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-[var(--color-border)] p-0 text-[color:inherit] backdrop:bg-black/50"
      onClick={(event) => {
        // Clicking the backdrop lands on the dialog element itself.
        if (event.target === ref.current) ref.current?.close();
      }}
    >
      <div className="p-6">
        <h2 id="modal-title" className="font-semibold text-lg">
          {title}
        </h2>
        {children ? <div className="mt-2 text-sm">{children}</div> : null}
        {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  pending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'danger' | 'primary';
  pending?: boolean;
  error?: string | null;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? '…' : confirmLabel}
          </Button>
        </>
      }
    >
      {body ? <p className="text-muted">{body}</p> : null}
      {error ? (
        <div className="mt-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
    </Modal>
  );
}
