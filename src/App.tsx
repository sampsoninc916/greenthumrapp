import { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PlantCard } from './components/PlantCard';
import { CreateNewPlantModal } from './components/CreateNewPlantModal';
import { Button } from './components/ui/button';
import { SlidersHorizontal, Grid3X3, List } from 'lucide-react';
import './index.css';
import './App.css';
import type { Plant } from './interfaces/Plant';
import { useAuth } from './contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from './config/amplify';
import { apiClient } from './services/auth';

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
        setPlantsData(result);
      } catch (err) {
        console.error('Error fetching plants:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
                {/* {0} plants found */}
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
            <div className={`
              ${viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                : 'space-y-4'
              }
            `}>
              {filteredPlants.map((plant: Plant) => (
                <PlantCard
                  key={plant.id}
                  plant={plant}
                  onPlantUpdate={handlePlantUpdate}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              {loading ? (
                <div className="text-lg text-gray-500">Loading plants...</div>
              ) : error ? (
                <div className="text-lg text-red-500">Error loading plants. Please try again later.</div>
              ) : (
                <>
                  <div className="text-muted-foreground mb-4">
                    No plants found matching your criteria
                  </div>
                  <Button variant="outline" onClick={() => {
                    setSearchQuery('');
                    setFilters({
                      categories: [],
                      priceRange: [0, 500],
                      conditions: [],
                      location: 'anywhere'
                    });
                  }}>
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
    </div>
  );
}

export default App;