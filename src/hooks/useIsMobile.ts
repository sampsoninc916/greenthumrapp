import { useMediaQuery } from './useMediaQuery';

export function useIsMobile(breakpoint: number = 768) {
  return useMediaQuery(`(max-width: ${breakpoint - 1}px)`);
}
