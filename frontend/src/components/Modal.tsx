import React from 'react';
import { Modal as FlowbiteModal } from 'flowbite-react';

interface ModalProps {
  children: React.ReactNode;
  show: boolean;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
  position?: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  popup?: boolean;
  dismissible?: boolean;
  className?: string;
}

export default function Modal({
  children,
  show,
  onClose,
  size = 'md',
  position = 'center',
  popup = false,
  dismissible = true,
  className = '',
}: ModalProps) {
  return (
    <FlowbiteModal
      show={show}
      onClose={onClose}
      size={size}
      position={position}
      popup={popup}
      dismissible={dismissible}
      className={className}
    >
      {children}
    </FlowbiteModal>
  );
}

interface ModalSubComponentProps {
  children: React.ReactNode;
  className?: string;
}

Modal.Header = function ModalHeader({ children, className = '' }: ModalSubComponentProps) {
  return (
    <div className={`flex items-start justify-between p-4 border-b rounded-t dark:border-gray-600 ${className}`}>
      {children}
    </div>
  );
};

Modal.Body = function ModalBody({ children, className = '' }: ModalSubComponentProps) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
};

Modal.Footer = function ModalFooter({ children, className = '' }: ModalSubComponentProps) {
  return (
    <div className={`flex items-center p-6 space-x-2 border-t border-gray-200 rounded-b dark:border-gray-600 ${className}`}>
      {children}
    </div>
  );
};