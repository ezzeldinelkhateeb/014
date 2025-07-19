export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey, x-api-key');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get API key from various sources
    const apiKey = req.headers.accesskey || 
                   req.headers.AccessKey || 
                   req.headers['accesskey'] || 
                   req.headers['access-key'] ||
                   req.headers.authorization?.replace('Bearer ', '') ||
                   process.env.VITE_BUNNY_API_KEY;
                   
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key not found in request or environment variables'
      });
    }
    
    // Return API key details (safely masked)
    res.status(200).json({
      success: true,
      message: 'API key found',
      details: {
        source: req.headers.accesskey ? 'accesskey header' : 
                req.headers.AccessKey ? 'AccessKey header' :
                req.headers['accesskey'] ? 'accesskey headers object' :
                req.headers['access-key'] ? 'access-key header' :
                req.headers.authorization ? 'authorization header' : 'environment variable',
        length: apiKey.length,
        preview: `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`,
      }
    });
  } catch (error) {
    console.error('Test API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking API key',
      error: error.message
    });
  }
}
