'use client';
import { useEffect } from 'react';

export default function ChunkErrorListener() {
  useEffect(() => {
    const handleError = (e) => {
      if (e.message && (e.message.includes('Loading chunk') || e.message.includes('Failed to fetch'))) {
        window.location.reload();
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  return null;
}