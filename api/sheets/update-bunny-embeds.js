import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      message: 'Method not allowed',
      results: [],
      stats: { updated: 0, notFound: 0, skipped: 0, error: 0 }
    });
  }

  try {
    const { 
      videos, 
      spreadsheetId: customSpreadsheetId, 
      sheetName: customSheetName, 
      nameColumn = 'N', 
      embedColumn = 'W', 
      finalMinutesColumn = 'Q' 
    } = req.body;
    
    console.log(`[Vercel API] Received request with ${videos ? videos.length : 0} videos`);
    
    if (videos && videos.length > 0) {
      console.log(`[Vercel API] First video name: "${videos[0].name}"`);
    }
    
    // Use custom sheet config if provided, otherwise use environment defaults
    const spreadsheetId = customSpreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const sheetName = customSheetName || process.env.GOOGLE_SHEET_NAME || 'OPERATIONS';
    
    console.log(`[Vercel API] Using spreadsheet: ${spreadsheetId}, sheet: ${sheetName}`);
    console.log(`[Vercel API] Columns: Name=${nameColumn}, Embed=${embedColumn}, Minutes=${finalMinutesColumn}`);

    if (!Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No videos provided',
        results: [],
        stats: { updated: 0, notFound: 0, skipped: 0, error: 0 }
      });
    }

    // Validate environment variables
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS_JSON) {
      throw new Error('Google Sheets credentials not configured');
    }

    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID not configured');
    }

    const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Helper function to convert column letter to index (A=0, B=1, etc.)
    function columnToIndex(column) {
      let index = 0;
      for (let i = 0; i < column.length; i++) {
        index = index * 26 + (column.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
      }
      return index - 1;
    }

    // Calculate column indices
    const nameColumnIndex = columnToIndex(nameColumn);
    const embedColumnIndex = columnToIndex(embedColumn);
    
    // Calculate range to read based on provided columns
    const maxColumnIndex = Math.max(nameColumnIndex, embedColumnIndex);
    
    // Convert back to column letter for multi-letter columns
    function indexToColumn(index) {
      let column = '';
      index++; // Convert from 0-based to 1-based
      while (index > 0) {
        index--; // Convert back to 0-based for calculation
        column = String.fromCharCode((index % 26) + 'A'.charCodeAt(0)) + column;
        index = Math.floor(index / 26);
      }
      return column;
    }
    
    const endColumnLetter = indexToColumn(maxColumnIndex);
    const rangeToRead = `${sheetName}!A:${endColumnLetter}`;
    
    console.log(`[Vercel API] Reading range: ${rangeToRead}`);
    
    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rangeToRead,
    });

    const rows = sheetResponse.data.values || [];
    console.log(`[Vercel API] Found ${rows.length} rows in sheet`);

    // Enhanced function to normalize text for better matching
    function normalizeText(text) {
      return text
        .replace(/\.mp4$/i, '') // Remove .mp4 extension
        .replace(/[{}[\]()]/g, '') // Remove brackets
        .replace(/--/g, '-') // Replace double dashes
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim()
        .toLowerCase();
    }

    // Create lookup maps for efficient matching
    const nameToRowIndex = new Map();
    const existingEmbeds = new Map();
    
    rows.forEach((row, index) => {
      if (row.length > nameColumnIndex && row[nameColumnIndex]) {
        const originalName = row[nameColumnIndex].toString();
        const normalizedName = normalizeText(originalName);
        nameToRowIndex.set(normalizedName, index + 1);
        
        // Check if embed exists
        if (row.length > embedColumnIndex && row[embedColumnIndex]) {
          existingEmbeds.set(index + 1, row[embedColumnIndex].toString());
        }
      }
    });

    // Process videos
    const updates = [];
    const results = [];
    const stats = { updated: 0, notFound: 0, skipped: 0, error: 0 };

    for (const video of videos) {
      const originalVideoName = video.name;
      const normalizedVideoName = normalizeText(originalVideoName);
      
      console.log(`[Vercel API] Processing video: "${originalVideoName}"`);
      console.log(`[Vercel API] Normalized name: "${normalizedVideoName}"`);
      
      // Find row index
      let rowIndex = nameToRowIndex.get(normalizedVideoName);
      
      if (!rowIndex) {
        console.log(`[Vercel API] Video not found: "${originalVideoName}"`);
        results.push({ 
          videoName: video.name, 
          status: 'notFound',
          details: 'Video name not found in sheet'
        });
        stats.notFound++;
        continue;
      }

      console.log(`[Vercel API] Found video in row ${rowIndex}`);
      
      // Check for existing embed
      const existingEmbed = existingEmbeds.get(rowIndex);
      if (existingEmbed && existingEmbed.trim().length > 0) {
        console.log(`[Vercel API] Video already has embed code, skipping`);
        results.push({ 
          videoName: video.name, 
          status: 'skipped',
          details: 'Cell already contains embed code'
        });
        stats.skipped++;
        continue;
      }

      // Add update for embed code
      updates.push({
        range: `${sheetName}!${embedColumn}${rowIndex}`,
        values: [[video.embed_code]]
      });

      results.push({ 
        videoName: video.name, 
        status: 'updated',
        details: 'Successfully updated embed code'
      });
      stats.updated++;
      console.log(`[Vercel API] Will update row ${rowIndex} for "${originalVideoName}"`);
    }

    // Perform batch update if there are updates
    if (updates.length > 0) {
      console.log(`[Vercel API] Performing batch update for ${updates.length} cells`);
      try {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            data: updates,
            valueInputOption: 'RAW'
          }
        });
        console.log('[Vercel API] Batch update successful');
      } catch (updateError) {
        console.error('[Vercel API] Batch update failed:', updateError);
        
        // Mark updated videos as errors
        results.forEach(result => {
          if (result.status === 'updated') {
            result.status = 'error';
            result.details = 'Failed to update sheet - batch update error';
            stats.updated--;
            stats.error++;
          }
        });
        
        throw updateError;
      }
    } else {
      console.log('[Vercel API] No updates to perform');
    }

    // Determine overall success
    const actuallyUpdated = stats.updated;
    const hasErrors = stats.error > 0;
    const overallSuccess = actuallyUpdated > 0 && !hasErrors;

    const apiResponse = {
      success: overallSuccess,
      message: actuallyUpdated > 0 
        ? `تم تحديث ${stats.updated} فيديو بنجاح, ${stats.notFound} غير موجود, ${stats.skipped} تم تخطيه`
        : `لم يتم تحديث أي فيديو: ${stats.notFound} غير موجود, ${stats.skipped} تم تخطيه`,
      results: results,
      stats
    };

    return res.status(200).json(apiResponse);

  } catch (error) {
    console.error('[Vercel API] Error in sheet update:', error);
    let message = 'Internal server error during sheet update';
    if (error instanceof Error) {
      message = error.message;
    }
    
    return res.status(500).json({
      success: false,
      message: message,
      results: [],
      stats: { updated: 0, notFound: 0, skipped: 0, error: 1 }
    });
  }
}
