import { useState, useEffect, ReactNode } from 'react';
import { Spinner } from './Spinner';
import './Expander.css';

const MOBILE_BREAKPOINT = 768;

function getInitialExpanded(defaultExpanded: boolean, ignoreMobile: boolean): boolean {
  if (typeof window === 'undefined') return defaultExpanded;
  if (ignoreMobile) return defaultExpanded;
  return window.innerWidth <= MOBILE_BREAKPOINT ? false : defaultExpanded;
}

interface ExpanderProps {
  title: string;
  defaultExpanded?: boolean;
  ignoreMobileCollapse?: boolean;
  headerRight?: ReactNode;
  summary?: ReactNode;
  className?: string;
  loading?: boolean;
  children: ReactNode;
}

export function Expander({
  title,
  defaultExpanded = true,
  ignoreMobileCollapse = false,
  headerRight,
  summary,
  className = '',
  loading = false,
  children
}: ExpanderProps) {
  const [expanded, setExpanded] = useState(() => getInitialExpanded(defaultExpanded, ignoreMobileCollapse));

  useEffect(() => {
    setExpanded(getInitialExpanded(defaultExpanded, ignoreMobileCollapse));
  }, [defaultExpanded, ignoreMobileCollapse]);

  const showSummary = !expanded && summary;

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't toggle if clicking inside content or header-right (action buttons)
    if (!target.closest('.expander-content') && !target.closest('.expander-header-right')) {
      setExpanded(!expanded);
    }
  };

  return (
    <div className={`expander ${expanded ? 'expanded' : 'collapsed'} ${className}`} onClick={handleClick}>
      <div className="expander-header">
        <div className="expander-header-left">
          <span className={`expander-icon ${expanded ? 'expanded' : ''}`}>&#9658;</span>
          <h3 className="expander-title">{title}</h3>
          {loading && <Spinner size="sm" />}
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
