
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(date: string | Date, options: { showYear?: boolean, showSeconds?: boolean } = {}) {
  const d = new Date(date);
  return d.toLocaleString([], {
    year: options.showYear ? 'numeric' : undefined,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: options.showSeconds ? '2-digit' : undefined,
    hour12: true
  });
}

// Generate poster URL from Cloudinary video URL (replaces extension with .jpg)
export function getPosterUrl(url: string | undefined | null) {
  if (!url) return undefined;
  if (url.includes('cloudinary.com') && url.includes('/video/upload/')) {
    return url.replace(/\.[^/.]+$/, ".jpg");
  }
  return undefined;
}

export function playInteractionSound(enabled: boolean) {
  if (!enabled) return;
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, audioCtx.currentTime); 
    oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.05);
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.05);
  } catch (e) {
    console.error("Audio context failed", e);
  }
}

export function triggerHaptic(enabled: boolean) {
  if (!enabled) return;
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(50);
    } catch (e) {}
  }
}
