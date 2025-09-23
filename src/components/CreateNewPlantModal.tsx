import { useMemo, useState } from 'react';
import { Image } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader } from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { API_ENDPOINTS } from '../config/amplify';
import type { DeliveryMethod, LivePlantWarranty } from '../interfaces/Plant';
import {
  DELIVERY_METHOD_OPTIONS,
  extractStateCode,
  getDeliveryCombinationError,
  getProhibitedStateMessage,
  parseZipRanges,
  requiresZipRanges,
} from '../constants/fulfillmentRules';

interface CreateNewPlantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateNewPlantModal({ isOpen, onClose }: CreateNewPlantModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [plantName, setPlantName] = useState('');
  const [price, setPrice] = useState(0);
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [species, setSpecies] = useState('');
  const [cultivar, setCultivar] = useState('');
  const [usdaZone, setUsdaZone] = useState('');
  const [lightPreference, setLightPreference] = useState('');
  const [soilPreference, setSoilPreference] = useState('');
  const [condition, setCondition] = useState('');
  const [description, setDescription] = useState('');
  const [careInstructions, setCareInstructions] = useState('');
  const [potSize, setPotSize] = useState('');
  const [height, setHeight] = useState('');
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>([]);
  const [zipRangeInput, setZipRangeInput] = useState('');
  const [zipRangeError, setZipRangeError] = useState<string | null>(null);
  const [packagingNotes, setPackagingNotes] = useState('');
  const [warrantyOffered, setWarrantyOffered] = useState(false);
  const [warrantyDuration, setWarrantyDuration] = useState('');
  const [warrantyNotes, setWarrantyNotes] = useState('');
  const [deliveryValidationAttempted, setDeliveryValidationAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const maxFileSize = 50 * 1024 * 1024; // 50MB
  
  const { isAuthenticated, role } = useAuth();
  const isSeller = role === "seller";
  const navigate = useNavigate();
  const deliveryMethodOrder = useMemo(
    () => DELIVERY_METHOD_OPTIONS.map((option) => option.value),
    [],
  );
  const inlineCombinationError = useMemo(() => {
    if (deliveryMethods.length === 0) {
      return null;
    }
    return getDeliveryCombinationError(deliveryMethods);
  }, [deliveryMethods]);
  const shippingSelected = useMemo(
    () => requiresZipRanges(deliveryMethods),
    [deliveryMethods],
  );
  const locationStateCode = useMemo(
    () => extractStateCode(location),
    [location],
  );
  const prohibitedStateMessage = useMemo(
    () => getProhibitedStateMessage(locationStateCode, deliveryMethods),
    [locationStateCode, deliveryMethods],
  );

  // Redirect to login if not authenticated
  if (!isAuthenticated && isOpen) {
    onClose();
    navigate('/login', { state: { from: { pathname: '/', action: 'add-listing' } } });
    return null;
  }

  if (isOpen && isAuthenticated && !isSeller) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <div className="space-y-4 py-4">
            <h2 className="text-lg font-semibold text-green-700">Seller access required</h2>
            <p className="text-sm text-gray-600">
              Only seller accounts can create new plant listings. Update your account settings to become a seller and start
              listing your plants for sale.
            </p>
            <div className="flex justify-end">
              <Button onClick={onClose} className="bg-green-600 hover:bg-green-700 text-white">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const toggleDeliveryMethod = (method: DeliveryMethod, checked: boolean) => {
    setDeliveryMethods((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(method);
      } else {
        next.delete(method);
      }
      return deliveryMethodOrder.filter((value) => next.has(value));
    });
  };

  const handleZipRangeBlur = () => {
    if (!zipRangeInput) {
      setZipRangeError(null);
      return;
    }

    const { invalidEntries } = parseZipRanges(zipRangeInput);
    if (invalidEntries.length > 0) {
      setZipRangeError(`Invalid ZIP entries: ${invalidEntries.join(', ')}`);
    } else {
      setZipRangeError(null);
    }
  };

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
    if (!isSeller) {
      setError('Only seller accounts can create listings');
      return;
    }

    setDeliveryValidationAttempted(true);

    if (!plantName || !price || !location || !category || !condition) {
      setError('Please fill in all required fields');
      return;
    }

    const trimmedSpecies = species.trim();
    const trimmedCultivar = cultivar.trim();
    const trimmedUsdaZoneInput = usdaZone.trim();
    const normalizedUsdaZone = trimmedUsdaZoneInput.toUpperCase();
    const trimmedLightPreference = lightPreference.trim();
    const trimmedSoilPreference = soilPreference.trim();
    const zonePattern = /^(?:[1-9]|1[0-3])[A-D]?$/i;

    if (!trimmedSpecies) {
      setError('Please enter the plant species.');
      return;
    }

    if (!normalizedUsdaZone) {
      setError('Please enter the USDA hardiness zone.');
      return;
    }

    if (!zonePattern.test(normalizedUsdaZone)) {
      setError('Enter a valid USDA hardiness zone (1-13 with optional letter A-D).');
      return;
    }

    if (!trimmedLightPreference) {
      setError('Please describe the preferred light conditions.');
      return;
    }

    if (!trimmedSoilPreference) {
      setError('Please describe the preferred soil conditions.');
      return;
    }

    if (files.length === 0) {
      setError('Please upload at least one image');
      return;
    }

    const combinationValidationError = getDeliveryCombinationError(deliveryMethods);
    if (combinationValidationError) {
      setError(combinationValidationError);
      return;
    }

    const { ranges, invalidEntries } = parseZipRanges(zipRangeInput);

    if (invalidEntries.length > 0) {
      setZipRangeError(`Invalid ZIP entries: ${invalidEntries.join(', ')}`);
      setError('Please correct the ZIP ranges before submitting.');
      return;
    }

    setZipRangeError(null);

    if (shippingSelected && ranges.length === 0) {
      setError('Add at least one ZIP code or range when shipping is enabled.');
      return;
    }

    if (prohibitedStateMessage) {
      setError(prohibitedStateMessage);
      return;
    }

    let warrantyDurationValue: number | undefined;
    if (warrantyOffered) {
      warrantyDurationValue = Number(warrantyDuration);
      if (!Number.isFinite(warrantyDurationValue) || warrantyDurationValue <= 0) {
        setError('Enter a valid warranty duration in days.');
        return;
      }
    }

    const normalizedWarranty: LivePlantWarranty = warrantyOffered
      ? {
          isOffered: true,
          durationDays: warrantyDurationValue,
          notes: warrantyNotes.trim() || undefined,
        }
      : {
          isOffered: false,
          notes: warrantyNotes.trim() || undefined,
        };

    const normalizedPackagingNotes = packagingNotes.trim();

    setIsSubmitting(true);
    setError('');

    try {
      const base64files = await Promise.all(
        files.map(async (file) => {
          const base64 = await fileToBase64(file);
          return {
            fileName: file.name,
            fileContentType: file.type || "application/octet-stream",
            fileBase64: base64,
          };
        }),
      );
      const plantData = {
        name: plantName,
        price,
        location,
        category,
        species: trimmedSpecies,
        cultivar: trimmedCultivar || undefined,
        usdaZone: normalizedUsdaZone,
        lightPreference: trimmedLightPreference,
        soilPreference: trimmedSoilPreference,
        condition,
        description,
        careInstructions,
        potSize,
        height,
        deliveryMethods,
        availableZipRanges: ranges,
        packagingNotes: normalizedPackagingNotes || undefined,
        livePlantWarranty: normalizedWarranty,
      };
      const bodyJSON = {
        plant: plantData,
        files: base64files,
        role: role ?? undefined,
      };

      // Use authenticated fetch for creating listings
      const token = await authService.getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const res = await authService.authenticatedFetch(
        API_ENDPOINTS.PLANTS_WRITE,
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
      setSpecies('');
      setCultivar('');
      setUsdaZone('');
      setLightPreference('');
      setSoilPreference('');
      setCondition('');
      setDescription('');
      setCareInstructions('');
      setPotSize('');
      setHeight('');
      setDeliveryMethods([]);
      setZipRangeInput('');
      setZipRangeError(null);
      setPackagingNotes('');
      setWarrantyOffered(false);
      setWarrantyDuration('');
      setWarrantyNotes('');
      setDeliveryValidationAttempted(false);

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
                placeholder="Species (e.g., Monstera deliciosa)"
                onChange={(e) => setSpecies(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Cultivar (optional)"
                onChange={(e) => setCultivar(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="USDA Hardiness Zone (e.g., 9B)"
                onChange={(e) => setUsdaZone(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Light Preference (e.g., Bright indirect light)"
                onChange={(e) => setLightPreference(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Soil Preference (e.g., Well-draining mix)"
                onChange={(e) => setSoilPreference(e.target.value)}
              />
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
            <div className="flex w-full items-center justify-between rounded-md">
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
            <div className="space-y-4 rounded-md border border-gray-200 bg-white/70 p-4">
              <div>
                <h3 className="text-base font-semibold text-green-700">Delivery &amp; Fulfillment</h3>
                <p className="text-sm text-gray-600">
                  Choose the methods that were approved with fulfillment and add the supporting coverage
                  details.
                </p>
              </div>
              <div className="space-y-3">
                {DELIVERY_METHOD_OPTIONS.map((option) => {
                  const checkboxId = `delivery-${option.value.toLowerCase()}`;
                  return (
                    <label
                      key={option.value}
                      htmlFor={checkboxId}
                      className="flex items-start gap-3 rounded-md border border-gray-200/70 bg-white/60 p-3 shadow-sm"
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={deliveryMethods.includes(option.value)}
                        onCheckedChange={(checked) =>
                          toggleDeliveryMethod(option.value, checked === true)
                        }
                      />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-900">{option.label}</p>
                        <p className="text-xs text-gray-600">{option.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              {inlineCombinationError && (deliveryValidationAttempted || deliveryMethods.length > 0) && (
                <p className="text-sm text-red-600">{inlineCombinationError}</p>
              )}
              {(shippingSelected || zipRangeInput) && (
                <div className="space-y-2">
                  <Label htmlFor="zipRangeInput">Available ZIP ranges</Label>
                  <textarea
                    id="zipRangeInput"
                    value={zipRangeInput}
                    onChange={(e) => setZipRangeInput(e.target.value)}
                    onBlur={handleZipRangeBlur}
                    rows={shippingSelected ? 3 : 2}
                    className="w-full rounded-md border border-gray-300 p-2 text-sm"
                    placeholder="94107 or 75000-75200"
                  />
                  <p className="text-xs text-gray-500">
                    {shippingSelected
                      ? 'Enter one ZIP or ZIP range per line (##### or #####-#####).'
                      : 'ZIP ranges are optional unless shipping is enabled.'}
                  </p>
                  {zipRangeError && <p className="text-xs text-red-600">{zipRangeError}</p>}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="packagingNotes">Packaging notes</Label>
                <textarea
                  id="packagingNotes"
                  value={packagingNotes}
                  onChange={(e) => setPackagingNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 p-2 text-sm"
                  placeholder="Share insulation materials, heat packs, or handling steps."
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="warrantySwitch">Offer live-plant warranty</Label>
                  <Switch
                    id="warrantySwitch"
                    checked={warrantyOffered}
                    onCheckedChange={(checked) => {
                      setWarrantyOffered(checked);
                      if (!checked) {
                        setWarrantyDuration('');
                      }
                    }}
                  />
                </div>
                {warrantyOffered && (
                  <div className="space-y-1">
                    <Label htmlFor="warrantyDuration">Warranty duration (days)</Label>
                    <input
                      id="warrantyDuration"
                      type="number"
                      min={1}
                      value={warrantyDuration}
                      onChange={(e) => setWarrantyDuration(e.target.value)}
                      className="w-full rounded-md border border-gray-300 p-2 text-sm"
                      placeholder="30"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="warrantyNotes">
                    {warrantyOffered ? 'Warranty details' : 'Warranty notes (optional)'}
                  </Label>
                  <textarea
                    id="warrantyNotes"
                    value={warrantyNotes}
                    onChange={(e) => setWarrantyNotes(e.target.value)}
                    rows={warrantyOffered ? 3 : 2}
                    className="w-full rounded-md border border-gray-300 p-2 text-sm"
                    placeholder={
                      warrantyOffered
                        ? 'Outline care requirements, what is covered, and claim steps.'
                        : 'Add optional disclaimers about live arrival guarantees.'
                    }
                  />
                </div>
              </div>
              {prohibitedStateMessage && (
                <Alert variant="destructive">
                  <AlertTitle>Shipping restriction</AlertTitle>
                  <AlertDescription>{prohibitedStateMessage}</AlertDescription>
                </Alert>
              )}
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