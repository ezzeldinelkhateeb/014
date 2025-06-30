// pages/api/proxy/base/[...path].ts - Legacy Pages API for compatibility

import { NextApiRequest, NextApiResponse } from 'next';

const BASE_URL = "https://api.bunny.net";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
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
    
    const targetUrl = `${BASE_URL}${targetPath}${queryString.toString() ? '?' + queryString.toString() : ''}`;
    
    console.log(`[Legacy Base Proxy] ${req.method} ${targetUrl}`);
    
    // Make request
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'AccessKey': apiKey as string,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Legacy Base Proxy] Error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({
        error: 'Bunny API error',
        details: errorText.substring(0, 500)
      });
    }

    // Handle videolibrary specifically
    if (targetPath.includes('videolibrary')) {
      const rawText = await response.text();
      
      if (rawText.trim().startsWith('<!DOCTYPE') || rawText.trim().startsWith('<html')) {
        console.error('[Legacy Base Proxy] Received HTML instead of JSON');
        return res.status(502).json({
          error: 'Invalid API response',
          message: 'Received HTML instead of JSON. Check your API key and permissions.'
        });
      }
      
      try {
        const jsonData = JSON.parse(rawText);
        return res.json(jsonData);
      } catch (e) {
        console.error('[Legacy Base Proxy] Failed to parse JSON:', e);
        return res.status(502).json({
          error: 'Invalid JSON in response',
          details: rawText.substring(0, 500)
        });
      }
    }

    // For other endpoints
    const data = await response.json();
    return res.json(data);

  } catch (error) {
    console.error('[Legacy Base Proxy] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
