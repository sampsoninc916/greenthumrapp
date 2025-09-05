import { useState, useRef } from 'react';
import { DialogContent, DialogHeader } from './ui/dialog';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';
import { ImageWithFallback } from './figma/ImageWithFallback';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselPrevious,
    CarouselNext,
} from "./ui/carousel";
import { Plant } from '../interfaces/Plant';

interface EditListingScreenProps {
    plant: Plant;
    onCancel: () => void;
    onSave: (updatedPlant: Plant) => void;
}

export function EditListingScreen({
    plant,
    onCancel,
    onSave,
}: EditListingScreenProps) {
    const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
    
    // Create local state for all editable fields
    const [editedPlant, setEditedPlant] = useState<Plant>({ ...plant });
    const [priceInput, setPriceInput] = useState<string>(plant.price.toString());

    // Handler to update plant fields
    const updatePlantField = <K extends keyof Plant>(field: K, value: Plant[K]) => {
        setEditedPlant(prev => ({
            ...prev,
            [field]: value
        }));
    };

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
        // Validate price is not negative
        if (editedPlant.price < 0) {
            alert('Price cannot be negative');
            return;
        }
        onSave(editedPlant);
    };

    return (
        <DialogContent className="max-w-4xl h-screen md:h-[83vh] flex flex-col p-0">
            <div className="flex-1 overflow-y-auto p-6">
                <DialogHeader>
                    <h2 className="text-lg md:text-xl font-semibold">Edit Listing</h2>
                </DialogHeader>
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