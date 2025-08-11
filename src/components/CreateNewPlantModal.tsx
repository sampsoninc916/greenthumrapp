import { useState } from 'react';
import { X, Heart, MapPin, User, MessageCircle, Star, Shield, Image } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface Plant {
  id: string;
  name: string;
  price: number;
  images: string[];
  location: string;
  category: string;
  seller: string;
  sellerAvatar: string;
  sellerRating: number;
  condition: string;
  description: string;
  careInstructions: string;
  potSize: string;
  height: string;
  postedDate: string;
}

interface CreateNewPlantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateNewPlantModal({ isOpen, onClose }: CreateNewPlantModalProps) {
  // const [currentImageIndex, setCurrentImageIndex] = useState(0);
  // const [isLiked, setIsLiked] = useState(false);

  // if (!plant) return null;

  // const getConditionColor = (condition: string) => {
  //   switch (condition) {
  //     case 'New': return 'bg-green-100 text-green-800';
  //     case 'Like New': return 'bg-emerald-100 text-emerald-800';
  //     case 'Good': return 'bg-yellow-100 text-yellow-800';
  //     case 'Fair': return 'bg-orange-100 text-orange-800';
  //     default: return 'bg-gray-100 text-gray-800';
  //   }
  // };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between p-0">
          <div />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="h-6 w-8 p-0"
          >
            {/* <X className="h-4 w-4" /> */}
          </Button>
        </DialogHeader>

        <div className="grid md:grid-cols-1 gap-6">
          {/* Images */}
          {/* <div className="space-y-4">
            <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
              <ImageWithFallback
                src={plant.images[currentImageIndex]}
                alt={plant.name}
                className="w-full h-full object-cover"
              />
            </div>
            
            {plant.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {plant.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 ${
                      index === currentImageIndex 
                        ? 'border-green-500' 
                        : 'border-gray-200'
                    }`}
                  >
                    <ImageWithFallback
                      src={image}
                      alt={`${plant.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div> */}

          {/* Details */}
          <div className="space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <Image className="w-full m-auto h-64" />
              <div className="flex items-center justify-between border border-black rounded-md">
                  <label htmlFor="file_input" className="inline w-full text-sm font-medium text-black bg-green-600 rounded-md p-2 text-center">Upload Image(s)</label>
                  <input
                    type="file"
                    id="file_input"
                    className="hidden"
                    placeholder=""
                  />
              </div>
              
              {/* <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-green-600">
                  ${plant.price}
                </span>
                <Badge className={getConditionColor(plant.condition)} variant="secondary">
                  {plant.condition}
                </Badge>
                <Badge variant="outline">{plant.category}</Badge>
              </div>

              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{plant.location}</span>
              </div> */}
            </div>

            {/* <Separator /> */}
            <div className="flex items-center justify-between border border-black rounded-md">
              <input
                type="text"
                className="inline-block p-2"
                placeholder="Plant Name"
              />
            </div>
            <div className="flex items-center justify-between border border-black rounded-md">
              <input
                type="number"
                className="inline-block p-2 w-full"
                placeholder="Price"
              />
            </div>
            <div className="flex items-center justify-between border border-black rounded-md">
              <input
                type="text"
                className="inline-block p-2"
                placeholder="Location"
              />
            </div>
            <div className="flex items-center justify-between border border-black rounded-md">
              <select
                className="inline-block p-2 w-full"
              >
                <option value="">Select Category</option>
                <option value="houseplants">Houseplants</option>
                <option value="flowers">Flowers</option>
                <option value="herbs">Herbs</option>
                <option value="succulents">Succulents</option>
                <option value="trees">Trees</option>
                <option value="seeds">Seeds</option>
                <option value="tools">Tools & Supplies</option>
              </select>
            </div>
            <div className="flex items-center justify-between border border-black rounded-md">
              <input
                type="text"
                className="inline-block p-2"
                placeholder="Condition"
              />
            </div>
            <div className="flex items-center justify-between border border-black rounded-md">
              <input
                type="text"
                className="inline-block p-2"
                placeholder="Description"
              />
            </div>
            <div className="flex items-center justify-between border border-black rounded-md">
              <input
                type="text"
                className="inline-block p-2"
                placeholder="Care Instructions"
              />
            </div>
            <div className="flex items-center justify-between border border-black rounded-md">
              <input
                type="text"
                className="inline-block p-2"
                placeholder="Pot Size"
              />
            </div>
            <div className="flex items-center justify-between border border-black rounded-md">
              <input
                type="text"
                className="inline-block p-2"
                placeholder="Height"
              />
            </div>
            <div className="flex items-center justify-between border border-black rounded-md">
              <button className="inline w-full text-sm font-medium text-black bg-green-600 rounded-md p-2 text-center">
                <span>Add Plant</span>
              </button>
            </div>
            {/* Seller Info */}
            {/* <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={plant.sellerAvatar} />
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{plant.seller}</p>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm text-muted-foreground">
                      {plant.sellerRating} rating
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600">Verified Seller</span>
              </div>
            </div> */}

            {/* <Separator /> */}

            {/* Plant Details */}
            {/* <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Pot Size:</span>
                  <p className="font-medium">{plant.potSize}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Height:</span>
                  <p className="font-medium">{plant.height}</p>
                </div>
              </div>

              <div>
                <span className="text-muted-foreground">Description:</span>
                <p className="mt-1">{plant.description}</p>
              </div>

              <div>
                <span className="text-muted-foreground">Care Instructions:</span>
                <p className="mt-1">{plant.careInstructions}</p>
              </div>
            </div> */}

            {/* <Separator /> */}

            {/* Actions */}
            {/* <div className="space-y-3">
              <Button className="w-full bg-green-600 hover:bg-green-700">
                Contact Seller
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Message
                </Button>
                <Button variant="outline">
                  Make Offer
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Posted {plant.postedDate}
            </p> */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}