export type DeliveryMethod =
    | "LOCAL_PICKUP"
    | "LOCAL_DELIVERY"
    | "REGIONAL_SHIPPING"
    | "NATIONWIDE_SHIPPING";

export interface ZipRange {
    start: string;
    end: string;
}

export interface LivePlantWarranty {
    isOffered: boolean;
    durationDays?: number;
    notes?: string;
}

export interface Plant {
    id: string;
    name: string;
    price: number;
    images: string[];
    location: string;
    category: string;
    species?: string;
    cultivar?: string;
    usdaZone?: string;
    lightPreference?: string;
    soilPreference?: string;
    seller: string;
    sellerId?: string;
    sellerAvatar: string;
    sellerRating: number;
    sellerReviewCount?: number;
    condition: string;
    description: string;
    careInstructions: string;
    potSize: string;
    height: string;
    postedDate: string;
    deliveryMethods: DeliveryMethod[];
    availableZipRanges: ZipRange[];
    packagingNotes?: string;
    livePlantWarranty?: LivePlantWarranty;
}
