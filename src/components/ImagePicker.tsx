import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImageUpload } from './ImageUpload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';
import { 
  Image, 
  Upload, 
  Search, 
  X, 
  Check, 
  Loader2,
  Grid3X3,
  List,
  Trash2
} from 'lucide-react';

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  compact?: boolean;
  placeholder?: string;
  iconOnly?: boolean;
}

interface StoredImage {
  name: string;
  id: string;
  updated_at: string;
  size: number;
  url: string;
}

export const ImagePicker = ({ 
  value, 
  onChange, 
  onRemove, 
  compact = false,
  placeholder = "Select an image",
  iconOnly = false
}: ImagePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [images, setImages] = useState<StoredImage[]>([]);
  const [filteredImages, setFilteredImages] = useState<StoredImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch images from storage
  const fetchImages = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('product-images')
        .list('', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'updated_at', order: 'desc' }
        });

      if (error) throw error;

      const imagesWithUrls = data.map(file => ({
        name: file.name,
        id: file.id,
        updated_at: file.updated_at,
        size: file.metadata?.size || 0,
        url: supabase.storage.from('product-images').getPublicUrl(file.name).data.publicUrl
      }));

      setImages(imagesWithUrls);
      setFilteredImages(imagesWithUrls);
    } catch (error) {
      console.error('Error fetching images:', error);
      toast.error('Failed to load images');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Filter images based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredImages(images);
    } else {
      const filtered = images.filter(img => 
        img.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredImages(filtered);
    }
  }, [searchQuery, images]);

  // Load images when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchImages();
    }
  }, [isOpen, fetchImages]);

  const handleImageSelect = (imageUrl: string) => {
    onChange(imageUrl);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit (before compression)
      toast.error('File size should be less than 10MB');
      return;
    }

    setIsUploading(true);
    try {
      // Compress the image before uploading (max 80KB file size)
      const compressedBlob = await compressImage(file, 600, 600, 0.65, 80);
      
      // Create a new file from the compressed blob
      const compressedFile = new File(
        [compressedBlob], 
        `${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`,
        { type: 'image/jpeg' }
      );
      
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(compressedFile.name, compressedFile);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(data.path);

      // Refresh the image list
      await fetchImages();
      
      // Select the newly uploaded image
      handleImageSelect(publicUrl);
      
      toast.success('Image uploaded and optimized successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async (imageName: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      const { error } = await supabase.storage
        .from('product-images')
        .remove([imageName]);

      if (error) throw error;

      // Refresh the image list
      await fetchImages();
      toast.success('Image deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete image');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-2">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            className={`${iconOnly ? 'w-auto px-2' : `w-full ${compact ? 'h-8' : 'h-10'} justify-start`}`}
          >
            {value ? (
              <div className={`flex items-center ${iconOnly ? 'gap-1' : 'gap-2'}`}>
                <img 
                  src={value} 
                  alt="Selected" 
                  className={`${iconOnly ? 'w-4 h-4' : 'w-6 h-6'} object-cover rounded`}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                {!iconOnly && <span className="truncate">Image selected</span>}
                {!iconOnly && <Check className="w-4 h-4 text-green-500" />}
              </div>
            ) : (
              <div className={`flex items-center ${iconOnly ? 'gap-1' : 'gap-2'}`}>
                <Image className="w-4 h-4" />
                {!iconOnly && <span>{placeholder}</span>}
              </div>
            )}
          </Button>
        </DialogTrigger>
        
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Select Image</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search and View Controls */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search images..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Upload Section */}
            <div className="border-2 border-dashed border-muted rounded-lg p-4">
              <div className="text-center">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  Upload a new image
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Choose File'
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                  className="hidden"
                />
              </div>
            </div>

            {/* Image Gallery */}
            <ScrollArea className="h-96">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="ml-2">Loading images...</span>
                </div>
              ) : filteredImages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No images found matching your search' : 'No images uploaded yet'}
                </div>
              ) : (
                <div className={viewMode === 'grid' ? 'grid grid-cols-4 gap-4' : 'space-y-2'}>
                  {filteredImages.map((image) => (
                    <div
                      key={image.id}
                      className={`relative group cursor-pointer rounded-lg border-2 transition-all ${
                        value === image.url 
                          ? 'border-primary ring-2 ring-primary/20' 
                          : 'border-muted hover:border-primary/50'
                      } ${viewMode === 'list' ? 'flex items-center gap-3 p-2' : 'aspect-square'}`}
                      onClick={() => handleImageSelect(image.url)}
                    >
                      {viewMode === 'grid' ? (
                        <>
                          <img
                            src={image.url}
                            alt={image.name}
                            className="w-full h-full object-cover rounded-lg"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg" />
                          {value === image.url && (
                            <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                          <div className="absolute bottom-2 left-2 right-2 bg-black/70 text-white text-xs p-1 rounded truncate">
                            {image.name}
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => handleDeleteImage(image.name, e)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <img
                            src={image.url}
                            alt={image.name}
                            className="w-12 h-12 object-cover rounded"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{image.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatFileSize(image.size)}</span>
                              <span>•</span>
                              <span>{formatDate(image.updated_at)}</span>
                            </div>
                          </div>
                          {value === image.url && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => handleDeleteImage(image.name, e)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Selected Image Info */}
            {value && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <img 
                    src={value} 
                    alt="Selected" 
                    className="w-8 h-8 object-cover rounded"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <span className="text-sm">Image selected</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (onRemove) onRemove();
                    setIsOpen(false);
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
