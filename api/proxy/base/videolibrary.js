export default async function handler(req, res) {
  try {
    const apiKey = req.headers['accesskey'] || req.headers['AccessKey'] || process.env.VITE_BUNNY_API_KEY;
    
    if (!apiKey) {
      return res.status(401).json({
        message: 'API key is required'
      });
    }

    const url = `https://api.bunny.net/videolibrary${req.url.replace('/api/proxy/base/videolibrary', '')}`;

    const response = await fetch(url, {
      method: req.method,
      headers: {
        'AccessKey': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[Proxy] Error:', error);
    res.status(500).json({
      message: 'Error proxying request to BunnyCDN',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
