// Configuration for Hostinger deployment
// Update these values with your actual Supabase credentials

window.APP_CONFIG = {
  SUPABASE_URL: "https://supabase.akhiyanbd.com", // Self-hosted Supabase instance
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0", // Default anon key for self-hosted
  APP_ENV: "production"
};

// Log configuration (remove in production)
console.log('App Configuration Loaded:', {
  url: window.APP_CONFIG.SUPABASE_URL,
  key: window.APP_CONFIG.SUPABASE_ANON_KEY?.substring(0, 20) + '...',
  env: window.APP_CONFIG.APP_ENV
});
