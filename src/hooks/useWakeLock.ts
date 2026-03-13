
import { useEffect, useRef } from 'react';

export const useWakeLock = () => {
  const wakeLock = useRef<any>(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLock.current = await (navigator as any).wakeLock.request('screen');
        console.log('Wake Lock is active');
        
        wakeLock.current.addEventListener('release', () => {
          console.log('Wake Lock was released');
        });
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        console.warn('Wake Lock request was denied:', err.message);
      } else {
        console.error(`${err.name}, ${err.message}`);
      }
    }
  };

  useEffect(() => {
    requestWakeLock();

    const handleVisibilityChange = () => {
      if (wakeLock.current !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock.current) {
        wakeLock.current.release();
        wakeLock.current = null;
      }
    };
  }, []);
};
