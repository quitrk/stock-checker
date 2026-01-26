import { useState, useEffect, useRef } from 'react';

const REQUEST_DELAY_MS = 50;

let lastRequestTime = 0;
const pendingQueue: Array<() => void> = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (pendingQueue.length > 0) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < REQUEST_DELAY_MS) {
      await new Promise(r => setTimeout(r, REQUEST_DELAY_MS - timeSinceLastRequest));
    }

    const resolve = pendingQueue.shift();
    if (resolve) {
      lastRequestTime = Date.now();
      resolve();
    }
  }

  isProcessing = false;
}

function enqueueLoad(): Promise<void> {
  return new Promise(resolve => {
    pendingQueue.push(resolve);
    processQueue();
  });
}

interface StockLogoProps {
  url: string;
  alt?: string;
  className?: string;
}

export function StockLogo({ url, alt = '', className }: StockLogoProps) {
  const [isInView, setIsInView] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  // Observe visibility with debounce for fast scrolling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          debounceTimer = setTimeout(() => {
            setIsInView(true);
            observer.disconnect();
          }, 150);
        } else if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(el);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, []);

  // Queue load only when in view
  useEffect(() => {
    if (!isInView) return;
    mountedRef.current = true;

    enqueueLoad().then(() => {
      if (mountedRef.current) {
        setShouldLoad(true);
      }
    });

    return () => {
      mountedRef.current = false;
    };
  }, [isInView, url]);

  if (!shouldLoad || hasError) {
    return <div ref={containerRef} className={className} />;
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
