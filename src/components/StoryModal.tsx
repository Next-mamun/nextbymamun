import React from 'react';
import ReactDOM from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const StoryModal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div 
      className="fixed inset-0 z-[99] animate-in fade-in-20"
      onClick={onClose}
    >
      {children}
    </div>,
    document.getElementById('root') as HTMLElement
  );
};

export default StoryModal;
