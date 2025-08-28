import { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PlantCard } from './components/PlantCard';
import { CreateNewPlantModal } from './components/CreateNewPlantModal';
import { Button } from './components/ui/button';
import { SlidersHorizontal, Grid3X3, List } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import './index.css';
import './App.css';
import { Plant } from './interfaces/Plant';
import { set } from 'react-hook-form';

const App = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCreateNewPlantModalOpen, setIsCreateNewPlantModalOpen] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [isPlantModalOpen, setIsPlantModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [filters, setFilters] = useState({
    categories: [],
    priceRange: [0, 500],
    condition: '',
    location: 'anywhere'
  });
  const [plantsData, setPlantsData] = useState<Plant[]>([]);
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true); // Set loading state before fetching
        const response = await fetch('https://dzakzltsq4.execute-api.us-east-1.amazonaws.com/default/readPlantsData');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        setPlantsData(result); // Set data after successful fetch
      } catch (err) {
        setError(true); // Set error state if something goes wrong
      } finally {
        setLoading(false); // Always turn off loading state
      }
    };

    fetchData(); // Call the async function
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
      if (filters.condition && plant.condition.toLowerCase().replace(' ', '-') !== filters.condition) {
        return false;
      }

      return true;
    });
  }, [searchQuery, filters, plantsData]);

  const handleAddListing = () => {
    // In a real app, this would open a form to add a new listing
    setIsCreateNewPlantModalOpen(true);
  };
  // useEffect(() => {
  //   async function fetchJwt() {
  //     if (user && user.isVerified) {
  //       const res = await fetch('/api/request-jwt', { method: 'POST', body: JSON.stringify({ userId: user.id }) });
  //       const data = await res.json();
  //       setJwt(data.token);
  //     }
  //   }
  //   fetchJwt();
  // }, [user]);

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
                      condition: '',
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