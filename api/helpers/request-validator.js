/**
 * Helper functions to validate requests to Bunny.net
 */

export function validateApiKey(apiKey) {
  // Accept any non-empty string as valid
  return !!apiKey && typeof apiKey === 'string' && apiKey.length > 0;
}

export function extractApiKey(req) {
  return req.headers.accesskey || 
         req.headers.AccessKey || 
         req.headers['accesskey'] || 
         req.headers['access-key'] ||
         req.headers.authorization?.replace('Bearer ', '') ||
         process.env.VITE_BUNNY_API_KEY;
}
