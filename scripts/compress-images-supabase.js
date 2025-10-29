/**
 * Server-side script to compress existing images in Supabase storage
 * Run with: node scripts/compress-images-supabase.js
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import fs from 'fs/promises';

// Configuration - The same values used in your app
const SUPABASE_URL = 'https://supabase.akhiyanbd.com';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const BUCKET_NAME = 'product-images';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Stats
const stats = {
  total: 0,
  processed: 0,
  compressed: 0,
  skipped: 0,
  errors: 0,
  originalSize: 0,
  compressedSize: 0
};

/**
 * Compress image using sharp
 */
async function compressImage(imageBuffer) {
  try {
    let quality = 60;
    let result = await sharp(imageBuffer)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, progressive: true })
      .toBuffer();
    
    // If still too large, reduce quality iteratively
    while (result.length > 50 * 1024 && quality > 30) {
      quality -= 5;
      result = await sharp(imageBuffer)
        .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, progressive: true })
        .toBuffer();
    }
    
    return { buffer: result, quality };
  } catch (error) {
    throw new Error(`Compression failed: ${error.message}`);
  }
}

/**
 * Process all images
 */
async function processImages() {
  console.log('\n🚀 Starting image compression...\n');
  console.log('━'.repeat(60));
  
  try {
    // List all files in the bucket
    console.log(`\n📂 Fetching files from bucket: ${BUCKET_NAME}...`);
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      });
    
    if (listError) {
      throw listError;
    }
    
    if (!files || files.length === 0) {
      console.log('⚠️  No files found in bucket');
      return;
    }
    
    stats.total = files.length;
    console.log(`✅ Found ${files.length} files\n`);
    
    // Process each file
    for (const file of files) {
      try {
        console.log(`\n📥 Processing: ${file.name}`);
        
        // Download the file
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(BUCKET_NAME)
          .download(file.name);
        
        if (downloadError) {
          throw downloadError;
        }
        
        // Convert Blob to Buffer
        const arrayBuffer = await fileData.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);
        const originalSize = imageBuffer.length;
        stats.originalSize += originalSize;
        
        // Skip if already small enough
        if (originalSize <= 50 * 1024) {
          console.log(`⏭️  Skipped (already ${(originalSize / 1024).toFixed(2)}KB)`);
          stats.skipped++;
          stats.compressedSize += originalSize;
          stats.processed++;
          continue;
        }
        
        // Compress
        console.log(`🗜️  Compressing (${(originalSize / 1024).toFixed(2)}KB)...`);
        const { buffer: compressedBuffer, quality } = await compressImage(imageBuffer);
        const compressedSize = compressedBuffer.length;
        stats.compressedSize += compressedSize;
        
        // Upload compressed version
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(file.name, compressedBuffer, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: true
          });
        
        if (uploadError) {
          throw uploadError;
        }
        
        const savedKB = ((originalSize - compressedSize) / 1024).toFixed(2);
        const savedPercent = ((1 - compressedSize / originalSize) * 100).toFixed(1);
        console.log(`✅ ${(originalSize / 1024).toFixed(2)}KB → ${(compressedSize / 1024).toFixed(2)}KB (saved ${savedKB}KB, ${savedPercent}%, quality: ${quality}%)`);
        
        stats.compressed++;
        stats.processed++;
        
        // Small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`❌ Error processing ${file.name}:`, error.message);
        stats.errors++;
        stats.processed++;
      }
    }
    
    // Print summary
    console.log('\n' + '━'.repeat(60));
    console.log('\n🎉 Compression Complete!\n');
    console.log('📊 Summary:');
    console.log(`   Total files: ${stats.total}`);
    console.log(`   Compressed: ${stats.compressed}`);
    console.log(`   Skipped: ${stats.skipped}`);
    console.log(`   Errors: ${stats.errors}`);
    console.log(`   Original size: ${(stats.originalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   Compressed size: ${(stats.compressedSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   💾 Space saved: ${((stats.originalSize - stats.compressedSize) / (1024 * 1024)).toFixed(2)} MB`);
    const percentSaved = stats.originalSize > 0 ? ((1 - stats.compressedSize / stats.originalSize) * 100).toFixed(1) : 0;
    console.log(`   📉 Size reduction: ${percentSaved}%`);
    console.log('\n' + '━'.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check that your Supabase URL and Anon Key are correct');
    console.error('   2. Verify that the bucket "product-images" exists');
    console.error('   3. Ensure the bucket has proper access permissions');
    console.error('   4. Check your network connection to Supabase\n');
    process.exit(1);
  }
}

// Run the script
processImages().catch(console.error);

