import { useState } from 'react';
import { Heart, MapPin } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import type { Plant } from '../interfaces/Plant';

interface PlantCardProps {
  plant: Plant;
  isLiked?: boolean;
  onLike?: (id: string) => void;
  onPlantUpdate?: (plant: Plant) => void;
  onViewDetail?: (plant: Plant) => void;
}

export function PlantCard({
  plant,
  isLiked = false,
  onLike,
  onPlantUpdate,
  onViewDetail,
}: PlantCardProps) {
  const [liked, setLiked] = useState(isLiked);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLiked(!liked);
    onLike?.(plant.plantId);
  };

  const handleClick = () => {
    onViewDetail?.(plant);
  };

  const handlePlantUpdate = (updatedPlant: Plant) => {
    onPlantUpdate?.(updatedPlant);
  }

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'New': return 'bg-green-100 text-green-800';
      case 'Like New': return 'bg-emerald-100 text-emerald-800';
      case 'Good': return 'bg-yellow-100 text-yellow-800';
      case 'Fair': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const taxonomyBadges = [
    plant.species && plant.cultivar
      ? `${plant.species} '${plant.cultivar}'`
      : plant.species,
    !plant.species && plant.cultivar ? `Cultivar ${plant.cultivar}` : null,
    plant.usdaZone ? `Zone ${String(plant.usdaZone).toUpperCase()}` : null,
    plant.lightPreference ? `${plant.lightPreference} light` : null,
    plant.soilPreference ? `${plant.soilPreference} soil` : null,
  ].filter((badge): badge is string => Boolean(badge));
  const visibleBadges = taxonomyBadges.slice(0, 3);

  return (
    <>
      <Card
        className="overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 group"
        onClick={handleClick}
      >
        <div className="relative aspect-square overflow-hidden">
          <ImageWithFallback
            src={Array.isArray(plant.images) ? plant.images[0] : plant.images}
            alt={plant.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 p-2 bg-white/80 hover:bg-white/90 backdrop-blur-sm rounded-full"
            onClick={handleLike}
          >
            <Heart 
              className={`h-4 w-4 ${liked ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} 
            />
          </Button>
          <Badge 
            className={`absolute top-2 left-2 ${getConditionColor(plant.condition)}`}
            variant="secondary"
          >
            {plant.condition}
          </Badge>
        </div>
        
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <h3 className="line-clamp-2 group-hover:text-green-600 transition-colors">
                {plant.name}
              </h3>
            </div>
            
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="text-sm">{plant.location}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="font-medium text-green-600">
                ${plant.price}
              </span>
              <Badge variant="outline" className="text-xs">
                {plant.category}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground">
              by {plant.seller}
            </p>
            {visibleBadges.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {visibleBadges.map((badge, index) => (
                  <Badge
                    key={`${badge}-${index}`}
                    variant="secondary"
                    className="border-emerald-200 bg-emerald-50 text-emerald-700"
                  >
                    {badge}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}