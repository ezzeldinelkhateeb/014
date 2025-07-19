/**
 * Middleware for API key validation and management
 */

export function createApiKeyValidationMiddleware() {
  return (req, res, next) => {
    // Skip validation for certain routes
    const skipRoutes = ['/health', '/api/auth-check', '/api/proxy/test'];
    if (skipRoutes.some(route => req.path.startsWith(route))) {
      return next();
    }

    // Skip for OPTIONS requests
    if (req.method === 'OPTIONS') {
      return next();
    }

    console.log(`[API Key Validation] ${req.method} ${req.path}`);
    
    // Extract API key from various header formats
    const apiKey = req.headers['accesskey'] || 
                   req.headers['AccessKey'] || 
                   req.headers['access-key'] ||
                   req.headers['Access-Key'] ||
                   req.headers['authorization']?.replace('Bearer ', '') ||
                   process.env.VITE_BUNNY_API_KEY;

    console.log('[API Key Validation] Key sources:', {
      hasAccesskey: !!req.headers['accesskey'],
      hasAccessKey: !!req.headers['AccessKey'],
      hasAccessDash: !!req.headers['access-key'],
      hasAccessDashCap: !!req.headers['Access-Key'],
      hasAuthorization: !!req.headers['authorization'],
      hasEnvKey: !!process.env.VITE_BUNNY_API_KEY,
      finalKey: apiKey ? `${apiKey.substring(0, 8)}...` : 'None'
    });

    if (!apiKey) {
      console.error('[API Key Validation] No API key found for Bunny.net request');
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No API key provided in request headers',
        expectedHeaders: ['AccessKey', 'accesskey', 'Access-Key', 'access-key'],
        receivedHeaders: Object.keys(req.headers)
      });
    }

    // Add the API key to request for downstream use
    req.bunnyApiKey = apiKey;
    
    // Set header for proxy forwarding
    req.headers['AccessKey'] = apiKey;
    
    console.log(`[API Key Validation] ✅ Valid API key found (${apiKey.length} chars)`);
    next();
  };
}

export function logApiKeyUsage(req, operation) {
  const apiKey = req.bunnyApiKey || req.headers['AccessKey'] || 'Not found';
  console.log(`[API Usage] ${operation}:`, {
    method: req.method,
    path: req.path,
    hasApiKey: !!apiKey,
    keyLength: typeof apiKey === 'string' ? apiKey.length : 0,
    timestamp: new Date().toISOString()
  });
}

export default {
  createApiKeyValidationMiddleware,
  logApiKeyUsage
};
