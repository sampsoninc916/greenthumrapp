import { useEffect, useMemo } from 'react';
import { SEO_DEFAULTS, type SeoMetadata } from '../constants/seo';

const setMetaTag = (attribute: 'name' | 'property', key: string, value: string | null) => {
  if (typeof document === 'undefined') {
    return () => undefined;
  }

  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

  if (!element) {
    if (value === null) {
      return () => undefined;
    }

    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  const previous = element.getAttribute('content');

  if (value === null) {
    element.remove();
    return () => {
      if (previous !== null) {
        const restored = document.createElement('meta');
        restored.setAttribute(attribute, key);
        restored.setAttribute('content', previous);
        document.head.appendChild(restored);
      }
    };
  }

  element.setAttribute('content', value);

  return () => {
    if (previous === null) {
      element?.remove();
      return;
    }
    element?.setAttribute('content', previous);
  };
};

const setLinkTag = (rel: string, href: string | null) => {
  if (typeof document === 'undefined') {
    return () => undefined;
  }

  let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  const previousHref = link?.getAttribute('href') ?? null;

  if (!link) {
    if (href === null) {
      return () => undefined;
    }
    link = document.createElement('link');
    link.setAttribute('rel', rel);
    document.head.appendChild(link);
  }

  if (href === null) {
    link?.remove();
    return () => {
      if (previousHref) {
        const restored = document.createElement('link');
        restored.setAttribute('rel', rel);
        restored.setAttribute('href', previousHref);
        document.head.appendChild(restored);
      }
    };
  }

  link.setAttribute('href', href);

  return () => {
    if (previousHref === null) {
      link?.remove();
      return;
    }
    link?.setAttribute('href', previousHref);
  };
};

const normaliseDescription = (value: string) => {
  if (value.length <= 160) {
    return value;
  }
  return `${value.substring(0, 157)}...`;
};

export type SeoOverrides = Partial<SeoMetadata>;

export const useSeoMetadata = (overrides?: SeoOverrides) => {
  const metadata = useMemo<SeoMetadata>(() => {
    const base: SeoMetadata = {
      ...SEO_DEFAULTS,
      keywords: [...SEO_DEFAULTS.keywords],
    };

    if (!overrides) {
      return base;
    }

    if (overrides.title) {
      base.title = overrides.title;
    }

    if (overrides.description) {
      base.description = overrides.description;
    }

    if (overrides.keywords) {
      base.keywords = overrides.keywords;
    }

    if (overrides.image) {
      base.image = overrides.image;
    }

    if (overrides.url) {
      base.url = overrides.url;
    }

    if (overrides.type) {
      base.type = overrides.type;
    }

    if (overrides.twitterCard) {
      base.twitterCard = overrides.twitterCard;
    }

    if (overrides.twitterHandle) {
      base.twitterHandle = overrides.twitterHandle;
    }

    if (overrides.siteName) {
      base.siteName = overrides.siteName;
    }

    return base;
  }, [overrides]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const cleanups: Array<() => void> = [];

    const keywords = metadata.keywords.join(', ');
    const description = normaliseDescription(metadata.description);

    const previousTitle = document.title;
    document.title = metadata.title;

    cleanups.push(() => {
      document.title = previousTitle;
    });

    cleanups.push(setMetaTag('name', 'description', description));
    cleanups.push(setMetaTag('name', 'keywords', keywords));
    cleanups.push(setMetaTag('name', 'theme-color', '#166534'));

    cleanups.push(setMetaTag('property', 'og:title', metadata.title));
    cleanups.push(setMetaTag('property', 'og:description', description));
    cleanups.push(setMetaTag('property', 'og:type', metadata.type ?? 'website'));
    cleanups.push(setMetaTag('property', 'og:url', metadata.url));
    cleanups.push(setMetaTag('property', 'og:image', metadata.image));
    cleanups.push(setMetaTag('property', 'og:site_name', metadata.siteName ?? SEO_DEFAULTS.siteName ?? ''));

    cleanups.push(setMetaTag('name', 'twitter:card', metadata.twitterCard ?? 'summary_large_image'));
    cleanups.push(setMetaTag('name', 'twitter:site', metadata.twitterHandle ?? SEO_DEFAULTS.twitterHandle ?? ''));
    cleanups.push(setMetaTag('name', 'twitter:title', metadata.title));
    cleanups.push(setMetaTag('name', 'twitter:description', description));
    cleanups.push(setMetaTag('name', 'twitter:image', metadata.image));

    cleanups.push(setLinkTag('canonical', metadata.url));

    return () => {
      cleanups.forEach((cleanup) => {
        cleanup();
      });
    };
  }, [metadata]);
};