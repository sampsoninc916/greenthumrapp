import { describe, expect, it } from 'vitest';
import { normalizePlantRecord, normalizeZipRanges } from '../plants';
import type { PlantResponseDto } from '../../interfaces/dtos';
import type { DeliveryMethod, Plant } from '../../interfaces/Plant';

describe('normalizeZipRanges', () => {
  it('returns an empty array when provided a non-array value', () => {
    expect(normalizeZipRanges(undefined as unknown as any[])).toEqual([]);
    expect(normalizeZipRanges({} as unknown as any[])).toEqual([]);
  });

  it('coerces mixed zip range inputs into normalized ranges and filters invalid entries', () => {
    const input = [
      { start: '12345', end: '12346' },
      { startZip: '20000' },
      { startZip: '30000', endZip: '30010' },
      { start: '', end: '00000' },
      { other: true },
    ];

    expect(normalizeZipRanges(input as any[])).toEqual([
      { start: '12345', end: '12346' },
      { start: '20000', end: '20000' },
      { start: '30000', end: '30010' },
    ]);
  });
});

describe('normalizePlantRecord', () => {
  const createPlantDto = (overrides: Partial<PlantResponseDto> = {}): PlantResponseDto => ({
    plantId: 'plant-1',
    name: 'Monstera',
    price: '49.99',
    images: ['https://example.com/1.jpg', 2 as unknown as string],
    seller: '  ',
    sellerId: 'seller-123',
    sellerAvatar: 'avatar.png',
    sellerRating: '4.5',
    sellerReviewCount: '37',
    category: 'Aroids',
    condition: 'Rooted cutting',
    description: 'A beautiful plant',
    careInstructions: 'Mist weekly',
    location: 'Portland, OR',
    postedDate: '2024-01-01',
    potSize: '6in',
    height: '12in',
    deliveryMethods: ['LOCAL_PICKUP', 'INVALID_METHOD'],
    availableZipRanges: [
      { startZip: '97035', endZip: '97040' },
      { startZip: '', endZip: '00000' },
    ],
    packagingNotes: 'Handle with care',
    livePlantWarranty: {
      isOffered: true,
      durationDays: '14',
      notes: 'Contact us if there are issues',
    } as Record<string, unknown>,
    compliance: {
      restrictedStates: ['AK'],
      restrictedStatesAcknowledged: true,
      requiresPhytosanitaryCertificate: false,
      phytosanitaryAcknowledged: true,
      arrivalGuaranteeAcknowledged: true,
    },
    ...overrides,
  });

  it('normalizes primitive values and filters unsupported delivery methods', () => {
    const dto = createPlantDto();

    const normalized = normalizePlantRecord(dto);

    const expected: Plant = {
      plantId: 'plant-1',
      name: 'Monstera',
      price: 49.99,
      images: ['https://example.com/1.jpg'],
      location: 'Portland, OR',
      category: 'Aroids',
      species: undefined,
      cultivar: undefined,
      usdaZone: undefined,
      lightPreference: undefined,
      soilPreference: undefined,
      seller: 'Unknown Seller',
      sellerId: 'seller-123',
      sellerAvatar: 'avatar.png',
      sellerRating: 4.5,
      sellerReviewCount: 37,
      condition: 'Rooted cutting',
      description: 'A beautiful plant',
      careInstructions: 'Mist weekly',
      potSize: '6in',
      height: '12in',
      postedDate: '2024-01-01',
      deliveryMethods: ['LOCAL_PICKUP'] as DeliveryMethod[],
      availableZipRanges: [
        { start: '97035', end: '97040' },
      ],
      packagingNotes: 'Handle with care',
      livePlantWarranty: {
        isOffered: true,
        durationDays: 14,
        notes: 'Contact us if there are issues',
      },
      compliance: {
        restrictedStates: ['AK'],
        restrictedStatesAcknowledged: true,
        requiresPhytosanitaryCertificate: false,
        phytosanitaryAcknowledged: true,
        arrivalGuaranteeAcknowledged: true,
      },
    };

    expect(normalized).toEqual(expected);
  });

  it('provides sensible defaults when optional fields are missing', () => {
    const dto = createPlantDto({
      seller: undefined,
      description: undefined,
      careInstructions: undefined,
      livePlantWarranty: null,
      availableZipRanges: undefined,
      deliveryMethods: undefined,
      packagingNotes: undefined,
      compliance: null,
    });

    const normalized = normalizePlantRecord(dto);

    expect(normalized.seller).toBe('Unknown Seller');
    expect(normalized.description).toBe('');
    expect(normalized.careInstructions).toBe('');
    expect(normalized.livePlantWarranty).toEqual({ isOffered: false });
    expect(normalized.availableZipRanges).toEqual([]);
    expect(normalized.deliveryMethods).toEqual([]);
    expect(normalized.packagingNotes).toBe('');
    expect(normalized.compliance).toBeUndefined();
  });
});
