export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Test different ways to get the API key
    const accessKey = req.headers.accesskey || 
                     req.headers.AccessKey || 
                     req.headers['accesskey'] || 
                     req.headers['access-key'] ||
                     req.headers.authorization?.replace('Bearer ', '') ||
                     process.env.VITE_BUNNY_API_KEY;
    
    // Test API key by making a simple request to Bunny.net
    let bunnyTestResult = null;
    if (accessKey) {
      try {
        console.log('Testing API key with Bunny.net...');
        const response = await fetch('https://api.bunny.net/videolibrary?page=1&perPage=1', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'AccessKey': accessKey,
          }
        });
        
        bunnyTestResult = {
          status: response.status,
          statusText: response.statusText,
          success: response.ok
        };
        
        if (response.ok) {
          const data = await response.json();
          bunnyTestResult.libraryCount = data.items?.length || 0;
        } else {
          const errorText = await response.text();
          bunnyTestResult.error = errorText;
        }
      } catch (error) {
        bunnyTestResult = {
          success: false,
          error: error.message
        };
      }
    }
    
    // Return comprehensive diagnostics
    res.status(200).json({
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      
      // API Key Sources
      apiKeySources: {
        fromAccesskey: !!req.headers.accesskey,
        fromAccessKey: !!req.headers.AccessKey,
        fromAccesskeyLower: !!req.headers['accesskey'],
        fromAccessDash: !!req.headers['access-key'],
        fromAuthorization: !!req.headers.authorization,
        fromEnvironment: !!process.env.VITE_BUNNY_API_KEY
      },
      
      // Final API Key Info
      apiKey: accessKey ? {
        configured: true,
        length: accessKey.length,
        preview: `${accessKey.substring(0, 4)}...${accessKey.substring(accessKey.length - 4)}`,
        source: req.headers.accesskey ? 'accesskey header' : 
                req.headers.AccessKey ? 'AccessKey header' :
                req.headers['accesskey'] ? 'accesskey headers object' :
                req.headers['access-key'] ? 'access-key header' :
                req.headers.authorization ? 'authorization header' : 'environment variable'
      } : {
        configured: false
      },
      
      // Bunny.net API Test
      bunnyApiTest: bunnyTestResult,
      
      // Request Headers (sanitized)
      requestHeaders: {
        hasAccesskey: !!req.headers.accesskey,
        hasAccessKey: !!req.headers.AccessKey,
        hasAuthorization: !!req.headers.authorization,
        contentType: req.headers['content-type'],
        userAgent: req.headers['user-agent']?.substring(0, 50) + '...'
      },
      
      // Environment Variables (existence only)
      environmentVariables: {
        NODE_ENV: process.env.NODE_ENV,
        hasViteBunnyApiKey: !!process.env.VITE_BUNNY_API_KEY
      }
    });
  } catch (error) {
    console.error('Diagnostic error:', error);
    res.status(500).json({
      success: false,
      message: 'Error running diagnostics',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
