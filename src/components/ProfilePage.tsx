import { useState, ChangeEvent } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { PlantCard } from "./PlantCard";

// Initial mock user data
const initialUser = {
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
  ],
  savedListings: [
    {
      id: "4",
      name: "Lavender Plant",
      price: 15,
      image: "https://images.unsplash.com/photo-1611909023032-2d6b3134ecba?w=400",
      location: "Portland, OR",
      category: "Herbs",
      condition: "Good",
    },
  ],
  subscription: "Free Plan",
};

const settingsTabs = [
  { key: "listings", label: "My Listings" },
  { key: "saved", label: "Saved Listings" },
  { key: "subscription", label: "Subscription" },
  { key: "security", label: "Password & Security" },
  { key: "privacy", label: "Privacy" },
  { key: "help", label: "Help & Support" },
  { key: "about", label: "About" },
  { key: "feedback", label: "Send Feedback" },
  { key: "terms", label: "Terms of Service" },
];

export function ProfilePage() {
  const [user, setUser] = useState(initialUser);
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(user.description);
  const [editAvatar, setEditAvatar] = useState(user.avatar);
  const [activeTab, setActiveTab] = useState("listings");

  // Handle avatar file upload
  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setEditAvatar(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Save changes
  const handleSave = () => {
    setUser({
      ...user,
      avatar: editAvatar,
      description: editDescription,
    });
    setIsEditing(false);
  };

  // Cancel editing
  const handleCancel = () => {
    setEditDescription(user.description);
    setEditAvatar(user.avatar);
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      {/* Profile Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative">
          <img
            src={isEditing ? editAvatar : user.avatar}
            alt={user.name}
            className="w-24 h-24 rounded-full object-cover border-4 border-green-300 mb-4"
          />
          {isEditing && (
            <label className="absolute bottom-2 right-2 bg-green-600 text-white rounded-full px-2 py-1 text-xs cursor-pointer">
              Change
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </label>
          )}
        </div>
        <h2 className="text-2xl font-semibold text-green-800">{user.name}</h2>
        {isEditing ? (
          <textarea
            value={editDescription}
            onChange={e => setEditDescription(e.target.value)}
            className="mt-2 max-w-md w-full p-2 rounded border border-green-200 text-gray-700"
            rows={3}
          />
        ) : (
          <p className="text-gray-600 text-center mt-2 max-w-md">{user.description}</p>
        )}
        {isEditing ? (
          <div className="flex gap-2 mt-4">
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleSave}>
              Save
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button className="mt-4 bg-green-600 hover:bg-green-700 text-white" onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="w-full max-w-4xl mb-8">
        <div className="flex border-b border-green-200 overflow-x-auto">
          {settingsTabs.map(tab => (
            <button
              key={tab.key}
              className={`py-2 px-4 text-sm font-medium focus:outline-none ${
                activeTab === tab.key
                  ? "border-b-2 border-green-600 text-green-700 bg-green-50"
                  : "text-gray-500 hover:text-green-700"
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="w-full max-w-4xl">
        {activeTab === "listings" && (
          <>
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
          </>
        )}

        {activeTab === "saved" && (
          <>
            <h3 className="text-lg font-medium text-green-700 mb-4">Saved Listings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {user.savedListings.length > 0 ? (
                user.savedListings.map(listing => (
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
                ))
              ) : (
                <div className="text-gray-500">No saved listings yet.</div>
              )}
            </div>
          </>
        )}

        {activeTab === "subscription" && (
          <div className="p-6 bg-white rounded-lg shadow border border-green-100">
            <h3 className="text-lg font-medium text-green-700 mb-2">Subscription Plan</h3>
            <p className="mb-4">Current Plan: <span className="font-semibold">{user.subscription}</span></p>
            <Button className="bg-green-600 hover:bg-green-700 text-white">Upgrade Plan</Button>
          </div>
        )}

        {activeTab === "security" && (
          <div className="p-6 bg-white rounded-lg shadow border border-green-100">
            <h3 className="text-lg font-medium text-green-700 mb-2">Password & Security</h3>
            <Button className="bg-green-600 hover:bg-green-700 text-white mb-2">Reset Password</Button>
            <p className="text-gray-500 text-sm">For account security, use a strong password and never share it.</p>
          </div>
        )}

        {activeTab === "privacy" && (
          <div className="p-6 bg-white rounded-lg shadow border border-green-100">
            <h3 className="text-lg font-medium text-green-700 mb-2">Privacy Settings</h3>
            <p className="text-gray-500 mb-2">Manage your privacy preferences and data sharing options.</p>
            <Button className="bg-green-600 hover:bg-green-700 text-white">Edit Privacy Settings</Button>
          </div>
        )}

        {activeTab === "help" && (
          <div className="p-6 bg-white rounded-lg shadow border border-green-100">
            <h3 className="text-lg font-medium text-green-700 mb-2">Help & Support</h3>
            <p className="mb-2">Need help? Visit our <a href="#" className="text-green-600 underline">Help Center</a> or contact support.</p>
            <Button className="bg-green-600 hover:bg-green-700 text-white">Contact Support</Button>
          </div>
        )}

        {activeTab === "about" && (
          <div className="p-6 bg-white rounded-lg shadow border border-green-100">
            <h3 className="text-lg font-medium text-green-700 mb-2">About Thumr</h3>
            <p className="text-gray-500">Thumr is a community for plant lovers to buy, sell, and trade plants. Our mission is to connect people through greenery!</p>
          </div>
        )}

        {activeTab === "feedback" && (
          <div className="p-6 bg-white rounded-lg shadow border border-green-100">
            <h3 className="text-lg font-medium text-green-700 mb-2">Send Feedback</h3>
            <textarea
              className="w-full p-2 border border-green-200 rounded mb-2"
              rows={3}
              placeholder="Let us know your thoughts..."
            />
            <Button className="bg-green-600 hover:bg-green-700 text-white">Submit Feedback</Button>
          </div>
        )}

        {activeTab === "terms" && (
          <div className="p-6 bg-white rounded-lg shadow border border-green-100">
            <h3 className="text-lg font-medium text-green-700 mb-2">Terms of Service</h3>
            <p className="text-gray-500 text-sm">By using Thumr, you agree to our terms of service and privacy policy.</p>
            <a href="#" className="text-green-600 underline">View Full Terms</a>
          </div>
        )}
      </div>
    </div>
  );
}