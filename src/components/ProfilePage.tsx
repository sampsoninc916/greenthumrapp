import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { PlantCard } from "./PlantCard";

// Mock user data
const user = {
  name: "Jane Doe",
  description: "Plant enthusiast and collector. I love sharing rare houseplants and gardening tips!",
  avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b167?w=150",
  listings: [
    {
      id: "1",
      name: "Monstera Deliciosa",
      price: 45,
      image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400",
      location: "Brooklyn, NY",
      category: "Houseplants",
      condition: "Like New",
    },
    {
      id: "2",
      name: "Fiddle Leaf Fig",
      price: 75,
      image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400",
      location: "San Francisco, CA",
      category: "Trees",
      condition: "New",
    },
    {
      id: "3",
      name: "Snake Plant",
      price: 30,
      image: "https://images.unsplash.com/photo-1572688484438-313a6e50c333?w=400",
      location: "Austin, TX",
      category: "Houseplants",
      condition: "New",
    },
    // Add more mock listings as needed
  ],
};

export function ProfilePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      {/* Profile Header */}
      <div className="flex flex-col items-center mb-8">
        <img
          src={user.avatar}
          alt={user.name}
          className="w-24 h-24 rounded-full object-cover border-4 border-green-300 mb-4"
        />
        <h2 className="text-2xl font-semibold text-green-800">{user.name}</h2>
        <p className="text-gray-600 text-center mt-2 max-w-md">{user.description}</p>
        <Button className="mt-4 bg-green-600 hover:bg-green-700 text-white">Edit Profile</Button>
      </div>

      {/* User Listings */}
      <div className="w-full max-w-4xl">
        <h3 className="text-lg font-medium text-green-700 mb-4">My Listings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {user.listings.map(listing => (
            <Card key={listing.id} className="p-0">
              <PlantCard
                id={listing.id}
                name={listing.name}
                price={listing.price}
                image={listing.image}
                location={listing.location}
                category={listing.category}
                seller={user.name}
                condition={listing.condition}
                onClick={() => {}}
              />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}