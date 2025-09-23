export interface Plant {
    id: string;
    name: string;
    price: number;
    images: string[];
    location: string;
    category: string;
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
}