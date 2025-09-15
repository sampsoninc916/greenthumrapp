import { useState, useEffect, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { PlantCard } from "./PlantCard";
import { Plant } from "../interfaces/Plant";
import { User } from "../interfaces/User";
import { API_ENDPOINTS } from "../config/amplify";
import { apiClient } from "../services/auth";
import { getCurrentUser } from "aws-amplify/auth";
import { useAuth } from "../contexts/AuthContext";
import { AccountDeletedModal } from "./AccountDeletedModal";
 
interface Review {
  rating: number;
  review: string;
}

// Helper to parse DynamoDB JSON format
function parseUserData(data: any) {
  return {
    userId: data.userId || "",
    fullName: data.fullName || "",
    joinedDate: data.joinedDate || "",
    profilePic: data.profilePic || "empty",
    description: data.description || "",
    subscription: data.subscription || "Free Plan",
    plantListingIds: data.plantListings && Array.isArray(data.plantListings) && data.plantListings.length > 0 ? [...data.plantListings] : [],
    savedListingIds: data.savedListings && Array.isArray(data.savedListings) && data.savedListings.length > 0 ? [...data.savedListings] : [],
  };
}

const getUser = async (logout: () => Promise<void>) => {
  try {
    const user = await getCurrentUser();
    if (user) {
      return user;
    } else {
      console.log("No user found, logging out.");
      await logout();
    }
  } catch (error) {
    console.error("Error fetching current user:", error);
    return null;
  }
};

const initialUser: User = {
  userId: "",
  fullName: "Jane Doe",
  joinedDate: "",
  profilePic: "https://images.unsplash.com/photo-1494790108755-2616b612b167?w=150",
  description: "Plant enthusiast and collector. I love sharing rare houseplants and gardening tips!",
  plantListings: [],
  savedListings: [],
  subscription: "Free Plan",
  // reviews: [],
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
  { key: "delete", label: "Delete Account" },
];

export function ProfilePage() {
  const [user, setUser] = useState(initialUser);
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(user.description);
  const [editAvatar, setEditAvatar] = useState(user.profilePic);
  const [editFullName, setEditFullName] = useState(user.fullName);
  const [activeTab, setActiveTab] = useState("listings");
  const [userPlantListings, setUserPlantListings] = useState<Plant[]>([]);
  const [userSavedListings, setUserSavedListings] = useState<Plant[]>([]);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const { deleteAccount } = useAuth();
  const navigate = useNavigate();

  // Fetch user data from API on mount
  useEffect(() => {
    async function fetchUserAndPlants() {
      try {
        const userId = "97c7e891-a50d-456d-990c-a3a271099c0c";
        const tableName = "users";
        const userData = { userId, tableName };
        const queryParams = new URLSearchParams(userData as any).toString();
        const url = `${API_ENDPOINTS.USERS_READ}?${queryParams}`;
        const response = await apiClient.get(url, true); // Requires auth to read user data
        if (!response.ok) throw new Error("Failed to fetch user data");
        const data = await response.json();
        const parsed = parseUserData(data);
        
        // Fetch all plant data
        const plantsResponse = await apiClient.get(API_ENDPOINTS.PLANTS_READ, false); // Public endpoint
        if (!plantsResponse.ok) throw new Error("Failed to fetch plants data");
        const allPlants: Plant[] = await plantsResponse.json();
        
        // Filter plants for user's listings
        const userPlants = allPlants.filter(plant => parsed.plantListingIds.includes(plant.id));
        const savedPlants = allPlants.filter(plant => parsed.savedListingIds.includes(plant.id));
        
        setUserPlantListings(userPlants);
        setUserSavedListings(savedPlants);
        setUser({
          ...parsed,
          plantListings: userPlants,
          savedListings: savedPlants
        });
        setEditDescription(parsed.description || "");
        setEditAvatar(parsed.profilePic);
        setEditFullName(parsed.fullName);
      } catch (error) {
        console.error(error);
      }
    }
    fetchUserAndPlants();
  }, []);

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

  // Save changes (local only)
  const handleSave = () => {
    setUser({
      ...user,
      profilePic: editAvatar,
      description: editDescription,
    });
    setIsEditing(false);
  };

  const handleDeleteAccount = () => {
    deleteAccount();
    setShowDeletedModal(true);
  }

  // Cancel editing
  const handleCancel = () => {
    setEditDescription(user.description);
    setEditAvatar(user.profilePic);
    setIsEditing(false);
  };

  // Save changes to backend
  const saveChangesToBackend = async () => {
    try {
      const response = await apiClient.put(
        `${API_ENDPOINTS.USERS_UPDATE}?userId=${user.userId}`,
        { fullName: editFullName, profilePic: editAvatar, description: editDescription },
        true // Requires authentication
      );
      if (!response.ok) {
        throw new Error('Failed to save changes');
      }
      console.log('Changes saved successfully');
      // Update local state if needed
      setUser({
        ...user,
        fullName: editFullName,
        profilePic: editAvatar,
        description: editDescription,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving changes:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      {/* Profile Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative">
          <img
            src={isEditing ? editAvatar : user?.profilePic.replace("'", "").replace('https://dev.thumr.com/', '')}
            alt={user.fullName}
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
        <h2 className="text-2xl font-semibold text-green-800">{user.fullName}</h2>
        {isEditing ? (
          <>
            <span className="text-green-800 text-md">Edit Name</span>
            <input
              type="text"
              value={editFullName}
              onChange={e => setEditFullName(e.target.value)}
              className="mt-2 max-w-md w-full p-2 rounded border border-green-200 text-gray-700"
            />
          </>
        ) : (
          <p className="text-gray-600 text-center mt-2 max-w-md">{user.description}</p>
        )}
        {isEditing ? (
          <>
            <span className="text-green-800 text-md">Edit Description</span>
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                className="mt-2 max-w-md w-full p-2 rounded border border-green-200 text-gray-700"
                rows={3}
            />
          </>
        ) : (
          <p className="text-gray-600 text-center mt-2 max-w-md">{user.description}</p>
        )}
        {isEditing ? (
          <div className="flex gap-2 mt-4">
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={saveChangesToBackend}>
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
              {userPlantListings && userPlantListings.length > 0 ? (
                userPlantListings.map((listing: Plant) => (
                  <Card key={listing.id}>
                    <PlantCard
                      plant={listing}
                      // onClick={() => {}}
                    />
                  </Card>
                ))
              ) : (
                <div className="text-gray-500">No listings yet.</div>
              )}
            </div>
          </>
        )}

        {activeTab === "saved" && (
          <>
            <h3 className="text-lg font-medium text-green-700 mb-4">Saved Listings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {userSavedListings && userSavedListings.length > 0 ? (
                userSavedListings.map((listing: Plant) => (
                  <Card key={listing.id}>
                    <PlantCard
                      plant={listing}
                      // onClick={() => {}}
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

        {activeTab === "delete" && (
          <div className="p-6 bg-white rounded-lg shadow border border-green-100">
            <h3 className="text-lg font-medium text-green-700 mb-2">Delete Account</h3>
            <p className="text-gray-500 text-sm">Are you sure you want to delete your account? This action cannot be undone.</p>
            <Button onClick={handleDeleteAccount} className="bg-red-600 hover:bg-red-700 text-white">Delete Account</Button>
          </div>
        )}
        <AccountDeletedModal isOpen={showDeletedModal} onClose={() => {
          setShowDeletedModal(false);
          navigate("/");
        }} />
      </div>
    </div>
  );
}