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
    
    console.log(`[Vercel API] Received final minutes update request with ${videos ? videos.length : 0} videos`);

    // Use custom sheet config if provided, otherwise use environment defaults
    const spreadsheetId = customSpreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const sheetName = customSheetName || process.env.GOOGLE_SHEET_NAME || 'OPERATIONS';
    
    if (!Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No videos provided',
        results: [],
        stats: { updated: 0, notFound: 0, skipped: 0, error: 0 }
      });
    }

    const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Helper function to convert column letter to index
    function columnToIndex(column) {
      let index = 0;
      for (let i = 0; i < column.length; i++) {
        index = index * 26 + (column.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
      }
      return index - 1;
    }

    // Calculate column indices
    const nameColumnIndex = columnToIndex(nameColumn);
    const finalMinutesColumnIndex = columnToIndex(finalMinutesColumn);
    
    // Get data from sheet
    const rangeToRead = `${sheetName}!A:${finalMinutesColumn}`;
    
    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rangeToRead,
    });

    const rows = sheetResponse.data.values || [];

    // Enhanced function to normalize text for better matching
    function normalizeText(text) {
      return text
        .replace(/\.mp4$/i, '')
        .replace(/[{}[\]()]/g, '')
        .replace(/--/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    }

    // Create lookup map
    const nameToRowIndex = new Map();
    
    rows.forEach((row, index) => {
      if (row.length > nameColumnIndex && row[nameColumnIndex]) {
        const originalName = row[nameColumnIndex].toString();
        const normalizedName = normalizeText(originalName);
        nameToRowIndex.set(normalizedName, index + 1);
      }
    });

    // Process updates
    const updates = [];
    const results = [];
    const stats = { updated: 0, notFound: 0, skipped: 0, error: 0 };

    for (const video of videos) {
      const originalVideoName = video.name;
      const normalizedVideoName = normalizeText(originalVideoName);
      
      // Find matching row
      let rowIndex = nameToRowIndex.get(normalizedVideoName);
      
      if (!rowIndex) {
        results.push({ 
          videoName: video.name, 
          status: 'notFound',
          details: 'Video name not found in sheet'
        });
        stats.notFound++;
        continue;
      }

      // Convert seconds to minutes (rounded)
      const finalMinutes = Math.round(video.final_minutes || 0);
      
      updates.push({
        range: `${sheetName}!${finalMinutesColumn}${rowIndex}`,
        values: [[finalMinutes]]
      });

      results.push({ 
        videoName: video.name, 
        status: 'updated',
        details: `Successfully updated final minutes: ${finalMinutes} minutes`
      });
      stats.updated++;
    }

    // Perform batch update
    if (updates.length > 0) {
      try {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            data: updates,
            valueInputOption: 'RAW'
          }
        });
      } catch (updateError) {
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
    }

    // Determine overall success
    const actuallyUpdated = stats.updated;
    const hasErrors = stats.error > 0;
    const overallSuccess = actuallyUpdated > 0 && !hasErrors;

    const apiResponse = {
      success: overallSuccess,
      message: actuallyUpdated > 0 
        ? `تم تحديث ${stats.updated} فيديو بنجاح, ${stats.notFound} غير موجود`
        : `لم يتم تحديث أي فيديو: ${stats.notFound} غير موجود`,
      results: results,
      stats
    };

    return res.status(200).json(apiResponse);

  } catch (error) {
    console.error('[Vercel API] Error updating final minutes:', error);
    let message = 'Internal server error during final minutes update';
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
