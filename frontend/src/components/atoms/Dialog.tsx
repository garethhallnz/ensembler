import type { ReactNode } from 'react';
import { Modal, type ModalProps } from 'flowbite-react';

interface DialogProps {
  show: boolean;
  onClose: () => void;
  // Accessible name for the dialog. Flowbite hardwires aria-labelledby to its
  // own ModalHeader, so we name the dialog explicitly instead of adopting it.
  ariaLabel: string;
  size?: ModalProps['size'];
  // Esc and backdrop-click both close by default; disable for flows that must
  // not be dismissed accidentally.
  dismissible?: boolean;
  initialFocus?: ModalProps['initialFocus'];
  children: ReactNode;
}

// Flowbite's Modal owns its own panel styling via content.inner; our modals
// bring their own panel markup, so we blank it out and keep only the accessible
// shell: role="dialog", aria-modal, focus-trap, Esc, backdrop, scroll-lock.
const passthroughTheme = { content: { inner: '' } };

export default function Dialog({
  show,
  onClose,
  ariaLabel,
  size = '2xl',
  dismissible = true,
  initialFocus,
  children,
}: DialogProps) {
  return (
    <Modal
      show={show}
      onClose={onClose}
      size={size}
      dismissible={dismissible}
      initialFocus={initialFocus}
      aria-label={ariaLabel}
      theme={passthroughTheme}
    >
      {children}
    </Modal>
  );
}
