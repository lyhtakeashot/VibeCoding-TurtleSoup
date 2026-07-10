import { ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-lg p-6 animate-floatIn max-h-[85vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h3 className="text-lg font-semibold mb-4 neon-text">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
