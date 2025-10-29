# Image Compression Scripts

## Compress Existing Images

This script compresses all existing images in your Supabase storage bucket to under 50KB.

### How to Use:

1. **Open the HTML file in your browser:**
   ```
   scripts/compress-existing-images.html
   ```

2. **Fill in the configuration:**
   - **Supabase URL:** `https://supabase.akhiyanbd.com`
   - **Supabase Anon Key:** Get this from your Supabase dashboard or `public/config.js`
   - **Bucket Name:** `product-images` (default)

3. **Click "Start Compression"**
   - The script will automatically:
     - Download each image
     - Compress it to under 50KB
     - Replace the old image with the compressed version
     - Show real-time progress and statistics

4. **Monitor Progress:**
   - Total files processed
   - Number compressed
   - Number skipped (already under 50KB)
   - Total space saved
   - Live progress bar
   - Detailed logs

### Features:

✅ **Smart Compression:**
- Resizes images to max 600×600px
- Iteratively reduces quality until file size is under 50KB
- Maintains aspect ratio
- Minimum quality of 30% to preserve basic image quality

✅ **Safe Operation:**
- Skips images already under 50KB
- Can be stopped at any time
- Shows detailed logs for each file
- Replaces images in-place (preserves URLs)

✅ **Statistics:**
- Real-time progress tracking
- Shows original vs compressed size
- Calculates total space saved
- Displays savings percentage per image

### Important Notes:

⚠️ **Backup First:**
- This script replaces your existing images
- Consider backing up your storage bucket before running
- Download a copy of important images

⚠️ **Large Buckets:**
- For buckets with many images, this may take time
- The script processes images sequentially to avoid overwhelming the server
- You can stop and resume anytime (it will reprocess all files)

⚠️ **Image Quality:**
- Images will be compressed to JPEG format
- Some quality loss is expected for aggressive compression
- Product images at 600px width should still look good at 40-50% quality

### Example Output:

```
[14:30:45] 🚀 Starting compression process...
[14:30:46] 📂 Fetching files from bucket: product-images
[14:30:47] ✅ Found 156 files
[14:30:48] 📥 Processing: product-1.jpg
[14:30:48] 🗜️ Compressing product-1.jpg (1250KB)...
[14:30:49] ✅ product-1.jpg: 1250KB → 47KB (saved 1203KB, 96.2%)
[14:30:50] 📥 Processing: product-2.png
[14:30:50] ⏭️ Skipped product-2.png (already 38KB)
...
[14:45:20] 🎉 Compression complete!
[14:45:20] 💾 Total space saved: 158.32 MB
```

### Getting Your Supabase Anon Key:

1. Open `public/config.js` in your project
2. Copy the `SUPABASE_ANON_KEY` value
3. Or go to: https://supabase.akhiyanbd.com/project/default/settings/api
4. Copy the "anon public" key

