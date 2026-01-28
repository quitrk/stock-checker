import { useRef, useEffect, useState } from 'react';
import { useSearchAutocomplete } from '../hooks/useSearchAutocomplete';
import { Spinner } from './Spinner';
import './SearchAutocomplete.css';

interface SearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (symbol: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function SearchAutocomplete({
  value,
  onChange,
  onSelect,
  onSubmit,
  disabled = false,
  placeholder = 'Symbol or company name',
}: SearchAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const {
    results,
    isLoading,
    error,
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
    clearResults,
  } = useSearchAutocomplete(value);

  const showDropdown = isFocused && hasInteracted && (results.length > 0 || isLoading || error);

  // Autofocus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        clearResults();
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clearResults]);

  const handleSelect = (symbol: string) => {
    onChange(symbol);
    clearResults();
    setIsFocused(false);
    setHasInteracted(false);
    onSelect(symbol);
  };

  const handleSubmit = () => {
    clearResults();
    setIsFocused(false);
    setHasInteracted(false);
    onSubmit();
  };

  return (
    <div className="search-autocomplete">
      <div className="search-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setHasInteracted(true);
            onChange(e.target.value.toUpperCase());
          }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={(e) => handleKeyDown(e, handleSelect, handleSubmit)}
          placeholder={placeholder}
          className="search-input"
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
        {isLoading && (
          <div className="search-loading">
            <Spinner size="sm" />
          </div>
        )}
      </div>

      {showDropdown && (
        <div ref={dropdownRef} className="search-dropdown">
          {error ? (
            <div className="search-error">{error}</div>
          ) : results.length === 0 && !isLoading ? (
            <div className="search-no-results">No results found</div>
          ) : (
            results.map((result, index) => (
              <div
                key={result.symbol}
                className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
                onMouseEnter={() => setSelectedIndex(index)}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur before click
                  handleSelect(result.symbol);
                }}
              >
                <div className="result-top-row">
                  <span className="result-symbol">{result.symbol}</span>
                  <span className="result-type">{result.type}</span>
                </div>
                <span className="result-name">{result.name}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
