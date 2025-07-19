// pages/api/proxy/video/[...path].ts - Legacy Pages API for compatibility

import { NextApiRequest, NextApiResponse } from 'next';

const VIDEO_BASE_URL = "https://video.bunnycdn.com";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { path } = req.query;
    const apiKey = req.headers.accesskey || req.headers.AccessKey;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key is required' });
    }

    // Build target path
    const targetPath = Array.isArray(path) ? `/${path.join('/')}` : `/${path}`;
    
    // Build target URL
    const queryString = new URLSearchParams();
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'path' && value) {
        if (Array.isArray(value)) {
          value.forEach(v => queryString.append(key, v));
        } else {
          queryString.append(key, value);
        }
      }
    });
    
    const targetUrl = `${VIDEO_BASE_URL}${targetPath}${queryString.toString() ? '?' + queryString.toString() : ''}`;
    
    console.log(`[Legacy Video Proxy] ${req.method} ${targetUrl}`);
    
    // Set up headers
    const headers: HeadersInit = {
      'AccessKey': apiKey as string,
      'Accept': '*/*',
    };
    
    // Copy content type if it exists
    const contentType = req.headers['content-type'];
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    
    // Make request
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Legacy Video Proxy] Error: ${response.status} - ${errorText}`);
      res.status(response.status);
      return res.send(errorText);
    }

    // Handle binary responses
    const responseContentType = response.headers.get('Content-Type');
    if (responseContentType && responseContentType.includes('application/octet-stream')) {
      const buffer = await response.arrayBuffer();
      res.setHeader('Content-Type', responseContentType);
      return res.send(Buffer.from(buffer));
    }

    // Try JSON first
    try {
      const data = await response.json();
      return res.json(data);
    } catch (e) {
      // If not JSON, return text
      const text = await response.text();
      res.setHeader('Content-Type', 'text/plain');
      return res.send(text);
    }

  } catch (error) {
    console.error('[Legacy Video Proxy] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
