import { useState, useEffect, ReactNode } from 'react';
import './Expander.css';

const MOBILE_BREAKPOINT = 768;

function getInitialExpanded(defaultExpanded: boolean): boolean {
  if (typeof window === 'undefined') return defaultExpanded;
  return window.innerWidth <= MOBILE_BREAKPOINT ? false : defaultExpanded;
}

interface ExpanderProps {
  title: string;
  defaultExpanded?: boolean;
  headerRight?: ReactNode;
  summary?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Expander({
  title,
  defaultExpanded = true,
  headerRight,
  summary,
  className = '',
  children
}: ExpanderProps) {
  const [expanded, setExpanded] = useState(() => getInitialExpanded(defaultExpanded));

  useEffect(() => {
    setExpanded(getInitialExpanded(defaultExpanded));
  }, [defaultExpanded]);

  const showSummary = !expanded && summary;

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.expander-content')) {
      setExpanded(!expanded);
    }
  };

  return (
    <div className={`expander ${expanded ? 'expanded' : 'collapsed'} ${className}`} onClick={handleClick}>
      <div className="expander-header">
        <div className="expander-header-left">
          <span className={`expander-icon ${expanded ? 'expanded' : ''}`}>&#9658;</span>
          <h3 className="expander-title">{title}</h3>
        </div>
        {showSummary ? (
          <div className="expander-summary">{summary}</div>
        ) : (
          headerRight && <div className="expander-header-right">{headerRight}</div>
        )}
      </div>
      <div className={`expander-content ${expanded ? 'expanded' : 'collapsed'}`}>
        <div className="expander-content-inner">
          {children}
        </div>
      </div>
    </div>
  );
}
