interface CompressionOptions {
  /** Maximum width in pixels after resizing. */
  maxWidth?: number;
  /** Maximum height in pixels after resizing. */
  maxHeight?: number;
  /** Quality factor passed to canvas encoders (0-1). */
  quality?: number;
  /** Minimum number of bytes that must be saved to keep the compressed blob. */
  minBytesSaved?: number;
  /** Preferred MIME type for the compressed output. */
  outputMimeType?: string;
}

interface CompressionResult {
  file: File;
  wasCompressed: boolean;
}

const DEFAULT_MAX_DIMENSION = 2800;
const DEFAULT_QUALITY = 0.82;
const DEFAULT_MIN_BYTES_SAVED = 32 * 1024; // 32KB

const createCanvas = (width: number, height: number): HTMLCanvasElement | OffscreenCanvas => {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const drawToCanvas = async (
  image: ImageBitmap | HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  mimeType: string,
  quality: number,
): Promise<Blob | null> => {
  const canvas = createCanvas(targetWidth, targetHeight);

  if ('getContext' in canvas) {
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }
    context.drawImage(image, 0, 0, targetWidth, targetHeight);
    return new Promise<Blob | null>((resolve) => {
      (canvas as HTMLCanvasElement).toBlob((blob) => resolve(blob), mimeType, quality);
    });
  }

  const bitmapRenderer = (canvas as OffscreenCanvas).getContext('bitmaprenderer');
  if (!bitmapRenderer) {
    return null;
  }
  bitmapRenderer.transferFromImageBitmap(image instanceof ImageBitmap ? image : await createImageBitmap(image));
  return (canvas as OffscreenCanvas).convertToBlob({ type: mimeType, quality });
};

const shouldAttemptCompression = (file: File): boolean => {
  if (!file.type.startsWith('image/')) {
    return false;
  }

  // Animated formats, SVG, or very small files generally should not be recompressed.
  const lowerType = file.type.toLowerCase();
  if (lowerType.includes('gif') || lowerType.includes('svg') || file.size < 40 * 1024) {
    return false;
  }

  return true;
};

const normalizeDimensions = (
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
) => {
  let targetWidth = width;
  let targetHeight = height;

  if (width > maxWidth || height > maxHeight) {
    const widthRatio = maxWidth / width;
    const heightRatio = maxHeight / height;
    const ratio = Math.min(widthRatio, heightRatio);
    targetWidth = Math.max(1, Math.round(width * ratio));
    targetHeight = Math.max(1, Math.round(height * ratio));
  }

  return { targetWidth, targetHeight };
};

const loadImageBitmap = async (file: File): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to Image element based loading.
    }
  }

  let objectUrl: string | null = null;

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = (error) => reject(error);
    objectUrl = URL.createObjectURL(file);
    image.src = objectUrl;
  }).finally(() => {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      try {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      } catch {
        // Ignore cleanup errors.
      }
    }
  });
};

export const compressImageIfNeeded = async (
  file: File,
  options: CompressionOptions = {},
): Promise<CompressionResult> => {
  if (!shouldAttemptCompression(file)) {
    return { file, wasCompressed: false };
  }

  const maxWidth = options.maxWidth ?? DEFAULT_MAX_DIMENSION;
  const maxHeight = options.maxHeight ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_QUALITY;
  const minBytesSaved = options.minBytesSaved ?? DEFAULT_MIN_BYTES_SAVED;

  let image: ImageBitmap | HTMLImageElement;
  try {
    image = await loadImageBitmap(file);
  } catch (error) {
    console.warn('Failed to load image for compression, skipping.', error);
    return { file, wasCompressed: false };
  }

  const width = 'width' in image ? image.width : (image as HTMLImageElement).naturalWidth;
  const height = 'height' in image ? image.height : (image as HTMLImageElement).naturalHeight;
  const { targetWidth, targetHeight } = normalizeDimensions(width, height, maxWidth, maxHeight);

  if (targetWidth === width && targetHeight === height && file.type === options.outputMimeType) {
    // Nothing to change.
    return { file, wasCompressed: false };
  }

  const desiredType = options.outputMimeType ?? (file.type === 'image/heic' ? 'image/jpeg' : file.type || 'image/jpeg');

  const blob = await drawToCanvas(image, targetWidth, targetHeight, desiredType, quality);
  if (!blob) {
    return { file, wasCompressed: false };
  }

  let convertedBlob = blob;
  if ('type' in convertedBlob && convertedBlob.type && convertedBlob.type !== desiredType && 'slice' in convertedBlob) {
    // Some environments ignore the type passed to convertToBlob/toBlob. Manually coerce using Blob constructor.
    convertedBlob = new Blob([convertedBlob], { type: desiredType });
  }

  if (typeof (convertedBlob as Blob).size === 'number' && (convertedBlob as Blob).size + minBytesSaved >= file.size) {
    // Compression did not yield significant savings.
    return { file, wasCompressed: false };
  }

  const extensionMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  let optimizedName = file.name;
  if (desiredType !== file.type) {
    const targetExtension = extensionMap[desiredType];
    if (targetExtension) {
      const nameWithoutExtension = file.name.replace(/\.[^.]+$/, '');
      optimizedName = `${nameWithoutExtension}.${targetExtension}`;
    }
  }

  const renamedFile = new File([convertedBlob], optimizedName, {
    type: desiredType,
    lastModified: file.lastModified,
  });

  return { file: renamedFile, wasCompressed: true };
};

