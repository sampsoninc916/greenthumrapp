import { Suspense, lazy, useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PlantCard } from './components/PlantCard';
import { Button } from './components/ui/button';
import { MobileActionBar } from './components/MobileActionBar';
import { SlidersHorizontal, Grid3X3, List } from 'lucide-react';
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

const CreateNewPlantModal = lazy(() => import('./components/CreateNewPlantModal').then((module) => ({ default: module.CreateNewPlantModal })));
const PlantDetailModal = lazy(() => import('./components/PlantDetailModal').then((module) => ({ default: module.PlantDetailModal })));

const PLANTS_PAGE_SIZE = 20;

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
        uniqueById.set(plant.id, plant);
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
    return plantsData.find((plant) => plant.id === plantId) ?? null;
  }, [plantsData, plantId]);

  const isDetailRoute = Boolean(plantId);
  const shouldShowListing = !isDetailRoute || !isMobile;

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
      const index = items.findIndex((plant) => plant.id === updatedPlant.id);
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
      const existingIndex = prev.findIndex((plant) => plant.id === updatedPlant.id);
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
    navigate(`/plants/${plant.id}`);
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
            <Sidebar
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
              filters={filters}
              onFiltersChange={setFilters}
            />

            <main className="flex-1 px-4 pb-32 pt-5 sm:px-6 sm:pb-10 sm:pt-6">
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
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                      : 'space-y-4'
                  }
                >
                  {filteredPlants.map((plant: Plant) => (
                    <PlantCard
                      key={plant.id}
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

      <MobileActionBar onAddListing={handleAddListing} />
    </div>
  );
}

export default App;