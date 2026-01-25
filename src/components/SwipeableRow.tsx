import { useState, useRef, useEffect, ReactNode } from 'react';
import './SwipeableRow.css';

const SWIPE_THRESHOLD = 50;

interface SwipeableRowProps {
  children: ReactNode;
  actions: ReactNode;
  enabled?: boolean;
  className?: string;
  onSwipeOpen?: () => void;
  onSwipeClose?: () => void;
}

export function SwipeableRow({
  children,
  actions,
  enabled = true,
  className = '',
  onSwipeOpen,
  onSwipeClose,
}: SwipeableRowProps) {
  const [isSwiped, setIsSwiped] = useState(false);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const rowRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isSwiped) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setIsSwiped(false);
        onSwipeClose?.();
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isSwiped, onSwipeClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchStartX.current - touchEndX;
    const deltaY = Math.abs(touchStartY.current - touchEndY);

    // Only trigger if horizontal swipe is dominant
    if (deltaY < Math.abs(deltaX)) {
      if (deltaX > SWIPE_THRESHOLD) {
        // Swiped left - reveal actions
        setIsSwiped(true);
        onSwipeOpen?.();
      } else if (deltaX < -SWIPE_THRESHOLD) {
        // Swiped right - hide actions
        setIsSwiped(false);
        onSwipeClose?.();
      }
    }
  };

  const close = () => {
    setIsSwiped(false);
    onSwipeClose?.();
  };

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={rowRef}
      className={`swipeable-row ${isSwiped ? 'swiped' : ''} ${className}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="swipeable-row-content">
        {children}
      </div>
      <div className="swipeable-row-actions" onClick={close}>
        {actions}
      </div>
    </div>
  );
}
