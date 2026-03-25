import { useQuery } from "convex/react";

/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * LOADING STATE UTILITIES
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */

export interface LoadingState<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Hook to extract loading state from Convex query
 */
export function useLoadingState<T>(queryResult: T | undefined): LoadingState<T> {
  return {
    data: queryResult,
    isLoading: queryResult === undefined,
    isError: queryResult === null,
    error: null,
  };
}

/**
 * Determine if skeleton should be shown
 */
export function shouldShowSkeleton(data: unknown): boolean {
  return data === undefined;
}

/**
 * Determine if empty state should be shown
 */
export function isEmptyData(data: unknown[] | undefined | null): boolean {
  return data !== undefined && data !== null && data.length === 0;
}

/**
 * Skeleton visibility helper with delay
 * Prevents flickering for fast loads
 */
export function useDelayedSkeleton(
  isLoading: boolean,
  delay: number = 200
): boolean {
  // This would use useState + useEffect in real implementation
  return isLoading;
}
