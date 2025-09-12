import { useState } from 'react';
import { Image } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader } from './ui/dialog';
import { Button } from './ui/button';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { getApiEndpoints } from '../config/amplify';

interface CreateNewPlantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type UploadPlan = { file: File; url: string; headers: Record<string,string> };

export function CreateNewPlantModal({ isOpen, onClose }: CreateNewPlantModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [plantName, setPlantName] = useState('');
  const [price, setPrice] = useState(0);
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [description, setDescription] = useState('');
  const [careInstructions, setCareInstructions] = useState('');
  const [potSize, setPotSize] = useState('');
  const [height, setHeight] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const maxFileSize = 50 * 1024 * 1024; // 50MB
  
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect to login if not authenticated
  if (!isAuthenticated && isOpen) {
    onClose();
    navigate('/login', { state: { from: { pathname: '/', action: 'add-listing' } } });
    return null;
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
          if (reader.result) {
          // reader.result will be a Data URL (e.g., "data:image/png;base64,iVBORw...")
                  // You might want to remove the "data:MIME_type;base64," prefix if only the base64 string is needed.
                  const base64String = reader.result.toString().split(',')[1];
                  resolve(base64String);
              } else {
                  reject(new Error("Failed to read file."));
              }
          };
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);
    // Filter files over 50MB
    const validFiles = selectedFiles.filter(file => file.size <= maxFileSize);
    setFiles(prevFiles => [...prevFiles, ...validFiles]);
  };

  const handleSubmit = async () => {
    // Validation
    if (!plantName || !price || !location || !category || !condition) {
      setError('Please fill in all required fields');
      return;
    }
    
    if (files.length === 0) {
      setError('Please upload at least one image');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
    const base64files = await Promise.all(files.map(async (file) => {
      const base64 = await fileToBase64(file);
      return {
        fileName: file.name,
        fileContentType: file.type || "application/octet-stream",
        fileBase64: base64
      };
    }));
    const plantData = {
        name: plantName,
        price,
        location,
        category,
        condition,
        description,
        careInstructions,
        potSize,
        height
    };
    const bodyJSON = {
      plant: plantData,
      files: base64files
    };

      // Use authenticated fetch for creating listings
      const token = await authService.getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const endpoints = await getApiEndpoints();
      const res = await authService.authenticatedFetch(
        endpoints.PLANTS_WRITE,
        {
          method: 'POST',
          body: JSON.stringify(bodyJSON),
          requiresAuth: true
        }
      );
      
      if (!res.ok) {
        throw new Error(`Failed to create listing: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('Plant created:', data);
      
      // Reset form and close modal
      setFiles([]);
      setPlantName('');
      setPrice(0);
      setLocation('');
      setCategory('');
      setCondition('');
      setDescription('');
      setCareInstructions('');
      setPotSize('');
      setHeight('');
      
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create listing');
      console.error('Error creating listing:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-screen md:h-[83vh] overflow-y-auto flex flex-col justify-start">
        <DialogHeader className="flex flex-row items-center justify-between p-0">
          <div />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="hidden h-6 w-8 p-0"
          >
            {/* <X className="h-4 w-4" /> */}
          </Button>
        </DialogHeader>

        <div className="grid md:grid-cols-1 gap-6 flex-1">
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
              <div className="flex items-center justify-between rounded-md">
                  <label htmlFor="file_input" className="inline w-full text-sm font-medium text-white bg-green-600 rounded-md p-2 text-center">Upload Image(s)</label>
                  <input
                    type="file"
                    id="file_input"
                    className="hidden"
                    placeholder=""
                    multiple
                    onChange={handleFileChange}
                  />
              </div>
              <div className="flex items-center justify-center">
                <span className="text-black">{files && files.length > 0 && files.length === 1 ? `${files.length} image uploaded` : `${files.length} images uploaded`}</span>
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
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Plant Name"
                onChange={(e) => setPlantName(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="number"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Price"
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Location"
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <select
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select Category</option>
                <option value="Houseplants">Houseplants</option>
                <option value="Flowers">Flowers</option>
                <option value="Herbs">Herbs</option>
                <option value="Succulents">Succulents</option>
                <option value="Trees">Trees</option>
                <option value="Seeds">Seeds</option>
                <option value="Tools & Supplies">Tools & Supplies</option>
              </select>
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Condition"
                onChange={(e) => setCondition(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Description"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex w-fullitems-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Care Instructions"
                onChange={(e) => setCareInstructions(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Pot Size"
                onChange={(e) => setPotSize(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Height"
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <button 
                className="inline w-full text-sm font-medium text-white bg-green-600 rounded-md p-2 text-center disabled:opacity-50" 
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                <span>{isSubmitting ? 'Creating...' : 'Add Plant'}</span>
              </button>
            </div>
            {error && (
              <div className="text-red-500 text-sm mt-2">{error}</div>
            )}
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