import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Yes',
  cancelText = 'Cancel',
  isDestructive = true
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="relative bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl w-full max-w-sm border border-gray-100 dark:border-gray-800"
          >
            <div className="flex flex-col items-center text-center gap-3">
              <div className={`p-4 rounded-full ${isDestructive ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'}`}>
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">{title}</h3>
              <p className="text-gray-500 dark:text-gray-400 font-medium text-sm leading-relaxed">{message}</p>
            </div>
            <div className="flex gap-3 mt-8">
              <button 
                onClick={onCancel}
                className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold rounded-xl transition-colors"
              >
                {cancelText}
              </button>
              <button 
                onClick={() => {
                  onConfirm();
                }}
                className={`flex-1 py-3 px-4 text-white font-bold rounded-xl shadow-lg transition-colors ${
                  isDestructive 
                    ? 'bg-red-500 hover:bg-red-600 hover:shadow-red-500/20' 
                    : 'bg-[#1877F2] hover:bg-blue-600 hover:shadow-blue-500/20'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDialog;
