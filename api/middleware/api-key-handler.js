/**
 * Middleware to handle API keys for Bunny.net requests
 */

export default function apiKeyHandler(req, res, next) {
  // Extract API key from various header formats
  const accessKey = req.headers.accesskey || 
                   req.headers.AccessKey || 
                   req.headers['accesskey'] || 
                   req.headers['access-key'] ||
                   req.headers.authorization?.replace('Bearer ', '') ||
                   process.env.VITE_BUNNY_API_KEY;

  // Skip validation entirely - pass through any key format
  
  // Attach the key to the request object for easy access
  req.bunnyApiKey = accessKey;
  
  if (!accessKey) {
    return res.status(401).json({
      success: false,
      message: 'API key is required'
    });
  }

  // Continue with the request
  if (typeof next === 'function') {
    next();
  }
}
