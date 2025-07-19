export default function handler(req, res) {
  try {
    const apiKey = req.headers['accesskey'] || req.headers['AccessKey'] || process.env.VITE_BUNNY_API_KEY;
    
    if (!apiKey) {
      return res.status(401).json({
        authenticated: false,
        message: 'No API key provided'
      });
    }

    const isValidFormat = apiKey.length >= 30;
    
    res.status(200).json({
      authenticated: true,
      hasApiKey: true,
      keyLength: apiKey.length,
      keyMask: maskApiKey(apiKey),
      isValidFormat,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Auth Check] Error:', error);
    res.status(500).json({
      authenticated: false,
      error: 'Internal server error'
    });
  }
}

// Helper function to mask API key
function maskApiKey(key) {
  if (!key || key.length < 8) return '***';
  return key.substring(0, 4) + '...' + key.substring(key.length - 4);
}
