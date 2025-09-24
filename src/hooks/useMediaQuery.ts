import { useEffect, useState } from 'react';

export function useMediaQuery(query: string) {
  const getMatches = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState<boolean>(getMatches);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    const updateMatches = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(mediaQueryList.matches);

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', updateMatches);
      return () => mediaQueryList.removeEventListener('change', updateMatches);
    }

    if (typeof mediaQueryList.addListener === 'function') {
      mediaQueryList.addListener(updateMatches);
      return () => mediaQueryList.removeListener(updateMatches);
    }

    return;
  }, [query]);

  return matches;
}
