import { useState, useRef, useEffect, type ReactNode } from 'react';
import {
  Heart,
  MapPin,
  User,
  MessageCircle,
  Star,
  Shield,
  ArrowLeft,
  ShoppingCart,
  Send,
  Loader2,
  CheckCircle2,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { StarRating } from "./StarRating";
import { EditListingScreen } from './EditListingScreen';
import type { Plant } from '../interfaces/Plant';
import { useCart } from '../contexts/CartContext';
import { API_ENDPOINTS } from '../config/amplify';
import { apiClient } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Textarea } from './ui/textarea';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from './ui/drawer';
import { messagesService } from '../services/messages';
import type { MessageThread, ThreadMessage } from '../services/messages';
import { reviewsService } from '../services/reviews';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { analyticsService } from '../services/analytics';
import {
  DELIVERY_METHOD_LABEL_LOOKUP,
  extractStateCode,
  formatZipRange,
  getProhibitedStateMessage,
} from '../constants/fulfillmentRules';
import {
  buildComplianceContext,
  formatRestrictedStatesSummary,
  getComplianceHighlights,
  hasCompliance,
} from '../utils/compliance';

interface PlantDetailModalProps {
  plant: Plant | null;
  isOpen: boolean;
  onClose: () => void;
  onPlantUpdate?: (plant: Plant) => void;
  presentation?: 'modal' | 'page';
}

interface SubmittedReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export function PlantDetailModal({
  plant,
  isOpen,
  onClose,
  onPlantUpdate,
  presentation = 'modal',
}: PlantDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const isMobileView = useIsMobile();
  const [isReviewScreenOpen, setIsReviewScreenOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [isEditListingScreenOpen, setIsEditListingScreenOpen] = useState(false);
  const [showBackAlert, setShowBackAlert] = useState(false);
  const [currentPlant, setCurrentPlant] = useState<Plant | null>(plant);
  const { addItem, isInCart } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [conversationThread, setConversationThread] = useState<MessageThread | null>(null);
  const [isConversationOpen, setIsConversationOpen] = useState(false);
  const [isContactingSeller, setIsContactingSeller] = useState(false);
  const [newMessageBody, setNewMessageBody] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [submittedReviews, setSubmittedReviews] = useState<SubmittedReview[]>([]);
  const [showReviewSuccessBanner, setShowReviewSuccessBanner] = useState(false);
  const [hasAttemptedReviewSubmit, setHasAttemptedReviewSubmit] = useState(false);
  const [reviewErrors, setReviewErrors] = useState<{ rating?: string; comment?: string }>({});
  const [touchedReviewFields, setTouchedReviewFields] = useState({ rating: false, comment: false });
  const messageListRef = useRef<HTMLDivElement | null>(null);

  // Sync plantName and currentPlant when plant prop changes
  useEffect(() => {
    setCurrentPlant(plant);
    setConversationThread(null);
    setIsConversationOpen(false);
    setNewMessageBody('');
    setIsContactingSeller(false);
    setIsSendingMessage(false);
    setIsSubmittingReview(false);
    setSubmittedReviews([]);
    setShowReviewSuccessBanner(false);
    setHasAttemptedReviewSubmit(false);
    setReviewErrors({});
    setTouchedReviewFields({ rating: false, comment: false });
  }, [plant]);

  // Reset all states when modal closes
  const handleClose = () => {
    setCurrentImageIndex(0);
    setIsReviewScreenOpen(false);
    setIsEditListingScreenOpen(false);
    setReviewRating(0);
    setReviewComment("");
    setShowBackAlert(false);
    setIsConversationOpen(false);
    setConversationThread(null);
    setNewMessageBody('');
    setIsContactingSeller(false);
    setIsSendingMessage(false);
    setIsSubmittingReview(false);
    setSubmittedReviews([]);
    setShowReviewSuccessBanner(false);
    setHasAttemptedReviewSubmit(false);
    setReviewErrors({});
    setTouchedReviewFields({ rating: false, comment: false });
    onClose();
  };

  const messageCount = conversationThread?.messages?.length ?? 0;
  const isPagePresentation = presentation === 'page';

  useEffect(() => {
    if (!isConversationOpen) {
      return;
    }
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [isConversationOpen, messageCount]);

  useEffect(() => {
    if (!isConversationOpen || !conversationThread) {
      return;
    }

    const markThreadAsRead = async () => {
      try {
        await messagesService.markThreadRead(conversationThread.id);
      } catch (error) {
        console.error('Failed to mark conversation as read', error);
      }
    };

    markThreadAsRead();
  }, [isConversationOpen, conversationThread]);

  useEffect(() => {
    if (
      !hasAttemptedReviewSubmit &&
      !touchedReviewFields.rating &&
      !touchedReviewFields.comment
    ) {
      return;
    }

    setReviewErrors((previousErrors) => {
      const nextErrors = computeReviewErrors(reviewRating, reviewComment);

      if (
        previousErrors.rating === nextErrors.rating &&
        previousErrors.comment === nextErrors.comment
      ) {
        return previousErrors;
      }

      return nextErrors;
    });
  }, [
    hasAttemptedReviewSubmit,
    touchedReviewFields.rating,
    touchedReviewFields.comment,
    reviewRating,
    reviewComment,
  ]);

  if (!currentPlant) return null;

  const alreadyInCart = isInCart(currentPlant.id);
  const deliveryMethods = Array.isArray(currentPlant.deliveryMethods)
    ? currentPlant.deliveryMethods
    : [];
  const zipRanges = Array.isArray(currentPlant.availableZipRanges)
    ? currentPlant.availableZipRanges
    : [];
  const formattedZipRanges = zipRanges
    .map((range) => {
      if (!range || typeof range.start !== 'string' || typeof range.end !== 'string') {
        return null;
      }
      return formatZipRange({ start: range.start, end: range.end });
    })
    .filter((value): value is string => Boolean(value));
  const packagingNotes = (currentPlant.packagingNotes ?? '').trim();
  const normalizedWarranty = currentPlant.livePlantWarranty ?? { isOffered: false };
  const normalizedSpecies = currentPlant.species ? currentPlant.species.trim() : '';
  const normalizedCultivar = currentPlant.cultivar ? currentPlant.cultivar.trim() : '';
  const normalizedUsdaZone = currentPlant.usdaZone
    ? String(currentPlant.usdaZone).trim().toUpperCase()
    : '';
  const normalizedLightPreference = currentPlant.lightPreference
    ? currentPlant.lightPreference.trim()
    : '';
  const normalizedSoilPreference = currentPlant.soilPreference
    ? currentPlant.soilPreference.trim()
    : '';
  const hasTaxonomyDetails = Boolean(
    normalizedSpecies || normalizedCultivar || normalizedUsdaZone,
  );
  const hasCarePreferenceDetails = Boolean(
    normalizedLightPreference || normalizedSoilPreference,
  );
  const hasTaxonomyOrCareDetails = hasTaxonomyDetails || hasCarePreferenceDetails;
  const hasWarrantyDetails =
    normalizedWarranty.isOffered ||
    typeof normalizedWarranty.durationDays === 'number' ||
    Boolean(normalizedWarranty.notes);
  const complianceContext = buildComplianceContext(
    currentPlant.compliance,
    currentPlant.livePlantWarranty,
  );
  const complianceHighlights = getComplianceHighlights(
    currentPlant.compliance,
    currentPlant.livePlantWarranty,
  );
  const hasComplianceDetails = hasCompliance(complianceContext);
  const hasFulfillmentDetails =
    deliveryMethods.length > 0 ||
    formattedZipRanges.length > 0 ||
    Boolean(packagingNotes) ||
    hasWarrantyDetails ||
    hasComplianceDetails;
  const locationStateCode = extractStateCode(currentPlant.location);
  const prohibitedStateMessage = getProhibitedStateMessage(locationStateCode, deliveryMethods);

  const formatReviewTimestamp = (timestamp: string) => {
    const submittedAt = new Date(timestamp);
    if (Number.isNaN(submittedAt.getTime())) {
      return 'Just now';
    }

    const diffInMs = Date.now() - submittedAt.getTime();
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffInMs < minute) {
      return 'Just now';
    }

    if (diffInMs < hour) {
      const minutes = Math.floor(diffInMs / minute);
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }

    if (diffInMs < day) {
      const hours = Math.floor(diffInMs / hour);
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }

    try {
      return submittedAt.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return submittedAt.toISOString();
    }
  };

  const renderSubmittedReviewStars = (rating: number) => (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const isActive = index < Math.round(rating);
        return (
          <Star
            key={index}
            className={`h-4 w-4 ${
              isActive ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
            }`}
          />
        );
      })}
    </div>
  );

  const computeReviewErrors = (rating: number, comment: string) => {
    const errors: { rating?: string; comment?: string } = {};
    if (rating <= 0) {
      errors.rating = 'Please select a rating to continue.';
    }

    if (!comment.trim()) {
      errors.comment = 'Please share a few words about your experience.';
    }

    return errors;
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'New': return 'bg-green-100 text-green-800';
      case 'Like New': return 'bg-emerald-100 text-emerald-800';
      case 'Good': return 'bg-yellow-100 text-yellow-800';
      case 'Fair': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleReviewBack = (reviewComment: string, reviewRating: number) => {
    if (reviewRating > 0 || reviewComment.trim() !== "") {
      setShowBackAlert(true);
    } else {
      setIsReviewScreenOpen(false);
      setReviewRating(0);
      setReviewComment("");
      setTouchedReviewFields({ rating: false, comment: false });
      setHasAttemptedReviewSubmit(false);
      setReviewErrors({});
    }
  };

  const handleBackConfirm = () => {
    setShowBackAlert(false);
    setIsReviewScreenOpen(false);
    setReviewRating(0);
    setReviewComment("");
    setTouchedReviewFields({ rating: false, comment: false });
    setHasAttemptedReviewSubmit(false);
    setReviewErrors({});
  };

  const handleBackCancel = () => {
    setShowBackAlert(false);
  };

  const openConversation = async (thread: MessageThread) => {
    const normalizedThread: MessageThread = {
      ...thread,
      messages: thread.messages ?? [],
    };

    setConversationThread(normalizedThread);

    if (isMobileView) {
      try {
        await messagesService.markThreadRead(normalizedThread.id);
      } catch (error) {
        console.error('Failed to mark conversation as read', error);
      }

      navigate(`/messages/${normalizedThread.id}`, {
        state: { plantId: currentPlant?.id },
      });
    } else {
      setIsConversationOpen(true);
    }
  };

  const handleContactSeller = async () => {
    if (!currentPlant) {
      return;
    }

    if (!isAuthenticated) {
      toast.error('Please sign in to contact the seller.');
      navigate('/login', {
        state: { from: { pathname: '/messages', plantId: currentPlant.id } },
      });
      return;
    }

    if (isContactingSeller) {
      return;
    }

    setIsContactingSeller(true);

    try {
      const thread = await messagesService.startThread({
        plantId: currentPlant.id,
        sellerId: currentPlant.sellerId ?? currentPlant.seller,
      });

      await openConversation(thread);
      toast.success('Conversation ready. Start messaging the seller!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start the conversation.';
      toast.error(message);
    } finally {
      setIsContactingSeller(false);
    }
  };

  const handleSendMessage = async () => {
    if (!conversationThread) {
      return;
    }

    if (!isAuthenticated) {
      toast.error('Please sign in to send messages.');
      navigate('/login', { state: { from: { pathname: '/messages' } } });
      return;
    }

    const trimmedMessage = newMessageBody.trim();

    if (!trimmedMessage || isSendingMessage) {
      return;
    }

    const optimisticMessage: ThreadMessage = {
      id: `temp-${Date.now()}`,
      threadId: conversationThread.id,
      body: trimmedMessage,
      senderId: 'me',
      senderType: 'buyer',
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    setConversationThread(prev => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        messages: [...(prev.messages ?? []), optimisticMessage],
      };
    });

    setNewMessageBody('');
    setIsSendingMessage(true);

    try {
      const persistedMessage = await messagesService.sendMessage({
        threadId: conversationThread.id,
        body: trimmedMessage,
      });

      setConversationThread(prev => {
        if (!prev) {
          return prev;
        }

        const messages = prev.messages ?? [];
        const updatedMessages = messages.map(message =>
          message.id === optimisticMessage.id ? persistedMessage : message
        );

        if (!updatedMessages.some(message => message.id === persistedMessage.id)) {
          updatedMessages[updatedMessages.length - 1] = persistedMessage;
        }

        return {
          ...prev,
          messages: updatedMessages,
        };
      });
    } catch (error) {
      setConversationThread(prev => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          messages: (prev.messages ?? []).filter(message => message.id !== optimisticMessage.id),
        };
      });

      setNewMessageBody(trimmedMessage);

      const message = error instanceof Error ? error.message : 'Unable to send the message.';
      toast.error(message);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleAddReview = () => {
    if (!currentPlant) {
      return;
    }

    if (!isAuthenticated) {
      toast.error('Please sign in to leave a review.');
      navigate('/login', {
        state: { from: { pathname: '/', action: 'add-review', plantId: currentPlant.id } },
      });
      return;
    }

    setIsReviewScreenOpen(true);
  };

  const handleReviewSubmit = async () => {
    if (!currentPlant) {
      return;
    }

    setHasAttemptedReviewSubmit(true);

    const validationErrors = computeReviewErrors(reviewRating, reviewComment);
    setReviewErrors(validationErrors);

    if (validationErrors.rating || validationErrors.comment) {
      return;
    }

    const previousPlantState = currentPlant;
    const existingReviewCount = currentPlant.sellerReviewCount ?? 0;
    const optimisticReviewCount = existingReviewCount + 1;
    const weightedRating = ((currentPlant.sellerRating ?? 0) * existingReviewCount) + reviewRating;
    const optimisticRating = optimisticReviewCount > 0 ? weightedRating / optimisticReviewCount : reviewRating;

    const optimisticPlant: Plant = {
      ...currentPlant,
      sellerRating: Number(optimisticRating.toFixed(2)),
      sellerReviewCount: optimisticReviewCount,
    };

    setCurrentPlant(optimisticPlant);
    onPlantUpdate?.(optimisticPlant);
    setIsSubmittingReview(true);

    try {
      const trimmedComment = reviewComment.trim();
      const response = await reviewsService.submitReview({
        plantId: currentPlant.id,
        rating: reviewRating,
        comment: trimmedComment,
      });

      let nextRating = typeof response.sellerRating === 'number' ? response.sellerRating : optimisticPlant.sellerRating;
      let nextCount = typeof response.totalReviews === 'number' ? response.totalReviews : optimisticPlant.sellerReviewCount;

      if (nextRating === undefined || nextCount === undefined) {
        try {
          const summary = await reviewsService.getReviewSummary(currentPlant.id);
          nextRating = summary.sellerRating ?? nextRating;
          nextCount = summary.totalReviews ?? nextCount;
        } catch (summaryError) {
          console.warn('Failed to refresh review summary', summaryError);
        }
      }

      const updatedPlant: Plant = {
        ...optimisticPlant,
        sellerRating: typeof nextRating === 'number' ? nextRating : optimisticPlant.sellerRating,
        sellerReviewCount: typeof nextCount === 'number' ? nextCount : optimisticPlant.sellerReviewCount,
      };

      setCurrentPlant(updatedPlant);
      onPlantUpdate?.(updatedPlant);
      const resolvedRating = typeof response.rating === 'number' ? response.rating : reviewRating;
      const resolvedComment =
        typeof response.comment === 'string' && response.comment.trim()
          ? response.comment.trim()
          : trimmedComment;
      const newReview: SubmittedReview = {
        id: response.reviewId ?? `temp-${Date.now()}`,
        rating: resolvedRating,
        comment: resolvedComment,
        createdAt: new Date().toISOString(),
      };

      setSubmittedReviews((existing) => {
        const alreadyPresent = existing.some((review) => review.id === newReview.id);
        if (alreadyPresent) {
          return existing.map((review) => (review.id === newReview.id ? newReview : review));
        }
        return [newReview, ...existing];
      });
      setShowReviewSuccessBanner(true);
      toast.success('Review submitted successfully.');
      setIsReviewScreenOpen(false);
      setReviewRating(0);
      setReviewComment('');
      setShowBackAlert(false);
      setTouchedReviewFields({ rating: false, comment: false });
      setHasAttemptedReviewSubmit(false);
      setReviewErrors({});
    } catch (error) {
      setCurrentPlant(previousPlantState);
      onPlantUpdate?.(previousPlantState);
      const message = error instanceof Error ? error.message : 'Failed to submit review.';
      analyticsService.track('review_submission_failed', {
        plantId: currentPlant.id,
        error: message,
        rating: reviewRating,
        commentLength: reviewComment.trim().length,
      });
      toast.error(message, {
        action: {
          label: 'Retry',
          onClick: () => {
            void handleReviewSubmit();
          },
        },
      });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleListingSave = async (
    updatedPlant: Plant,
    changedFields: Set<keyof Plant>,
  ) => {
    // Only send the fields that were actually changed
    const changedData: Partial<Record<keyof Plant, Plant[keyof Plant]>> = {};

    // Build object with only changed fields
    changedFields.forEach((field) => {
      changedData[field] = updatedPlant[field];
    });
    
    // Only make API call if there are changes
    if (changedFields.size > 0) {
      console.log('Sending changed fields:', changedData);
      
      try {
        const response = await apiClient.put(
          `${API_ENDPOINTS.PLANTS_UPDATE}?plantId=${updatedPlant.id}`,
          changedData,
          true // Requires authentication to update plants
        );
        
        if (!response.ok) {
          throw new Error('Failed to save changes');
        }
        
        console.log('Successfully saved changes');
        // Update the local state with the new plant data
        setCurrentPlant(updatedPlant);
        onPlantUpdate?.(updatedPlant);
      } catch (error) {
        console.error('Error saving changes:', error);
        alert('Failed to save changes. Please try again.');
        return;
      }
    } else {
      console.log('No changes to save');
    }
    
    setIsEditListingScreenOpen(false);
  };

  const renderImageGallery = () => (
    <div className="space-y-4">
      <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
        <ImageWithFallback
          src={Array.isArray(currentPlant?.images) ? currentPlant.images[currentImageIndex] : currentPlant?.images}
          alt={currentPlant?.name ?? 'Plant image'}
          className="h-full w-full object-cover"
        />
      </div>

      {Array.isArray(currentPlant?.images) && currentPlant.images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {currentPlant.images.map((image, index) => (
            <button
              key={index}
              onClick={() => setCurrentImageIndex(index)}
              className={`flex-shrink-0 h-16 w-16 overflow-hidden rounded-md border-2 ${
                index === currentImageIndex ? 'border-green-500' : 'border-gray-200'
              }`}
            >
              <ImageWithFallback
                src={image}
                alt={`${currentPlant?.name ?? 'Plant'} ${index + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderDetailSections = (options?: { showBackButton?: boolean }) => (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {options?.showBackButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-10 w-10 rounded-full border border-border"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back to listings</span>
              </Button>
            )}
            <h1 className="text-2xl font-semibold">{currentPlant?.name}</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsLiked(!isLiked)}
            className="h-10 w-10 rounded-full border border-border"
          >
            <Heart className={`h-5 w-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
            <span className="sr-only">{isLiked ? 'Remove from favorites' : 'Save listing'}</span>
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <span className="text-2xl font-bold text-green-600">
              ${currentPlant?.price ?? 0}
            </span>
            {currentPlant?.condition && (
              <Badge className={getConditionColor(currentPlant.condition)} variant="secondary">
                {currentPlant.condition}
              </Badge>
            )}
            {currentPlant?.category && <Badge variant="outline">{currentPlant.category}</Badge>}
          </div>

          <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:items-end">
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{currentPlant?.location}</span>
            </div>
            <Button
              className="w-full rounded-full bg-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 sm:w-auto"
              onClick={() => setIsEditListingScreenOpen(true)}
            >
              Edit Listing
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={currentPlant?.sellerAvatar} />
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{currentPlant?.seller}</p>
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="text-sm text-muted-foreground">
                {currentPlant?.sellerRating} rating
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-green-600">
          <Shield className="h-4 w-4" />
          <span>Verified Seller</span>
        </div>
      </div>

      <Separator />

      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-muted-foreground">Pot Size:</span>
            <p className="font-medium">{currentPlant?.potSize}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Height:</span>
            <p className="font-medium">{currentPlant?.height}</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-base font-semibold text-green-700">Taxonomy &amp; Growing Preferences</h3>
          {hasTaxonomyOrCareDetails ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <span className="text-muted-foreground">Species:</span>
                  <p className="font-medium">{normalizedSpecies || 'Not specified'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cultivar:</span>
                  <p className="font-medium">{normalizedCultivar || 'Not specified'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">USDA zone:</span>
                  <p className="font-medium">{normalizedUsdaZone || 'Not specified'}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-muted-foreground">Light preference:</span>
                  <p className="font-medium">{normalizedLightPreference || 'Not specified'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Soil preference:</span>
                  <p className="font-medium">{normalizedSoilPreference || 'Not specified'}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Seller has not provided detailed taxonomy or care preferences for this listing yet.
            </p>
          )}
        </div>

        {currentPlant?.description && (
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-green-700">Description</h3>
            <p className="leading-relaxed text-muted-foreground whitespace-pre-line">
              {currentPlant.description}
            </p>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span>Safe &amp; secure checkout guaranteed</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Star className="h-4 w-4 text-yellow-400" />
          <span>Over {currentPlant?.sellerReviewCount ?? 0} verified reviews</span>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Seller Rating</span>
          <div className="flex items-center gap-1 text-sm font-semibold">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span>{currentPlant?.sellerRating}</span>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Based on {currentPlant?.sellerReviewCount ?? 0} reviews
        </div>
      </div>

      {submittedReviews.length > 0 && (
        <div className="space-y-3 rounded-lg border border-green-100 bg-green-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-green-700">Your community review</h3>
              <p className="text-xs text-green-800/80">
                Shared instantly with growers exploring this seller.
              </p>
            </div>
            <Badge variant="outline" className="border-green-200 bg-white text-green-700">
              New
            </Badge>
          </div>
          <div className="space-y-3">
            {submittedReviews.map((review) => {
              const ratingLabel = Number.isInteger(review.rating)
                ? review.rating.toString()
                : review.rating.toFixed(1);
              return (
                <div
                  key={review.id}
                  className="space-y-3 rounded-md bg-white/80 p-4 shadow-sm shadow-green-100"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-green-700">
                      {renderSubmittedReviewStars(review.rating)}
                      <span className="text-sm font-semibold">{ratingLabel}</span>
                      <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                        You
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatReviewTimestamp(review.createdAt)}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">
                      {review.comment}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Separator />

      <div className="space-y-4 text-sm">
        <div>
          <h3 className="text-base font-semibold text-green-700">Shipping &amp; Delivery</h3>
          <p className="text-sm text-gray-600">
            Fulfillment guidance approved for this listing.
          </p>
        </div>
        <div className="space-y-3">
          {deliveryMethods.length > 0 && (
            <div>
              <span className="text-muted-foreground">Available methods:</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {deliveryMethods.map((method) => (
                  <Badge
                    key={method}
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-emerald-700"
                  >
                    {DELIVERY_METHOD_LABEL_LOOKUP.get(method) ?? method.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {formattedZipRanges.length > 0 && (
            <div>
              <span className="text-muted-foreground">Ship-to ZIP ranges:</span>
              <p className="mt-1">{formattedZipRanges.join(', ')}</p>
            </div>
          )}
          {packagingNotes && (
            <div>
              <span className="text-muted-foreground">Packaging notes:</span>
              <p className="mt-1 whitespace-pre-line">{packagingNotes}</p>
            </div>
          )}
          {hasComplianceDetails && (
            <div className="space-y-2">
              <span className="text-muted-foreground">Compliance notices:</span>
              {complianceHighlights.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {complianceHighlights.map((highlight) => (
                    <Badge
                      key={highlight}
                      variant="outline"
                      className="border-amber-200 bg-amber-50 text-amber-900"
                    >
                      {highlight}
                    </Badge>
                  ))}
                </div>
              )}
              {complianceContext.restrictedStates.length > 0 && (
                <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-900">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Restricted destinations</AlertTitle>
                  <AlertDescription className="space-y-1 text-rose-900/90">
                    <p>
                      Seller cannot ship to: {formatRestrictedStatesSummary(complianceContext.restrictedStates)}.
                    </p>
                    <p className="text-xs">
                      {complianceContext.restrictedStatesAcknowledged
                        ? 'Seller confirmed these orders will be cancelled automatically.'
                        : 'Contact the seller before ordering to these states.'}
                    </p>
                  </AlertDescription>
                </Alert>
              )}
              {complianceContext.requiresPhytosanitaryCertificate && (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                  <Shield className="h-4 w-4" />
                  <AlertTitle>Phytosanitary certificate</AlertTitle>
                  <AlertDescription className="space-y-1 text-amber-900/90">
                    <p>
                      {complianceContext.phytosanitaryAcknowledged
                        ? 'Seller will include the required certification for regulated destinations.'
                        : 'A certificate may be required—confirm details with the seller before purchase.'}
                    </p>
                    {complianceContext.phytosanitaryDetails && (
                      <p className="text-xs">{complianceContext.phytosanitaryDetails}</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              {complianceContext.arrivalGuaranteeOffered && (
                <Alert
                  className={
                    'border ' +
                    (complianceContext.arrivalGuaranteeAcknowledged
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-amber-200 bg-amber-50 text-amber-900')
                  }
                >
                  {complianceContext.arrivalGuaranteeAcknowledged ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <AlertTitle>Arrival guarantee</AlertTitle>
                  <AlertDescription className="text-sm">
                    {complianceContext.arrivalGuaranteeAcknowledged
                      ? 'Seller confirmed they will honor the advertised live-arrival guarantee.'
                      : 'Seller advertises a live-arrival guarantee—request written confirmation before checkout.'}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          {hasWarrantyDetails ? (
            <div>
              <span className="text-muted-foreground">Live-plant warranty:</span>
              <p className="mt-1">
                {normalizedWarranty.isOffered
                  ? `Warranty offered${
                      normalizedWarranty.durationDays
                        ? ` for ${normalizedWarranty.durationDays} day${
                            normalizedWarranty.durationDays === 1 ? '' : 's'
                          }`
                        : ''
                    }.`
                  : 'No live-plant warranty advertised.'}
              </p>
              {normalizedWarranty.notes && (
                <p className="mt-1 whitespace-pre-line">{normalizedWarranty.notes}</p>
              )}
            </div>
          ) : null}
          {!hasFulfillmentDetails && (
            <p className="text-muted-foreground">
              Seller has not published shipping, delivery, or warranty details for this listing yet.
            </p>
          )}
          {!hasWarrantyDetails && hasFulfillmentDetails && (
            <div>
              <span className="text-muted-foreground">Live-plant warranty:</span>
              <p className="mt-1">No live-plant warranty advertised.</p>
            </div>
          )}
        </div>
        {prohibitedStateMessage && (
          <Alert variant="destructive">
            <AlertTitle>Shipping restriction</AlertTitle>
            <AlertDescription>{prohibitedStateMessage}</AlertDescription>
          </Alert>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <Button
          className="w-full bg-green-600 py-3 text-base hover:bg-green-700"
          onClick={() => currentPlant && addItem(currentPlant)}
        >
          <ShoppingCart className="mr-2 h-5 w-5" />
          {alreadyInCart ? 'Add another to cart' : 'Add to cart'}
        </Button>
        <Button
          className="w-full bg-green-600 py-3 text-base hover:bg-green-700"
          onClick={handleContactSeller}
          disabled={isContactingSeller}
        >
          {isContactingSeller ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <MessageCircle className="mr-2 h-5 w-5" />
              Contact Seller
            </>
          )}
        </Button>
        <Button
          className="w-full bg-green-600 py-3 text-base hover:bg-green-700"
          onClick={handleAddReview}
        >
          Add Review
        </Button>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={handleContactSeller}
            disabled={isContactingSeller}
            className="py-3 text-base"
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            {isContactingSeller ? 'Opening...' : 'Message'}
          </Button>
          <Button variant="outline" className="py-3 text-base">
            Make Offer
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Posted {currentPlant?.postedDate}
      </p>
    </div>
  );


  const renderDefaultBody = () => (
    <div className="flex flex-col md:gap-10 gap-6 pt-4">
      <section className="flex flex-col gap-6">{renderImageGallery()}</section>
      <section className="flex flex-col gap-6">
        {showReviewSuccessBanner && (
          <Alert className="border-green-200 bg-green-50 text-green-900">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" aria-hidden="true" />
              <div className="flex-1">
                <AlertTitle>Thanks for your review!</AlertTitle>
                <AlertDescription>
                  Your feedback is now visible to future buyers below.
                </AlertDescription>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewSuccessBanner(false)}
                className="rounded-full p-1 text-green-700 transition hover:bg-green-100"
                aria-label="Dismiss review success"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </Alert>
        )}
        {renderDetailSections({ showBackButton: !isPagePresentation })}
      </section>
    </div>
  );

  const isReviewValid = reviewRating > 0 && reviewComment.trim().length > 0;

  const handleReviewRatingChange = (value: number) => {
    if (!touchedReviewFields.rating) {
      setTouchedReviewFields((prev) => ({ ...prev, rating: true }));
    }
    setReviewRating(value);
  };

  const handleReviewCommentChange = (value: string) => {
    if (!touchedReviewFields.comment) {
      setTouchedReviewFields((prev) => ({ ...prev, comment: true }));
    }
    setReviewComment(value);
  };

  const renderReviewBody = () => {
    const missingRating = reviewRating <= 0;
    const missingComment = reviewComment.trim().length === 0;
    const showRatingError = Boolean(reviewErrors.rating) && (hasAttemptedReviewSubmit || touchedReviewFields.rating);
    const showCommentError = Boolean(reviewErrors.comment) && (hasAttemptedReviewSubmit || touchedReviewFields.comment);

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleReviewBack(reviewComment, reviewRating)}
                className="h-10 w-10 rounded-full border border-border"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back to listing</span>
              </Button>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold leading-tight">Share your experience</h2>
                <p className="text-sm text-muted-foreground">
                  Tell other growers about your experience with {currentPlant?.seller ?? 'this seller'}.
                </p>
              </div>
            </div>
            <StarRating value={reviewRating} onChange={handleReviewRatingChange} />
          </div>
          {showRatingError ? (
            <p className="text-sm text-red-600">{reviewErrors.rating}</p>
          ) : missingRating ? (
            <p className="text-sm text-muted-foreground">Select a rating to submit your review.</p>
          ) : null}
        </div>

        {showBackAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
              <div className="mb-4 text-center">
                <p className="mb-2 text-lg font-semibold">Are you sure you want to go back?</p>
                <p className="text-sm text-gray-600">Some changes may be unsaved.</p>
              </div>
              <div className="flex justify-center gap-3">
                <Button className="bg-green-600 text-white hover:bg-green-700" onClick={handleBackConfirm}>
                  Yes
                </Button>
                <Button
                  variant="outline"
                  className="border-green-600 text-green-600 hover:bg-green-50"
                  onClick={handleBackCancel}
                >
                  No
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Textarea
              id="message"
              rows={8}
              value={reviewComment}
              onChange={(e) => handleReviewCommentChange(e.target.value)}
              onBlur={() => setTouchedReviewFields((prev) => ({ ...prev, comment: true }))}
              placeholder="Share details about your experience with this seller..."
              className="min-h-[200px]"
              aria-invalid={showCommentError}
              aria-describedby={showCommentError ? 'review-comment-error' : undefined}
            />
            {showCommentError ? (
              <p id="review-comment-error" className="text-sm text-red-600">
                {reviewErrors.comment}
              </p>
            ) : missingComment ? (
              <p className="text-sm text-muted-foreground">
                Share a few details so other shoppers can learn from your experience.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Button
              className="w-full rounded-full bg-green-600 py-3 text-base hover:bg-green-700"
              onClick={handleReviewSubmit}
              disabled={isSubmittingReview || !isReviewValid}
            >
              {isSubmittingReview ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit review'
              )}
            </Button>
            {!isReviewValid && !isSubmittingReview ? (
              <p className="text-center text-xs text-muted-foreground">
                Add both a star rating and a comment to enable submit.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderPageShell = (body: ReactNode, title: string, onBack: () => void) => (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col bg-background">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-10 w-10 rounded-full border border-border"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back to listings</span>
        </Button>
        <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
        <span className="hidden w-10 sm:block" aria-hidden="true" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">{body}</div>
    </div>
  );

  const renderDrawer = () => (
    <Drawer
      open={isConversationOpen}
      onOpenChange={(open) => {
        setIsConversationOpen(open);
        if (!open) {
          setNewMessageBody('');
        }
      }}
    >
      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>
            Conversation with {currentPlant?.seller ?? 'Seller'}
          </DrawerTitle>
          <DrawerDescription>
            {currentPlant ? `Discussing ${currentPlant.name}` : 'Plant conversation'}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <div
            ref={messageListRef}
            className="flex max-h-[24rem] flex-col gap-3 overflow-y-auto pr-1"
          >
            {conversationThread?.messages && conversationThread.messages.length > 0 ? (
              conversationThread.messages.map((message) => {
                const isBuyerMessage = message.senderType === 'buyer';
                const isPending = message.status === 'pending';
                const timestamp = message.createdAt
                  ? new Date(message.createdAt).toLocaleString()
                  : 'Just now';

                return (
                  <div
                    key={message.id}
                    className={`flex ${isBuyerMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${isBuyerMessage
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p>{message.body}</p>
                      <span className="mt-1 block text-xs opacity-75">
                        {isPending ? 'Sending…' : timestamp}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {isContactingSeller
                  ? 'Starting conversation...'
                  : 'No messages yet. Say hello to start the conversation.'}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Textarea
              rows={3}
              value={newMessageBody}
              onChange={(e) => setNewMessageBody(e.target.value)}
              placeholder="Type your message..."
            />
            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={handleSendMessage}
              disabled={isSendingMessage || !newMessageBody.trim()}
            >
              {isSendingMessage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send message
                </>
              )}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );

  if (isPagePresentation) {
    const pageTitle = isReviewScreenOpen
      ? `Review ${currentPlant?.name ?? 'listing'}`
      : currentPlant?.name ?? 'Plant details';

    const handleBackAction = () => {
      if (isReviewScreenOpen) {
        handleReviewBack(reviewComment, reviewRating);
      } else {
        handleClose();
      }
    };

    const pageBody = isReviewScreenOpen ? renderReviewBody() : renderDefaultBody();

    return (
      <>
        {renderPageShell(pageBody, pageTitle, handleBackAction)}
        {isEditListingScreenOpen && (
          <Dialog
            open={isEditListingScreenOpen}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) {
                setIsEditListingScreenOpen(false);
              }
            }}
          >
            <EditListingScreen
              plant={currentPlant}
              onCancel={() => setIsEditListingScreenOpen(false)}
              onSave={handleListingSave}
            />
          </Dialog>
        )}
        {renderDrawer()}
      </>
    );
  }

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            handleClose();
          }
        }}
      >
        {!isReviewScreenOpen && !isEditListingScreenOpen && (
          <DialogContent className="max-w-5xl w-[calc(100vw-2rem)] overflow-y-auto px-4 py-6 sm:px-6 md:h-[85vh]">
            {renderDefaultBody()}
          </DialogContent>
        )}
        {isEditListingScreenOpen && !isReviewScreenOpen && (
          <EditListingScreen
            plant={currentPlant}
            onCancel={() => setIsEditListingScreenOpen(false)}
            onSave={handleListingSave}
          />
        )}
        {isReviewScreenOpen && (
          <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] overflow-y-auto px-4 py-6 sm:px-6">
            {renderReviewBody()}
          </DialogContent>
        )}
      </Dialog>
      {renderDrawer()}
    </>
  );
}
