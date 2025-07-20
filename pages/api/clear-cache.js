/**
 * API endpoint to clear cached API keys
 */

export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST.'
    });
  }

  try {
    // Simple cache clearing logic for server-side
    // This would normally interface with your cache system
    
    console.log('[Cache Clear] Clearing all cached API keys');
    
    // For client-side cache clearing, we'll return instructions
    res.status(200).json({
      success: true,
      message: 'Cache clear request processed',
      instructions: {
        clearLocalStorage: [
          'bunny_api_key',
          'app_cache',
          'library_data'
        ],
        clearCacheKeys: [
          'default_api_key',
          'library_*_api',
          'library_*_data'
        ]
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing cache',
      error: error.message
    });
  }
}
