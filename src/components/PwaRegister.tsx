'use client';
import { useEffect } from 'react';

// Registers the service worker so Sahyatri installs to the home screen
// and shows a branded offline page without a connection.
export default function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
