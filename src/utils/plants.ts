import type { Plant, DeliveryMethod, LivePlantWarranty, ZipRange, PlantCompliance } from '../interfaces/Plant';
import { DELIVERY_METHOD_OPTIONS } from '../constants/fulfillmentRules';
import type { PlantResponseDto } from '../interfaces/dtos';
import { toNumberOrNull } from '../interfaces/dtos';

const VALID_DELIVERY_METHODS = new Set<DeliveryMethod>(
  DELIVERY_METHOD_OPTIONS.map((option) => option.value),
);

export const normalizeZipRanges = (ranges: any[]): ZipRange[] => {
  if (!Array.isArray(ranges)) {
    return [];
  }

  return ranges
    .map((range) => {
      const start =
        typeof range?.start === 'string'
          ? range.start
          : typeof range?.startZip === 'string'
          ? range.startZip
          : '';
      const endCandidate =
        typeof range?.end === 'string'
          ? range.end
          : typeof range?.endZip === 'string'
          ? range.endZip
          : '';
      const end = endCandidate || start;
      if (!start || !end) {
        return null;
      }
      return { start, end } satisfies ZipRange;
    })
    .filter((value): value is ZipRange => Boolean(value));
};

export const normalizePlantRecord = (plant: PlantResponseDto): Plant => {
  const deliveryMethods: DeliveryMethod[] = Array.isArray(plant.deliveryMethods)
    ? plant.deliveryMethods.filter(
        (method): method is DeliveryMethod =>
          typeof method === 'string' && VALID_DELIVERY_METHODS.has(method as DeliveryMethod),
      )
    : [];

  const availableZipRanges: ZipRange[] = normalizeZipRanges(
    Array.isArray(plant.availableZipRanges) ? plant.availableZipRanges : [],
  );

  const packagingNotes = typeof plant.packagingNotes === 'string' ? plant.packagingNotes : '';

  const rawWarranty = plant.livePlantWarranty;
  let normalizedWarranty: LivePlantWarranty = { isOffered: false };
  if (rawWarranty && typeof rawWarranty === 'object') {
    const durationRaw = rawWarranty?.durationDays;
    const parsedDuration = toNumberOrNull(durationRaw);
    const durationDays = parsedDuration !== null && parsedDuration > 0 ? parsedDuration : undefined;
    const notes =
      typeof rawWarranty?.notes === 'string' && rawWarranty.notes.trim().length > 0
        ? rawWarranty.notes
        : undefined;

    normalizedWarranty = {
      isOffered: Boolean(rawWarranty?.isOffered),
      durationDays,
      notes,
    };
  }

  const priceNumber = toNumberOrNull(plant.price) ?? 0;
  const sellerRating = toNumberOrNull(plant.sellerRating) ?? 0;
  const sellerReviewCount = toNumberOrNull(plant.sellerReviewCount) ?? undefined;
  const images = Array.isArray(plant.images)
    ? plant.images.filter((image): image is string => typeof image === 'string')
    : [];

  const compliance =
    plant.compliance && typeof plant.compliance === 'object'
      ? (plant.compliance as PlantCompliance)
      : undefined;

  return {
    id: plant.id,
    name: plant.name,
    price: priceNumber,
    images,
    location: typeof plant.location === 'string' ? plant.location : '',
    category: typeof plant.category === 'string' ? plant.category : 'General',
    species: typeof plant.species === 'string' ? plant.species : undefined,
    cultivar: typeof plant.cultivar === 'string' ? plant.cultivar : undefined,
    usdaZone: typeof plant.usdaZone === 'string' ? plant.usdaZone : undefined,
    lightPreference: typeof plant.lightPreference === 'string' ? plant.lightPreference : undefined,
    soilPreference: typeof plant.soilPreference === 'string' ? plant.soilPreference : undefined,
    seller: typeof plant.seller === 'string' && plant.seller.trim().length > 0 ? plant.seller : 'Unknown Seller',
    sellerId: typeof plant.sellerId === 'string' ? plant.sellerId : undefined,
    sellerAvatar: typeof plant.sellerAvatar === 'string' ? plant.sellerAvatar : '',
    sellerRating,
    sellerReviewCount: sellerReviewCount ?? undefined,
    condition: typeof plant.condition === 'string' ? plant.condition : 'Unknown',
    description: typeof plant.description === 'string' ? plant.description : '',
    careInstructions: typeof plant.careInstructions === 'string' ? plant.careInstructions : '',
    potSize: typeof plant.potSize === 'string' ? plant.potSize : '',
    height: typeof plant.height === 'string' ? plant.height : '',
    postedDate: typeof plant.postedDate === 'string' ? plant.postedDate : '',
    deliveryMethods,
    availableZipRanges,
    packagingNotes,
    livePlantWarranty: normalizedWarranty,
    compliance,
  };
};
