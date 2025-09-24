import { useState, useMemo, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PlantCard } from './components/PlantCard';
import { CreateNewPlantModal } from './components/CreateNewPlantModal';
import { PlantDetailModal } from './components/PlantDetailModal';
import { Button } from './components/ui/button';
import { MobileActionBar } from './components/MobileActionBar';
import { SlidersHorizontal, Grid3X3, List } from 'lucide-react';
import './index.css';
import './App.css';
import type { Plant } from './interfaces/Plant';
import { useAuth } from './contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { API_ENDPOINTS } from './config/amplify';
import { apiClient } from './services/auth';
import { normalizePlantRecord } from './utils/plants';
import { useIsMobile } from './hooks/useIsMobile';
import { toast } from 'sonner';
import { isPlantResponseDto, type PlantResponseDto } from './interfaces/dtos';

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
  // TODO: Consider replacing the manual fetch logic with React Query or SWR for cache management.
  const fetchPlants = useCallback(async () => {
    try {
      setLoading(true);
      // Public endpoint - no authentication required for viewing plants
      const { data } = await apiClient.get<PlantResponseDto[]>(API_ENDPOINTS.PLANTS_READ, {
        requiresAuth: false,
      });

      if (!data) {
        setPlantsData([]);
        setError(false);
        return;
      }

      const validPlants = data.filter((item): item is PlantResponseDto => isPlantResponseDto(item));

      if (validPlants.length !== data.length) {
        console.warn('Filtered invalid plant payload entries', {
          total: data.length,
          valid: validPlants.length,
        });
        toast.error('Some plant listings could not be loaded. Please refresh to try again.');
      }

      const normalizedPlants: Plant[] = validPlants.map((item) => normalizePlantRecord(item));
      setPlantsData(normalizedPlants);
      setError(false);
    } catch (err) {
      console.error('Error fetching plants:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPlants();
  }, [fetchPlants]);

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
    setPlantsData((prev) => {
      const existingIndex = prev.findIndex((plant) => plant.id === updatedPlant.id);
      if (existingIndex === -1) {
        return [...prev, updatedPlant];
      }
      const next = [...prev];
      next[existingIndex] = { ...next[existingIndex], ...updatedPlant };
      return next;
    });
  }, []);

  const handleListingCreated = useCallback(
    (createdPlant: Plant) => {
      handlePlantUpdate(createdPlant);
      void fetchPlants();
    },
    [fetchPlants, handlePlantUpdate],
  );

  const handleListingUpdated = useCallback(
    (_updatedPlant: Plant) => {
      void fetchPlants();
    },
    [fetchPlants],
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
            onListingCreated={handleListingCreated}
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
          onListingUpdated={handleListingUpdated}
          presentation={isMobile ? 'page' : 'modal'}
        />
      )}

      <MobileActionBar onAddListing={handleAddListing} />
    </div>
  );
}

export default App;