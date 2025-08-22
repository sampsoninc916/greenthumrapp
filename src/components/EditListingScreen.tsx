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

interface Plant {
    id: string;
    name: string;
    price: number;
    images: string[];
    location: string;
    category: string;
    seller: string;
    sellerAvatar: string;
    sellerRating: number;
    condition: string;
    description: string;
    careInstructions: string;
    potSize: string;
    height: string;
    postedDate: string;
}

interface EditListingScreenProps {
    plant: Plant;
    onCancel: () => void;
    onSave: () => void;
}

export function EditListingScreen({
    plant,
    onCancel,
    onSave,
}: EditListingScreenProps) {
    const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

    return (
        <DialogContent className="max-w-4xl h-screen md:h-[83vh] overflow-y-auto">
            <div className="space-y-12">
                <DialogHeader className="flex flex-row items-center justify-between p-0">
                    <h2 className="text-xl font-semibold">Edit Listing</h2>
                    <Button
                        variant="white"
                        size="sm"
                        onClick={onCancel}
                        className="h-6 w-8 p-0"
                    >
                        {/* <X className="h-4 w-4" /> */}
                    </Button>
                </DialogHeader>

                <div className="grid md:grid-cols-1 gap-6">
                    {/* Editable Images */}
                    <div className="space-y-4">
                        <div className="relative w-full flex justify-center items-center px-2">
                            <Carousel className="mx-auto">
                                <CarouselContent>
                                    {plant.images.map((img, idx) => (
                                        <CarouselItem key={idx}>
                                            <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
                                                <ImageWithFallback
                                                    src={img}
                                                    alt={plant.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        </CarouselItem>
                                    ))}
                                </CarouselContent>
                                <div className="absolute top-1/2 left-4 -translate-y-1/2 z-10">
                                    <CarouselPrevious />
                                </div>
                                <div className="absolute top-1/2 right-4 -translate-y-1/2 z-10">
                                    <CarouselNext />
                                </div>
                            </Carousel>
                        </div>

                        <div className="flex gap-2 overflow-x-auto">
                            {plant.images.map((image, index) => (
                                <div key={index} className="flex flex-col items-center">
                                    <input
                                        type="text"
                                        value={image}
                                        onChange={e => {
                                            const newImages = [...plant.images];
                                            newImages[index] = e.target.value;
                                            plant.images = newImages;
                                        }}
                                        className="w-32 p-1 border rounded mb-1"
                                        placeholder="Image URL"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const newImages = plant.images.filter((_, i) => i !== index);
                                            plant.images = newImages;
                                        }}
                                    >
                                        Remove
                                    </Button>
                                </div>
                            ))}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    plant.images = [...plant.images, ""];
                                }}
                            >
                                Add Image
                            </Button>
                        </div>
                    </div>

                    {/* Editable Details */}
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Plant Name</label>
                                <input
                                    type="text"
                                    value={plant.name}
                                    onChange={e => { plant.name = e.target.value; }}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Price</label>
                                <input
                                    type="number"
                                    value={plant.price}
                                    onChange={e => { plant.price = Number(e.target.value); }}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Location</label>
                                <input
                                    type="text"
                                    value={plant.location}
                                    onChange={e => { plant.location = e.target.value; }}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Category</label>
                                <input
                                    type="text"
                                    value={plant.category}
                                    onChange={e => { plant.category = e.target.value; }}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Condition</label>
                                <input
                                    type="text"
                                    value={plant.condition}
                                    onChange={e => { plant.condition = e.target.value; }}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Pot Size</label>
                                <input
                                    type="text"
                                    value={plant.potSize}
                                    onChange={e => { plant.potSize = e.target.value; }}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Height</label>
                                <input
                                    type="text"
                                    value={plant.height}
                                    onChange={e => { plant.height = e.target.value; }}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Description</label>
                            <textarea
                                ref={descriptionRef}
                                value={plant.description}
                                onChange={e => { plant.description = e.target.value; }}
                                className="w-full p-2 border rounded"
                                rows={3}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Care Instructions</label>
                            <textarea
                                value={plant.careInstructions}
                                onChange={e => { plant.careInstructions = e.target.value; }}
                                className="w-full p-2 border rounded"
                                rows={2}
                            />
                        </div>
                    </div>

                    <Separator />

                    {/* Seller Info */}
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarImage src={plant.sellerAvatar} />
                            <AvatarFallback>
                                {plant.seller[0] || "?"}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-medium">{plant.seller}</p>
                            <div className="flex items-center gap-1">
                                <span className="text-sm text-muted-foreground">
                                    {plant.sellerRating} rating
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-8">
                    <Button variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={onSave}>
                        Save Changes
                    </Button>
                </div>
            </div>
        </DialogContent>
    );
}