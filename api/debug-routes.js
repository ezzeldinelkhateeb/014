export default function handler(req, res) {
  // Enable CORS for diagnostic endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey, x-api-key');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Return debugging information
  res.status(200).json({
    success: true,
    timestamp: new Date().toISOString(),
    request: {
      url: req.url,
      method: req.method,
      headers: req.headers,
      query: req.query
    },
    environment: {
      node_env: process.env.NODE_ENV,
      api_key_configured: !!process.env.VITE_BUNNY_API_KEY,
      available_env_vars: Object.keys(process.env)
    },
    message: "API route debugging endpoint is working correctly"
  });
}
