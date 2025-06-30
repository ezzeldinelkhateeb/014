export default async function handler(req, res) {
  console.log('Proxy API called:', {
    method: req.method,
    url: req.url,
    query: req.query,
    path: req.query.path
  });

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { path } = req.query;
    const pathArray = Array.isArray(path) ? path : [path];
    const apiPath = pathArray.join('/');
    
    // Get API key from request headers first, then environment as fallback
    const apiKey = req.headers.accesskey || req.headers.AccessKey || process.env.VITE_BUNNY_API_KEY;
    if (!apiKey) {
      console.error('Missing API key in headers or environment');
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Build the full Bunny CDN API URL
    const baseUrl = 'https://video.bunnycdn.com';
    const queryString = new URLSearchParams(req.query);
    queryString.delete('path'); // Remove the path parameter
    
    const targetUrl = `${baseUrl}/${apiPath}${queryString.toString() ? '?' + queryString.toString() : ''}`;
    
    console.log('Proxying to:', targetUrl);
    console.log('Using API key:', apiKey.substring(0, 8) + '...');

    // Make the request to Bunny CDN
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'AccessKey': apiKey,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    });

    console.log('Bunny API response status:', response.status);
    console.log('Bunny API response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bunny API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      return res.status(response.status).json({ 
        error: `Bunny API error: ${response.status} ${response.statusText}`,
        details: errorText 
      });
    }

    const data = await response.json();
    console.log('Bunny API success, returning data');
    
    return res.status(200).json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Proxy request failed', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
