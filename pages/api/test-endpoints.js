export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey, accesskey');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const baseUrl = `https://${req.headers.host}`;
  
  // Get API key from headers or environment
  const accessKey = req.headers.accesskey || 
                   req.headers.AccessKey || 
                   req.headers['accesskey'] || 
                   process.env.VITE_BUNNY_API_KEY;
  
  if (!accessKey) {
    return res.status(401).json({
      error: 'No API key available',
      message: 'Provide API key in headers or set VITE_BUNNY_API_KEY environment variable'
    });
  }
  
  const endpoints = [
    {
      name: 'Auth Check',
      url: `${baseUrl}/api/auth-check`,
      method: 'GET'
    },
    {
      name: 'Video Libraries (Base Proxy)',
      url: `${baseUrl}/api/proxy/base/videolibrary`,
      method: 'GET'
    },
    {
      name: 'Base Proxy (Catch-all)',
      url: `${baseUrl}/api/proxy/base/videolibrary?page=1&perPage=5`,
      method: 'GET'
    },
    {
      name: 'Video Proxy (Generic)',
      url: `${baseUrl}/api/proxy/video/library/123456/videos?page=1&itemsPerPage=5`,
      method: 'GET'
    },
    {
      name: 'Collections Endpoint',
      url: `${baseUrl}/api/proxy/video/library/123456/collections`,
      method: 'GET'
    }
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing endpoint: ${endpoint.name} - ${endpoint.url}`);
      
      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'AccessKey': accessKey,
          'accesskey': accessKey
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { rawResponse: responseText.substring(0, 200) };
      }
      
      results.push({
        name: endpoint.name,
        url: endpoint.url,
        method: endpoint.method,
        status: response.status,
        statusText: response.statusText,
        success: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      results.push({
        name: endpoint.name,
        url: endpoint.url,
        method: endpoint.method,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Summary
  const summary = {
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    errors: results.filter(r => r.error).length
  };
  
  res.json({
    timestamp: new Date().toISOString(),
    apiKeyUsed: `${accessKey.substring(0, 8)}...`,
    summary,
    results
  });
}
