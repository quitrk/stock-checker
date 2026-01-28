import { useState, useEffect, useRef, useCallback } from 'react';
import { searchStocks } from '../api/searchApi';
import type { SearchResult } from '../../lib/types/index.js';

interface UseSearchAutocompleteOptions {
  debounceMs?: number;
  minChars?: number;
  maxResults?: number;
}

interface UseSearchAutocompleteReturn {
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  handleKeyDown: (e: React.KeyboardEvent, onSelect: (symbol: string) => void, onSubmit: () => void) => void;
  clearResults: () => void;
}

export function useSearchAutocomplete(
  query: string,
  options: UseSearchAutocompleteOptions = {}
): UseSearchAutocompleteReturn {
  const { debounceMs = 300, minChars = 1, maxResults = 10 } = options;

  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const trimmedQuery = query.trim();

    // Clear results if query is too short
    if (trimmedQuery.length < minChars) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setSelectedIndex(-1);

    debounceTimerRef.current = setTimeout(async () => {
      abortControllerRef.current = new AbortController();

      try {
        const searchResults = await searchStocks(trimmedQuery, maxResults);
        setResults(searchResults);
        setError(null);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return; // Ignore aborted requests
        }
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, debounceMs, minChars, maxResults]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, onSelect: (symbol: string) => void, onSubmit: () => void) => {
      if (results.length === 0) {
        if (e.key === 'Enter') {
          onSubmit();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            onSelect(results[selectedIndex].symbol);
          } else {
            onSubmit();
          }
          break;
        case 'Escape':
          e.preventDefault();
          setResults([]);
          setSelectedIndex(-1);
          break;
        case 'Tab':
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            e.preventDefault();
            onSelect(results[selectedIndex].symbol);
          }
          break;
      }
    },
    [results, selectedIndex]
  );

  const clearResults = useCallback(() => {
    setResults([]);
    setSelectedIndex(-1);
    setError(null);
  }, []);

  return {
    results,
    isLoading,
    error,
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
    clearResults,
  };
}
