interface SheetUpdateResult {
  success: boolean;
  message?: string;
  notFound?: boolean;
  sheetUpdated?: boolean;
  status?: 'updated' | 'notFound' | 'skipped' | 'error';
  details?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Updates the Google Sheet with video information
 */
export async function updateSheetForVideo(
  videoTitle: string, 
  videoGuid: string, 
  libraryId: string
): Promise<SheetUpdateResult> {
  try {
    const embedCode = `<div style="position:relative;padding-top:56.25%;"><iframe src="https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>`;

    const response = await fetch(`${API_BASE_URL}/api/sheets/update-bunny-embeds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AccessKey': import.meta.env.VITE_BUNNY_API_KEY || '',
      },
      credentials: 'include',
      body: JSON.stringify({
        videos: [{
          name: videoTitle,
          embed_code: embedCode
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sheet update error:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      // Check for specific video status in results array
      const videoResult = data.results?.find(r => r.videoName === videoTitle);
      
      if (videoResult) {
        return {
          success: videoResult.status === 'updated',
          status: videoResult.status,
          message: videoResult.details || data.message,
          notFound: videoResult.status === 'notFound',
          sheetUpdated: videoResult.status === 'updated'
        };
      }
      
      // Legacy fallback for older API responses
      if (data.not_found_videos?.includes(videoTitle)) {
        return {
          success: false,
          status: 'notFound',
          message: 'Video not found in sheet',
          notFound: true
        };
      }
      
      return {
        success: true,
        status: 'updated',
        message: 'Sheet updated successfully',
        sheetUpdated: true
      };
    } 
    
    return {
      success: false,
      message: data.message || 'Sheet update failed'
    };

  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
