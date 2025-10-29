/**
 * Compress and resize an image file
 * @param file - The image file to compress
 * @param maxWidth - Maximum width in pixels (default: 80)
 * @param maxHeight - Maximum height in pixels (default: 80)
 * @param quality - JPEG quality 0-1 (default: 0.7)
 * @returns Compressed image as a Blob
 */
export async function compressImage(
  file: File,
  maxWidth: number = 80,
  maxHeight: number = 80,
  quality: number = 0.7
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log(`Original size: ${(file.size / 1024).toFixed(2)}KB, Compressed size: ${(blob.size / 1024).toFixed(2)}KB`);
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Create a thumbnail version of an image
 * @param file - The image file
 * @param maxSize - Maximum width/height in pixels (default: 200)
 * @returns Thumbnail as a Blob
 */
export async function createThumbnail(
  file: File,
  maxSize: number = 200
): Promise<Blob> {
  return compressImage(file, maxSize, maxSize, 0.7);
}

