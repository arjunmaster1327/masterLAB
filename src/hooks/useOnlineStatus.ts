import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let networkListenerRemove: (() => Promise<void>) | undefined;

    if (Capacitor.isNativePlatform()) {
      Network.getStatus()
        .then((status) => setIsOnline(status.connected))
        .catch(() => {});

      Network.addListener('networkStatusChange', (status) => {
        setIsOnline(status.connected);
      })
        .then((handle) => {
          networkListenerRemove = () => handle.remove();
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (networkListenerRemove) {
        networkListenerRemove().catch(() => {});
      }
    };
  }, []);

  return isOnline;
}
