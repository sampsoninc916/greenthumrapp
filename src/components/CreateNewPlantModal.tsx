import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Image as ImageIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
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

type FieldName =
  | 'images'
  | 'plantName'
  | 'price'
  | 'location'
  | 'category'
  | 'species'
  | 'usdaZone'
  | 'lightPreference'
  | 'soilPreference'
  | 'condition'
  | 'deliveryMethods'
  | 'zipRange'
  | 'warrantyDuration';

type FieldErrorState = Partial<Record<FieldName, string>>;

interface PlantImageFile {
  id: string;
  file: File;
  previewUrl: string;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_FILE_SIZE_MB = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
] as const;
const ALLOWED_IMAGE_TYPE_SET = new Set<string>(ALLOWED_IMAGE_TYPES.map((type) => type.toLowerCase()));
const IMAGE_TYPES_LABEL = 'JPG, PNG, GIF, WebP, or HEIC';
const MAX_IMAGE_COUNT = 10;
const MIN_IMAGE_WIDTH = 600;
const MIN_IMAGE_HEIGHT = 600;
const MIN_IMAGE_DIMENSION_LABEL = `${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT}px`;

interface UploadScanResult {
  fileName: string;
  allowed: boolean;
  reason?: string;
}

const loadImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to read image dimensions.'));
    };
    image.src = objectUrl;
  });
};

const logImageValidationFailure = (file: File, reason: string) => {
  console.warn('[ImageUploadValidation] Rejected file', {
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    reason,
  });
};

const STEPS = [
  {
    key: 'photos',
    title: 'Photos',
    description: 'Show the plant clearly and highlight unique details.',
  },
  {
    key: 'details',
    title: 'Plant details',
    description: 'Share the basics, growing habits, and care information.',
  },
  {
    key: 'fulfillment',
    title: 'Fulfillment',
    description: 'Choose how buyers receive the plant and set expectations.',
  },
] as const;

interface CreateNewPlantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1];
        if (base64) {
          resolve(base64);
          return;
        }
      }
      reject(new Error('Failed to read file.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
};

const createImageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export function CreateNewPlantModal({ isOpen, onClose }: CreateNewPlantModalProps) {
  const [images, setImages] = useState<PlantImageFile[]>([]);
  const [plantName, setPlantName] = useState('');
  const [price, setPrice] = useState('');
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
  const [packagingNotes, setPackagingNotes] = useState('');
  const [warrantyOffered, setWarrantyOffered] = useState(false);
  const [warrantyDuration, setWarrantyDuration] = useState('');
  const [warrantyNotes, setWarrantyNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrorState>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { isAuthenticated, role } = useAuth();
  const isSeller = role === 'seller';
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

  const clearFieldError = useCallback((field: FieldName) => {
    setFieldErrors((prev) => {
      if (!(field in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const setFieldError = useCallback((field: FieldName, message: string) => {
    setFieldErrors((prev) => {
      if (prev[field] === message) {
        return prev;
      }
      return { ...prev, [field]: message };
    });
  }, []);

  const resetForm = useCallback(() => {
    setImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setPlantName('');
    setPrice('');
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
    setPackagingNotes('');
    setWarrantyOffered(false);
    setWarrantyDuration('');
    setWarrantyNotes('');
    setFieldErrors({});
    setSubmissionError(null);
    setIsSubmitting(false);
    setCurrentStep(0);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  useEffect(() => {
    if (!shippingSelected) {
      clearFieldError('zipRange');
    }
  }, [shippingSelected, clearFieldError]);

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
    clearFieldError('deliveryMethods');
  };

  const performUploadSecurityScan = useCallback(async (files: File[]): Promise<UploadScanResult[]> => {
    if (files.length === 0) {
      return [];
    }

    if (!API_ENDPOINTS.UPLOAD_SCAN) {
      console.info('Upload scan endpoint is not configured; skipping server-side validation.');
      return files.map((file) => ({ fileName: file.name, allowed: true }));
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file, file.name);
    });

    const response = await authService.authenticatedFetch(API_ENDPOINTS.UPLOAD_SCAN, {
      method: 'POST',
      body: formData,
      requiresAuth: true,
    });

    if (!response.ok) {
      throw new Error(`Upload scan failed with status ${response.status}`);
    }

    try {
      const payload = await response.json();
      const rawResults: unknown = Array.isArray(payload?.results) ? payload.results : payload;

      if (!Array.isArray(rawResults)) {
        console.warn('Unexpected upload scan response structure. Treating files as allowed.');
        return files.map((file) => ({ fileName: file.name, allowed: true }));
      }

      return rawResults.map((item, index) => {
        const file = files[index];
        if (item && typeof item === 'object' && 'allowed' in item) {
          const normalizedReason =
            typeof (item as Record<string, unknown>).reason === 'string'
              ? ((item as Record<string, unknown>).reason as string).trim()
              : undefined;
          return {
            fileName:
              typeof (item as Record<string, unknown>).fileName === 'string'
                ? ((item as Record<string, unknown>).fileName as string)
                : file.name,
            allowed: Boolean((item as Record<string, unknown>).allowed),
            reason: normalizedReason && normalizedReason.length > 0 ? normalizedReason : undefined,
          } satisfies UploadScanResult;
        }

        return {
          fileName: file.name,
          allowed: true,
        } satisfies UploadScanResult;
      });
    } catch (error) {
      console.warn('Unable to parse upload scan response. Treating files as allowed.', error);
      return files.map((file) => ({ fileName: file.name, allowed: true }));
    }
  }, []);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const selectedFiles = Array.from(input.files ?? []);
    if (selectedFiles.length === 0) {
      return;
    }

    const issues: string[] = [];
    const candidateFiles: File[] = [];

    for (const file of selectedFiles) {
      if (images.length + candidateFiles.length >= MAX_IMAGE_COUNT) {
        const message = `Cannot add "${file.name}" because you can upload up to ${MAX_IMAGE_COUNT} images per listing. Remove an existing photo to upload another.`;
        issues.push(message);
        logImageValidationFailure(file, message);
        continue;
      }

      const normalizedType = (file.type || '').toLowerCase();
      if (!normalizedType || !ALLOWED_IMAGE_TYPE_SET.has(normalizedType)) {
        const message = `"${file.name}" must be an ${IMAGE_TYPES_LABEL} file.`;
        issues.push(message);
        logImageValidationFailure(file, message);
        continue;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        const message = `"${file.name}" is larger than ${MAX_FILE_SIZE_MB}MB.`;
        issues.push(message);
        logImageValidationFailure(file, message);
        continue;
      }

      try {
        const { width, height } = await loadImageDimensions(file);
        if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
          const message = `"${file.name}" must be at least ${MIN_IMAGE_DIMENSION_LABEL}.`;
          issues.push(message);
          logImageValidationFailure(file, `${message} (actual: ${width}x${height})`);
          continue;
        }
      } catch (error) {
        const message = `Could not verify image dimensions for "${file.name}".`;
        issues.push(message);
        logImageValidationFailure(file, `${message} ${(error as Error).message ?? ''}`.trim());
        continue;
      }

      candidateFiles.push(file);
    }

    let scanResults: UploadScanResult[] = [];
    if (candidateFiles.length > 0) {
      try {
        scanResults = await performUploadSecurityScan(candidateFiles);
      } catch (error) {
        const message = 'Unable to complete security checks for your images. Please try again.';
        setFieldError('images', message);
        toast.error(message);
        console.error('Upload security scan failed', error);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
    }

    const approvedImages: PlantImageFile[] = [];
    candidateFiles.forEach((file, index) => {
      const result = scanResults[index];
      if (result && !result.allowed) {
        const reasonSuffix = result.reason ? ` ${result.reason}` : '';
        const message = `"${result.fileName || file.name}" was blocked by security scanning.${reasonSuffix}`;
        issues.push(message);
        logImageValidationFailure(file, `Server-side scan rejection${reasonSuffix ? `: ${reasonSuffix.trim()}` : ''}`);
        return;
      }

      approvedImages.push({
        id: createImageId(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });

    if (approvedImages.length > 0) {
      setImages((prev) => [...prev, ...approvedImages]);
      clearFieldError('images');
    }

    if (issues.length > 0) {
      const message = issues.join(' ');
      setFieldError('images', message);
      const firstIssue = issues[0];
      toast.error(
        issues.length > 1
          ? `${firstIssue} Additional files were rejected. Please review the requirements.`
          : firstIssue,
      );
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    } else {
      input.value = '';
    }
  };

  const removeImage = (id: string) => {
    setImages((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return current.filter((image) => image.id !== id);
    });
  };

  const moveImage = (id: string, direction: 'left' | 'right') => {
    setImages((current) => {
      const index = current.findIndex((image) => image.id === id);
      if (index === -1) {
        return current;
      }
      const newIndex = direction === 'left' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= current.length) {
        return current;
      }
      const updated = [...current];
      const [item] = updated.splice(index, 1);
      updated.splice(newIndex, 0, item);
      return updated;
    });
  };

  const validateField = useCallback(
    (field: FieldName): boolean => {
      const zonePattern = /^(?:[1-9]|1[0-3])[A-D]?$/i;

      switch (field) {
        case 'images': {
          if (images.length === 0) {
            setFieldError('images', 'Add at least one photo to your listing.');
            return false;
          }
          break;
        }
        case 'plantName': {
          if (!plantName.trim()) {
            setFieldError('plantName', 'Enter a plant name.');
            return false;
          }
          break;
        }
        case 'price': {
          if (!price.trim()) {
            setFieldError('price', 'Set a price for the plant.');
            return false;
          }
          const numericPrice = Number(price);
          if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
            setFieldError('price', 'Enter a valid price greater than zero.');
            return false;
          }
          break;
        }
        case 'location': {
          if (!location.trim()) {
            setFieldError('location', 'Provide the city and state for the listing.');
            return false;
          }
          break;
        }
        case 'category': {
          if (!category.trim()) {
            setFieldError('category', 'Choose a category for the plant.');
            return false;
          }
          break;
        }
        case 'species': {
          if (!species.trim()) {
            setFieldError('species', 'Add the plant species.');
            return false;
          }
          break;
        }
        case 'usdaZone': {
          const normalized = usdaZone.trim().toUpperCase();
          if (!normalized) {
            setFieldError('usdaZone', 'Enter the USDA hardiness zone.');
            return false;
          }
          if (!zonePattern.test(normalized)) {
            setFieldError('usdaZone', 'Use zones 1-13 with an optional A-D suffix (e.g., 6B).');
            return false;
          }
          break;
        }
        case 'lightPreference': {
          if (!lightPreference.trim()) {
            setFieldError('lightPreference', 'Describe the preferred light conditions.');
            return false;
          }
          break;
        }
        case 'soilPreference': {
          if (!soilPreference.trim()) {
            setFieldError('soilPreference', 'Describe the preferred soil.');
            return false;
          }
          break;
        }
        case 'condition': {
          if (!condition.trim()) {
            setFieldError('condition', 'Share the plant’s current condition.');
            return false;
          }
          break;
        }
        case 'deliveryMethods': {
          if (deliveryMethods.length === 0) {
            setFieldError('deliveryMethods', 'Select at least one fulfillment option.');
            return false;
          }
          if (inlineCombinationError) {
            setFieldError('deliveryMethods', inlineCombinationError);
            return false;
          }
          break;
        }
        case 'zipRange': {
          if (!shippingSelected) {
            clearFieldError('zipRange');
            return true;
          }
          if (!zipRangeInput.trim()) {
            setFieldError('zipRange', 'Add ZIP codes or ranges for shipping coverage.');
            return false;
          }
          const { invalidEntries } = parseZipRanges(zipRangeInput);
          if (invalidEntries.length > 0) {
            setFieldError('zipRange', `Invalid ZIP entries: ${invalidEntries.join(', ')}`);
            return false;
          }
          break;
        }
        case 'warrantyDuration': {
          if (!warrantyOffered) {
            clearFieldError('warrantyDuration');
            return true;
          }
          if (!warrantyDuration.trim()) {
            setFieldError('warrantyDuration', 'Enter the number of days your warranty lasts.');
            return false;
          }
          const parsedDuration = Number(warrantyDuration);
          if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
            setFieldError('warrantyDuration', 'Warranty duration must be a positive number of days.');
            return false;
          }
          break;
        }
        default:
          break;
      }

      clearFieldError(field);
      return true;
    },
    [
      images,
      plantName,
      price,
      location,
      category,
      species,
      usdaZone,
      lightPreference,
      soilPreference,
      condition,
      deliveryMethods,
      inlineCombinationError,
      shippingSelected,
      zipRangeInput,
      warrantyOffered,
      warrantyDuration,
      clearFieldError,
      setFieldError,
    ],
  );

  const stepFieldMap: Record<number, FieldName[]> = {
    0: ['images'],
    1: [
      'plantName',
      'price',
      'location',
      'category',
      'species',
      'usdaZone',
      'lightPreference',
      'soilPreference',
      'condition',
    ],
    2: ['deliveryMethods', 'zipRange', 'warrantyDuration'],
  };

  const validateStep = (stepIndex: number) => {
    const fields = stepFieldMap[stepIndex] ?? [];
    let isValid = true;
    fields.forEach((field) => {
      const fieldValid = validateField(field);
      if (!fieldValid) {
        isValid = false;
      }
    });
    return isValid;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handlePreviousStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleZipRangeBlur = () => {
    validateField('zipRange');
  };

  const handleWarrantyToggle = (checked: boolean) => {
    setWarrantyOffered(checked);
    if (!checked) {
      setWarrantyDuration('');
      clearFieldError('warrantyDuration');
    }
  };

  const handleSubmit = async () => {
    const stepsToValidate = [0, 1, 2];
    for (const stepIndex of stepsToValidate) {
      if (!validateStep(stepIndex)) {
        setCurrentStep(stepIndex);
        return;
      }
    }

    const trimmedSpecies = species.trim();
    const trimmedCultivar = cultivar.trim();
    const normalizedUsdaZone = usdaZone.trim().toUpperCase();
    const trimmedLightPreference = lightPreference.trim();
    const trimmedSoilPreference = soilPreference.trim();
    const trimmedCondition = condition.trim();
    const trimmedDescription = description.trim();
    const trimmedCareInstructions = careInstructions.trim();
    const normalizedPackagingNotes = packagingNotes.trim();
    const normalizedPrice = Number(price);
    const { ranges } = parseZipRanges(zipRangeInput);

    let warrantyDurationValue: number | undefined;
    if (warrantyOffered) {
      warrantyDurationValue = Number(warrantyDuration);
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

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const base64files = await Promise.all(
        images.map(async (image) => {
          const fileBase64 = await fileToBase64(image.file);
          return {
            fileName: image.file.name,
            fileContentType: image.file.type || 'application/octet-stream',
            fileBase64,
          };
        }),
      );

      const plantData = {
        name: plantName.trim(),
        price: normalizedPrice,
        location: location.trim(),
        category: category.trim(),
        species: trimmedSpecies,
        cultivar: trimmedCultivar || undefined,
        usdaZone: normalizedUsdaZone,
        lightPreference: trimmedLightPreference,
        soilPreference: trimmedSoilPreference,
        condition: trimmedCondition,
        description: trimmedDescription,
        careInstructions: trimmedCareInstructions,
        potSize: potSize.trim(),
        height: height.trim(),
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

      const token = await authService.getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const res = await authService.authenticatedFetch(API_ENDPOINTS.PLANTS_WRITE, {
        method: 'POST',
        body: JSON.stringify(bodyJSON),
        requiresAuth: true,
      });

      if (!res.ok) {
        let message = `Failed to create listing: ${res.status}`;
        try {
          const errorBody = await res.json();
          if (errorBody && typeof errorBody.message === 'string') {
            message = errorBody.message;
          }
        } catch (error) {
          console.warn('Unable to parse error response', error);
        }
        throw new Error(message);
      }

      const data = await res.json();
      console.log('Plant created:', data);

      toast.success('Your plant listing is live!');
      resetForm();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create listing';
      setSubmissionError(message);
      toast.error(message);
      console.error('Error creating listing:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <section className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-green-700">Photos</h3>
                <p className="text-sm text-muted-foreground">
                  Upload at least one clear, well-lit image. Use the arrows to reorder the cover photo.
                </p>
              </div>
              <div className="rounded-md border border-dashed border-green-200 bg-green-50/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-12 items-center justify-center rounded-md bg-green-100 text-green-700">
                      <ImageIcon className="size-6" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Add plant photos</p>
                      <p className="text-xs text-muted-foreground">
                        {images.length === 0 ? 'No photos added yet.' : `${images.length} photo${images.length > 1 ? 's' : ''} ready to upload.`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ALLOWED_IMAGE_TYPES.join(',')}
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      Choose images
                    </Button>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Accepts {IMAGE_TYPES_LABEL} up to {MAX_FILE_SIZE_MB}MB each. Minimum resolution {MIN_IMAGE_DIMENSION_LABEL}. Up to
                  {' '}
                  {MAX_IMAGE_COUNT} photos per listing.
                </p>
                {fieldErrors.images && <p className="mt-2 text-xs text-destructive">{fieldErrors.images}</p>}
              </div>
            </section>

            {images.length > 0 && (
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Preview &amp; order</h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {images.map((image, index) => (
                    <div key={image.id} className="overflow-hidden rounded-md border bg-white shadow-sm">
                      <img
                        src={image.previewUrl}
                        alt={image.file.name}
                        className="h-48 w-full object-cover"
                      />
                      <div className="space-y-1 border-t px-3 py-2 text-xs">
                        <p className="font-medium text-gray-900">Photo {index + 1}</p>
                        <p className="truncate text-muted-foreground">{image.file.name}</p>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            onClick={() => moveImage(image.id, 'left')}
                            disabled={index === 0}
                            aria-label="Move photo earlier"
                          >
                            <ArrowLeft className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            onClick={() => moveImage(image.id, 'right')}
                            disabled={index === images.length - 1}
                            aria-label="Move photo later"
                          >
                            <ArrowRight className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8 text-red-600 hover:bg-red-50"
                            onClick={() => removeImage(image.id)}
                            aria-label="Remove photo"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        );
      case 1:
        return (
          <div className="space-y-8">
            <section className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-green-700">Listing basics</h3>
                <p className="text-sm text-muted-foreground">
                  Help buyers understand what you’re selling with clear, searchable details.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="plantName">Plant name*</Label>
                  <Input
                    id="plantName"
                    value={plantName}
                    onChange={(event) => {
                      setPlantName(event.target.value);
                      clearFieldError('plantName');
                    }}
                    onBlur={() => validateField('plantName')}
                    placeholder="Variegated Monstera"
                    aria-invalid={fieldErrors.plantName ? true : undefined}
                  />
                  <p className="text-xs text-muted-foreground">Use a descriptive name shoppers will recognize.</p>
                  {fieldErrors.plantName && <p className="text-xs text-destructive">{fieldErrors.plantName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price (USD)*</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(event) => {
                      setPrice(event.target.value);
                      clearFieldError('price');
                    }}
                    onBlur={() => validateField('price')}
                    placeholder="45.00"
                    aria-invalid={fieldErrors.price ? true : undefined}
                  />
                  <p className="text-xs text-muted-foreground">Set the total price buyers will pay.</p>
                  {fieldErrors.price && <p className="text-xs text-destructive">{fieldErrors.price}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location*</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(event) => {
                      setLocation(event.target.value);
                      clearFieldError('location');
                    }}
                    onBlur={() => validateField('location')}
                    placeholder="Portland, OR"
                    aria-invalid={fieldErrors.location ? true : undefined}
                  />
                  <p className="text-xs text-muted-foreground">Share where the plant is available for pickup or shipping.</p>
                  {fieldErrors.location && <p className="text-xs text-destructive">{fieldErrors.location}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category*</Label>
                  <Input
                    id="category"
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value);
                      clearFieldError('category');
                    }}
                    onBlur={() => validateField('category')}
                    placeholder="Houseplants"
                    aria-invalid={fieldErrors.category ? true : undefined}
                  />
                  <p className="text-xs text-muted-foreground">Group the plant so buyers can filter by interest.</p>
                  {fieldErrors.category && <p className="text-xs text-destructive">{fieldErrors.category}</p>}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-green-700">Plant identity</h3>
                <p className="text-sm text-muted-foreground">
                  Include botanical information so collectors know exactly what they’re getting.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="species">Species*</Label>
                  <Input
                    id="species"
                    value={species}
                    onChange={(event) => {
                      setSpecies(event.target.value);
                      clearFieldError('species');
                    }}
                    onBlur={() => validateField('species')}
                    placeholder="Monstera deliciosa"
                    aria-invalid={fieldErrors.species ? true : undefined}
                  />
                  <p className="text-xs text-muted-foreground">Use the botanical species name.</p>
                  {fieldErrors.species && <p className="text-xs text-destructive">{fieldErrors.species}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cultivar">Cultivar (optional)</Label>
                  <Input
                    id="cultivar"
                    value={cultivar}
                    onChange={(event) => setCultivar(event.target.value)}
                    placeholder="Albo Variegata"
                  />
                  <p className="text-xs text-muted-foreground">Add a cultivar or variety if applicable.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="usdaZone">USDA hardiness zone*</Label>
                  <Input
                    id="usdaZone"
                    value={usdaZone}
                    onChange={(event) => {
                      setUsdaZone(event.target.value.toUpperCase());
                      clearFieldError('usdaZone');
                    }}
                    onBlur={() => validateField('usdaZone')}
                    placeholder="6B"
                    aria-invalid={fieldErrors.usdaZone ? true : undefined}
                  />
                  <p className="text-xs text-muted-foreground">Format 1-13 with an optional letter (e.g., 9A, 5B).</p>
                  {fieldErrors.usdaZone && <p className="text-xs text-destructive">{fieldErrors.usdaZone}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="potSize">Pot size (optional)</Label>
                  <Input
                    id="potSize"
                    value={potSize}
                    onChange={(event) => setPotSize(event.target.value)}
                    placeholder='6" pot'
                  />
                  <p className="text-xs text-muted-foreground">Share pot diameter or container details.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Approximate height (optional)</Label>
                  <Input
                    id="height"
                    value={height}
                    onChange={(event) => setHeight(event.target.value)}
                    placeholder="18 inches"
                  />
                  <p className="text-xs text-muted-foreground">Give a sense of size or growth stage.</p>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-green-700">Care &amp; condition</h3>
                <p className="text-sm text-muted-foreground">
                  Buyers rely on care notes to keep the plant thriving once it arrives.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lightPreference">Light preference*</Label>
                  <Input
                    id="lightPreference"
                    value={lightPreference}
                    onChange={(event) => {
                      setLightPreference(event.target.value);
                      clearFieldError('lightPreference');
                    }}
                    onBlur={() => validateField('lightPreference')}
                    placeholder="Bright indirect light"
                    aria-invalid={fieldErrors.lightPreference ? true : undefined}
                  />
                  <p className="text-xs text-muted-foreground">Explain the lighting that keeps the plant happiest.</p>
                  {fieldErrors.lightPreference && <p className="text-xs text-destructive">{fieldErrors.lightPreference}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="soilPreference">Soil preference*</Label>
                  <Input
                    id="soilPreference"
                    value={soilPreference}
                    onChange={(event) => {
                      setSoilPreference(event.target.value);
                      clearFieldError('soilPreference');
                    }}
                    onBlur={() => validateField('soilPreference')}
                    placeholder="Well-draining aroid mix"
                    aria-invalid={fieldErrors.soilPreference ? true : undefined}
                  />
                  <p className="text-xs text-muted-foreground">Share the soil blend or medium that works best.</p>
                  {fieldErrors.soilPreference && <p className="text-xs text-destructive">{fieldErrors.soilPreference}</p>}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="condition">Condition*</Label>
                  <Input
                    id="condition"
                    value={condition}
                    onChange={(event) => {
                      setCondition(event.target.value);
                      clearFieldError('condition');
                    }}
                    onBlur={() => validateField('condition')}
                    placeholder="Rooted cutting with new growth"
                    aria-invalid={fieldErrors.condition ? true : undefined}
                  />
                  <p className="text-xs text-muted-foreground">Describe the plant’s health, maturity, or propagation state.</p>
                  {fieldErrors.condition && <p className="text-xs text-destructive">{fieldErrors.condition}</p>}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Note variegation, growth habits, or special care tips."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">Share what makes this plant unique.</p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="careInstructions">Care instructions (optional)</Label>
                  <Textarea
                    id="careInstructions"
                    value={careInstructions}
                    onChange={(event) => setCareInstructions(event.target.value)}
                    placeholder="Water weekly when top inch is dry; enjoys 60% humidity."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">Provide watering, humidity, or seasonal care recommendations.</p>
                </div>
              </div>
            </section>
          </div>
        );
      case 2:
        return (
          <div className="space-y-8">
            <section className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-green-700">Delivery &amp; fulfillment</h3>
                <p className="text-sm text-muted-foreground">
                  Select every option you can reliably support and add any required coverage details.
                </p>
              </div>
              <div className="space-y-3">
                {DELIVERY_METHOD_OPTIONS.map((option) => {
                  const checkboxId = `delivery-${option.value.toLowerCase()}`;
                  return (
                    <label
                      key={option.value}
                      htmlFor={checkboxId}
                      className="flex items-start gap-3 rounded-md border border-gray-200/80 bg-white/70 p-3 shadow-sm"
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={deliveryMethods.includes(option.value)}
                        onCheckedChange={(checked) => {
                          toggleDeliveryMethod(option.value, checked === true);
                        }}
                      />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-900">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              {fieldErrors.deliveryMethods && (
                <p className="text-xs text-destructive">{fieldErrors.deliveryMethods}</p>
              )}
              {!fieldErrors.deliveryMethods && inlineCombinationError && (
                <p className="text-xs text-destructive">{inlineCombinationError}</p>
              )}
            </section>

            {(shippingSelected || zipRangeInput) && (
              <section className="space-y-2">
                <Label htmlFor="zipRangeInput">Available ZIP ranges</Label>
                <Textarea
                  id="zipRangeInput"
                  value={zipRangeInput}
                  onChange={(event) => {
                    setZipRangeInput(event.target.value);
                    clearFieldError('zipRange');
                  }}
                  onBlur={handleZipRangeBlur}
                  rows={shippingSelected ? 4 : 3}
                  placeholder="94107 or 75000-75200"
                  aria-invalid={fieldErrors.zipRange ? true : undefined}
                />
                <p className="text-xs text-muted-foreground">
                  Enter one ZIP or ZIP range per line (##### or #####-#####).
                </p>
                {fieldErrors.zipRange && <p className="text-xs text-destructive">{fieldErrors.zipRange}</p>}
              </section>
            )}

            <section className="space-y-2">
              <Label htmlFor="packagingNotes">Packaging notes (optional)</Label>
              <Textarea
                id="packagingNotes"
                value={packagingNotes}
                onChange={(event) => setPackagingNotes(event.target.value)}
                rows={3}
                placeholder="Share insulation materials, heat packs, or handling steps."
              />
              <p className="text-xs text-muted-foreground">Let buyers know how you protect plants in transit.</p>
            </section>

            <section className="space-y-4 rounded-md border border-gray-200/80 bg-white/70 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Live plant warranty</h4>
                  <p className="text-xs text-muted-foreground">
                    Offer peace of mind with a live arrival guarantee when you can support it.
                  </p>
                </div>
                <Switch
                  id="warrantySwitch"
                  checked={warrantyOffered}
                  onCheckedChange={handleWarrantyToggle}
                  aria-label="Toggle live plant warranty"
                />
              </div>
              {warrantyOffered && (
                <div className="space-y-2">
                  <Label htmlFor="warrantyDuration">Warranty duration (days)*</Label>
                  <Input
                    id="warrantyDuration"
                    type="number"
                    min="1"
                    value={warrantyDuration}
                    onChange={(event) => {
                      setWarrantyDuration(event.target.value);
                      clearFieldError('warrantyDuration');
                    }}
                    onBlur={() => validateField('warrantyDuration')}
                    placeholder="30"
                    aria-invalid={fieldErrors.warrantyDuration ? true : undefined}
                  />
                  <p className="text-xs text-muted-foreground">Specify how long buyers have to report issues.</p>
                  {fieldErrors.warrantyDuration && (
                    <p className="text-xs text-destructive">{fieldErrors.warrantyDuration}</p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="warrantyNotes">{warrantyOffered ? 'Warranty details' : 'Warranty notes (optional)'}</Label>
                <Textarea
                  id="warrantyNotes"
                  value={warrantyNotes}
                  onChange={(event) => setWarrantyNotes(event.target.value)}
                  rows={warrantyOffered ? 3 : 2}
                  placeholder={
                    warrantyOffered
                      ? 'Outline care requirements, what is covered, and claim steps.'
                      : 'Add optional disclaimers about live arrival guarantees.'
                  }
                />
                <p className="text-xs text-muted-foreground">Clarify what you cover and how buyers can reach you.</p>
              </div>
            </section>

            {prohibitedStateMessage && (
              <Alert variant="destructive">
                <AlertTitle>Shipping restriction</AlertTitle>
                <AlertDescription>{prohibitedStateMessage}</AlertDescription>
              </Alert>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  if (!isAuthenticated && isOpen) {
    onClose();
    navigate('/login', { state: { from: { pathname: '/', action: 'add-listing' } } });
    return null;
  }

  if (isOpen && isAuthenticated && !isSeller) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="gap-3">
            <DialogTitle className="text-lg font-semibold text-green-700">Seller access required</DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Only seller accounts can create new plant listings. Update your account settings to become a seller and start
              listing your plants for sale.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={onClose} className="bg-green-600 text-white hover:bg-green-700">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden">
        <DialogHeader className="gap-1 text-left">
          <DialogTitle>Create a new plant listing</DialogTitle>
          <DialogDescription>
            Upload photos, share plant details, and set fulfillment preferences to publish your listing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 overflow-hidden">
          <nav aria-label="Listing steps" className="rounded-md border bg-white/70 p-4">
            <ol className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              {STEPS.map((step, index) => {
                const isCompleted = index < currentStep;
                const isActive = index === currentStep;
                return (
                  <li key={step.key} className="flex items-start gap-3 md:flex-1 md:items-center">
                    <span
                      className={
                        'flex size-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ' +
                        (isActive
                          ? 'bg-green-600 text-white'
                          : isCompleted
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600')
                      }
                    >
                      {isCompleted ? <Check className="size-4" /> : index + 1}
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </nav>

          <form
            className="flex flex-1 flex-col overflow-hidden"
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmit();
            }}
          >
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="space-y-8 pb-6">{renderStepContent()}</div>
            </div>

            {submissionError && (
              <p className="mt-4 text-sm text-destructive">{submissionError}</p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">Step {currentStep + 1} of {STEPS.length}</p>
              <div className="flex flex-wrap gap-3">
                {currentStep > 0 && (
                  <Button type="button" variant="outline" onClick={handlePreviousStep}>
                    Back
                  </Button>
                )}
                {currentStep < STEPS.length - 1 && (
                  <Button type="button" onClick={handleNextStep}>
                    Next
                  </Button>
                )}
                {currentStep === STEPS.length - 1 && (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating…' : 'Create listing'}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
