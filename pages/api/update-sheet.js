/**
 * Sheet Update API endpoint
 * Handles updating Google Sheets with video embed codes
 */

export default async function handler(req, res) {
  console.log('[API] /api/update-sheet called');
  console.log('[API] Method:', req.method);
  console.log('[API] Headers:', JSON.stringify(req.headers, null, 2));
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('[API] Method not allowed:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported' 
    });
  }

  try {
    const { videos, sheetConfig } = req.body;
    
    console.log('[API] Request body received:');
    console.log('[API] Videos count:', videos?.length || 0);
    console.log('[API] Has sheet config:', !!sheetConfig);
    
    if (sheetConfig) {
      console.log('[API] Sheet config details:', {
        spreadsheetId: sheetConfig.spreadsheetId,
        sheetName: sheetConfig.sheetName,
        nameColumn: sheetConfig.nameColumn || sheetConfig.videoNameColumn,
        embedColumn: sheetConfig.embedColumn || sheetConfig.embedCodeColumn,
        finalMinutesColumn: sheetConfig.finalMinutesColumn
      });
    }

    // Validate request
    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      console.log('[API] Invalid videos data');
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Videos array is required and must not be empty'
      });
    }

    // Forward the request to the appropriate sheet update endpoint
    console.log('[API] Forwarding to sheet update endpoint...');
    
    // Determine which endpoint to use based on sheet config
    const targetEndpoint = sheetConfig ? 
      '/api/sheets/update-bunny-embeds' : 
      '/api/sheets/update-bunny-embeds';
    
    // Prepare the body for the sheet update service
    const updateBody = {
      videos: videos,
      ...(sheetConfig && {
        spreadsheetId: sheetConfig.spreadsheetId,
        sheetName: sheetConfig.sheetName,
        nameColumn: sheetConfig.nameColumn || sheetConfig.videoNameColumn || 'M',
        embedColumn: sheetConfig.embedColumn || sheetConfig.embedCodeColumn || 'V',
        finalMinutesColumn: sheetConfig.finalMinutesColumn || 'P'
      })
    };

    console.log('[API] Prepared update body:', JSON.stringify({
      videosCount: updateBody.videos.length,
      spreadsheetId: updateBody.spreadsheetId,
      sheetName: updateBody.sheetName,
      columns: {
        name: updateBody.nameColumn,
        embed: updateBody.embedColumn,
        minutes: updateBody.finalMinutesColumn
      }
    }, null, 2));

    // Make the internal request
    const baseUrl = req.headers.host ? `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}` : 'http://localhost:3000';
    const fullUrl = `${baseUrl}${targetEndpoint}`;
    
    console.log('[API] Making request to:', fullUrl);
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'UpdateSheet-API/1.0'
      },
      body: JSON.stringify(updateBody)
    });

    console.log('[API] Sheet service response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Sheet service error:', errorText);
      
      return res.status(response.status).json({
        error: 'Sheet update failed',
        message: `Sheet service returned ${response.status}`,
        details: errorText
      });
    }

    const result = await response.json();
    console.log('[API] Sheet service result:', {
      success: result.success,
      statsUpdated: result.stats?.updated || 0,
      statsNotFound: result.stats?.notFound || 0,
      statsSkipped: result.stats?.skipped || 0
    });

    // Return the result
    return res.status(200).json(result);

  } catch (error) {
    console.error('[API] /api/update-sheet error:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Unknown error occurred',
      details: error.stack
    });
  }
}
