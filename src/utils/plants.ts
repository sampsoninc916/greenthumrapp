import type { Plant, DeliveryMethod, LivePlantWarranty, ZipRange } from '../interfaces/Plant';
import { DELIVERY_METHOD_OPTIONS } from '../constants/fulfillmentRules';

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

export const normalizePlantRecord = (plant: any): Plant => {
  const deliveryMethods: DeliveryMethod[] = Array.isArray(plant?.deliveryMethods)
    ? plant.deliveryMethods.filter(
        (method: unknown): method is DeliveryMethod =>
          typeof method === 'string' && VALID_DELIVERY_METHODS.has(method as DeliveryMethod),
      )
    : [];

  const availableZipRanges: ZipRange[] = normalizeZipRanges(plant?.availableZipRanges);

  const packagingNotes = typeof plant?.packagingNotes === 'string' ? plant.packagingNotes : '';

  const rawWarranty = plant?.livePlantWarranty;
  let normalizedWarranty: LivePlantWarranty = { isOffered: false };
  if (rawWarranty && typeof rawWarranty === 'object') {
    const durationRaw = rawWarranty?.durationDays;
    const parsedDuration =
      typeof durationRaw === 'number'
        ? durationRaw
        : typeof durationRaw === 'string'
        ? Number(durationRaw)
        : undefined;
    const durationDays =
      parsedDuration !== undefined && Number.isFinite(parsedDuration) && parsedDuration > 0
        ? parsedDuration
        : undefined;
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

  return {
    ...plant,
    deliveryMethods,
    availableZipRanges,
    packagingNotes,
    livePlantWarranty: normalizedWarranty,
  } as Plant;
};
