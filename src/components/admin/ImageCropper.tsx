import type { FC } from 'react';
import { useState, useRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Crop as CropIcon, X } from 'lucide-react';

interface ImageCropperProps {
  open: boolean;
  imageUrl: string;
  onCropComplete: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number;
  circularCrop?: boolean;
}

/**
 * Image cropper dialog component
 * Allows users to crop images with drag-adjustable controls
 */
export const ImageCropper: FC<ImageCropperProps> = ({
  open,
  imageUrl,
  onCropComplete,
  onCancel,
  aspectRatio,
  circularCrop = false,
}) => {
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    x: 10,
    y: 10,
    width: 80,
    height: 80,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;

    // Initialize crop to center of image
    const cropWidth = width * 0.8;
    const cropHeight = aspectRatio ? cropWidth / aspectRatio : height * 0.8;

    setCrop({
      unit: '%',
      x: 10,
      y: 10,
      width: 80,
      height: aspectRatio ? (cropHeight / height) * 100 : 80,
    });
  };

  const getCroppedImg = async (): Promise<Blob | null> => {
    const image = imgRef.current;
    const crop = completedCrop;

    if (!image || !crop) {
      return null;
    }

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return null;
    }

    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = crop.width * pixelRatio * scaleX;
    canvas.height = crop.height * pixelRatio * scaleY;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        'image/png',
        1
      );
    });
  };

  const handleCrop = async () => {
    const croppedImageBlob = await getCroppedImg();
    if (croppedImageBlob) {
      onCropComplete(croppedImageBlob);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center max-h-[60vh] overflow-auto">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            {...(aspectRatio && { aspect: aspectRatio })}
            circularCrop={circularCrop}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Crop preview"
              onLoad={onImageLoad}
              className="max-w-full h-auto"
            />
          </ReactCrop>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCrop}
            disabled={!completedCrop}
          >
            <CropIcon className="h-4 w-4 mr-2" />
            Apply Crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
