import { Plant } from "./Plant";

export interface UserConsents {
  termsAcceptedAt: string | null;
  privacyAcceptedAt: string | null;
  marketingEmailOptIn: boolean;
  marketingSmsOptIn: boolean;
  marketingGlobalUnsubscribed: boolean;
}

export interface User {
  userId: string;
  fullName: string;
  joinedDate: string;
  profilePic: string;
  description: string;
  plantListings: Plant[];
  savedListings: Plant[];
  subscription: string;
  consents: UserConsents;
  // reviews: Review[];
}
