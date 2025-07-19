export default function handler(req, res) {
  console.log('Test videolibrary API called:', {
    method: req.method,
    url: req.url,
    query: req.query,
    headers: {
      accesskey: req.headers.accesskey ? 'present' : 'missing',
      AccessKey: req.headers.AccessKey ? 'present' : 'missing'
    }
  });

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  res.status(200).json({ 
    message: 'Test videolibrary endpoint working!',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    query: req.query,
    hasAccessKey: !!(req.headers.accesskey || req.headers.AccessKey),
    env: {
      hasViteBunnyApiKey: !!process.env.VITE_BUNNY_API_KEY,
      nodeEnv: process.env.NODE_ENV
    }
  });
}