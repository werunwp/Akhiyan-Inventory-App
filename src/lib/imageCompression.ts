/**
 * Compress and resize an image file
 * @param file - The image file to compress
 * @param maxWidth - Maximum width in pixels (default: 600)
 * @param maxHeight - Maximum height in pixels (default: 600)
 * @param quality - JPEG quality 0-1 (default: 0.65)
 * @param maxFileSizeKB - Maximum file size in KB (default: 80)
 * @returns Compressed image as a Blob
 */
export async function compressImage(
  file: File,
  maxWidth: number = 600,
  maxHeight: number = 600,
  quality: number = 0.65,
  maxFileSizeKB: number = 80
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
        
        // Function to compress with iterative quality reduction
        const compressWithQuality = (currentQuality: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              
              const fileSizeKB = blob.size / 1024;
              
              // If file size is under maxFileSizeKB or quality is already very low, use this blob
              if (fileSizeKB <= maxFileSizeKB || currentQuality <= 0.3) {
                console.log(
                  `Original size: ${(file.size / 1024).toFixed(2)}KB, ` +
                  `Compressed size: ${fileSizeKB.toFixed(2)}KB, ` +
                  `Quality: ${(currentQuality * 100).toFixed(0)}%`
                );
                resolve(blob);
              } else {
                // Reduce quality and try again
                const newQuality = Math.max(0.3, currentQuality - 0.05);
                console.log(`File size ${fileSizeKB.toFixed(2)}KB > ${maxFileSizeKB}KB, reducing quality to ${(newQuality * 100).toFixed(0)}%`);
                compressWithQuality(newQuality);
              }
            },
            'image/jpeg',
            currentQuality
          );
        };
        
        // Start compression with initial quality
        compressWithQuality(quality);
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

