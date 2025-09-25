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
import { uploadsService, MAX_UPLOAD_FILE_BYTES } from '../services/uploads';
import type { PresignedUploadTarget } from '../services/uploads';
import { API_ENDPOINTS } from '../config/amplify';
import type { DeliveryMethod, LivePlantWarranty } from '../interfaces/Plant';
import type { Plant } from '../interfaces/Plant';
import {
  DELIVERY_METHOD_OPTIONS,
  extractStateCode,
  getDeliveryCombinationError,
  getProhibitedStateMessage,
  parseZipRanges,
  requiresZipRanges,
} from '../constants/fulfillmentRules';
import { parseRestrictedStatesInput } from '../utils/compliance';
import { normalizePlantRecord } from '../utils/plants';
import { isPlantResponseDto } from '../interfaces/dtos';
import { compressImageIfNeeded } from '../utils/imageCompression';
import { analyticsService } from '../services/analytics';
import { telemetryService } from '../services/telemetry';

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
  | 'warrantyDuration'
  | 'restrictedStates'
  | 'restrictedStatesAcknowledgment'
  | 'phytosanitaryDetails'
  | 'phytosanitaryAcknowledgment'
  | 'arrivalGuaranteeAcknowledgment';

type FieldErrorState = Partial<Record<FieldName, string>>;

interface PlantImageFile {
  id: string;
  file: File;
  previewUrl: string;
}

interface UploadProgressEntry {
  uploadedBytes: number;
  totalBytes: number;
}

const MAX_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_BYTES;
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
const MAX_CONCURRENT_UPLOADS = 3;
const COMPRESSION_SETTINGS = {
  maxWidth: 2800,
  maxHeight: 2800,
  quality: 0.82,
  minBytesSaved: 32 * 1024,
} as const;

interface UploadReadyImage extends PlantImageFile {
  optimizedBytes: number;
  originalBytes: number;
  wasCompressed: boolean;
}

const runWithConcurrency = async function <T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  let nextIndex = 0;
  const maxWorkers = Math.max(1, Math.min(limit, items.length));

  const takeNext = (): number | null => {
    if (nextIndex >= items.length) {
      return null;
    }
    const current = nextIndex;
    nextIndex += 1;
    return current;
  };

  const workers: Promise<void>[] = Array.from({ length: maxWorkers }, async () => {
    while (true) {
      const currentIndex = takeNext();
      if (currentIndex === null) {
        return;
      }
      await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
};

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
  onListingCreated?: (plant: Plant) => void;
}

const createImageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export function CreateNewPlantModal({ isOpen, onClose, onListingCreated }: CreateNewPlantModalProps) {
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
  const [restrictedStatesInput, setRestrictedStatesInput] = useState('');
  const [restrictedStatesAcknowledged, setRestrictedStatesAcknowledged] = useState(false);
  const [phytosanitaryRequired, setPhytosanitaryRequired] = useState(false);
  const [phytosanitaryDetails, setPhytosanitaryDetails] = useState('');
  const [phytosanitaryAcknowledged, setPhytosanitaryAcknowledged] = useState(false);
  const [warrantyOffered, setWarrantyOffered] = useState(false);
  const [warrantyDuration, setWarrantyDuration] = useState('');
  const [warrantyNotes, setWarrantyNotes] = useState('');
  const [arrivalGuaranteeAcknowledged, setArrivalGuaranteeAcknowledged] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrorState>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgressEntry>>({});
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
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

  const overallUploadPercent = useMemo(() => {
    const entries = Object.values(uploadProgress);
    if (entries.length === 0) {
      return 0;
    }
    const totals = entries.reduce(
      (acc, entry) => {
        const uploaded = Math.min(entry.uploadedBytes, entry.totalBytes);
        return {
          uploaded: acc.uploaded + uploaded,
          total: acc.total + entry.totalBytes,
        };
      },
      { uploaded: 0, total: 0 },
    );

    if (totals.total === 0) {
      return 0;
    }

    return Math.round((totals.uploaded / totals.total) * 100);
  }, [uploadProgress]);

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

  const resetUploadState = useCallback(() => {
    setUploadProgress({});
    setUploadStatus(null);
  }, []);

  const updateUploadProgress = useCallback((id: string, uploaded: number, total: number) => {
    setUploadProgress((prev) => {
      const nextEntry: UploadProgressEntry = {
        uploadedBytes: Math.min(uploaded, total),
        totalBytes: total,
      };

      const existing = prev[id];
      if (
        existing &&
        existing.uploadedBytes === nextEntry.uploadedBytes &&
        existing.totalBytes === nextEntry.totalBytes
      ) {
        return prev;
      }

      return { ...prev, [id]: nextEntry };
    });
  }, []);

  const resetForm = useCallback(() => {
    resetUploadState();
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
    setRestrictedStatesInput('');
    setRestrictedStatesAcknowledged(false);
    setPhytosanitaryRequired(false);
    setPhytosanitaryDetails('');
    setPhytosanitaryAcknowledged(false);
    setWarrantyOffered(false);
    setWarrantyDuration('');
    setWarrantyNotes('');
    setArrivalGuaranteeAcknowledged(false);
    setFieldErrors({});
    setSubmissionError(null);
    setIsSubmitting(false);
    setCurrentStep(0);
  }, [resetUploadState]);

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
      const rawResults: unknown =
        payload && typeof payload === 'object' && 'results' in payload && Array.isArray((payload as any).results)
          ? (payload as any).results
          : payload;

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
        telemetryService.captureException(error, {
          message: 'Upload security scan failed',
          tags: {
            feature: 'listing',
            operation: 'upload-security-scan',
          },
          extra: {
            fileCount: candidateFiles.length,
          },
        });
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
        case 'restrictedStates': {
          if (!restrictedStatesInput.trim()) {
            clearFieldError('restrictedStates');
            return true;
          }
          const { invalidEntries } = parseRestrictedStatesInput(restrictedStatesInput);
          if (invalidEntries.length > 0) {
            setFieldError(
              'restrictedStates',
              `Use two-letter state codes: ${invalidEntries.join(', ')}`,
            );
            return false;
          }
          break;
        }
        case 'restrictedStatesAcknowledgment': {
          const { states } = parseRestrictedStatesInput(restrictedStatesInput);
          if (states.length === 0) {
            clearFieldError('restrictedStatesAcknowledgment');
            return true;
          }
          if (!restrictedStatesAcknowledged) {
            setFieldError(
              'restrictedStatesAcknowledgment',
              'Confirm you will block shipments to the restricted states listed.',
            );
            return false;
          }
          break;
        }
        case 'phytosanitaryDetails': {
          if (!phytosanitaryRequired) {
            clearFieldError('phytosanitaryDetails');
            return true;
          }
          if (!phytosanitaryDetails.trim()) {
            setFieldError(
              'phytosanitaryDetails',
              'Share details about when certificates are included.',
            );
            return false;
          }
          break;
        }
        case 'phytosanitaryAcknowledgment': {
          if (!phytosanitaryRequired) {
            clearFieldError('phytosanitaryAcknowledgment');
            return true;
          }
          if (!phytosanitaryAcknowledged) {
            setFieldError(
              'phytosanitaryAcknowledgment',
              'Acknowledge that you will provide required certification.',
            );
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
        case 'arrivalGuaranteeAcknowledgment': {
          if (!warrantyOffered) {
            clearFieldError('arrivalGuaranteeAcknowledgment');
            return true;
          }
          if (!arrivalGuaranteeAcknowledged) {
            setFieldError(
              'arrivalGuaranteeAcknowledgment',
              'Confirm you will honor the live-arrival guarantee you are offering.',
            );
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
    2: [
      'deliveryMethods',
      'zipRange',
      'restrictedStates',
      'restrictedStatesAcknowledgment',
      'phytosanitaryDetails',
      'phytosanitaryAcknowledgment',
      'warrantyDuration',
      'arrivalGuaranteeAcknowledgment',
    ],
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
      setArrivalGuaranteeAcknowledged(false);
      clearFieldError('arrivalGuaranteeAcknowledgment');
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
    const { states: restrictedStates } = parseRestrictedStatesInput(restrictedStatesInput);

    let warrantyDurationValue: number | undefined;
    if (warrantyOffered) {
      warrantyDurationValue = Number(warrantyDuration);
    }

    const complianceData = {
      restrictedStates,
      restrictedStatesAcknowledged:
        restrictedStates.length > 0 ? restrictedStatesAcknowledged : false,
      requiresPhytosanitaryCertificate: phytosanitaryRequired,
      phytosanitaryDetails: phytosanitaryRequired
        ? phytosanitaryDetails.trim() || undefined
        : undefined,
      phytosanitaryAcknowledged: phytosanitaryRequired ? phytosanitaryAcknowledged : false,
      arrivalGuaranteeAcknowledged: warrantyOffered ? arrivalGuaranteeAcknowledged : false,
    };

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

    const imagesToUpload = [...images];

    setUploadStatus('Preparing uploads…');

    const compressionStart = performance.now();
    const optimizedImages: UploadReadyImage[] = [];
    let totalOriginalBytes = 0;
    let totalOptimizedBytes = 0;

    for (const image of imagesToUpload) {
      totalOriginalBytes += image.file.size;

      try {
        const { file: optimizedFile, wasCompressed } = await compressImageIfNeeded(image.file, COMPRESSION_SETTINGS);
        optimizedImages.push({
          ...image,
          file: optimizedFile,
          originalBytes: image.file.size,
          optimizedBytes: optimizedFile.size,
          wasCompressed,
        });
        totalOptimizedBytes += optimizedFile.size;
      } catch (compressionError) {
        console.warn('Image compression failed; using original file.', {
          fileName: image.file.name,
          error: compressionError,
        });
        optimizedImages.push({
          ...image,
          originalBytes: image.file.size,
          optimizedBytes: image.file.size,
          wasCompressed: false,
        });
        totalOptimizedBytes += image.file.size;
      }
    }

    if (optimizedImages.length > 0) {
      analyticsService.track('media_compression_summary', {
        fileCount: optimizedImages.length,
        totalOriginalBytes,
        totalOptimizedBytes,
        bytesSaved: Math.max(0, totalOriginalBytes - totalOptimizedBytes),
        durationMs: Math.round(performance.now() - compressionStart),
      });
    }

    setUploadProgress(
      optimizedImages.reduce<Record<string, UploadProgressEntry>>((acc, image) => {
        acc[image.id] = { uploadedBytes: 0, totalBytes: image.optimizedBytes };
        return acc;
      }, {}),
    );

    try {
      const cleanupKeys = new Set<string>();

      try {
        const uploadedMedia: Array<{ key: string; fileName: string; contentType: string }> = [];

        if (optimizedImages.length > 0) {
          const presignStart = performance.now();
          const presignPayload = optimizedImages.map((image) => ({
            clientUploadId: image.id,
            fileName: image.file.name,
            contentType: image.file.type || 'application/octet-stream',
            contentLength: image.optimizedBytes,
          }));

          const presignedUploads = await uploadsService.createPresignedUploads(presignPayload);
          presignedUploads.forEach((target) => cleanupKeys.add(target.key));

          const uploadTargetMap = new Map<string, PresignedUploadTarget>(
            presignedUploads.map((target) => [target.clientUploadId, target]),
          );

          if (uploadTargetMap.size !== optimizedImages.length) {
            throw new Error('Upload endpoint did not return URLs for every photo.');
          }

          analyticsService.track('media_presign_completed', {
            fileCount: optimizedImages.length,
            totalBytes: totalOptimizedBytes,
            durationMs: Math.round(performance.now() - presignStart),
          });

          const performUploadAttempt = async (image: UploadReadyImage, target: PresignedUploadTarget) => {
            const headers = new Headers(target.headers ?? {});
            if (!headers.has('Content-Type')) {
              headers.set('Content-Type', image.file.type || 'application/octet-stream');
            }

            const totalBytes = image.optimizedBytes;
            updateUploadProgress(image.id, 0, totalBytes);

            const supportsStreaming =
              typeof image.file.stream === 'function' && typeof ReadableStream !== 'undefined';

            if (supportsStreaming) {
              let uploadedBytes = 0;
              const stream = image.file.stream();
              const progressStream = new ReadableStream<Uint8Array>({
                start(controller) {
                  const reader = stream.getReader();

                  const push = (): void => {
                    reader
                      .read()
                      .then(({ done, value }) => {
                        if (done) {
                          controller.close();
                          return;
                        }
                        if (value) {
                          uploadedBytes += value.byteLength;
                          updateUploadProgress(image.id, uploadedBytes, totalBytes);
                          controller.enqueue(value);
                        } else {
                          updateUploadProgress(image.id, uploadedBytes, totalBytes);
                        }
                        push();
                      })
                      .catch((streamError) => {
                        controller.error(streamError);
                      });
                  };

                  push();
                },
              });

              const response = await fetch(target.uploadUrl, {
                method: 'PUT',
                headers,
                body: progressStream,
              });

              if (!response.ok) {
                throw new Error(`Upload failed with status ${response.status}.`);
              }
            } else {
              if (typeof XMLHttpRequest === 'undefined') {
                const response = await fetch(target.uploadUrl, {
                  method: 'PUT',
                  headers,
                  body: image.file,
                });

                if (!response.ok) {
                  throw new Error(`Upload failed with status ${response.status}.`);
                }
              } else {
                await new Promise<void>((resolve, reject) => {
                  const xhr = new XMLHttpRequest();
                  xhr.open('PUT', target.uploadUrl, true);
                  headers.forEach((value, key) => {
                    xhr.setRequestHeader(key, value);
                  });

                  xhr.upload.onprogress = (event) => {
                    const reportedTotal = event.total || totalBytes;
                    updateUploadProgress(image.id, Math.min(event.loaded, reportedTotal), totalBytes);
                  };

                  xhr.onerror = () => {
                    reject(new Error('Network error during upload.'));
                  };

                  xhr.onload = () => {
                    const status = xhr.status || 0;
                    if (status >= 200 && status < 300) {
                      updateUploadProgress(image.id, totalBytes, totalBytes);
                      resolve();
                    } else {
                      reject(new Error(`Upload failed with status ${status || 'unknown'}.`));
                    }
                  };

                  xhr.onabort = () => {
                    reject(new Error('Upload was aborted.'));
                  };

                  xhr.send(image.file);
                });
              }
            }

            updateUploadProgress(image.id, totalBytes, totalBytes);
          };

          const uploadWithRetries = async (
            image: UploadReadyImage,
            target: PresignedUploadTarget,
          ): Promise<void> => {
            const maxAttempts = 3;
            let attempt = 0;

            while (attempt < maxAttempts) {
              try {
                await performUploadAttempt(image, target);
                return;
              } catch (uploadError) {
                attempt += 1;
                if (attempt >= maxAttempts) {
                  throw uploadError instanceof Error
                    ? uploadError
                    : new Error('An unexpected error occurred while uploading a photo.');
                }

                const backoffMs = 500 * attempt;
                console.warn('Retrying upload after failure', {
                  fileName: image.file.name,
                  attempt,
                  maxAttempts,
                });
                await new Promise((resolve) => setTimeout(resolve, backoffMs));
              }
            }
          };

          const totalFiles = optimizedImages.length;
          let completedUploads = 0;
          const uploadStart = performance.now();
          analyticsService.track('media_upload_batch_started', {
            fileCount: totalFiles,
            totalBytes: totalOptimizedBytes,
          });

          setUploadStatus(`Uploading photos (0/${totalFiles})…`);

          const uploadedMediaResults: Array<{
            key: string;
            fileName: string;
            contentType: string;
          } | null> = new Array(totalFiles).fill(null);

          let encounteredError: Error | null = null;

          await runWithConcurrency(optimizedImages, MAX_CONCURRENT_UPLOADS, async (image, index) => {
            const target = uploadTargetMap.get(image.id);
            if (!target) {
              throw new Error(`Missing upload target for ${image.file.name}.`);
            }

            const fileUploadStart = performance.now();
            analyticsService.track('media_upload_started', {
              fileName: image.file.name,
              fileSize: image.optimizedBytes,
              originalSize: image.originalBytes,
              wasCompressed: image.wasCompressed,
            });

            try {
              await uploadWithRetries(image, target);
              uploadedMediaResults[index] = {
                key: target.key,
                fileName: image.file.name,
                contentType: image.file.type || 'application/octet-stream',
              };
              analyticsService.track('media_upload_succeeded', {
                fileName: image.file.name,
                durationMs: Math.round(performance.now() - fileUploadStart),
                fileSize: image.optimizedBytes,
                originalSize: image.originalBytes,
                wasCompressed: image.wasCompressed,
              });
            } catch (uploadError) {
              analyticsService.track('media_upload_failed', {
                fileName: image.file.name,
                error: uploadError instanceof Error ? uploadError.message : 'unknown',
                durationMs: Math.round(performance.now() - fileUploadStart),
              });
              encounteredError = uploadError instanceof Error
                ? uploadError
                : new Error('An unexpected error occurred while uploading a photo.');
              throw encounteredError;
            } finally {
              completedUploads += 1;
              setUploadStatus(`Uploading photos (${completedUploads}/${totalFiles})…`);
            }
          });

          if (encounteredError) {
            throw encounteredError;
          }

          const uploadDuration = Math.round(performance.now() - uploadStart);
          analyticsService.track('media_upload_batch_succeeded', {
            fileCount: totalFiles,
            totalBytes: totalOptimizedBytes,
            durationMs: uploadDuration,
          });

          uploadedMedia.push(
            ...uploadedMediaResults.filter((entry): entry is { key: string; fileName: string; contentType: string } => {
              return entry !== null;
            }),
          );
        }

        setUploadStatus('Finalizing listing…');

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
          compliance: complianceData,
        };

        const bodyJSON = {
          plant: plantData,
          media: uploadedMedia,
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
            if (errorBody && typeof (errorBody as { message?: string }).message === 'string') {
              message = (errorBody as { message: string }).message;
            }
          } catch (parseError) {
            console.warn('Unable to parse error response', parseError);
          }
          throw new Error(message);
        }

        const responseBody = res.data ?? (await res.json());
        const rawPlant =
          responseBody && typeof responseBody === 'object' && 'plant' in responseBody
            ? (responseBody as { plant: unknown }).plant
            : responseBody;
        let createdPlant: Plant | null = null;
        if (rawPlant && typeof rawPlant === 'object' && isPlantResponseDto(rawPlant)) {
          const normalized = normalizePlantRecord(rawPlant);
          if (normalized && typeof normalized.id === 'string') {
            createdPlant = normalized;
          }
        }

        if (createdPlant) {
          console.log('Plant created:', createdPlant);
          onListingCreated?.(createdPlant);
        } else {
          console.warn('Plant created but response payload could not be normalized.');
        }

        toast.success('Your plant listing is live!');
        resetForm();
        onClose();
        cleanupKeys.clear();
      } catch (innerError) {
        if (cleanupKeys.size > 0) {
          await uploadsService.cleanupUploads(Array.from(cleanupKeys));
        }
        analyticsService.track('media_upload_batch_failed', {
          error: innerError instanceof Error ? innerError.message : 'unknown',
        });
        throw innerError;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create listing';
      setSubmissionError(message);
      toast.error(message);
      telemetryService.captureException(error, {
        message: 'Error creating listing',
        tags: {
          feature: 'listing',
          operation: 'create',
        },
        extra: {
          plantName: formState.plantName,
          imageCount: images.length,
        },
      });
    } finally {
      resetUploadState();
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

            <section className="space-y-3 rounded-md border border-gray-200/80 bg-white/70 p-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Restricted destinations</h4>
                <p className="text-xs text-muted-foreground">
                  List the U.S. states where you cannot ship this plant due to agricultural rules.
                </p>
              </div>
              <Textarea
                id="restrictedStates"
                value={restrictedStatesInput}
                onChange={(event) => {
                  setRestrictedStatesInput(event.target.value);
                  clearFieldError('restrictedStates');
                }}
                rows={3}
                placeholder="CA, AZ, HI"
                aria-invalid={fieldErrors.restrictedStates ? true : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Use two-letter state codes separated by commas or line breaks.
              </p>
              {fieldErrors.restrictedStates && (
                <p className="text-xs text-destructive">{fieldErrors.restrictedStates}</p>
              )}
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={restrictedStatesAcknowledged}
                  onCheckedChange={(checked) => {
                    setRestrictedStatesAcknowledged(checked === true);
                    clearFieldError('restrictedStatesAcknowledgment');
                  }}
                />
                <span>
                  I will block orders shipping to the states listed above and cancel any that slip through.
                </span>
              </label>
              {fieldErrors.restrictedStatesAcknowledgment && (
                <p className="text-xs text-destructive">{fieldErrors.restrictedStatesAcknowledgment}</p>
              )}
            </section>

            <section className="space-y-3 rounded-md border border-gray-200/80 bg-white/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Phytosanitary certification</h4>
                  <p className="text-xs text-muted-foreground">
                    Toggle on if certain destinations require a certificate for this plant.
                  </p>
                </div>
                <Switch
                  id="phytosanitaryRequired"
                  checked={phytosanitaryRequired}
                  onCheckedChange={(checked) => {
                    const nextValue = checked === true;
                    setPhytosanitaryRequired(nextValue);
                    if (!nextValue) {
                      setPhytosanitaryDetails('');
                      setPhytosanitaryAcknowledged(false);
                      clearFieldError('phytosanitaryDetails');
                      clearFieldError('phytosanitaryAcknowledgment');
                    }
                  }}
                  aria-label="Toggle phytosanitary certification requirement"
                />
              </div>
              {phytosanitaryRequired && (
                <>
                  <Textarea
                    id="phytosanitaryDetails"
                    value={phytosanitaryDetails}
                    onChange={(event) => {
                      setPhytosanitaryDetails(event.target.value);
                      clearFieldError('phytosanitaryDetails');
                    }}
                    rows={3}
                    placeholder="Include certification for CA, AZ. Ships with state-issued inspection docs."
                    aria-invalid={fieldErrors.phytosanitaryDetails ? true : undefined}
                  />
                  <p className="text-xs text-muted-foreground">
                    Share when you include certificates, inspection numbers, or agency contacts.
                  </p>
                  {fieldErrors.phytosanitaryDetails && (
                    <p className="text-xs text-destructive">{fieldErrors.phytosanitaryDetails}</p>
                  )}
                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={phytosanitaryAcknowledged}
                      onCheckedChange={(checked) => {
                        setPhytosanitaryAcknowledged(checked === true);
                        clearFieldError('phytosanitaryAcknowledgment');
                      }}
                    />
                    <span>I will include required phytosanitary documentation with every applicable shipment.</span>
                  </label>
                  {fieldErrors.phytosanitaryAcknowledgment && (
                    <p className="text-xs text-destructive">{fieldErrors.phytosanitaryAcknowledgment}</p>
                  )}
                </>
              )}
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
              {warrantyOffered && (
                <>
                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={arrivalGuaranteeAcknowledged}
                      onCheckedChange={(checked) => {
                        setArrivalGuaranteeAcknowledged(checked === true);
                        clearFieldError('arrivalGuaranteeAcknowledgment');
                      }}
                    />
                    <span>I will honor this arrival guarantee or provide refunds/replacements per marketplace policy.</span>
                  </label>
                  {fieldErrors.arrivalGuaranteeAcknowledgment && (
                    <p className="text-xs text-destructive">{fieldErrors.arrivalGuaranteeAcknowledgment}</p>
                  )}
                </>
              )}
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
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">Step {currentStep + 1} of {STEPS.length}</p>
                {isSubmitting && uploadStatus && (
                  <p className="text-xs text-muted-foreground">
                    {uploadStatus}
                    {overallUploadPercent > 0 &&
                    overallUploadPercent <= 100 &&
                    uploadStatus !== 'Finalizing listing…'
                      ? ` ${overallUploadPercent}%`
                      : ''}
                  </p>
                )}
              </div>
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
