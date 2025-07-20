export default async function handler(req, res) {
  console.log('Collections API called:', {
    method: req.method,
    url: req.url,
    query: req.query,
    libraryId: req.query.libraryId
  });

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey, accesskey');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { libraryId } = req.query;
  
  if (!libraryId) {
    return res.status(400).json({ error: 'Missing libraryId parameter' });
  }
  
  try {
    // Get API key from request headers with priority order
    const accessKey = req.headers.accesskey || 
                     req.headers.AccessKey || 
                     req.headers['accesskey'] || 
                     req.headers['access-key'] ||
                     req.headers.authorization?.replace('Bearer ', '');
    
    console.log('Collections API request details:', {
      libraryId: libraryId,
      method: req.method,
      hasAccessKey: !!accessKey,
      keyLength: accessKey?.length,
      keyPreview: accessKey ? `${accessKey.substring(0, 8)}...` : 'none'
    });
    
    if (!accessKey) {
      console.error('No AccessKey provided in request headers');
      return res.status(401).json({ 
        error: 'Missing AccessKey header',
        message: 'Please provide API key in AccessKey or accesskey header',
        receivedHeaders: Object.keys(req.headers)
      });
    }
    
    console.log('Collections API using key from:', {
      fromAccessKey: !!req.headers.accesskey,
      fromAccessKeyHeader: !!req.headers.AccessKey,
      fromAuth: !!req.headers.authorization,
      fromEnv: !!process.env.VITE_BUNNY_API_KEY,
      keyLength: accessKey.length,
      libraryId: libraryId
    });
    
    // Build URL with query parameters
    const queryString = new URLSearchParams();
    Object.keys(req.query).forEach(key => {
      if (key !== 'libraryId') { // Exclude route parameter
        queryString.append(key, req.query[key]);
      }
    });
    const queryParams = queryString.toString();
    const bunnyUrl = `https://video.bunnycdn.com/library/${libraryId}/collections${queryParams ? '?' + queryParams : ''}`;
    console.log('Proxying to:', bunnyUrl);
    
    const response = await fetch(bunnyUrl, {
      method: req.method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': req.headers['content-type'] || 'application/json',
        'AccessKey': accessKey,
      },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined
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
    return res.json(data);
    
  } catch (error) {
    console.error('Collections proxy error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
