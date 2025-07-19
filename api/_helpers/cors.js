/**
 * Helper for consistent CORS headers across API endpoints
 */
export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey, Content-Length, Accept, x-api-key');
}

export function handleCors(req, res) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  
  return false;
}

export function getApiKey(req) {
  return req.headers.accesskey || 
         req.headers.AccessKey || 
         req.headers['accesskey'] || 
         req.headers['access-key'] ||
         req.headers.authorization?.replace('Bearer ', '') ||
         process.env.VITE_BUNNY_API_KEY;
}
