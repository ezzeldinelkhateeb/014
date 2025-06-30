import { HttpClient } from '../http-client';
import { UploadProgress } from '../types';

export class SimpleUploadService {
  constructor(
    private httpClient: HttpClient,
    private videoBaseUrl: string
  ) {}

  private getApiKey(libraryId?: string, accessToken?: string): string {
    if (accessToken) {
      return accessToken;
    }
    
    try {
      return this.httpClient.getApiKey(libraryId);
    } catch (error) {
      console.error(`[SimpleUploadService] Error getting API key: ${error.message}`);
      throw error;
    }
  }

  /**
   * Simple direct upload using Bunny.net's direct upload API
   * This bypasses TUS and all the complex resumable upload logic
   */
  async uploadVideoSimple(
    file: File,
    libraryId: string,
    onProgress?: (progress: UploadProgress) => void,
    collectionId?: string,
    accessToken?: string,
    signal?: AbortSignal
  ): Promise<{ guid: string; title: string; warning?: string }> {
    const apiKey = this.getApiKey(libraryId, accessToken);
    if (!apiKey) {
      throw new Error('No API key available for upload');
    }

    console.log(`[SimpleUploadService] Starting simple upload for ${file.name}`);

    try {
      // Step 1: Create video entry
      const { guid, title } = await this.createVideoEntry(file.name, libraryId, apiKey, collectionId);
      console.log(`[SimpleUploadService] Created video entry with GUID: ${guid}`);

      // Step 2: Upload video content directly
      await this.uploadVideoContent(file, libraryId, guid, apiKey, onProgress, signal);
      console.log(`[SimpleUploadService] Upload completed for GUID: ${guid}`);

      return { guid, title };
    } catch (error) {
      console.error('[SimpleUploadService] Upload failed:', error);
      throw error;
    }
  }

  /**
   * Create video entry in Bunny.net
   */
  private async createVideoEntry(
    originalTitle: string,
    libraryId: string,
    apiKey: string,
    collectionId?: string
  ): Promise<{ guid: string; title: string }> {
    const sanitizedTitle = this.sanitizeTitle(originalTitle);
    
    const createData: any = {
      title: sanitizedTitle
    };

    // Only add collection if it's a valid GUID format
    if (collectionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collectionId)) {
      createData.collectionId = collectionId;
    }

    console.log(`[SimpleUploadService] Creating video entry:`, { title: sanitizedTitle, libraryId, hasCollection: !!collectionId });

    try {
      // Try proxy endpoint first
      const response = await this.httpClient.fetchWithError<any>(
        '/api/proxy/create-video',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...createData,
            libraryId,
            accessToken: apiKey
          })
        }
      );

      if (!response?.guid) {
        throw new Error('Failed to create video entry: No GUID in response');
      }

      return { guid: response.guid, title: sanitizedTitle };
    } catch (error) {
      console.error('[SimpleUploadService] Error creating video entry:', error);
      
      // Fallback to direct API
      try {
        const directResponse = await this.httpClient.fetchWithError<any>(
          `/library/${libraryId}/videos`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'AccessKey': apiKey
            },
            body: JSON.stringify(createData)
          }
        );

        if (!directResponse?.guid) {
          throw new Error('Failed to create video entry via direct API');
        }

        return { guid: directResponse.guid, title: sanitizedTitle };
      } catch (directError) {
        console.error('[SimpleUploadService] Direct API also failed:', directError);
        throw new Error(`Failed to create video entry: ${error.message}`);
      }
    }
  }

  /**
   * Upload video content using simple XMLHttpRequest
   */
  private async uploadVideoContent(
    file: File,
    libraryId: string,
    guid: string,
    apiKey: string,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Use direct Bunny CDN URL for simple upload
      const uploadUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`;

      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('AccessKey', apiKey);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');

      let lastTime = Date.now();
      let lastBytes = 0;
      const startTime = lastTime;

      // Progress tracking
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;
          const bytesDiff = event.loaded - lastBytes;
          const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
          
          const progress = (event.loaded / event.total) * 100;
          const totalTimeElapsed = (now - startTime) / 1000;
          const estimatedTotalTime = totalTimeElapsed / (progress / 100);
          const timeRemaining = Math.max(0, estimatedTotalTime - totalTimeElapsed);

          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: progress,
            bytesPerSecond: speed,
            timeRemaining: timeRemaining
          });

          lastBytes = event.loaded;
          lastTime = now;
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log(`[SimpleUploadService] Upload successful for GUID: ${guid}`);
          resolve();
        } else {
          console.error(`[SimpleUploadService] Upload failed for GUID: ${guid}. Status: ${xhr.status}`, xhr.responseText);
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => {
        console.error(`[SimpleUploadService] Network error during upload for GUID: ${guid}`);
        reject(new Error("Network error during upload"));
      };

      xhr.onabort = () => {
        console.log(`[SimpleUploadService] Upload aborted for GUID: ${guid}`);
        reject(new DOMException('Upload aborted by user', 'AbortError'));
      };

      // Handle abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          if (xhr.readyState !== 4) {
            xhr.abort();
          }
        });
      }

      // Start the upload
      xhr.send(file);
    });
  }

  /**
   * Sanitize video title
   */
  private sanitizeTitle(title: string): string {
    // Remove file extension
    const titleWithoutExt = title.replace(/\.[^/.]+$/, '');
    
    // Replace problematic characters
    const sanitized = titleWithoutExt
      .replace(/[<>:"/\\|?*{}]/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/__+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 200);
    
    console.log('[SimpleUploadService] Title sanitization:', 
      `Original: "${title}"`,
      `Final: "${sanitized}"`
    );
    
    return sanitized;
  }
}
