export interface SeoMetadata {
  title: string;
  description: string;
  keywords: string[];
  image: string;
  url: string;
  type?: 'website' | 'article' | 'product';
  twitterCard?: 'summary' | 'summary_large_image';
  twitterHandle?: string;
  siteName?: string;
}

export const SEO_DEFAULTS: SeoMetadata = {
  title: 'GreenThumr | Rare Plant Marketplace',
  description:
    'GreenThumr is the community-driven marketplace where plant collectors discover, trade, and care for rare houseplants together.',
  keywords: [
    'plant marketplace',
    'buy rare plants',
    'sell houseplants',
    'plant swap',
    'plant care community',
  ],
  image: 'https://greenthumr.app/social-share.jpg',
  url: 'https://greenthumr.app/',
  type: 'website',
  twitterCard: 'summary_large_image',
  twitterHandle: '@greenthumrapp',
  siteName: 'GreenThumr Marketplace',
};