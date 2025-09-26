import { X, Filter, DollarSign, MapPin, Star } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Slider } from './ui/slider';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Separator } from './ui/separator';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    categories: string[];
    priceRange: number[];
    conditions: string[];
    location: string;
  };
  onFiltersChange: (filters: any) => void;
}

export function Sidebar({ isOpen, onClose, filters, onFiltersChange }: SidebarProps) {
  const categories = [
    { id: 'houseplants', label: 'Houseplants', count: 45 },
    { id: 'flowers', label: 'Flowers', count: 32 },
    { id: 'herbs', label: 'Herbs', count: 28 },
    { id: 'succulents', label: 'Succulents', count: 38 },
    { id: 'trees', label: 'Trees', count: 12 },
    { id: 'seeds', label: 'Seeds', count: 22 },
    { id: 'tools', label: 'Tools & Supplies', count: 15 },
  ];

  const conditions = [
    { id: 'new', label: 'New' },
    { id: 'like-new', label: 'Like New' },
    { id: 'good', label: 'Good' },
    { id: 'fair', label: 'Fair' },
  ];

  const locations = [
    { id: 'local', label: 'Local (within 10 miles)' },
    { id: 'nearby', label: 'Nearby (within 25 miles)' },
    { id: 'anywhere', label: 'Anywhere' },
  ];

  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    const newCategories = checked 
      ? [...filters.categories, categoryId]
      : filters.categories.filter(id => id !== categoryId);
    
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const handlePriceChange = (value: number[]) => {
    onFiltersChange({ ...filters, priceRange: [value[0], value[1]] });
  };

  const handleConditionChange = (conditionId: string, checked: boolean) => {
    const newConditions = checked 
      ? [...filters.conditions, conditionId]
      : filters.conditions.filter(id => id !== conditionId);
    
    onFiltersChange({ ...filters, conditions: newConditions });
  };

  const handleLocationChange = (location: string) => {
    onFiltersChange({ ...filters, location });
  };

  const clearFilters = () => {
    onFiltersChange({
      categories: [],
      priceRange: [0, 500],
      conditions: [],
      location: 'anywhere'
    });
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed top-16 left-0 h-[calc(100vh-4rem)] w-80 bg-white border-r border-green-100 z-50 overflow-y-auto
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:sticky md:top-20 md:h-[calc(100vh-5rem)] md:shrink-0 md:translate-x-0 md:overflow-y-auto md:block
      `}>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-green-600" />
              <h2 className="font-semibold">Filters</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="md:hidden"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-3">
            <h3 className="font-medium">Categories</h3>
            <div className="space-y-2">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={category.id}
                      checked={filters.categories.includes(category.id)}
                      onCheckedChange={(checked) => 
                        handleCategoryChange(category.id, checked as boolean)
                      }
                    />
                    <Label 
                      htmlFor={category.id}
                      className="text-sm cursor-pointer"
                    >
                      {category.label}
                    </Label>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {category.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Price Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <h3 className="font-medium">Price Range</h3>
            </div>
            <div className="px-2">
              <Slider
                value={filters.priceRange}
                onValueChange={handlePriceChange}
                max={500}
                min={0}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-1">
                <span>${filters.priceRange[0]}</span>
                <span>${filters.priceRange[1]}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Condition */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-green-600" />
              <h3 className="font-medium">Condition</h3>
            </div>
            <div className="space-y-2">
              {conditions.map((condition) => (
                <div key={condition.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={condition.id}
                    checked={filters.conditions.includes(condition.id)}
                    onCheckedChange={(checked) => 
                      handleConditionChange(condition.id, checked as boolean)
                    }
                  />
                  <Label 
                    htmlFor={condition.id}
                    className="text-sm cursor-pointer"
                  >
                    {condition.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Location */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-600" />
              <h3 className="font-medium">Location</h3>
            </div>
            <RadioGroup 
              value={filters.location} 
              onValueChange={handleLocationChange}
            >
              {locations.map((location) => (
                <div key={location.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={location.id} id={location.id} />
                  <Label htmlFor={location.id} className="text-sm cursor-pointer">
                    {location.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>
      </aside>
    </>
  );
}