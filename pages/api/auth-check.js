export default async function handler(req, res) {
  console.log('Auth check API called:', {
    method: req.method,
    url: req.url,
    headers: {
      accesskey: req.headers.accesskey ? '***' : undefined,
      AccessKey: req.headers.AccessKey ? '***' : undefined
    }
  });

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const accessKey = req.headers.accesskey || req.headers.AccessKey || process.env.VITE_BUNNY_API_KEY;
    
    if (!accessKey) {
      console.error('Missing AccessKey header and no default API key');
      return res.status(401).json({ 
        error: 'Missing AccessKey header',
        authenticated: false 
      });
    }
    
    // Test the API key by making a simple request to Bunny.net
    const testUrl = 'https://api.bunny.net/videolibrary?page=1&perPage=1';
    console.log('Testing API key with:', testUrl);
    console.log('Using API key:', accessKey.substring(0, 8) + '...');
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'AccessKey': accessKey,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    console.log('Bunny API auth test response status:', response.status);
    
    if (response.status === 401) {
      console.error('API key authentication failed');
      return res.status(401).json({ 
        error: 'API key authentication failed',
        authenticated: false 
      });
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bunny API error during auth check:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      return res.status(response.status).json({ 
        error: `Bunny API error: ${response.status}`,
        details: errorText,
        authenticated: false 
      });
    }
    
    // If we get here, the API key is valid
    console.log('API key authentication successful');
    return res.json({ 
      authenticated: true,
      message: 'API key is valid',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Auth check error:', error);
    return res.status(500).json({ 
      error: 'Internal server error during auth check',
      details: error.message,
      authenticated: false 
    });
  }
}