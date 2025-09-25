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
  title: 'Thumr | Rare Plant Marketplace',
  description:
    'Thumr is the community-driven marketplace where plant collectors discover, trade, and care for rare houseplants together.',
  keywords: [
    'plant marketplace',
    'buy rare plants',
    'sell houseplants',
    'plant swap',
    'plant care community',
  ],
  image: 'https://thumr.com/social-share.jpg',
  url: 'https://thumr.com/',
  type: 'website',
  twitterCard: 'summary_large_image',
  twitterHandle: '@thumrapp',
  siteName: 'Thumr Marketplace',
};