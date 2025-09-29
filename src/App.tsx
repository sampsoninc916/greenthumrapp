import { Suspense, lazy, useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { FormEvent } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PlantCard } from './components/PlantCard';
import { Button } from './components/ui/button';
import { MobileActionBar } from './components/MobileActionBar';
import {
  SlidersHorizontal,
  Grid3X3,
  List,
  Leaf,
  Sprout,
  Droplets,
  HeartHandshake,
  Quote,
} from 'lucide-react';
import './index.css';
import './App.css';
import type { Plant } from './interfaces/Plant';
import { useAuth } from './contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { plantApi } from './services/auth';
import { normalizePlantRecord } from './utils/plants';
import { useIsMobile } from './hooks/useIsMobile';
import { toast } from 'sonner';
import { isPlantResponseDto, type PlantResponseDto } from './interfaces/dtos';
import { Skeleton } from './components/ui/skeleton';
import { telemetryService } from './services/telemetry';
import { useSeoMetadata } from './hooks/useSeoMetadata';
import { SEO_DEFAULTS } from './constants/seo';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Checkbox } from './components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from './components/ui/radio-group';
import { EmailCaptureModal } from './components/EmailCaptureModal';
import { emailService } from './services/email';
import type { SubscriptionIncentive } from './services/email';

const CreateNewPlantModal = lazy(() => import('./components/CreateNewPlantModal').then((module) => ({ default: module.CreateNewPlantModal })));
const PlantDetailModal = lazy(() => import('./components/PlantDetailModal').then((module) => ({ default: module.PlantDetailModal })));

const PLANTS_PAGE_SIZE = 20;

type WaitlistIncentiveOption = 'discount' | 'care_kit';

const WAITLIST_INCENTIVES: Record<WaitlistIncentiveOption, { title: string; description: string; serviceIncentive: SubscriptionIncentive }>
  = {
    discount: {
      title: '15% off your first order',
      description: 'We will send a single-use launch code as soon as the marketplace opens to the public.',
      serviceIncentive: {
        type: 'discount_code',
        description: '15% launch discount for your first order.',
        value: '15%',
      },
    },
    care_kit: {
      title: 'Propagation care kit',
      description: 'Receive a limited propagation kit (rooting gel, humidity dome, and care cards) with your first purchase.',
      serviceIncentive: {
        type: 'care_kit',
        description: 'Propagation care kit sent with your first qualifying purchase.',
      },
    },
  };

const WAITLIST_INCENTIVE_ENTRIES = Object.entries(WAITLIST_INCENTIVES) as Array<
  [WaitlistIncentiveOption, (typeof WAITLIST_INCENTIVES)[WaitlistIncentiveOption]]
>;

const PlantCardSkeleton = () => {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <Skeleton className="h-56 w-full" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-16" />
        </div>
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
};

const ModalLoadingFallback = ({ message, presentation = 'modal' }: { message: string; presentation?: 'modal' | 'page' }) => {
  if (presentation === 'page') {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-white">
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="rounded-lg bg-white px-6 py-4 shadow-lg">
        <span className="text-sm font-medium text-muted-foreground">{message}</span>
      </div>
    </div>
  );
};

const App = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCreateNewPlantModalOpen, setIsCreateNewPlantModalOpen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [filters, setFilters] = useState({
    categories: [],
    priceRange: [0, 500],
    conditions: [],
    location: 'anywhere'
  });
  const [plantsData, setPlantsData] = useState<Plant[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [nextPage, setNextPage] = useState<number | null>(1);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalAvailable, setTotalAvailable] = useState<number | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [isSubmittingNewsletter, setIsSubmittingNewsletter] = useState(false);
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [newsletterGdprConsent, setNewsletterGdprConsent] = useState(false);
  const [selectedNewsletterPerk, setSelectedNewsletterPerk] = useState<WaitlistIncentiveOption>('discount');
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  const [waitlistModalMode, setWaitlistModalMode] = useState<'join' | 'manage'>('join');
  const [waitlistEmailPrefill, setWaitlistEmailPrefill] = useState('');
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { plantId } = useParams<{ plantId?: string }>();
  const isMobile = useIsMobile();
  const pageCacheRef = useRef<Map<number, Plant[]>>(new Map());
  const pendingPagesRef = useRef<Set<number>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const recomputePlantsFromCache = useCallback((): Plant[] => {
    const sortedPages = Array.from(pageCacheRef.current.keys()).sort((a, b) => a - b);
    const uniqueById = new Map<string, Plant>();

    for (const page of sortedPages) {
      const entries = pageCacheRef.current.get(page) ?? [];
      for (const plant of entries) {
        uniqueById.set(plant.plantId, plant);
      }
    }

    return Array.from(uniqueById.values());
  }, []);

  const loadPlantsPage = useCallback(async (
    page: number,
    options: { force?: boolean; cursor?: string | null } = {},
  ) => {
    const { force = false, cursor = null } = options;

    if (!force && pageCacheRef.current.has(page)) {
      setPlantsData(recomputePlantsFromCache());
      return;
    }

    if (pendingPagesRef.current.has(page)) {
      return;
    }

    pendingPagesRef.current.add(page);

    if (page === 1) {
      setIsInitialLoading(true);
    } else {
      setIsFetchingNextPage(true);
    }

    try {
      const response = await plantApi.list<PlantResponseDto>({
        page,
        pageSize: PLANTS_PAGE_SIZE,
        cursor,
      });

      const rawItems = response.items ?? [];
      const validPlants = rawItems.filter((item): item is PlantResponseDto => isPlantResponseDto(item));

      if (validPlants.length !== rawItems.length) {
        console.warn('Filtered invalid plant payload entries', {
          total: rawItems.length,
          valid: validPlants.length,
        });
        toast.error('Some plant listings could not be loaded. Please refresh to try again.');
      }

      const normalizedPlants: Plant[] = validPlants.map((item) => normalizePlantRecord(item));
      pageCacheRef.current.set(page, normalizedPlants);

      setPlantsData(recomputePlantsFromCache());
      setHasMore(response.hasMore);
      setNextPage(response.hasMore ? (response.nextPage ?? page + 1) : null);
      setNextCursor(response.cursor);
      setTotalAvailable(response.totalItems ?? null);
      setError(false);
    } catch (err) {
      telemetryService.captureException(err, {
        message: 'Error fetching plants',
        tags: {
          feature: 'plants',
          operation: 'list',
        },
        extra: {
          page,
          cursor,
        },
      });
      setError(true);
      toast.error('Unable to load plant listings. Please try again.');
    } finally {
      pendingPagesRef.current.delete(page);
      if (page === 1) {
        setIsInitialLoading(false);
      }
      if (page !== 1) {
        setIsFetchingNextPage(false);
      }
    }
  }, [recomputePlantsFromCache]);

  useEffect(() => {
    void loadPlantsPage(1, { force: true });
  }, [loadPlantsPage]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    void emailService.ensureTemplatesConfigured();
  }, []);

  const openWaitlistModal = useCallback((mode: 'join' | 'manage', prefill?: string) => {
    setWaitlistModalMode(mode);
    setWaitlistEmailPrefill(prefill ?? '');
    setIsWaitlistModalOpen(true);
  }, []);

  const selectedIncentiveDetails = useMemo(
    () => WAITLIST_INCENTIVES[selectedNewsletterPerk],
    [selectedNewsletterPerk],
  );

  const loadMoreTriggerRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (!node) {
      return;
    }

    observerRef.current = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry?.isIntersecting && hasMore && !isFetchingNextPage && !isInitialLoading && typeof nextPage === 'number') {
        void loadPlantsPage(nextPage, { cursor: nextCursor });
      }
    }, {
      rootMargin: '200px 0px',
    });

    observerRef.current.observe(node);
  }, [hasMore, isFetchingNextPage, isInitialLoading, loadPlantsPage, nextCursor, nextPage]);

  const selectedPlant = useMemo(() => {
    if (!plantId) {
      return null;
    }
    return plantsData.find((plant) => plant.plantId === plantId) ?? null;
  }, [plantsData, plantId]);

  const isDetailRoute = Boolean(plantId);
  const shouldShowListing = !isDetailRoute || !isMobile;
  const showLandingContent = !isAuthenticated;
  const showMarketplaceContent = isAuthenticated;

  const canonicalBaseUrl = useMemo(() => {
    return SEO_DEFAULTS.url.replace(/\/$/, '');
  }, []);

  const plantSeoOverrides = useMemo(() => {
    if (!selectedPlant) {
      return null;
    }

    const siteName = SEO_DEFAULTS.siteName ?? 'Thumr Marketplace';
    const primaryImage = (() => {
      const candidate = selectedPlant.images?.find((image) => Boolean(image));
      if (!candidate) {
        return SEO_DEFAULTS.image;
      }
      if (/^https?:\/\//i.test(candidate)) {
        return candidate;
      }
      return `${canonicalBaseUrl}${candidate.startsWith('/') ? '' : '/'}${candidate}`;
    })();

    const details: string[] = [];
    if (selectedPlant.category) {
      details.push(selectedPlant.category);
    }
    if (selectedPlant.location) {
      details.push(selectedPlant.location);
    }
    const detailSuffix = details.length > 0 ? ` – ${details.join(' · ')}` : '';
    const priceSnippet = Number.isFinite(selectedPlant.price)
      ? `${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(selectedPlant.price)} listing.`
      : '';
    const descriptionSource = selectedPlant.description?.trim() ??
      'Discover more plant listings from trusted Thumr growers.';
    const description = [
      `${selectedPlant.name}${detailSuffix}.`,
      priceSnippet,
      descriptionSource,
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const keywords = Array.from(
      new Set(
        [
          selectedPlant.name,
          selectedPlant.category,
          selectedPlant.species,
          selectedPlant.location,
          selectedPlant.usdaZone,
          'plant marketplace',
          'buy plants online',
          'rare houseplants',
        ].filter((keyword): keyword is string => Boolean(keyword)),
      ),
    );

    return {
      title: `${selectedPlant.name} | ${siteName}`,
      description,
      keywords,
      image: primaryImage,
      url: `${canonicalBaseUrl}/plants/${selectedPlant.plantId}`,
      type: 'product' as const,
    };
  }, [selectedPlant, canonicalBaseUrl]);

  const seoOverrides = useMemo(() => {
    if (plantSeoOverrides) {
      return plantSeoOverrides;
    }
    return { url: `${canonicalBaseUrl}/` };
  }, [plantSeoOverrides, canonicalBaseUrl]);

  useSeoMetadata(seoOverrides);

  const filteredPlants = useMemo(() => {
    return plantsData.filter(plant => {
      // Search filter
      if (searchQuery && !plant.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !plant.category.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Category filter
      if (filters.categories.length > 0) {
        const categoryMatch = filters.categories.some(cat => {
          if (cat === 'houseplants') return plant.category === 'Houseplants';
          if (cat === 'flowers') return plant.category === 'Flowers';
          if (cat === 'herbs') return plant.category === 'Herbs';
          if (cat === 'succulents') return plant.category === 'Succulents';
          if (cat === 'trees') return plant.category === 'Trees';
          return false;
        });
        if (!categoryMatch) return false;
      }

      // Price filter
      if (plant.price < filters.priceRange[0] || plant.price > filters.priceRange[1]) {
        return false;
      }

      // Condition filter
      if (filters.conditions.length > 0) {
        const conditionMatch = filters.conditions.some(cond => 
          plant.condition.toLowerCase().replace(' ', '-') === cond
        );
        if (!conditionMatch) return false;
      }

      return true;
    });
  }, [searchQuery, filters, plantsData]);

  const handlePlantUpdate = useCallback((updatedPlant: Plant) => {
    let foundInCache = false;

    pageCacheRef.current.forEach((items, page) => {
      const index = items.findIndex((plant) => plant.plantId === updatedPlant.plantId);
      if (index !== -1) {
        const nextItems = [...items];
        nextItems[index] = { ...nextItems[index], ...updatedPlant };
        pageCacheRef.current.set(page, nextItems);
        foundInCache = true;
      }
    });

    if (foundInCache) {
      setPlantsData(recomputePlantsFromCache());
      return;
    }

    setPlantsData((prev) => {
      const existingIndex = prev.findIndex((plant) => plant.plantId === updatedPlant.plantId);
      if (existingIndex === -1) {
        return [updatedPlant, ...prev];
      }
      const next = [...prev];
      next[existingIndex] = { ...next[existingIndex], ...updatedPlant };
      return next;
    });
  }, [recomputePlantsFromCache]);

  const resetAndReload = useCallback(async () => {
    pageCacheRef.current.clear();
    pendingPagesRef.current.clear();
    setPlantsData([]);
    setHasMore(true);
    setNextPage(1);
    setNextCursor(null);
    setTotalAvailable(null);
    setError(false);
    await loadPlantsPage(1, { force: true });
  }, [loadPlantsPage]);

  const handleListingCreated = useCallback(
    (createdPlant: Plant) => {
      handlePlantUpdate(createdPlant);
      void resetAndReload();
    },
    [handlePlantUpdate, resetAndReload],
  );

  const handleListingUpdated = useCallback(
    (_updatedPlant: Plant) => {
      void resetAndReload();
    },
    [resetAndReload],
  );

  const handleViewDetail = (plant: Plant) => {
    navigate(`/plants/${plant.plantId}`);
  };

  const handleCloseDetail = () => {
    navigate('/');
  };

  const handleAddListing = () => {
    if (!isAuthenticated) {
      // Store intended action and redirect to login
      navigate('/login', { state: { from: { pathname: '/', action: 'add-listing' } } });
    } else {
      setIsCreateNewPlantModalOpen(true);
    }
  };

  const handleExploreCategories = useCallback(() => {
    setIsSidebarOpen(true);
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        const marketplace = document.getElementById('marketplace-grid');
        marketplace?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  const handleJoinNewsletterFocus = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const input = document.getElementById('newsletter-email') as HTMLInputElement | null;
    input?.focus({ preventScroll: false });
  }, []);

  const handleNewsletterSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedEmail = newsletterEmail.trim().toLowerCase();

      if (!trimmedEmail) {
        toast.error('Please add your email so we can send growing tips.');
        handleJoinNewsletterFocus();
        return;
      }

      if (!newsletterConsent) {
        toast.error('Please confirm you would like to receive the grower newsletter.');
        return;
      }

      if (!newsletterGdprConsent) {
        toast.error('We need your consent to store your details for email delivery.');
        return;
      }

      setIsSubmittingNewsletter(true);

      const consentTimestamp = new Date().toISOString();

      try {
        const response = await emailService.subscribeToMarketingList({
          email: trimmedEmail,
          source: 'landing-newsletter',
          incentives: [selectedIncentiveDetails.serviceIncentive],
          consent: {
            email: trimmedEmail,
            marketingConsent: true,
            gdprConsent: true,
            consentAt: consentTimestamp,
            consentSource: 'landing-newsletter',
            metadata: {
              incentive: selectedNewsletterPerk,
            },
          },
          metadata: {
            channel: 'landing',
            incentive: selectedNewsletterPerk,
          },
        });

        await emailService.sendLifecycleEmail('waitlist_confirmation', {
          email: trimmedEmail,
          incentive: selectedNewsletterPerk,
          channel: 'newsletter-section',
        });

        toast.success(response.message ?? 'Welcome to the Thumr grower circle!');
        setNewsletterEmail('');
        setNewsletterConsent(false);
        setNewsletterGdprConsent(false);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to join the grower circle right now. Please try again.';
        toast.error(message);
      } finally {
        setIsSubmittingNewsletter(false);
      }
    },
    [
      handleJoinNewsletterFocus,
      newsletterEmail,
      newsletterConsent,
      newsletterGdprConsent,
      selectedIncentiveDetails,
      selectedNewsletterPerk,
    ],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      {shouldShowListing && (
        <>
          <Header
            onSearch={setSearchQuery}
            onAddListing={handleAddListing}
            onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <div className="flex">
            {showMarketplaceContent && (
              <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                filters={filters}
                onFiltersChange={setFilters}
              />
            )}

            <main className="flex-1 px-4 pb-32 pt-5 sm:px-6 sm:pb-10 sm:pt-6">
              {showLandingContent && (
                <>
                  <section className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-500 px-6 py-10 text-white shadow-lg sm:px-10">
                <div className="absolute inset-y-0 right-0 hidden max-w-xs overflow-hidden sm:block">
                  <div className="h-full w-full bg-gradient-to-t from-emerald-700/30 to-transparent" />
                </div>
                <div className="relative grid gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
                  <div className="space-y-6">
                    <div className="inline-flex items-center rounded-full bg-white/10 px-4 py-1 text-sm font-medium backdrop-blur">
                      Fresh finds for plant lovers
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                      Grow your urban jungle with trusted Thumr growers
                    </h1>
                    <p className="max-w-2xl text-lg text-emerald-50">
                      Discover rare houseplants, resilient natives, and beautifully propagated cuttings sourced from a passionate community of growers who care as much as you do.
                    </p>
                    <ul className="grid gap-4 text-sm font-medium text-emerald-50 sm:grid-cols-2">
                      <li className="flex items-start gap-3">
                        <Leaf className="mt-0.5 h-5 w-5 text-lime-200" />
                        Sustainably raised plants with transparent growing notes.
                      </li>
                      <li className="flex items-start gap-3">
                        <Sprout className="mt-0.5 h-5 w-5 text-lime-200" />
                        Hand-picked selections from growers in your climate zone.
                      </li>
                      <li className="flex items-start gap-3">
                        <Droplets className="mt-0.5 h-5 w-5 text-lime-200" />
                        Care guides for thriving greenery, from seedlings to mature specimens.
                      </li>
                      <li className="flex items-start gap-3">
                        <HeartHandshake className="mt-0.5 h-5 w-5 text-lime-200" />
                        Safe transactions and community support at every step.
                      </li>
                    </ul>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button size="lg" onClick={handleAddListing} className="bg-white text-emerald-700 hover:bg-emerald-50">
                        Become a Seller
                      </Button>
                      <Button size="lg" variant="outline" onClick={handleExploreCategories} className="border-white text-emerald-700 hover:bg-white/10">
                        Explore Categories
                      </Button>
                      <Button
                        size="lg"
                        variant="secondary"
                        onClick={() => openWaitlistModal('join', newsletterEmail)}
                        className="bg-emerald-700 text-white hover:bg-emerald-600"
                      >
                        Claim Launch Perks
                      </Button>
                    </div>
                  </div>
                  <div className="relative hidden overflow-hidden rounded-2xl bg-emerald-900/40 shadow-2xl sm:block">
                    <img
                      src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80"
                      alt="A lush shelf of thriving indoor plants"
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-emerald-900/30" aria-hidden="true" />
                  </div>
                </div>
              </section>

              <section className="mb-12 grid gap-6 rounded-3xl border border-emerald-100 bg-white/70 p-6 shadow-sm backdrop-blur-sm sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    title: 'Expertly curated collections',
                    description: 'Shop by light level, pet safety, or growth habit so every plant thrives in its new home.',
                    icon: <Grid3X3 className="h-6 w-6 text-emerald-600" aria-hidden="true" />,
                  },
                  {
                    title: 'Grower-first marketplace',
                    description: 'List your plants in minutes with transparent pricing and dedicated seller analytics.',
                    icon: <Sprout className="h-6 w-6 text-emerald-600" aria-hidden="true" />,
                  },
                  {
                    title: 'Climate-conscious shipping',
                    description: 'Insulated, eco-friendly packaging and delivery windows designed around plant health.',
                    icon: <Droplets className="h-6 w-6 text-emerald-600" aria-hidden="true" />,
                  },
                  {
                    title: 'Community knowledge base',
                    description: 'Access tutorials, live Q&As, and seasonal plant care workshops led by master growers.',
                    icon: <HeartHandshake className="h-6 w-6 text-emerald-600" aria-hidden="true" />,
                  },
                ].map((item) => (
                  <article key={item.title} className="rounded-2xl bg-gradient-to-br from-white to-emerald-50 p-5 shadow-sm">
                    <div className="mb-4 inline-flex rounded-full bg-emerald-100 p-3 text-emerald-700">
                      {item.icon}
                    </div>
                    <h2 className="mb-2 text-lg font-semibold text-emerald-900">{item.title}</h2>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </article>
                ))}
              </section>

              <section id="newsletter-section" className="mb-12 grid gap-8 rounded-3xl bg-emerald-900 px-6 py-8 text-emerald-50 shadow-lg lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Join the grower circle</h2>
                  <p className="text-sm text-emerald-100 sm:text-base">
                    Get exclusive access to propagation tutorials, seasonal care checklists, and curated drops from our most loved sellers. Pick the launch perk you want as a thank-you for joining early.
                  </p>
                  <form className="space-y-4" onSubmit={handleNewsletterSubmit}>
                    <div className="space-y-2">
                      <Label htmlFor="newsletter-email" className="text-emerald-50">
                        Email address
                      </Label>
                      <Input
                        id="newsletter-email"
                        type="email"
                        placeholder="you@plantmail.com"
                        value={newsletterEmail}
                        onChange={(event) => setNewsletterEmail(event.target.value)}
                        className="border-emerald-500/70 bg-emerald-950/30 text-emerald-50 placeholder:text-emerald-200"
                        aria-describedby="newsletter-description"
                        required
                      />
                      <p id="newsletter-description" className="text-xs text-emerald-200">
                        We send one thoughtfully curated email a week. Unsubscribe anytime.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">Choose your perk</p>
                      <RadioGroup
                        value={selectedNewsletterPerk}
                        onValueChange={(value) => setSelectedNewsletterPerk(value as WaitlistIncentiveOption)}
                        className="space-y-2"
                        aria-label="Select your launch perk"
                      >
                        {WAITLIST_INCENTIVE_ENTRIES.map(([key, details]) => (
                          <Label
                            key={key}
                            htmlFor={`newsletter-perk-${key}`}
                            className="cursor-pointer items-start gap-3 rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-sm text-emerald-100 transition hover:border-emerald-300 hover:bg-emerald-950/40"
                          >
                            <RadioGroupItem
                              id={`newsletter-perk-${key}`}
                              value={key}
                              className="mt-1 border-emerald-300 text-emerald-300 data-[state=checked]:bg-emerald-300 data-[state=checked]:text-emerald-950"
                            />
                            <span className="space-y-1">
                              <span className="block text-sm font-semibold text-white">{details.title}</span>
                              <span className="block text-xs text-emerald-200">{details.description}</span>
                            </span>
                          </Label>
                        ))}
                      </RadioGroup>
                    </div>
                    <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="newsletter-consent"
                          checked={newsletterConsent}
                          onCheckedChange={(checked) => setNewsletterConsent(checked === true)}
                          className="mt-1 border-emerald-300 data-[state=checked]:bg-emerald-300 data-[state=checked]:text-emerald-950"
                        />
                        <Label htmlFor="newsletter-consent" className="cursor-pointer items-start text-xs text-emerald-100">
                          Yes, send me the grower circle newsletter and launch incentives.
                        </Label>
                      </div>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="newsletter-gdpr"
                          checked={newsletterGdprConsent}
                          onCheckedChange={(checked) => setNewsletterGdprConsent(checked === true)}
                          className="mt-1 border-emerald-300 data-[state=checked]:bg-emerald-300 data-[state=checked]:text-emerald-950"
                        />
                        <Label htmlFor="newsletter-gdpr" className="cursor-pointer items-start text-xs text-emerald-100">
                          I consent to Thumr storing my details so the perk and emails can be delivered. I can unsubscribe at any time.
                        </Label>
                      </div>
                      <p className="text-xs text-emerald-200">
                        We log consent with a timestamp and every email includes an unsubscribe link for immediate opt-out.
                      </p>
                    </div>
                    <Button type="submit" size="lg" className="w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400" disabled={isSubmittingNewsletter}>
                      {isSubmittingNewsletter ? 'Claiming perk...' : 'Claim my launch perk'}
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      className="text-emerald-100 underline-offset-4 hover:text-emerald-50"
                      onClick={() => openWaitlistModal('manage', newsletterEmail)}
                    >
                      Manage preferences or unsubscribe
                    </Button>
                  </form>
                </div>
                <div className="grid content-between gap-6 rounded-2xl bg-emerald-950/40 p-6">
                  <div className="flex items-start gap-3">
                    <Quote className="mt-1 h-7 w-7 text-emerald-300" aria-hidden="true" />
                    <p className="text-sm text-emerald-100">
                      "Thumr has transformed how I discover rare specimens. The newsletters are packed with seasonal advice that keeps my collection lush and healthy."
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <img
                      src="https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=120&q=80"
                      alt="Portrait of Maya, a joyful plant stylist"
                      className="h-12 w-12 rounded-full object-cover"
                      loading="lazy"
                    />
                    <div>
                      <p className="text-sm font-semibold text-white">Maya Chen</p>
                      <p className="text-xs text-emerald-200">Plant stylist & long-time Thumr seller</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-12 space-y-6 rounded-3xl border border-emerald-100 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
                <header className="space-y-3 text-center">
                  <h2 className="text-2xl font-bold text-emerald-950">What our growers are saying</h2>
                  <p className="text-sm text-muted-foreground">
                    Hear how plant enthusiasts are thriving with Thumr—from balcony gardens to greenhouse sanctuaries.
                  </p>
                </header>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {[
                    {
                      quote:
                        'I listed my first batch of philodendron cuttings and sold out in a weekend. The listing tools made it effortless to share my propagation notes.',
                      author: 'Jonas Rivera',
                      role: 'Tropical plant hobbyist',
                      image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=80',
                    },
                    {
                      quote:
                        'Shipping supplies arrive sustainably sourced, and the marketplace community helped me master heat packs for winter deliveries.',
                      author: 'Priya Natarajan',
                      role: 'Cold-climate cactus grower',
                      image: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=120&q=80',
                    },
                    {
                      quote:
                        'The category filters make it easy to recommend pet-safe greenery to my clients. It is my go-to hub for sourcing healthy plants.',
                      author: 'Elena Brooks',
                      role: 'Interior plant designer',
                      image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=120&q=80',
                    },
                  ].map((testimonial) => (
                    <figure key={testimonial.author} className="flex h-full flex-col justify-between rounded-2xl bg-white p-5 shadow-md">
                      <blockquote className="text-sm text-muted-foreground">“{testimonial.quote}”</blockquote>
                      <figcaption className="mt-5 flex items-center gap-3">
                        <img
                          src={testimonial.image}
                          alt={`Portrait of ${testimonial.author}`}
                          className="h-10 w-10 rounded-full object-cover"
                          loading="lazy"
                        />
                        <div>
                          <p className="text-sm font-semibold text-emerald-900">{testimonial.author}</p>
                          <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                        </div>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>

                </>
              )}

              {showMarketplaceContent && (
                <>
                  {/* Controls */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="md:hidden"
                      >
                        <SlidersHorizontal className="h-4 w-4 mr-2" />
                        Filters
                      </Button>

                      <div className="text-sm text-muted-foreground">
                        {isInitialLoading && filteredPlants.length === 0 ? (
                          'Loading plants...'
                        ) : (
                          <>
                            {filteredPlants.length} plants loaded
                            {totalAvailable !== null && totalAvailable > filteredPlants.length && (
                              <span className="ml-1">of {totalAvailable}+</span>
                            )}
                            {searchQuery && (
                              <span> for "{searchQuery}"</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant={viewMode === 'grid' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Plants Grid */}
                  {filteredPlants.length > 0 ? (
                <div
                  id="marketplace-grid"
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                      : 'space-y-4'
                  }
                >
                  {filteredPlants.map((plant: Plant) => (
                    <PlantCard
                      key={plant.plantId}
                      plant={plant}
                      onPlantUpdate={handlePlantUpdate}
                      onViewDetail={handleViewDetail}
                    />
                  ))}
                  <div ref={loadMoreTriggerRef} className="col-span-full h-1" aria-hidden />
                </div>
              ) : (
                <div className="py-12 text-center">
                  {isInitialLoading ? (
                    <div
                      className={
                        viewMode === 'grid'
                          ? 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                          : 'space-y-4'
                      }
                    >
                      {Array.from({ length: viewMode === 'grid' ? 8 : 4 }).map((_, index) => (
                        <PlantCardSkeleton key={`initial-skeleton-${index}`} />
                      ))}
                    </div>
                  ) : error ? (
                    <div className="text-lg text-red-500">Error loading plants. Please try again later.</div>
                  ) : (
                    <>
                      <div className="mb-4 text-muted-foreground">
                        No plants found matching your criteria
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchQuery('');
                          setFilters({
                            categories: [],
                            priceRange: [0, 500],
                            conditions: [],
                            location: 'anywhere'
                          });
                        }}
                      >
                        Clear all filters
                      </Button>
                    </>
                  )}
                </div>
              )}

              {filteredPlants.length > 0 && isFetchingNextPage && (
                <div
                  className={`${
                    viewMode === 'grid'
                      ? 'mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                      : 'mt-6 space-y-4'
                  }`}
                >
                  {Array.from({ length: viewMode === 'grid' ? 4 : 2 }).map((_, index) => (
                    <PlantCardSkeleton key={`loading-more-${index}`} />
                  ))}
                </div>
              )}

              {!hasMore && !isInitialLoading && filteredPlants.length > 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  You’ve reached the end of the plant listings.
                </div>
                  )}
                </>
              )}
            </main>
          </div>

          {isCreateNewPlantModalOpen && (
            <Suspense fallback={<ModalLoadingFallback message="Preparing listing creator..." />}>
              <CreateNewPlantModal
                isOpen={isCreateNewPlantModalOpen}
                onClose={() => setIsCreateNewPlantModalOpen(false)}
                onListingCreated={handleListingCreated}
              />
            </Suspense>
          )}
        </>
      )}

      {!shouldShowListing && !selectedPlant && (
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          Loading listing...
        </div>
      )}

      {selectedPlant && (
        <Suspense
          fallback={(
            <ModalLoadingFallback
              message="Loading plant details..."
              presentation={isMobile ? 'page' : 'modal'}
            />
          )}
        >
          <PlantDetailModal
            plant={selectedPlant}
            isOpen={isDetailRoute}
            onClose={handleCloseDetail}
            onPlantUpdate={handlePlantUpdate}
            onListingUpdated={handleListingUpdated}
            presentation={isMobile ? 'page' : 'modal'}
          />
        </Suspense>
      )}

      <EmailCaptureModal
        open={isWaitlistModalOpen}
        mode={waitlistModalMode}
        initialEmail={waitlistEmailPrefill || (newsletterEmail ? newsletterEmail : undefined)}
        onOpenChange={(open) => {
          setIsWaitlistModalOpen(open);
          if (!open) {
            setWaitlistEmailPrefill('');
          }
        }}
      />

      {showMarketplaceContent && <MobileActionBar onAddListing={handleAddListing} />}
    </div>
  );
}

export default App;
