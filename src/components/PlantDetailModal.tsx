import { useState } from 'react';
import { X, Heart, MapPin, User, MessageCircle, Star, Shield, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { StarRating } from "./StarRating";
import { Arrow } from '@radix-ui/react-context-menu';

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

interface Review {
  id: string;
  rating: number;
  comment: string;
  reviewer: string;
  date: string;
}

interface PlantDetailModalProps {
  plant: Plant | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PlantDetailModal({ plant, isOpen, onClose }: PlantDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [isReviewScreenOpen, setIsReviewScreenOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewFormFields, setReviewFormFields] = useState<Review[]>([]);
  const [showBackAlert, setShowBackAlert] = useState(false);

  if (!plant) return null;

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'New': return 'bg-green-100 text-green-800';
      case 'Like New': return 'bg-emerald-100 text-emerald-800';
      case 'Good': return 'bg-yellow-100 text-yellow-800';
      case 'Fair': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleReviewBack = (reviewComment: string, reviewRating: number) => {
    if (reviewRating > 0 || reviewComment.trim() !== "") {
      setShowBackAlert(true);
    } else {
      setIsReviewScreenOpen(false);
      setReviewRating(0);
      setReviewComment("");
    }
  };

  const handleBackConfirm = () => {
    setShowBackAlert(false);
    setIsReviewScreenOpen(false);
    setReviewRating(0);
    setReviewComment("");
  };

  const handleBackCancel = () => {
    setShowBackAlert(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {!isReviewScreenOpen && (
        <DialogContent className={`max-w-4xl h-[${isMobileView ? `100vh` : `83vh`}] overflow-y-auto`}>
          <div className="space-y-12">
            <DialogHeader className="flex flex-row items-center justify-between p-0">
              <div />
              <Button 
                variant="white" 
                size="sm" 
                onClick={onClose}
                className="h-6 w-8 p-0 hidden"
              >
                {/* <X className="h-4 w-4" /> */}
              </Button>
            </DialogHeader>

            <div className="grid md:grid-cols-1 gap-6 -mt-12">
              {/* Images */}
              <div className="space-y-4">
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
              </div>

              {/* Details */}
              <div className="space-y-6">
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h1 className="text-2xl font-semibold">{plant.name}</h1>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsLiked(!isLiked)}
                      className="p-2"
                    >
                      <Heart 
                        className={`h-5 w-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} 
                      />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
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
                  </div>
                </div>

                <Separator />

                {/* Seller Info */}
                <div className="flex items-center justify-between">
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
                </div>

                <Separator />

                {/* Plant Details */}
                <div className="space-y-4">
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
                </div>

                <Separator />

                {/* Actions */}
                <div className="space-y-3">
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    Contact Seller
                  </Button>
                  <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => setIsReviewScreenOpen(true)}>
                    Add Review
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
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      )}
      {isReviewScreenOpen && (
        <DialogContent className={`max-w-4xl h-[${isMobileView ? `100vh` : `83vh`}] overflow-y-auto`}>
          <div className="space-y-12">
            <DialogHeader className="flex flex-row items-center justify-between p-0">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() =>handleReviewBack(reviewComment, reviewRating)}
                className="h-6 w-8 p-0 -mt-6 -ml-4"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClose}
                className="h-6 w-8 p-0 hidden"
              >
                {/* <X className="h-4 w-4" /> */}
              </Button>
            </DialogHeader>
            {/* Custom Alert Modal */}
            {showBackAlert && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 border border-black rounded-md">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
                  <div className="mb-4 text-center">
                    <p className="text-lg font-semibold mb-2">
                      Are you sure you want to go back?
                    </p>
                    <p className="text-sm text-gray-600">
                      Some changes may be unsaved.
                    </p>
                  </div>
                  <div className="flex justify-center gap-3">
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={handleBackConfirm}
                    >
                      Yes
                    </Button>
                    <Button
                      variant="outline"
                      className="border-green-600 text-green-600 hover:bg-green-50"
                      onClick={handleBackCancel}
                    >
                      No
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {/* Details */}
              <div className="space-y-6">
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h1 className="text-2xl font-semibold">Your Rating</h1>
                    <StarRating value={reviewRating} onChange={setReviewRating} />
                  </div>
                  
                  <div className="flex items-center justify-between border border-black rounded-md">
                    <textarea id="message" rows={32} onChange={(e) => setReviewComment(e.target.value)} className="block p-2 w-full text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" placeholder="Write your review here"></textarea>
                  </div>
                  <div className="flex items-start justify-between">
                    <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => setIsReviewScreenOpen(true)}>
                      Submit
                    </Button>
                  </div>
                  {/* <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{plant.location}</span>
                  </div> */}
                </div>

                {/* <Separator /> */}

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
                </div>

                <Separator /> */}

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
                </div>

                <Separator /> */}

                {/* Actions */}
                {/* <div className="space-y-3">
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    Contact Seller
                  </Button>
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    Add Review
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
                </div> */}

                {/* <p className="text-xs text-muted-foreground">
                  Posted {plant.postedDate}
                </p> */}
              </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}