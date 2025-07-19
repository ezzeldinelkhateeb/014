import { cache } from '../cache';
import { dataStorage } from '../data-storage';
import { BASE_URL, VIDEO_BASE_URL } from './constants';

export interface BunnyResponse<T = any> {
  items?: T[];
  totalItems?: number;
  error?: string;
}

export interface BunnyError extends Error {
  status?: number;
  detail?: string;
}

export class HttpClient {
  private apiKey: string | null = null;
  private videoApiKey: string | null = null;
  private libraryApiKeys: Map<string, string> = new Map();
  private lastRequestTime: number = 0;
  private requestDelay: number = 0;
  public readonly baseUrl: string = BASE_URL;
  public readonly videoBaseUrl: string = VIDEO_BASE_URL;

  constructor(apiKey?: string, videoApiKey?: string) {
    if (apiKey) this.apiKey = apiKey;
    if (videoApiKey) this.videoApiKey = videoApiKey;
  }

  /**
   * Set the delay between requests in milliseconds
   */
  setRequestDelay(delayMs: number): void {
    this.requestDelay = delayMs;
  }

  /**
   * Get the appropriate API key for a request
   */
  getApiKey(libraryId?: string, accessToken?: string): string {
    // First try the access token if provided
    if (accessToken) {
      return accessToken;
    }

    // Check environment variable first as it's most reliable
    const envApiKey = (typeof window !== 'undefined' && (window as any).__env?.VITE_BUNNY_API_KEY) || 
                      (typeof process !== 'undefined' && process.env?.VITE_BUNNY_API_KEY);
    
    if (envApiKey) {
      return envApiKey;
    }

    // Then try to get the library-specific key from cache
    if (libraryId) {
      // First check the in-memory map
      const cachedKey = this.libraryApiKeys.get(libraryId);
      if (cachedKey) {
        return cachedKey;
      }
      
      // Then check the global cache
      const libraryData = cache.get(`library_${libraryId}_data`);
      if (libraryData?.apiKey) {
        // Store in memory for future use
        this.libraryApiKeys.set(libraryId, libraryData.apiKey);
        return libraryData.apiKey;
      }
      
      // Try to get from the library data storage
      const allLibraries = cache.get('library_data');
      if (allLibraries?.libraries) {
        const library = allLibraries.libraries.find(l => l.id === libraryId);
        if (library?.apiKey) {
          // Store in memory for future use
          this.libraryApiKeys.set(libraryId, library.apiKey);
          return library.apiKey;
        }
      }
    }

    // Fall back to instance API key
    if (this.apiKey) {
      return this.apiKey;
    }

    // Check cached default key
    const cachedDefaultKey = cache.get('default_api_key');
    if (cachedDefaultKey) {
      return cachedDefaultKey;
    }

    console.error('[HttpClient] No API key available. Checked:', {
      hasAccessToken: !!accessToken,
      hasEnvKey: !!envApiKey,
      hasLibraryId: !!libraryId,
      hasInstanceKey: !!this.apiKey,
      hasCachedDefault: !!cachedDefaultKey
    });

    throw new Error('No API key available. Please set VITE_BUNNY_API_KEY environment variable or provide an access token.');
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  setLibraryApiKey(libraryId: string, apiKey: string): void {
    this.libraryApiKeys.set(libraryId, apiKey);
  }

  /**
   * Helper function to add a delay between requests
   */
  private async addDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.requestDelay) {
      const delayNeeded = this.requestDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }
    
    this.lastRequestTime = Date.now();
  }

  public async fetchWithError<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    try {
      // Add delay before request if configured
      if (this.requestDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      }

      // Determine if this is a video/collection request
      const isVideoApi = this.shouldUseVideoApi(path);
      
      // Extract library ID from path for video/collection requests
      let libraryId: string | undefined;
      if (isVideoApi) {
        const match = path.match(/\/library\/(\d+)/);
        if (match) {
          libraryId = match[1];
        }
      }

      // Get the appropriate API key
      const apiKeyToUse = this.getApiKey(libraryId);
      
      if (!apiKeyToUse) {
        throw new Error('API key not set');
      }

      // Special handling for collection operations
      if (path.includes('/collections')) {
        console.log(`[HttpClient] Collection operation: ${options.method} ${path}`);
        
        // Ensure the path is routed through the video proxy
        const collectionPath = path.startsWith('/api/proxy/') ?
          path : `/api/proxy/video${this.cleanPath(path)}`;
        const finalUrl = `${window.location.origin}${collectionPath}`;
        
        // Prepare headers
        const headers = new Headers(options.headers || {});
        headers.set('AccessKey', apiKeyToUse);
        headers.set('Content-Type', 'application/json');
        headers.set('Accept', 'application/json');
        
        console.log(`[HttpClient] Making collection request to: ${finalUrl}`);
        
        const response = await fetch(finalUrl, {
          ...options,
          headers,
          signal: options.signal || AbortSignal.timeout(60000) // 1 minute timeout for collections
        });

        console.log(`[HttpClient] Collection response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[HttpClient] Collection request failed:`, {
            url: finalUrl,
            status: response.status,
            statusText: response.statusText,
            response: errorText
          });
          throw new Error(`Collection request failed: ${response.status} ${errorText}`);
        }

        const responseText = await response.text();
        
        try {
          const jsonData = JSON.parse(responseText);
          console.log(`[HttpClient] Collection operation successful`);
          return jsonData;
        } catch (parseError) {
          console.error(`[HttpClient] Failed to parse collection response:`, {
            parseError: parseError.message,
            responseText: responseText.substring(0, 500)
          });
          throw new Error(`Failed to parse JSON response: ${parseError.message}`);
        }
      }

      // Special handling for create-video endpoint
      if (path === '/api/proxy/create-video') {
        console.log(`[HttpClient] Using create-video endpoint`, {
          method: options.method,
          headers: Object.fromEntries(new Headers(options.headers || {}).entries()),
          bodyLength: typeof options.body === 'string' ? options.body.length : 'unknown'
        });
        
        // Prepare headers
        const headers = new Headers(options.headers || {});
        headers.set('Content-Type', 'application/json');
        
        // Log the request we're about to make
        console.log('[HttpClient] Sending create-video request:', {
          url: `${window.location.origin}${path}`,
          method: options.method,
          headers: Object.fromEntries(headers.entries()),
          body: typeof options.body === 'string' ? JSON.parse(options.body) : null
        });
        
        // Make the request to our local proxy
        const response = await fetch(`${window.location.origin}${path}`, {
          ...options,
          headers,
          signal: options.signal || AbortSignal.timeout(180000) // 3 minute timeout
        });

        // Log response details before checking status
        console.log('[HttpClient] Create video response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });

        const responseText = await response.text();
        console.log('[HttpClient] Create video raw response:', responseText);

        if (!response.ok) {
          console.error(`[HttpClient] Create video request failed:`, {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            response: responseText
          });
          throw new Error(`Request failed: ${response.status} ${responseText}`);
        }

        try {
          const jsonResponse = JSON.parse(responseText);
          console.log('[HttpClient] Create video parsed response:', jsonResponse);
          return jsonResponse;
        } catch (e) {
          console.error('[HttpClient] Failed to parse create video response:', {
            error: e,
            responseText
          });
          throw new Error(`Failed to parse response: ${e.message}`);
        }
      }

      // Determine if we should use proxy
      const useProxy = this.shouldUseProxy(path);

      // Determine the effective base URL
      const baseUrl = isVideoApi ? this.videoBaseUrl : this.baseUrl;

      if (useProxy) {
        // Check if path already contains proxy prefix
        let finalUrl: string;
        if (path.startsWith('/api/proxy/')) {
          // Path already contains proxy prefix, use it as is
          finalUrl = `${window.location.origin}${path}`;
          console.log(`[HttpClient] Using proxy path as-is: ${path}`);
        } else {
          // Add proxy prefix
          const proxyPath = isVideoApi ? '/api/proxy/video' : '/api/proxy/base';
          const cleanPath = this.cleanPath(path);
          finalUrl = `${window.location.origin}${proxyPath}${cleanPath}`;
          console.log(`[HttpClient] Using proxy: ${proxyPath}${cleanPath}`);
        }
        
        // Prepare headers
        const headers = new Headers(options.headers || {});
        headers.set('AccessKey', apiKeyToUse);
        headers.set('Connection', 'keep-alive');
        
        // Make the request through our proxy
        const response = await fetch(finalUrl, {
          ...options,
          headers,
          signal: options.signal || AbortSignal.timeout(180000) // 3 minute timeout
        });

        console.log(`[HttpClient] Proxy response status: ${response.status}`);
        console.log(`[HttpClient] Proxy response headers:`, Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[HttpClient] Proxy request failed:`, {
            url: finalUrl,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            response: errorText
          });
          throw new Error(`Request failed: ${response.status} ${errorText}`);
        }

        const responseText = await response.text();
        console.log(`[HttpClient] Proxy raw response:`, responseText.substring(0, 200) + '...');
        
        try {
          const jsonData = JSON.parse(responseText);
          console.log(`[HttpClient] Proxy parsed response successfully`);
          return jsonData;
        } catch (parseError) {
          console.error(`[HttpClient] Failed to parse proxy response:`, {
            parseError: parseError.message,
            responseText: responseText.substring(0, 500),
            isHTML: responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<!doctype')
          });
          throw new Error(`Failed to parse JSON response: ${parseError.message}. Response was: ${responseText.substring(0, 200)}`);
        }
      }

      // For non-proxy requests, use the direct API URL
      const url = `${baseUrl}${path}`;
      console.log(`[HttpClient] Making direct request to: ${url}`);

      // Prepare headers
      const headers = new Headers(options.headers || {});
      headers.set('AccessKey', apiKeyToUse);
      headers.set('Connection', 'keep-alive');

      // Make the request
      const response = await fetch(url, {
        ...options,
        headers,
        signal: options.signal || AbortSignal.timeout(180000) // 3 minute timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HttpClient] Request failed: ${response.status} ${errorText}`);
        throw new Error(`Request failed: ${response.status} ${errorText}`);
      }

      return response.json();
    } catch (error) {
      console.error('[HttpClient] Error in fetchWithError:', error);
      throw error;
    }
  }

  private cleanPath(path: string): string {
    return path.startsWith('/') ? path : `/${path}`;
  }

  private createError(message: string, status: number): Error {
    const error = new Error(message) as BunnyError;
    error.status = status;
    return error;
  }

  private shouldUseVideoApi(path: string): boolean {
    return path.includes('/library/') && (path.includes('/videos') || path.includes('/collections'));
  }

  private shouldUseProxy(path: string): boolean {
    // Always use proxy in production, or when running on Vercel
    const isProduction = import.meta.env.PROD;
    const isVercel = window.location.hostname.includes('vercel.app') || 
                    window.location.hostname.includes('app.vercel.com') ||
                    import.meta.env.VITE_VERCEL_ENV;
    
    // Detect GitHub Pages hosting - it doesn't support backend APIs
    const isGitHubPages = window.location.hostname.includes('.github.io');
    
    // Always use proxy for paths that start with /api/proxy/
    const isProxyPath = path.startsWith('/api/proxy/');
    
    // Don't use proxy on GitHub Pages even in production, as it doesn't support backend
    return (isProduction && !isGitHubPages) || isVercel || this.shouldUseVideoApi(path) || isProxyPath;
  }
}
