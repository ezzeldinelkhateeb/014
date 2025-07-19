export default function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey, x-api-key');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Accept API key from various header formats with no validation
    const accessKey = req.headers.accesskey || 
                     req.headers.AccessKey || 
                     req.headers['accesskey'] || 
                     req.headers['access-key'] ||
                     req.headers.authorization?.replace('Bearer ', '') ||
                     process.env.VITE_BUNNY_API_KEY;
    
    // Return basic auth check status
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      apiKeyConfigured: !!accessKey,
      apiKeyLength: accessKey ? accessKey.length : 0,
      apiKeyPreview: accessKey ? `${accessKey.substring(0, 8)}...` : null
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error during auth check',
      error: error.message
    });
  }
}
