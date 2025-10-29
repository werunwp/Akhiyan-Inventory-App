/**
 * Server-side script to compress existing images in Supabase storage
 * Run with: node scripts/compress-images.js
 */

import https from 'https';
import http from 'http';
import sharp from 'sharp';

// Configuration - Update these with your Supabase credentials
const SUPABASE_URL = 'https://supabase.akhiyanbd.com';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const BUCKET_NAME = 'product-images';

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
 * Make HTTP request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.request(url, options, (res) => {
      const chunks = [];
      
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body, headers: res.headers });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body.toString()}`));
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

/**
 * List all files in the bucket
 */
async function listFiles() {
  console.log(`\n📂 Fetching files from bucket: ${BUCKET_NAME}`);
  
  const url = `${SUPABASE_URL}/storage/v1/object/list/${BUCKET_NAME}`;
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prefix: '',
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    })
  };
  
  try {
    const { body } = await makeRequest(url, options);
    const files = JSON.parse(body.toString());
    return files;
  } catch (error) {
    console.error('❌ Error listing files:', error.message);
    throw error;
  }
}

/**
 * Download a file from storage
 */
async function downloadFile(fileName) {
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${encodeURIComponent(fileName)}`;
  
  try {
    const { body } = await makeRequest(url);
    return body;
  } catch (error) {
    console.error(`❌ Error downloading ${fileName}:`, error.message);
    throw error;
  }
}

/**
 * Upload a file to storage (replace existing)
 */
async function uploadFile(fileName, fileBuffer, contentType = 'image/jpeg') {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${encodeURIComponent(fileName)}`;
  
  const options = {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': contentType,
      'Content-Length': fileBuffer.length,
      'x-upsert': 'true'
    },
    body: fileBuffer
  };
  
  try {
    await makeRequest(url, options);
  } catch (error) {
    console.error(`❌ Error uploading ${fileName}:`, error.message);
    throw error;
  }
}

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
    
    return result;
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
    // List all files
    const files = await listFiles();
    
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
        
        // Download
        const imageBuffer = await downloadFile(file.name);
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
        const compressedBuffer = await compressImage(imageBuffer);
        const compressedSize = compressedBuffer.length;
        stats.compressedSize += compressedSize;
        
        // Upload
        await uploadFile(file.name, compressedBuffer);
        
        const savedKB = ((originalSize - compressedSize) / 1024).toFixed(2);
        const savedPercent = ((1 - compressedSize / originalSize) * 100).toFixed(1);
        console.log(`✅ ${(originalSize / 1024).toFixed(2)}KB → ${(compressedSize / 1024).toFixed(2)}KB (saved ${savedKB}KB, ${savedPercent}%)`);
        
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
    console.log('\n' + '━'.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
processImages().catch(console.error);
