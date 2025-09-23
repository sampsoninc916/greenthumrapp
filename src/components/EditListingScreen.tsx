import { useState, useRef } from 'react';
import { DialogContent, DialogHeader } from './ui/dialog';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselPrevious,
    CarouselNext,
} from "./ui/carousel";
import { Plant, type DeliveryMethod, type LivePlantWarranty } from '../interfaces/Plant';
import {
    DELIVERY_METHOD_OPTIONS,
    extractStateCode,
    formatZipRange,
    getDeliveryCombinationError,
    getProhibitedStateMessage,
    parseZipRanges,
    requiresZipRanges,
} from '../constants/fulfillmentRules';

interface EditListingScreenProps {
    plant: Plant;
    onCancel: () => void;
    onSave: (updatedPlant: Plant, changedFields: Set<keyof Plant>) => void;
}

export function EditListingScreen({
    plant,
    onCancel,
    onSave,
}: EditListingScreenProps) {
    const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
    
    // Create local state for all editable fields
    const initialDeliveryMethods = Array.isArray(plant.deliveryMethods) ? plant.deliveryMethods : [];
    const initialZipRanges = Array.isArray(plant.availableZipRanges) ? plant.availableZipRanges : [];
    const initialPackagingNotes = plant.packagingNotes ?? '';
    const initialWarranty: LivePlantWarranty = plant.livePlantWarranty ?? { isOffered: false };
    const [editedPlant, setEditedPlant] = useState<Plant>({
        ...plant,
        deliveryMethods: initialDeliveryMethods,
        availableZipRanges: initialZipRanges,
        packagingNotes: initialPackagingNotes,
        livePlantWarranty: initialWarranty,
    });
    const [priceInput, setPriceInput] = useState<string>(plant.price.toString());
    const [changedFields, setChangedFields] = useState<Set<keyof Plant>>(new Set());
    const [zipRangeInput, setZipRangeInput] = useState<string>(
        initialZipRanges.length > 0 ? initialZipRanges.map(formatZipRange).join('\n') : ''
    );
    const [zipRangeError, setZipRangeError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [warrantyOffered, setWarrantyOffered] = useState<boolean>(initialWarranty.isOffered ?? false);
    const [warrantyDurationInput, setWarrantyDurationInput] = useState<string>(
        typeof initialWarranty.durationDays === 'number' ? initialWarranty.durationDays.toString() : ''
    );
    const [warrantyNotes, setWarrantyNotes] = useState<string>(initialWarranty.notes ?? '');

    // Handler to update plant fields and track changes
    const updatePlantField = <K extends keyof Plant>(field: K, value: Plant[K]) => {
        setEditedPlant(prev => ({
            ...prev,
            [field]: value
        }));

        // Track which field was changed
        if (JSON.stringify(plant[field]) !== JSON.stringify(value)) {
            setChangedFields(prev => new Set(prev).add(field));
        } else {
            // If value reverted to original, remove from changed fields
            setChangedFields(prev => {
                const newSet = new Set(prev);
                newSet.delete(field);
                return newSet;
            });
        }
    };

    const deliveryMethodOrder = DELIVERY_METHOD_OPTIONS.map(option => option.value);

    const toggleDeliveryMethod = (method: DeliveryMethod, checked: boolean) => {
        setFormError(null);
        const currentMethods: DeliveryMethod[] = Array.isArray(editedPlant.deliveryMethods)
            ? editedPlant.deliveryMethods as DeliveryMethod[]
            : [];
        const next = new Set(currentMethods);
        if (checked) {
            next.add(method);
        } else {
            next.delete(method);
        }
        const ordered = deliveryMethodOrder.filter(value => next.has(value));
        updatePlantField('deliveryMethods', ordered as Plant['deliveryMethods']);
    };

    const handleZipRangeBlur = () => {
        if (!zipRangeInput) {
            setZipRangeError(null);
            updatePlantField('availableZipRanges', []);
            return;
        }

        const { ranges, invalidEntries } = parseZipRanges(zipRangeInput);
        if (invalidEntries.length > 0) {
            setZipRangeError(`Invalid ZIP entries: ${invalidEntries.join(', ')}`);
            return;
        }

        setZipRangeError(null);
        updatePlantField('availableZipRanges', ranges);
        setZipRangeInput(ranges.map(formatZipRange).join('\n'));
    };

    const parseWarrantyDuration = (value: string): number | undefined => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return undefined;
        }
        return parsed;
    };

    const handleWarrantyToggle = (checked: boolean) => {
        setFormError(null);
        setWarrantyOffered(checked);
        if (!checked) {
            setWarrantyDurationInput('');
        }
        updatePlantField('livePlantWarranty', {
            isOffered: checked,
            durationDays: checked ? parseWarrantyDuration(warrantyDurationInput) : undefined,
            notes: warrantyNotes,
        } as LivePlantWarranty);
    };

    const handleWarrantyDurationChange = (value: string) => {
        setWarrantyDurationInput(value);
        updatePlantField('livePlantWarranty', {
            isOffered: warrantyOffered,
            durationDays: warrantyOffered ? parseWarrantyDuration(value) : undefined,
            notes: warrantyNotes,
        } as LivePlantWarranty);
    };

    const handleWarrantyNotesChange = (value: string) => {
        setWarrantyNotes(value);
        updatePlantField('livePlantWarranty', {
            isOffered: warrantyOffered,
            durationDays: warrantyOffered ? parseWarrantyDuration(warrantyDurationInput) : undefined,
            notes: value,
        } as LivePlantWarranty);
    };

    const selectedDeliveryMethods: DeliveryMethod[] = Array.isArray(editedPlant.deliveryMethods)
        ? editedPlant.deliveryMethods as DeliveryMethod[]
        : [];
    const inlineCombinationError = selectedDeliveryMethods.length > 0
        ? getDeliveryCombinationError(selectedDeliveryMethods)
        : null;
    const shippingSelected = requiresZipRanges(selectedDeliveryMethods);
    const locationStateCode = extractStateCode(editedPlant.location);
    const prohibitedStateMessage = getProhibitedStateMessage(locationStateCode, selectedDeliveryMethods);

    // Handler to update images array
    const updateImage = (index: number, value: string) => {
        const newImages = [...editedPlant.images];
        newImages[index] = value;
        updatePlantField('images', newImages);
    };

    // Handler to remove image
    const removeImage = (index: number) => {
        const newImages = editedPlant.images.filter((_, i) => i !== index);
        updatePlantField('images', newImages);
    };

    // Handler to add new image
    const addImage = () => {
        updatePlantField('images', [...editedPlant.images, ""]);
    };

    // Handler for saving changes
    const handleSave = () => {
        setFormError(null);

        if (editedPlant.price < 0) {
            setFormError('Price cannot be negative');
            return;
        }

        const combinationError = getDeliveryCombinationError(selectedDeliveryMethods);
        if (combinationError) {
            setFormError(combinationError);
            return;
        }

        const { ranges, invalidEntries } = parseZipRanges(zipRangeInput);
        if (invalidEntries.length > 0) {
            setZipRangeError(`Invalid ZIP entries: ${invalidEntries.join(', ')}`);
            setFormError('Please correct the ZIP ranges before saving.');
            return;
        }

        setZipRangeError(null);

        if (requiresZipRanges(selectedDeliveryMethods) && ranges.length === 0) {
            setFormError('Add at least one ZIP code or range when shipping is enabled.');
            return;
        }

        const prohibitedMessage = getProhibitedStateMessage(
            extractStateCode(editedPlant.location),
            selectedDeliveryMethods,
        );
        if (prohibitedMessage) {
            setFormError(prohibitedMessage);
            return;
        }

        let warrantyDurationValue: number | undefined;
        if (warrantyOffered) {
            warrantyDurationValue = parseWarrantyDuration(warrantyDurationInput);
            if (!warrantyDurationValue) {
                setFormError('Enter a valid warranty duration in days.');
                return;
            }
        }

        const normalizedWarranty: LivePlantWarranty = warrantyOffered
            ? {
                isOffered: true,
                durationDays: warrantyDurationValue,
                notes: warrantyNotes.trim() || undefined,
            }
            : {
                isOffered: false,
                notes: warrantyNotes.trim() || undefined,
            };

        const packagingNotesValue = (editedPlant.packagingNotes ?? '').trim();
        const updatedPlant: Plant = {
            ...editedPlant,
            deliveryMethods: selectedDeliveryMethods,
            availableZipRanges: ranges,
            packagingNotes: packagingNotesValue,
            livePlantWarranty: normalizedWarranty,
        };

        setZipRangeInput(ranges.length > 0 ? ranges.map(formatZipRange).join('\n') : '');

        const updatedChangedFields = new Set(changedFields);
        const originalDeliveryMethods = Array.isArray(plant.deliveryMethods) ? plant.deliveryMethods : [];
        const originalZipRanges = Array.isArray(plant.availableZipRanges) ? plant.availableZipRanges : [];
        const originalPackagingNotes = plant.packagingNotes ?? '';
        const originalWarranty = plant.livePlantWarranty ?? { isOffered: false };

        if (JSON.stringify(originalDeliveryMethods) !== JSON.stringify(selectedDeliveryMethods)) {
            updatedChangedFields.add('deliveryMethods');
        } else {
            updatedChangedFields.delete('deliveryMethods');
        }

        if (JSON.stringify(originalZipRanges) !== JSON.stringify(ranges)) {
            updatedChangedFields.add('availableZipRanges');
        } else {
            updatedChangedFields.delete('availableZipRanges');
        }

        if (originalPackagingNotes !== packagingNotesValue) {
            updatedChangedFields.add('packagingNotes');
        } else {
            updatedChangedFields.delete('packagingNotes');
        }

        if (JSON.stringify(originalWarranty) !== JSON.stringify(normalizedWarranty)) {
            updatedChangedFields.add('livePlantWarranty');
        } else {
            updatedChangedFields.delete('livePlantWarranty');
        }

        onSave(updatedPlant, updatedChangedFields);
        setEditedPlant(updatedPlant);
        setChangedFields(updatedChangedFields);
        setWarrantyOffered(normalizedWarranty.isOffered);
        setWarrantyNotes(normalizedWarranty.notes ?? '');
        setWarrantyDurationInput(
            normalizedWarranty.isOffered && normalizedWarranty.durationDays
                ? normalizedWarranty.durationDays.toString()
                : ''
        );
    };

    return (
        <DialogContent className="max-w-4xl h-screen md:h-[83vh] flex flex-col p-0">
            <div className="flex-1 overflow-y-auto p-6">
                <DialogHeader>
                    <h2 className="text-lg md:text-xl font-semibold">Edit Listing</h2>
                </DialogHeader>
                {formError && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertTitle>Cannot save changes</AlertTitle>
                        <AlertDescription>{formError}</AlertDescription>
                    </Alert>
                )}
                <div className="space-y-12">
                    <DialogHeader className="flex flex-row items-center justify-between p-0">
                        <div />
                        <Button
                            variant="white"
                            size="sm"
                            onClick={onCancel}
                            className="h-6 w-8 p-0 hidden"
                        >
                            {/* <X className="h-4 w-4" /> */}
                        </Button>
                    </DialogHeader>

                    <div className="grid grid-cols-1 gap-6">
                    {/* Editable Images */}
                    <div className="space-y-4">
                        <div className="relative w-full flex justify-center items-center px-0 md:px-2">
                            <Carousel className="mx-auto w-full max-w-xs md:max-w-md">
                                <CarouselContent>
                                    {editedPlant?.images && Array.isArray(editedPlant?.images) && editedPlant?.images.map((img, idx) => (
                                        <CarouselItem key={idx}>
                                            <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center w-full">
                                                <ImageWithFallback
                                                    src={img}
                                                    alt={editedPlant.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        </CarouselItem>
                                    ))}
                                </CarouselContent>
                                <div className="absolute top-1/2 left-2 md:left-4 -translate-y-1/2 z-10">
                                    <CarouselPrevious />
                                </div>
                                <div className="absolute top-1/2 right-2 md:right-4 -translate-y-1/2 z-10">
                                    <CarouselNext />
                                </div>
                            </Carousel>
                        </div>

                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {editedPlant?.images && Array.isArray(editedPlant?.images) && editedPlant?.images.map((image, index) => (
                                <div key={index} className="flex flex-col items-center min-w-[110px]">
                                    <input
                                        type="text"
                                        value={image}
                                        onChange={e => updateImage(index, e.target.value)}
                                        className="w-full p-1 border rounded mb-1 text-xs"
                                        placeholder="Image URL"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => removeImage(index)}
                                        className="text-xs"
                                    >
                                        Remove
                                    </Button>
                                </div>
                            ))}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={addImage}
                                className="min-w-[110px] text-xs"
                            >
                                Add Image
                            </Button>
                        </div>
                    </div>

                    {/* Editable Details */}
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs md:text-sm font-medium text-gray-700">Plant Name</label>
                                <input
                                    type="text"
                                    value={editedPlant.name}
                                    onChange={e => updatePlantField('name', e.target.value)}
                                    className="w-full p-2 border rounded text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs md:text-sm font-medium text-gray-700">Price</label>
                                <input
                                    type="text"
                                    value={priceInput}
                                    onChange={e => {
                                        setPriceInput(e.target.value);
                                    }}
                                    onBlur={e => {
                                        const value = parseFloat(e.target.value);
                                        if (!isNaN(value) && value >= 0) {
                                            updatePlantField('price', value);
                                            setPriceInput(value.toString());
                                        } else {
                                            // Reset to last valid value or 0
                                            const resetValue = editedPlant.price || 0;
                                            setPriceInput(resetValue.toString());
                                            updatePlantField('price', resetValue);
                                        }
                                    }}
                                    placeholder="0"
                                    className="w-full p-2 border rounded text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs md:text-sm font-medium text-gray-700">Location</label>
                                <input
                                    type="text"
                                    value={editedPlant.location}
                                    onChange={e => updatePlantField('location', e.target.value)}
                                    className="w-full p-2 border rounded text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs md:text-sm font-medium text-gray-700">Category</label>
                                <input
                                    type="text"
                                    value={editedPlant.category}
                                    onChange={e => updatePlantField('category', e.target.value)}
                                    className="w-full p-2 border rounded text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs md:text-sm font-medium text-gray-700">Condition</label>
                                <input
                                    type="text"
                                    value={editedPlant.condition}
                                    onChange={e => updatePlantField('condition', e.target.value)}
                                    className="w-full p-2 border rounded text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs md:text-sm font-medium text-gray-700">Pot Size</label>
                                <input
                                    type="text"
                                    value={editedPlant.potSize}
                                    onChange={e => updatePlantField('potSize', e.target.value)}
                                    className="w-full p-2 border rounded text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs md:text-sm font-medium text-gray-700">Height</label>
                                <input
                                    type="text"
                                    value={editedPlant.height}
                                    onChange={e => updatePlantField('height', e.target.value)}
                                    className="w-full p-2 border rounded text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-4 rounded-md border border-gray-200 bg-white/70 p-4">
                            <div>
                                <h3 className="text-sm font-semibold text-green-700 md:text-base">Delivery &amp; Fulfillment</h3>
                                <p className="text-xs text-gray-600 md:text-sm">
                                    Update the delivery methods and coverage you support for this listing.
                                </p>
                            </div>
                            <div className="space-y-3">
                                {DELIVERY_METHOD_OPTIONS.map((option) => {
                                    const checkboxId = `edit-delivery-${option.value.toLowerCase()}`;
                                    return (
                                        <label
                                            key={option.value}
                                            htmlFor={checkboxId}
                                            className="flex items-start gap-3 rounded-md border border-gray-200/70 bg-white/60 p-3"
                                        >
                                            <Checkbox
                                                id={checkboxId}
                                                checked={selectedDeliveryMethods.includes(option.value)}
                                                onCheckedChange={(checked) =>
                                                    toggleDeliveryMethod(option.value, checked === true)
                                                }
                                            />
                                            <div className="space-y-1">
                                                <p className="text-sm font-semibold text-gray-900">{option.label}</p>
                                                <p className="text-xs text-gray-600">{option.description}</p>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                            {inlineCombinationError && (
                                <p className="text-xs text-red-600 md:text-sm">{inlineCombinationError}</p>
                            )}
                            {(shippingSelected || zipRangeInput) && (
                                <div className="space-y-2">
                                    <Label htmlFor="edit-zip-range">Available ZIP ranges</Label>
                                    <textarea
                                        id="edit-zip-range"
                                        value={zipRangeInput}
                                        onChange={(e) => setZipRangeInput(e.target.value)}
                                        onBlur={handleZipRangeBlur}
                                        rows={shippingSelected ? 3 : 2}
                                        className="w-full rounded-md border border-gray-300 p-2 text-sm"
                                        placeholder="94107 or 75000-75200"
                                    />
                                    <p className="text-xs text-gray-500">
                                        {shippingSelected
                                            ? 'Enter one ZIP or ZIP range per line (##### or #####-#####).'
                                            : 'ZIP ranges are optional unless shipping is enabled.'}
                                    </p>
                                    {zipRangeError && <p className="text-xs text-red-600">{zipRangeError}</p>}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="edit-packaging-notes">Packaging notes</Label>
                                <textarea
                                    id="edit-packaging-notes"
                                    value={editedPlant.packagingNotes ?? ''}
                                    onChange={(e) => updatePlantField('packagingNotes', e.target.value)}
                                    rows={3}
                                    className="w-full rounded-md border border-gray-300 p-2 text-sm"
                                    placeholder="Share insulation materials, heat packs, or handling steps."
                                />
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="edit-warranty-switch">Offer live-plant warranty</Label>
                                    <Switch
                                        id="edit-warranty-switch"
                                        checked={warrantyOffered}
                                        onCheckedChange={handleWarrantyToggle}
                                    />
                                </div>
                                {warrantyOffered && (
                                    <div className="space-y-1">
                                        <Label htmlFor="edit-warranty-duration">Warranty duration (days)</Label>
                                        <input
                                            id="edit-warranty-duration"
                                            type="number"
                                            min={1}
                                            value={warrantyDurationInput}
                                            onChange={(e) => handleWarrantyDurationChange(e.target.value)}
                                            className="w-full rounded-md border border-gray-300 p-2 text-sm"
                                            placeholder="30"
                                        />
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <Label htmlFor="edit-warranty-notes">
                                        {warrantyOffered ? 'Warranty details' : 'Warranty notes (optional)'}
                                    </Label>
                                    <textarea
                                        id="edit-warranty-notes"
                                        value={warrantyNotes}
                                        onChange={(e) => handleWarrantyNotesChange(e.target.value)}
                                        rows={warrantyOffered ? 3 : 2}
                                        className="w-full rounded-md border border-gray-300 p-2 text-sm"
                                        placeholder={
                                            warrantyOffered
                                                ? 'Outline care requirements, what is covered, and claim steps.'
                                                : 'Add optional disclaimers about live arrival guarantees.'
                                        }
                                    />
                                </div>
                            </div>
                            {prohibitedStateMessage && (
                                <Alert variant="destructive">
                                    <AlertTitle>Shipping restriction</AlertTitle>
                                    <AlertDescription>{prohibitedStateMessage}</AlertDescription>
                                </Alert>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs md:text-sm font-medium text-gray-700">Description</label>
                            <textarea
                                ref={descriptionRef}
                                value={editedPlant.description}
                                onChange={e => updatePlantField('description', e.target.value)}
                                className="w-full p-2 border rounded text-sm"
                                rows={3}
                            />
                        </div>
                        <div>
                            <label className="block text-xs md:text-sm font-medium text-gray-700">Care Instructions</label>
                            <textarea
                                value={editedPlant.careInstructions}
                                onChange={e => updatePlantField('careInstructions', e.target.value)}
                                className="w-full p-2 border rounded text-sm"
                                rows={2}
                            />
                        </div>
                    </div>

                    <Separator />

                    {/* Seller Info (Read-only) */}
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarImage src={editedPlant.sellerAvatar} />
                            <AvatarFallback>
                                {editedPlant.seller[0] || "?"}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-medium text-sm">{editedPlant.seller}</p>
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">
                                    {editedPlant.sellerRating} rating
                                </span>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-2 bg-white px-4 py-3 border-t">
                <Button variant="outline" onClick={onCancel} className="text-sm">
                    Cancel
                </Button>
                <Button className="bg-green-600 hover:bg-green-700 text-white text-sm" onClick={handleSave}>
                    Save Changes
                </Button>
            </div>
        </DialogContent>
    );
}