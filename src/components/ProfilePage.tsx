import { useState, useEffect, ChangeEvent, useMemo, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { useIsMobile } from "../hooks/useIsMobile";
import { MobileActionBar } from "./MobileActionBar";

interface Review {
  rating: number;
  review: string;
}

// Helper to parse DynamoDB JSON format
function parseUserData(data: any) {
  const rawConsents = data.consents ?? {};
  return {
    userId: data.userId || "",
    fullName: data.fullName || "",
    joinedDate: data.joinedDate || "",
    profilePic: data.profilePic || "empty",
    description: data.description || "",
    subscription: data.subscription || "Free Plan",
    plantListingIds:
      data.plantListings && Array.isArray(data.plantListings) && data.plantListings.length > 0
        ? [...data.plantListings]
        : [],
    savedListingIds:
      data.savedListings && Array.isArray(data.savedListings) && data.savedListings.length > 0
        ? [...data.savedListings]
        : [],
    consents: {
      termsAcceptedAt: typeof rawConsents.termsAcceptedAt === "string" ? rawConsents.termsAcceptedAt : null,
      privacyAcceptedAt: typeof rawConsents.privacyAcceptedAt === "string" ? rawConsents.privacyAcceptedAt : null,
      marketingEmailOptIn: Boolean(rawConsents.marketingEmailOptIn),
      marketingSmsOptIn: Boolean(rawConsents.marketingSmsOptIn),
      marketingGlobalUnsubscribed: Boolean(rawConsents.marketingGlobalUnsubscribed),
    },
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
  consents: {
    termsAcceptedAt: null,
    privacyAcceptedAt: null,
    marketingEmailOptIn: false,
    marketingSmsOptIn: false,
    marketingGlobalUnsubscribed: false,
  },
  // reviews: [],
};

const baseSettingsTabs = [
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
  const [activeTab, setActiveTab] = useState("saved");
  const [userPlantListings, setUserPlantListings] = useState<Plant[]>([]);
  const [userSavedListings, setUserSavedListings] = useState<Plant[]>([]);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const { deleteAccount, role } = useAuth();
  const isSeller = role === "seller";
  const navigate = useNavigate();
  const isMobileView = useIsMobile();
  const [consentPreferences, setConsentPreferences] = useState({
    marketingEmailOptIn: initialUser.consents.marketingEmailOptIn,
    marketingSmsOptIn: initialUser.consents.marketingSmsOptIn,
  });
  const [isSavingConsents, setIsSavingConsents] = useState(false);
  const [consentFeedback, setConsentFeedback] = useState<
    | { type: "success" | "error"; message: string }
    | null
  >(null);
  const marketingGlobalUnsubscribed = user.consents?.marketingGlobalUnsubscribed ?? false;

  const formatConsentDate = (value: string | null) => {
    if (!value) {
      return "Pending acceptance";
    }
    try {
      return new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return value;
    }
  };

  const handleConsentPreferenceChange = (
    key: "marketingEmailOptIn" | "marketingSmsOptIn"
  ) =>
    (checked: boolean) => {
      setConsentPreferences((prev) => ({
        ...prev,
        [key]: checked,
      }));
      setConsentFeedback(null);
    };

  const settingsTabs = useMemo(
    () =>
      isSeller
        ? [{ key: "seller-dashboard", label: "Seller Dashboard" }, ...baseSettingsTabs]
        : baseSettingsTabs.filter((tab) => tab.key !== "listings"),
    [isSeller],
  );

  useEffect(() => {
    if (isSeller) {
      setActiveTab((prev) => (prev === "saved" ? "seller-dashboard" : prev));
    } else if (role === "buyer") {
      setActiveTab((prev) => (prev === "listings" || prev === "seller-dashboard" ? "saved" : prev));
    } else {
      setActiveTab((prev) => (prev === "seller-dashboard" ? "saved" : prev));
    }
  }, [isSeller, role]);

  useEffect(() => {
    const updateTabFromHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (!hash) {
        return;
      }
      const hasTab = settingsTabs.some((tab) => tab.key === hash);
      if (hasTab) {
        setActiveTab(hash);
      }
    };

    updateTabFromHash();
    window.addEventListener("hashchange", updateTabFromHash);
    return () => window.removeEventListener("hashchange", updateTabFromHash);
  }, [settingsTabs]);

  useEffect(() => {
    if (!settingsTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(settingsTabs[0]?.key ?? "saved");
    }
  }, [activeTab, settingsTabs]);

  useEffect(() => {
    setConsentPreferences({
      marketingEmailOptIn: user.consents.marketingEmailOptIn,
      marketingSmsOptIn: user.consents.marketingSmsOptIn,
    });
  }, [user.consents.marketingEmailOptIn, user.consents.marketingSmsOptIn]);

  // Fetch user data from API on mount
  useEffect(() => {
    async function fetchUserAndPlants() {
      try {
        const response = await apiClient.get(API_ENDPOINTS.USERS_READ, true); // Requires auth to read user data
        if (!response.ok) throw new Error("Failed to fetch user data");
        const data = await response.json();
        const parsed = parseUserData(data);

        // Fetch all plant data
        const plantsResponse = await apiClient.get(API_ENDPOINTS.PLANTS_READ, false); // Public endpoint
        if (!plantsResponse.ok) throw new Error("Failed to fetch plants data");
        const allPlants: Plant[] = await plantsResponse.json();

        // Filter plants for user's listings
        const userPlants = allPlants.filter((plant) => parsed.plantListingIds.includes(plant.id));
        const savedPlants = allPlants.filter((plant) => parsed.savedListingIds.includes(plant.id));

        setUserPlantListings(userPlants);
        setUserSavedListings(savedPlants);
        setUser({
          ...parsed,
          plantListings: userPlants,
          savedListings: savedPlants,
        });
        setEditDescription(parsed.description || "");
        setEditAvatar(parsed.profilePic);
        setEditFullName(parsed.fullName);
        setConsentPreferences({
          marketingEmailOptIn: parsed.consents.marketingEmailOptIn,
          marketingSmsOptIn: parsed.consents.marketingSmsOptIn,
        });
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
  };

  // Cancel editing
  const handleCancel = () => {
    setEditDescription(user.description);
    setEditAvatar(user.profilePic);
    setEditFullName(user.fullName);
    setIsEditing(false);
  };

  const saveConsentPreferences = async () => {
    setIsSavingConsents(true);
    setConsentFeedback(null);
    try {
      const response = await apiClient.put(
        API_ENDPOINTS.USERS_UPDATE,
        {
          consents: {
            ...user.consents,
            marketingEmailOptIn: consentPreferences.marketingEmailOptIn,
            marketingSmsOptIn: consentPreferences.marketingSmsOptIn,
          },
        },
        true,
      );

      if (!response.ok) {
        throw new Error("We couldn't update your communication preferences. Please try again.");
      }

      let updatedConsents = {
        ...user.consents,
        marketingEmailOptIn: consentPreferences.marketingEmailOptIn,
        marketingSmsOptIn: consentPreferences.marketingSmsOptIn,
      };

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (contentType.includes("application/json")) {
        try {
          const responseBody = await response.json();
          if (responseBody && typeof responseBody === "object") {
            const parsed = parseUserData(responseBody);
            updatedConsents = parsed.consents;
            setConsentPreferences({
              marketingEmailOptIn: parsed.consents.marketingEmailOptIn,
              marketingSmsOptIn: parsed.consents.marketingSmsOptIn,
            });
          }
        } catch (parseError) {
          console.warn("Unable to parse consent update response", parseError);
        }
      }

      setUser((prev) => ({
        ...prev,
        consents: {
          ...prev.consents,
          ...updatedConsents,
        },
      }));

      setConsentFeedback({
        type: "success",
        message: "Your communication preferences have been updated.",
      });
    } catch (error) {
      console.error(error);
      setConsentFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to update your preferences right now. Please try again later.",
      });
    } finally {
      setIsSavingConsents(false);
    }
  };

  // Save changes to backend
  const saveChangesToBackend = async () => {
    try {
      const response = await apiClient.put(
        API_ENDPOINTS.USERS_UPDATE,
        { fullName: editFullName, profilePic: editAvatar, description: editDescription },
        true, // Requires authentication
      );
      if (!response.ok) {
        throw new Error("Failed to save changes");
      }
      console.log("Changes saved successfully");
      // Update local state if needed
      setUser({
        ...user,
        fullName: editFullName,
        profilePic: editAvatar,
        description: editDescription,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving changes:", error);
    }
  };

  const handleTabSelection = (tabKey: string) => {
    setActiveTab(tabKey);
    navigate(`#${tabKey}`, { replace: true });
  };

  const renderPlantCollection = (collection: Plant[], emptyState: string) => {
    if (!collection || collection.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-green-200 bg-green-50/70 p-6 text-center text-sm text-green-700">
          {emptyState}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {collection.map((listing: Plant) => (
          <Card key={listing.id} className="overflow-hidden border border-green-100 shadow-sm">
            <PlantCard plant={listing} />
          </Card>
        ))}
      </div>
    );
  };

  const renderTabContent = (tabKey: string): ReactNode => {
    switch (tabKey) {
      case "seller-dashboard":
        if (!isSeller) {
          return null;
        }
        return (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm sm:p-5">
              <p className="text-xs uppercase tracking-wide text-gray-500">Active Listings</p>
              <p className="mt-2 text-2xl font-semibold text-green-700">{userPlantListings.length}</p>
              <p className="text-xs text-gray-500">Manage and update your plant listings.</p>
            </Card>
            <Card className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm sm:p-5">
              <p className="text-xs uppercase tracking-wide text-gray-500">Saved Leads</p>
              <p className="mt-2 text-2xl font-semibold text-green-700">{userSavedListings.length}</p>
              <p className="text-xs text-gray-500">Keep track of interested buyers.</p>
            </Card>
            <Card className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm sm:p-5">
              <p className="text-xs uppercase tracking-wide text-gray-500">Member Since</p>
              <p className="mt-2 text-2xl font-semibold text-green-700">{user.joinedDate || "—"}</p>
              <p className="text-xs text-gray-500">Grow your business with Thumr.</p>
            </Card>
          </div>
        );
      case "listings":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-green-800 sm:text-xl">My Listings</h3>
            {renderPlantCollection(userPlantListings, "No listings yet.")}
          </div>
        );
      case "saved":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-green-800 sm:text-xl">Saved Listings</h3>
            {renderPlantCollection(userSavedListings, "No saved listings yet.")}
          </div>
        );
      case "subscription":
        return (
          <Card className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-green-800">Subscription Plan</h3>
            <p className="mt-2 text-sm text-gray-600">
              Current Plan: <span className="font-semibold text-green-700">{user.subscription}</span>
            </p>
            <Button className="mt-4 bg-green-600 text-white hover:bg-green-700">Upgrade Plan</Button>
          </Card>
        );
      case "security":
        return (
          <Card className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-green-800">Password & Security</h3>
            <Button className="mt-4 bg-green-600 text-white hover:bg-green-700">Reset Password</Button>
            <p className="mt-2 text-sm text-gray-500">
              For account security, use a strong password and never share it.
            </p>
          </Card>
        );
      case "privacy":
        return (
          <Card className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-green-800">Privacy Settings</h3>
            <p className="mt-2 text-sm text-gray-600">
              Review how Thumr processes your personal data, the safeguards we apply, and the rights
              you have under privacy laws like the GDPR and CCPA.
            </p>
            <p className="mt-3 text-sm text-gray-600">
              Visit our
              <Link className="text-green-700 underline" to="/privacy">
                {" "}Privacy Policy
              </Link>
              {" "}to manage requests or update your preferences.
            </p>
            <div className="mt-6 space-y-5">
              <div className="rounded-xl border border-green-100 bg-green-50/60 p-4">
                <h4 className="text-sm font-semibold text-green-800">Required agreements</h4>
                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">Terms of Service</p>
                      <Link to="/terms" className="text-xs text-green-700 underline">
                        View terms
                      </Link>
                    </div>
                    <span className="text-xs uppercase tracking-wide text-gray-500">
                      {formatConsentDate(user.consents.termsAcceptedAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">Privacy Policy</p>
                      <Link to="/privacy" className="text-xs text-green-700 underline">
                        View policy
                      </Link>
                    </div>
                    <span className="text-xs uppercase tracking-wide text-gray-500">
                      {formatConsentDate(user.consents.privacyAcceptedAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">Email updates</h4>
                    <p className="text-xs text-gray-500">
                      Get seasonal tips, product launches, and curated plant guides.
                    </p>
                  </div>
                  <Switch
                    id="profile-marketing-email"
                    checked={consentPreferences.marketingEmailOptIn}
                    disabled={marketingGlobalUnsubscribed || isSavingConsents}
                    onCheckedChange={handleConsentPreferenceChange("marketingEmailOptIn")}
                  />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">Text messages</h4>
                    <p className="text-xs text-gray-500">
                      Receive limited-time offers and alerts about plants on your wishlist.
                    </p>
                  </div>
                  <Switch
                    id="profile-marketing-sms"
                    checked={consentPreferences.marketingSmsOptIn}
                    disabled={marketingGlobalUnsubscribed || isSavingConsents}
                    onCheckedChange={handleConsentPreferenceChange("marketingSmsOptIn")}
                  />
                </div>
                {marketingGlobalUnsubscribed && (
                  <p className="mt-3 text-xs text-amber-600">
                    You used a global unsubscribe link, so marketing messages are disabled. Contact
                    support if you would like to re-subscribe.
                  </p>
                )}
                <Button
                  className="mt-4 bg-green-600 text-white hover:bg-green-700"
                  onClick={saveConsentPreferences}
                  disabled={isSavingConsents || marketingGlobalUnsubscribed}
                >
                  {isSavingConsents ? "Saving preferences..." : "Save communication preferences"}
                </Button>
                {consentFeedback && (
                  <p
                    className={`mt-3 text-sm ${
                      consentFeedback.type === "success" ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {consentFeedback.message}
                  </p>
                )}
              </div>
            </div>
          </Card>
        );
      case "help":
        return (
          <Card className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-green-800">Help & Support</h3>
            <p className="mt-2 text-sm text-gray-600">
              Need help? Visit our <a href="#" className="text-green-600 underline">Help Center</a> or contact support.
            </p>
            <Button className="mt-4 bg-green-600 text-white hover:bg-green-700">Contact Support</Button>
          </Card>
        );
      case "about":
        return (
          <Card className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-green-800">About Thumr</h3>
            <p className="mt-2 text-sm text-gray-600">
              Thumr is a community for plant lovers to buy, sell, and trade plants. Our mission is to connect people through greenery!
            </p>
          </Card>
        );
      case "feedback":
        return (
          <Card className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-green-800">Send Feedback</h3>
            <Textarea
              className="mt-3 min-h-[120px]"
              rows={3}
              placeholder="Let us know your thoughts..."
            />
            <Button className="mt-4 bg-green-600 text-white hover:bg-green-700">Submit Feedback</Button>
          </Card>
        );
      case "terms":
        return (
          <Card className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-green-800">Terms of Service</h3>
            <p className="mt-2 text-sm text-gray-600">
              Understand your obligations when buying or selling plants, including plant-shipping
              liability and compliance with marketplace rules.
            </p>
            <p className="mt-3 text-sm text-gray-600">
              Review the full
              <Link className="text-green-700 underline" to="/terms">
                {" "}Terms of Service
              </Link>
              {" "}before listing or purchasing.
            </p>
          </Card>
        );
      case "delete":
        return (
          <Card className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-green-800">Delete Account</h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete your account? This action cannot be undone.
            </p>
            <Button onClick={handleDeleteAccount} className="mt-4 bg-red-600 text-white hover:bg-red-700">
              Delete Account
            </Button>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32 pt-8 sm:pb-20">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 sm:px-6">
        <section className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <img
                src={isEditing ? editAvatar : user?.profilePic.replace("'", "").replace("https://dev.thumr.com/", "")}
                alt={user.fullName}
                className="h-24 w-24 rounded-full border-4 border-green-200 object-cover sm:h-28 sm:w-28"
              />
              {isEditing && (
                <label className="absolute bottom-1 right-1 cursor-pointer rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white shadow">
                  Change
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
              )}
            </div>
            <div className="mt-4 flex w-full max-w-xl flex-col items-center gap-3">
              <h2 className="text-2xl font-semibold text-green-900 sm:text-3xl">{user.fullName}</h2>
              {role && (
                <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-700">
                  {role} account
                </span>
              )}

              {isEditing ? (
                <div className="w-full space-y-4 text-left">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-name" className="text-sm font-medium text-green-900">
                      Display name
                    </Label>
                    <Input
                      id="profile-name"
                      type="text"
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="bg-green-50/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-bio" className="text-sm font-medium text-green-900">
                      Bio
                    </Label>
                    <Textarea
                      id="profile-bio"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                      className="min-h-[120px] bg-green-50/40"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <Button className="bg-green-600 text-white hover:bg-green-700" onClick={saveChangesToBackend}>
                      Save changes
                    </Button>
                    <Button variant="outline" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button variant="ghost" onClick={handleSave}>
                      Save locally
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="max-w-2xl text-sm text-gray-600 sm:text-base">
                    {user.description || "Share a short bio to connect with the community."}
                  </p>
                  <Button className="bg-green-600 text-white hover:bg-green-700" onClick={() => setIsEditing(true)}>
                    Edit Profile
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="w-full">
          {isMobileView ? (
            <Accordion
              type="single"
              collapsible
              value={activeTab}
              onValueChange={(value) => value && handleTabSelection(value)}
              className="overflow-hidden rounded-2xl border border-green-100 bg-white"
            >
              {settingsTabs.map((tab) => (
                <AccordionItem key={tab.key} value={tab.key}>
                  <AccordionTrigger className="px-4 text-left text-base font-semibold text-green-900">
                    {tab.label}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4">{renderTabContent(tab.key)}</div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {settingsTabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? "bg-green-600 text-white shadow"
                        : "bg-green-50 text-green-700 hover:bg-green-100"
                    }`}
                    onClick={() => handleTabSelection(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="mt-6 space-y-4">{renderTabContent(activeTab)}</div>
            </div>
          )}
        </section>
      </div>

      <AccountDeletedModal
        isOpen={showDeletedModal}
        onClose={() => {
          setShowDeletedModal(false);
          navigate("/");
        }}
      />
      <MobileActionBar />
    </div>
  );
}
