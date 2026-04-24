
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
