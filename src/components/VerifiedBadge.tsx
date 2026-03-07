import React from 'react';
import { CheckCircle } from 'lucide-react';

export const VerifiedBadge: React.FC<{ size?: number, className?: string }> = ({ size = 14, className = "" }) => (
  <CheckCircle size={size} className={`text-[#1877F2] fill-[#1877F2] text-white ${className}`} strokeWidth={3} />
);
