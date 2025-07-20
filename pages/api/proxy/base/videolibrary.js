import { setCorsHeaders, handleCors, getApiKey } from '../../../../api/_helpers/cors.js';

export default async function handler(req, res) {
  console.log('Pages Videolibrary API called:', {
    method: req.method,
    url: req.url,
    query: req.query
  });

  // Handle CORS preflight
  if (handleCors(req, res)) {
    return; // OPTIONS request, already handled
  }
  
  try {
    // Get API key from request headers first, then fallback to environment
    const accessKey = req.headers.accesskey || 
                     req.headers.AccessKey || 
                     req.headers['accesskey'] || 
                     req.headers['access-key'] ||
                     req.headers.authorization?.replace('Bearer ', '') ||
                     process.env.VITE_BUNNY_API_KEY;
    
    if (!accessKey) {
      console.error('Missing AccessKey header and no environment default');
      return res.status(401).json({ error: 'Missing AccessKey header' });
    }
    
    console.log('Using API key from:', {
      fromAccessKey: !!req.headers.accesskey,
      fromAccessKeyHeader: !!req.headers.AccessKey,
      fromAuth: !!req.headers.authorization,
      fromEnv: !!process.env.VITE_BUNNY_API_KEY,
      keyLength: accessKey.length
    });
    
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
