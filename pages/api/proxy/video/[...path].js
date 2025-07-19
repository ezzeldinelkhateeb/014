export default async function handler(req, res) {
  console.log('Video Proxy API called:', {
    method: req.method,
    url: req.url,
    query: req.query,
    path: req.query.path
  });

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Extract path parameters
    const { path } = req.query;
    const fullPath = Array.isArray(path) ? path.join('/') : path;
    
    // Get the API key from headers or environment variable
    const accessKey = req.headers.accesskey || 
                     req.headers.AccessKey || 
                     req.headers['accesskey'] || 
                     process.env.VITE_BUNNY_API_KEY;
    
    if (!accessKey) {
      console.error('Missing AccessKey header and no environment default');
      return res.status(401).json({ error: 'Missing AccessKey header' });
    }
    
    // Construct the URL for Bunny.net video API
    const bunnyUrl = `https://video.bunnycdn.com/${fullPath}`;
    console.log('Proxying video request to:', bunnyUrl);
    
    // Forward the request to Bunny.net
    const response = await fetch(bunnyUrl, {
      method: req.method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': req.headers['content-type'] || 'application/json',
        'AccessKey': accessKey,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    });

    console.log('Bunny video API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bunny video API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      
      return res.status(response.status).json({ 
        error: `Bunny video API error: ${response.status}`,
        details: errorText 
      });
    }
    
    // For binary responses (like video content)
    const contentType = response.headers.get('Content-Type');
    if (contentType && !contentType.includes('application/json')) {
      const arrayBuffer = await response.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      return res.send(Buffer.from(arrayBuffer));
    }
    
    // For JSON responses
    const data = await response.json();
    return res.json(data);
    
  } catch (error) {
    console.error('Video proxy error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
