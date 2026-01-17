/**
 * Hook for managing list filters with URL persistence
 * Provides debounced search, URL sync, and conversion to list options
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SortOrder, SortConfig } from '@/types/filters';

interface UseListFiltersOptions<TFilters, TSortField extends string> {
  /** Default filter values */
  defaultFilters: TFilters;
  /** Default sort configuration */
  defaultSort?: SortConfig<TSortField>;
  /** Debounce delay for text search in ms */
  debounceMs?: number;
  /** URL parameter mapping (filter key -> URL param name) */
  paramMapping?: Record<string, string>;
}

interface UseListFiltersReturn<TFilters, TSortField extends string> {
  /** Current filter values */
  filters: TFilters;
  /** Update a single filter */
  setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K]) => void;
  /** Update multiple filters at once */
  setFilters: (updates: Partial<TFilters>) => void;
  /** Reset all filters to defaults */
  resetFilters: () => void;
  /** Check if any filters are active (different from defaults) */
  hasActiveFilters: boolean;
  /** Current sort configuration */
  sort: SortConfig<TSortField> | null;
  /** Update sort */
  setSort: (field: TSortField, order?: SortOrder) => void;
  /** Toggle sort for a field (cycles through asc -> desc -> none) */
  toggleSort: (field: TSortField) => void;
  /** Debounced search value (for API calls) */
  debouncedSearch: string;
  /** Get the sort icon direction for a column */
  getSortDirection: (field: TSortField) => SortOrder | null;
}

/**
 * Custom hook for managing list filters with URL persistence
 */
export function useListFilters<
  TFilters extends object,
  TSortField extends string = string
>(
  options: UseListFiltersOptions<TFilters, TSortField>
): UseListFiltersReturn<TFilters, TSortField> {
  const {
    defaultFilters,
    defaultSort,
    debounceMs = 300,
    paramMapping = {},
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse URL params into filter values
  const parseFiltersFromUrl = useCallback((): TFilters => {
    const parsed = { ...defaultFilters };

    for (const key of Object.keys(defaultFilters)) {
      const paramName = paramMapping[key] || key;
      const urlValue = searchParams.get(paramName);

      if (urlValue !== null) {
        const defaultValue = defaultFilters[key as keyof TFilters];
        if (typeof defaultValue === 'number') {
          (parsed as Record<string, unknown>)[key] = Number(urlValue);
        } else if (typeof defaultValue === 'boolean') {
          (parsed as Record<string, unknown>)[key] = urlValue === 'true';
        } else {
          (parsed as Record<string, unknown>)[key] = urlValue;
        }
      }
    }

    return parsed;
  }, [defaultFilters, paramMapping, searchParams]);

  // Parse sort from URL
  const parseSortFromUrl = useCallback((): SortConfig<TSortField> | null => {
    const sortParam = paramMapping['sort'] || 'sort';
    const orderParam = paramMapping['order'] || 'order';

    const field = searchParams.get(sortParam);
    const order = searchParams.get(orderParam) as SortOrder | null;

    if (field) {
      return {
        field: field as TSortField,
        order: order === 'desc' ? 'desc' : 'asc',
      };
    }

    return defaultSort || null;
  }, [defaultSort, paramMapping, searchParams]);

  // State
  const [filters, setFiltersState] = useState<TFilters>(parseFiltersFromUrl);
  const [sort, setSortState] = useState<SortConfig<TSortField> | null>(parseSortFromUrl);

  // Sync filters to URL
  const syncToUrl = useCallback(
    (newFilters: TFilters, newSort: SortConfig<TSortField> | null) => {
      const params = new URLSearchParams();

      // Add filter params
      for (const key of Object.keys(newFilters)) {
        const value = (newFilters as Record<string, unknown>)[key];
        const defaultValue = (defaultFilters as Record<string, unknown>)[key];
        const paramName = paramMapping[key] || key;

        // Only include non-default values
        if (value !== defaultValue && value !== '' && value !== 'all') {
          params.set(paramName, String(value));
        }
      }

      // Add sort params
      if (newSort) {
        const sortParam = paramMapping['sort'] || 'sort';
        const orderParam = paramMapping['order'] || 'order';

        // Only include if different from default
        if (
          !defaultSort ||
          newSort.field !== defaultSort.field ||
          newSort.order !== defaultSort.order
        ) {
          params.set(sortParam, newSort.field);
          params.set(orderParam, newSort.order);
        }
      }

      setSearchParams(params, { replace: true });
    },
    [defaultFilters, defaultSort, paramMapping, setSearchParams]
  );

  // Update single filter
  const setFilter = useCallback(
    <K extends keyof TFilters>(key: K, value: TFilters[K]) => {
      setFiltersState((prev) => {
        const newFilters = { ...prev, [key]: value };
        syncToUrl(newFilters, sort);
        return newFilters;
      });
    },
    [sort, syncToUrl]
  );

  // Update multiple filters
  const setFilters = useCallback(
    (updates: Partial<TFilters>) => {
      setFiltersState((prev) => {
        const newFilters = { ...prev, ...updates };
        syncToUrl(newFilters, sort);
        return newFilters;
      });
    },
    [sort, syncToUrl]
  );

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters);
    setSortState(defaultSort || null);
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [defaultFilters, defaultSort, setSearchParams]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    for (const key of Object.keys(filters)) {
      const value = (filters as Record<string, unknown>)[key];
      const defaultValue = (defaultFilters as Record<string, unknown>)[key];
      if (value !== defaultValue && value !== '' && value !== 'all') {
        return true;
      }
    }
    return false;
  }, [filters, defaultFilters]);

  // Set sort
  const setSort = useCallback(
    (field: TSortField, order: SortOrder = 'asc') => {
      const newSort = { field, order };
      setSortState(newSort);
      syncToUrl(filters, newSort);
    },
    [filters, syncToUrl]
  );

  // Toggle sort (asc -> desc -> null)
  const toggleSort = useCallback(
    (field: TSortField) => {
      let newSort: SortConfig<TSortField> | null;

      if (!sort || sort.field !== field) {
        newSort = { field, order: 'asc' };
      } else if (sort.order === 'asc') {
        newSort = { field, order: 'desc' };
      } else {
        newSort = defaultSort || null;
      }

      setSortState(newSort);
      syncToUrl(filters, newSort);
    },
    [sort, defaultSort, filters, syncToUrl]
  );

  // Get sort direction for a field
  const getSortDirection = useCallback(
    (field: TSortField): SortOrder | null => {
      if (sort && sort.field === field) {
        return sort.order;
      }
      return null;
    },
    [sort]
  );

  // Debounce search value
  useEffect(() => {
    const searchValue = (filters as { search?: string }).search || '';

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [(filters as { search?: string }).search, debounceMs]);

  // Initialize debounced search on mount
  useEffect(() => {
    setDebouncedSearch((filters as { search?: string }).search || '');
  }, []);

  return {
    filters,
    setFilter,
    setFilters,
    resetFilters,
    hasActiveFilters,
    sort,
    setSort,
    toggleSort,
    debouncedSearch,
    getSortDirection,
  };
}
