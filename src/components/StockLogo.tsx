import { useState, useEffect, useRef } from 'react';

const REQUEST_DELAY_MS = 100;

type QueueItem = {
  url: string;
  resolve: () => void;
};

const queue: QueueItem[] = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  while (queue.length > 0) {
    const item = queue.shift();
    if (item) {
      item.resolve();
      if (queue.length > 0) {
        await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
      }
    }
  }

  isProcessing = false;
}

function enqueueLoad(url: string): Promise<void> {
  return new Promise(resolve => {
    queue.push({ url, resolve });
    processQueue();
  });
}

interface StockLogoProps {
  url: string;
  alt?: string;
  className?: string;
}

export function StockLogo({ url, alt = '', className }: StockLogoProps) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [hasError, setHasError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    enqueueLoad(url).then(() => {
      if (mountedRef.current) {
        setShouldLoad(true);
      }
    });

    return () => {
      mountedRef.current = false;
    };
  }, [url]);

  if (!shouldLoad || hasError) {
    return null;
  }

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}
