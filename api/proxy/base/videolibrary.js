export default async function handler(req, res) {
  console.log('Videolibrary API called:', {
    method: req.method,
    url: req.url,
    query: req.query
  });

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const accessKey = req.headers.accesskey || req.headers.AccessKey || req.headers['accesskey'];
    
    if (!accessKey) {
      console.error('Missing AccessKey header');
      return res.status(401).json({ error: 'Missing AccessKey header' });
    }
    
    // Build query string
    const queryParams = new URLSearchParams();
    if (req.query.page) queryParams.append('page', String(req.query.page));
    if (req.query.perPage) queryParams.append('perPage', String(req.query.perPage));
    if (req.query.orderBy) queryParams.append('orderBy', String(req.query.orderBy));
    
    const bunnyUrl = `https://api.bunny.net/videolibrary${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
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
    console.error('Videolibrary Proxy error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}