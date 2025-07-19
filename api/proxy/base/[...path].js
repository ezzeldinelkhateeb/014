export default async function handler(req, res) {
  console.log('Base Proxy API called:', {
    method: req.method,
    url: req.url,
    query: req.query,
    path: req.query.path
  });

  const { path } = req.query;
  const fullPath = Array.isArray(path) ? path.join('/') : path;
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Use environment variable as fallback if no header is provided
    const accessKey = req.headers.accesskey || 
                     req.headers.AccessKey || 
                     process.env.VITE_BUNNY_API_KEY;
    
    if (!accessKey) {
      console.error('Missing AccessKey header and no environment default');
      return res.status(401).json({ error: 'Missing AccessKey header' });
    }
    
    const bunnyUrl = `https://api.bunny.net/${fullPath}`;
    console.log('Proxying to:', bunnyUrl);
    console.log('Using API key:', accessKey.substring(0, 8) + '...');
    
    const response = await fetch(bunnyUrl, {
      method: req.method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'AccessKey': accessKey,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

    console.log('Bunny API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bunny API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      return res.status(response.status).json({ 
        error: `Bunny API error: ${response.status}`,
        details: errorText 
      });
    }
    
    const data = await response.json();
    console.log('Bunny API success, returning data');
    return res.json(data);
    
  } catch (error) {
    console.error('Base Proxy error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
