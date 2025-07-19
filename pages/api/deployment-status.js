// Simple test to verify API endpoints work after deployment
export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Return deployment status
  return res.status(200).json({
    status: 'success',
    message: 'Vercel deployment working correctly',
    timestamp: new Date().toISOString(),
    deployment: 'vercel-fix-v0.0.1',
    environment: process.env.NODE_ENV || 'development'
  });
}