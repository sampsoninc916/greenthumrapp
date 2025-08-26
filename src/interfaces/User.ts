import { Plant } from "./Plant";

export interface User {
  userId: string;
  fullName: string;
  joinedDate: string;
  profilePic: string;
  description: string;
  plantListings: Plant[];
  savedListings: Plant[];
  subscription: string;
  // reviews: Review[];
}
