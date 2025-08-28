import { useState } from 'react';
import { Image } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader } from './ui/dialog';
import { Button } from './ui/button';

interface CreateNewPlantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type UploadPlan = { file: File; url: string; headers: Record<string,string> };

export function CreateNewPlantModal({ isOpen, onClose }: CreateNewPlantModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [plantName, setPlantName] = useState('');
  const [price, setPrice] = useState(0);
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [description, setDescription] = useState('');
  const [careInstructions, setCareInstructions] = useState('');
  const [potSize, setPotSize] = useState('');
  const [height, setHeight] = useState('');
  const maxFileSize = 50 * 1024 * 1024; // 50MB

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);
    // Filter files over 50MB
    const validFiles = selectedFiles.filter(file => file.size <= maxFileSize);
    setFiles(prevFiles => [...prevFiles, ...validFiles]);
  };

  const handleSubmit = async (bucket: string, presignApiUrl: string) => {
    if (files.length === 0) return;
    const presignBody = {
      bucket,
      files: files.map(f => ({ fileName: f.name, contentType: f.type || "application/octet-stream" })),
      plantData: {
        name: plantName,
        price,
        location,
        category,
        condition,
        description,
        careInstructions,
        potSize,
        height
      }
    };
    console.log(presignBody)

    const res = await fetch(`${presignApiUrl}?data=${encodeURIComponent(JSON.stringify(presignBody))}`);
    if (!res.ok) throw new Error(`presign failed: ${res.status} ${await res.text()}`);
    const data: { uploads: { fileName: string; url: string; headers: Record<string,string> }[] } = await res.json();
    // console.log(data);

    const plan: UploadPlan[] = files.map((file) => {
      // console.log()
      const entry = data.uploads.find((u: { fileName: string; }) => u.fileName === file.name)!;
      return { file, url: entry.url, headers: entry.headers };
    });

    const results = await Promise.all(plan.map(async ({ file, url, headers }) => {
      const put = await fetch(url, { method: "PUT", headers, body: file });
      if (!put.ok) throw new Error(`upload failed for ${file.name}: ${put.status}`);
      return { file: file.name, ok: true, attributes: file };
    }));

    // console.log(results);
    // if (!res.ok) throw new Error(`presign failed: ${res.status} ${await res.text()}`);

    // const data: { uploads: { fileName: string; url: string; headers: Record<string,string> }[] } = await res.json();

    // const plan: UploadPlan[] = files.map((file) => {
    //   const entry = data.uploads.find(u => u.fileName === file.name)!;
    //   return { file, url: entry.url, headers: entry.headers };
    // });

    // const results = await Promise.all(plan.map(async ({ file, url, headers }) => {
    //   const put = await fetch(url, { method: "PUT", headers, body: file });
    //   if (!put.ok) throw new Error(`upload failed for ${file.name}: ${put.status}`);
    //   return { file: file.name, ok: true };
    // }));
    // setResultsList(results);
    // console.log(resultsList);
    // console.log(files);
    // const reader = new FileReader();
    // files.forEach((file) => {
    //   const test = reader.readAsDataURL(file);
    //   console.log(test);
    // });
    // let formData ={
    //   name: plantName,
    //   price,
    //   location,
    //   category,
    //   condition,
    //   description,
    //   careInstructions,
    //   potSize,
    //   height,
    //   images: []
    // }
    // const formData = new FormData();
    // formData.append('name', plantName);
    // formData.append('price', price.toString());
    // formData.append('location', location);
    // formData.append('category', category);
    // formData.append('condition', condition);
    // formData.append('description', description);
    // formData.append('careInstructions', careInstructions);
    // formData.append('potSize', potSize);
    // formData.append('height', height);
    // files.forEach(file => {
    //   formData.append('images', file);
    // });

    // try {
      // console.log(formData);
      // const reader = new FileReader();
      // reader.onload = async () => {
      //   const base64data = reader.result?.toString().split(',')[1] || '';
      //   formData.images.push(base64data);
      //   console.log(formData.images);
      // const response = await fetch('https://dzakzltsq4.execute-api.us-east-1.amazonaws.com/default/writePlantsData', {
      //   method: 'POST',
      //   body: JSON.stringify(formData),
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      // });
      // const data = await response.json();
      // console.log(data);
      // };
      
      // formData.images.forEach((image) => {
      //   reader.readAsDataURL(image);
      // });

      // if (!response.ok) {
      //   throw new Error('Failed to upload images');
      // }

      // Handle successful upload
      onClose();
    // } catch (error) {
    //   console.error(error);
    // }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-screen md:h-[83vh] overflow-y-auto flex flex-col justify-start">
        <DialogHeader className="flex flex-row items-center justify-between p-0">
          <div />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="hidden h-6 w-8 p-0"
          >
            {/* <X className="h-4 w-4" /> */}
          </Button>
        </DialogHeader>

        <div className="grid md:grid-cols-1 gap-6 flex-1">
          {/* Images */}
          {/* <div className="space-y-4">
            <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
              <ImageWithFallback
                src={plant.images[currentImageIndex]}
                alt={plant.name}
                className="w-full h-full object-cover"
              />
            </div>
            
            {plant.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {plant.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 ${
                      index === currentImageIndex 
                        ? 'border-green-500' 
                        : 'border-gray-200'
                    }`}
                  >
                    <ImageWithFallback
                      src={image}
                      alt={`${plant.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div> */}

          {/* Details */}
          <div className="space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <Image className="w-full m-auto h-64" />
              <div className="flex items-center justify-between rounded-md">
                  <label htmlFor="file_input" className="inline w-full text-sm font-medium text-white bg-green-600 rounded-md p-2 text-center">Upload Image(s)</label>
                  <input
                    type="file"
                    id="file_input"
                    className="hidden"
                    placeholder=""
                    multiple
                    onChange={handleFileChange}
                  />
              </div>
              <div className="flex items-center justify-center">
                <span className="text-black">{files && files.length > 0 && files.length === 1 ? `${files.length} image uploaded` : `${files.length} images uploaded`}</span>
              </div>
              
              {/* <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-green-600">
                  ${plant.price}
                </span>
                <Badge className={getConditionColor(plant.condition)} variant="secondary">
                  {plant.condition}
                </Badge>
                <Badge variant="outline">{plant.category}</Badge>
              </div>

              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{plant.location}</span>
              </div> */}
            </div>

            {/* <Separator /> */}
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Plant Name"
                onChange={(e) => setPlantName(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="number"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Price"
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Location"
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <select
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select Category</option>
                <option value="houseplants">Houseplants</option>
                <option value="flowers">Flowers</option>
                <option value="herbs">Herbs</option>
                <option value="succulents">Succulents</option>
                <option value="trees">Trees</option>
                <option value="seeds">Seeds</option>
                <option value="tools">Tools & Supplies</option>
              </select>
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Condition"
                onChange={(e) => setCondition(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Description"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex w-fullitems-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Care Instructions"
                onChange={(e) => setCareInstructions(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Pot Size"
                onChange={(e) => setPotSize(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <input
                type="text"
                className="w-full inline-block p-2 border border-gray-300 rounded-md"
                placeholder="Height"
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md">
              <button className="inline w-full text-sm font-medium text-white bg-green-600 rounded-md p-2 text-center" onClick={() => handleSubmit('dev.thumr.com', 'https://dzakzltsq4.execute-api.us-east-1.amazonaws.com/default/writePlantsData')}>
                <span>Add Plant</span>
              </button>
            </div>
            {/* Seller Info */}
            {/* <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={plant.sellerAvatar} />
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{plant.seller}</p>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm text-muted-foreground">
                      {plant.sellerRating} rating
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600">Verified Seller</span>
              </div>
            </div> */}

            {/* <Separator /> */}

            {/* Plant Details */}
            {/* <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Pot Size:</span>
                  <p className="font-medium">{plant.potSize}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Height:</span>
                  <p className="font-medium">{plant.height}</p>
                </div>
              </div>

              <div>
                <span className="text-muted-foreground">Description:</span>
                <p className="mt-1">{plant.description}</p>
              </div>

              <div>
                <span className="text-muted-foreground">Care Instructions:</span>
                <p className="mt-1">{plant.careInstructions}</p>
              </div>
            </div> */}

            {/* <Separator /> */}

            {/* Actions */}
            {/* <div className="space-y-3">
              <Button className="w-full bg-green-600 hover:bg-green-700">
                Contact Seller
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Message
                </Button>
                <Button variant="outline">
                  Make Offer
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Posted {plant.postedDate}
            </p> */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}