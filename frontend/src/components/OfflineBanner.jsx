import React, { useEffect, useState } from 'react';
import { WifiIcon } from '@heroicons/react/24/outline';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline  = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online',  handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online',  handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-warning-500 text-white text-sm font-semibold py-2.5 px-4 flex items-center justify-center gap-2 animate-fade-in">
      <WifiIcon className="w-4 h-4" />
      You are offline — submit actions are disabled until connection is restored
    </div>
  );
}
