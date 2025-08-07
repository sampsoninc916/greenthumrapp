import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PlantCard } from './components/PlantCard';
import { PlantDetailModal } from './components/PlantDetailModal';
import { CreateNewPlantModal } from './components/CreateNewPlantModal';
import { Button } from './components/ui/button';
import { SlidersHorizontal, Grid3X3, List } from 'lucide-react';
import logo from './logo.svg';
import './index.css';
import './App.css';
import './styles/globals_g.css'

// Mock data for plants
const mockPlants = [
  {
    id: '1',
    name: 'Monstera Deliciosa',
    price: 45,
    images: [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
      'https://images.unsplash.com/photo-1545241047-6083a3684587?w=400'
    ],
    location: 'Brooklyn, NY',
    category: 'Houseplants',
    seller: 'Sarah M.',
    sellerAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b167?w=150',
    sellerRating: 4.8,
    condition: 'Like New',
    description: 'Beautiful mature Monstera with fenestrations. Healthy and well-established plant that has been growing in my home for 2 years.',
    careInstructions: 'Bright indirect light, water when top soil is dry. Loves humidity!',
    potSize: '8 inch',
    height: '3 feet',
    postedDate: '2 days ago'
  },
  {
    id: '2',
    name: 'Fiddle Leaf Fig',
    price: 75,
    images: ['https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400'],
    location: 'San Francisco, CA',
    category: 'Trees',
    seller: 'Mike R.',
    sellerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    sellerRating: 4.9,
    condition: 'New',
    description: 'Stunning fiddle leaf fig, perfect for adding height to any room.',
    careInstructions: 'Bright indirect light, water weekly in growing season.',
    potSize: '10 inch',
    height: '5 feet',
    postedDate: '1 day ago'
  },
  {
    id: '3',
    name: 'Snake Plant Variety Pack',
    price: 30,
    images: ['https://images.unsplash.com/photo-1572688484438-313a6e50c333?w=400'],
    location: 'Austin, TX',
    category: 'Houseplants',
    seller: 'Plant Lady Co.',
    sellerAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    sellerRating: 5.0,
    condition: 'New',
    description: 'Set of 3 different snake plant varieties. Perfect for beginners!',
    careInstructions: 'Low light tolerant, water every 2-3 weeks.',
    potSize: '4 inch each',
    height: '12-18 inches',
    postedDate: '3 days ago'
  },
  {
    id: '4',
    name: 'Lavender Plant',
    price: 15,
    images: ['https://images.unsplash.com/photo-1611909023032-2d6b3134ecba?w=400'],
    location: 'Portland, OR',
    category: 'Herbs',
    seller: 'Garden Guru',
    sellerAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    sellerRating: 4.7,
    condition: 'Good',
    description: 'Fragrant lavender plant, great for aromatherapy and cooking.',
    careInstructions: 'Full sun, well-draining soil, water sparingly.',
    potSize: '6 inch',
    height: '8 inches',
    postedDate: '5 days ago'
  },
  {
    id: '5',
    name: 'Succulent Collection',
    price: 25,
    images: ['https://images.unsplash.com/photo-1459156212016-c812468e2115?w=400'],
    location: 'Los Angeles, CA',
    category: 'Succulents',
    seller: 'Desert Dreams',
    sellerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    sellerRating: 4.6,
    condition: 'New',
    description: 'Beautiful collection of 6 different succulents in decorative pots.',
    careInstructions: 'Bright light, water every 1-2 weeks when soil is dry.',
    potSize: '3 inch each',
    height: '4-6 inches',
    postedDate: '1 week ago'
  },
  {
    id: '6',
    name: 'Bird of Paradise',
    price: 120,
    images: ['https://images.unsplash.com/photo-1509423350716-97f2360af543?w=400'],
    location: 'Miami, FL',
    category: 'Trees',
    seller: 'Tropical Plants Inc.',
    sellerAvatar: 'https://images.unsplash.com/photo-1502323777036-f29e3972d82f?w=150',
    sellerRating: 4.9,
    condition: 'Like New',
    description: 'Majestic Bird of Paradise, ready to make a statement in your home.',
    careInstructions: 'Bright indirect light, high humidity, water regularly.',
    potSize: '12 inch',
    height: '6 feet',
    postedDate: '4 days ago'
  },
  {
    id: '7',
    name: 'Herb Garden Starter Kit',
    price: 35,
    images: ['https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400'],
    location: 'Seattle, WA',
    category: 'Herbs',
    seller: 'Fresh Herbs Co.',
    sellerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    sellerRating: 4.8,
    condition: 'New',
    description: 'Complete starter kit with basil, rosemary, thyme, and oregano.',
    careInstructions: 'Bright light, water regularly, harvest frequently.',
    potSize: '4 inch each',
    height: '6-8 inches',
    postedDate: '2 days ago'
  },
  {
    id: '8',
    name: 'Pink Orchid',
    price: 40,
    images: ['https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400'],
    location: 'Denver, CO',
    category: 'Flowers',
    seller: 'Orchid Specialist',
    sellerAvatar: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=150',
    sellerRating: 4.9,
    condition: 'New',
    description: 'Gorgeous pink orchid in full bloom. Easy care variety.',
    careInstructions: 'Indirect light, water with ice cubes weekly.',
    potSize: '5 inch',
    height: '12 inches',
    postedDate: '6 days ago'
  }
];

const App = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCreateNewPlantModalOpen, setIsCreateNewPlantModalOpen] = useState(false);
  type Plant = typeof mockPlants[number];
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [isPlantModalOpen, setIsPlantModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [filters, setFilters] = useState({
    categories: [],
    priceRange: [0, 500],
    condition: '',
    location: 'anywhere'
  });

  // Filter plants based on search and filters
  const filteredPlants = useMemo(() => {
    return mockPlants.filter(plant => {
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
  }, [searchQuery, filters]);

  const handlePlantClick = (plantId: string) => {
    const plant = mockPlants.find(p => p.id === plantId);
    setSelectedPlant(plant ?? null);
    setIsPlantModalOpen(true);
  };

  const handleAddListing = () => {
    // In a real app, this would open a form to add a new listing
    setIsCreateNewPlantModalOpen(true);
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
              {filteredPlants.map((plant) => (
                <PlantCard
                  key={plant.id}
                  id={plant.id}
                  name={plant.name}
                  price={plant.price}
                  image={plant.images[0]}
                  location={plant.location}
                  category={plant.category}
                  seller={plant.seller}
                  condition={plant.condition}
                  onClick={handlePlantClick}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
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
            </div>
          )}
        </main>
      </div>

      <PlantDetailModal
        plant={selectedPlant}
        isOpen={isPlantModalOpen}
        onClose={() => setIsPlantModalOpen(false)}
      />
      <CreateNewPlantModal
        isOpen={isCreateNewPlantModalOpen}
        onClose={() => setIsCreateNewPlantModalOpen(false)}
      />
    </div>
  );
}

export default App;
