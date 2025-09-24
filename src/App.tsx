import { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PlantCard } from './components/PlantCard';
import { CreateNewPlantModal } from './components/CreateNewPlantModal';
import { PlantDetailModal } from './components/PlantDetailModal';
import { Button } from './components/ui/button';
import { SlidersHorizontal, Grid3X3, List } from 'lucide-react';
import './index.css';
import './App.css';
import type { Plant, DeliveryMethod, LivePlantWarranty } from './interfaces/Plant';
import { useAuth } from './contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { API_ENDPOINTS } from './config/amplify';
import { apiClient } from './services/auth';
import type { ZipRange } from './interfaces/Plant';
import { DELIVERY_METHOD_OPTIONS } from './constants/fulfillmentRules';
import { useIsMobile } from './hooks/useIsMobile';

const VALID_DELIVERY_METHODS = new Set<DeliveryMethod>(
  DELIVERY_METHOD_OPTIONS.map((option) => option.value),
);

const normalizeZipRanges = (ranges: any[]): ZipRange[] => {
  return ranges
    .map((range) => {
      const start =
        typeof range?.start === 'string'
          ? range.start
          : typeof range?.startZip === 'string'
          ? range.startZip
          : '';
      const endCandidate =
        typeof range?.end === 'string'
          ? range.end
          : typeof range?.endZip === 'string'
          ? range.endZip
          : '';
      const end = endCandidate || start;
      if (!start || !end) {
        return null;
      }
      return { start, end } satisfies ZipRange;
    })
    .filter((value): value is ZipRange => Boolean(value));
};

const normalizePlantRecord = (plant: any): Plant => {
  const deliveryMethods: DeliveryMethod[] = Array.isArray(plant?.deliveryMethods)
    ? plant.deliveryMethods.filter(
        (method: unknown): method is DeliveryMethod =>
          typeof method === 'string' && VALID_DELIVERY_METHODS.has(method as DeliveryMethod),
      )
    : [];

  const availableZipRanges: ZipRange[] = Array.isArray(plant?.availableZipRanges)
    ? normalizeZipRanges(plant.availableZipRanges)
    : [];

  const packagingNotes = typeof plant?.packagingNotes === 'string' ? plant.packagingNotes : '';

  const rawWarranty = plant?.livePlantWarranty;
  let normalizedWarranty: LivePlantWarranty = { isOffered: false };
  if (rawWarranty && typeof rawWarranty === 'object') {
    const durationRaw = rawWarranty.durationDays;
    const parsedDuration =
      typeof durationRaw === 'number'
        ? durationRaw
        : typeof durationRaw === 'string'
        ? Number(durationRaw)
        : undefined;
    const durationDays =
      parsedDuration !== undefined && Number.isFinite(parsedDuration) && parsedDuration > 0
        ? parsedDuration
        : undefined;
    const notes =
      typeof rawWarranty.notes === 'string' && rawWarranty.notes.trim().length > 0
        ? rawWarranty.notes
        : undefined;

    normalizedWarranty = {
      isOffered: Boolean(rawWarranty.isOffered),
      durationDays,
      notes,
    };
  }

  return {
    ...plant,
    deliveryMethods,
    availableZipRanges,
    packagingNotes,
    livePlantWarranty: normalizedWarranty,
  } as Plant;
};

const App = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCreateNewPlantModalOpen, setIsCreateNewPlantModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [filters, setFilters] = useState({
    categories: [],
    priceRange: [0, 500],
    conditions: [],
    location: 'anywhere'
  });
  const [plantsData, setPlantsData] = useState<Plant[]>([]);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { plantId } = useParams<{ plantId?: string }>();
  const isMobile = useIsMobile();
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Public endpoint - no authentication required for viewing plants
        const response = await apiClient.get(API_ENDPOINTS.PLANTS_READ, false);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        const normalizedPlants: Plant[] = Array.isArray(result)
          ? result.map((item: any) => normalizePlantRecord(item))
          : [];
        setPlantsData(normalizedPlants);
      } catch (err) {
        console.error('Error fetching plants:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

  const handlePlantUpdate = (updatedPlant: Plant) => {
    setPlantsData(prev =>
      prev.map(plant => (plant.id === updatedPlant.id ? { ...plant, ...updatedPlant } : plant))
    );
  };

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

            <main className="flex-1 p-6">
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
                    {filteredPlants.length} plants found
                    {searchQuery && (
                      <span> for "{searchQuery}"</span>
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
                </div>
              ) : (
                <div className="py-12 text-center">
                  {loading ? (
                    <div className="text-lg text-gray-500">Loading plants...</div>
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
            </main>
          </div>

          <CreateNewPlantModal
            isOpen={isCreateNewPlantModalOpen}
            onClose={() => setIsCreateNewPlantModalOpen(false)}
          />
        </>
      )}

      {!shouldShowListing && !selectedPlant && (
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          Loading listing...
        </div>
      )}

      {selectedPlant && (
        <PlantDetailModal
          plant={selectedPlant}
          isOpen={isDetailRoute}
          onClose={handleCloseDetail}
          onPlantUpdate={handlePlantUpdate}
          presentation={isMobile ? 'page' : 'modal'}
        />
      )}
    </div>
  );
}

export default App;