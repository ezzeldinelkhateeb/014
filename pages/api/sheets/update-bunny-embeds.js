import { google } from 'googleapis';

// Helper function to convert column letter to index (A=0, B=1, etc.)
function columnToIndex(column) {
  let result = 0;
  for (let i = 0; i < column.length; i++) {
    result = result * 26 + (column.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return result - 1;
}

// Helper function to normalize strings for matching
const normalizeString = (str) => {
  if (!str) return '';
  
  return str
    .trim()
    .replace(/\.[^/.]+$/, '') // Remove file extension
    .replace(/(?:--|—|-)?\s*(?:واجب|homework|الحصة الرابعة|الحصة|درس)\s*\d*/gi, '')
    .replace(/[\[\{\(].*?[\]\}\)]/g, '') // Remove content within brackets
    .replace(/[-_—]+/g, ' ') // Replace dashes with spaces
    .replace(/[أإآ]/g, 'ا') // Normalize Arabic characters
    .replace(/[يى]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
    .toLowerCase();
};

// Function to check if names match
const namesMatch = (nameA, nameB) => {
  const normA = normalizeString(nameA);
  const normB = normalizeString(nameB);
  
  // Direct match
  if (normA === normB) return true;
  
  // Core name comparison (ignoring Q numbers)
  const coreA = normA.replace(/q\s*\d+/gi, '').replace(/\s+/g, ' ').trim();
  const coreB = normB.replace(/q\s*\d+/gi, '').replace(/\s+/g, ' ').trim();
  
  return coreA === coreB && coreA.length > 10;
};

// Function to find matching row
const findMatchingRow = (videoName, rows, nameColumnIndex = 0) => {
  console.log(`[findMatchingRow] Finding match for: "${videoName}"`);
  
  const processedVideoName = videoName.replace(/\.mp4$/i, '');
  
  // Try exact match first
  let exactMatchIndex = rows.findIndex((row) => {
    if (!row || !row[nameColumnIndex]) return false;
    return row[nameColumnIndex].toString().trim() === processedVideoName;
  });
  
  if (exactMatchIndex !== -1) {
    console.log(`[findMatchingRow] ✅ Exact match at row ${exactMatchIndex + 1}`);
    return exactMatchIndex;
  }
  
  // Try normalized match
  const rowIndex = rows.findIndex((row) => {
    if (!row) return false;
    const cellValue = row.length > nameColumnIndex ? row[nameColumnIndex] : row[0];
    if (!cellValue) return false;
    return namesMatch(videoName, cellValue.toString());
  });
  
  console.log('[findMatchingRow] Match result:', rowIndex !== -1 ?
    `Found at row ${rowIndex + 1}` : 'No match found');
  
  return rowIndex;
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey, accesskey');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
      spreadsheetId, 
      sheetName, 
      nameColumn, 
      embedColumn, 
      finalMinutesColumn 
    } = req.body;
    
    console.log('[API] Received request:', {
      videosCount: videos?.length || 0,
      hasCustomConfig: !!(spreadsheetId && sheetName),
      customConfig: { spreadsheetId: spreadsheetId?.substring(0, 10) + '...', sheetName, nameColumn, embedColumn, finalMinutesColumn }
    });
    
    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No videos provided for update',
        results: [],
        stats: { updated: 0, notFound: 0, skipped: 0, error: 0 }
      });
    }
    
    // Use custom config if provided, otherwise fall back to environment variables
    const finalSpreadsheetId = spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const finalSheetName = sheetName || process.env.GOOGLE_SHEET_NAME || 'Sheet1';
    const finalNameColumn = nameColumn || 'M';
    const finalEmbedColumn = embedColumn || 'Q';
    const finalFinalMinutesColumn = finalMinutesColumn || 'P';
    
    console.log('[API] Using configuration:', {
      spreadsheetId: finalSpreadsheetId?.substring(0, 10) + '...',
      sheetName: finalSheetName,
      columns: { name: finalNameColumn, embed: finalEmbedColumn, minutes: finalFinalMinutesColumn }
    });
    
    if (!finalSpreadsheetId) {
      return res.status(500).json({
        success: false,
        message: 'Google Sheets configuration missing. Please provide spreadsheetId or set environment variables.',
        results: [],
        stats: { updated: 0, notFound: 0, skipped: 0, error: 0 }
      });
    }
    
    // Get Google Sheets credentials
    const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
    if (!credentialsJson) {
      return res.status(500).json({
        success: false,
        message: 'Google Sheets credentials not configured',
        results: [],
        stats: { updated: 0, notFound: 0, skipped: 0, error: 0 }
      });
    }
    
    let credentials;
    try {
      credentials = JSON.parse(credentialsJson);
    } catch (parseError) {
      console.error('Failed to parse Google Sheets credentials:', parseError);
      return res.status(500).json({
        success: false,
        message: 'Invalid Google Sheets credentials format',
        results: [],
        stats: { updated: 0, notFound: 0, skipped: 0, error: 0 }
      });
    }
    
    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Get all data from the sheet
    console.log('[API] Reading sheet data...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: finalSpreadsheetId,
      range: `${finalSheetName}!A:Z`,
    });
    
    const rows = response.data.values || [];
    console.log(`[API] Found ${rows.length} rows in sheet`);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet is empty or not found',
        results: [],
        stats: { updated: 0, notFound: 0, skipped: 0, error: 0 }
      });
    }
    
    // Convert column letters to indices
    const nameColumnIndex = columnToIndex(finalNameColumn);
    const embedColumnIndex = columnToIndex(finalEmbedColumn);
    const minutesColumnIndex = columnToIndex(finalFinalMinutesColumn);
    
    console.log('[API] Column indices:', {
      name: `${finalNameColumn}=${nameColumnIndex}`,
      embed: `${finalEmbedColumn}=${embedColumnIndex}`,
      minutes: `${finalFinalMinutesColumn}=${minutesColumnIndex}`
    });
    
    const results = [];
    const stats = { updated: 0, notFound: 0, skipped: 0, error: 0 };
    
    // Process each video
    for (const video of videos) {
      try {
        const videoName = video.name;
        const embedCode = video.embed_code;
        const finalMinutes = video.final_minutes;
        
        console.log(`[API] Processing video: "${videoName}"`);
        
        // Find matching row
        const rowIndex = findMatchingRow(videoName, rows, nameColumnIndex);
        
        if (rowIndex === -1) {
          console.log(`[API] ❌ Video not found: "${videoName}"`);
          results.push({
            videoName,
            status: 'notFound',
            details: 'Video name not found in sheet'
          });
          stats.notFound++;
          continue;
        }
        
        const actualRowNumber = rowIndex + 1; // Convert to 1-based for Google Sheets
        const row = rows[rowIndex];
        
        console.log(`[API] Found video at row ${actualRowNumber}`);
        
        // Check if embed code already exists and is not empty
        const existingEmbedCode = row[embedColumnIndex];
        if (existingEmbedCode && existingEmbedCode.toString().trim() !== '') {
          console.log(`[API] ⏭️ Video already has embed code: "${videoName}"`);
          results.push({
            videoName,
            status: 'skipped',
            details: 'Video already has embed code'
          });
          stats.skipped++;
          continue;
        }
        
        // Prepare updates
        const updates = [];
        
        // Update embed code
        if (embedCode) {
          updates.push({
            range: `${finalSheetName}!${finalEmbedColumn}${actualRowNumber}`,
            values: [[embedCode]]
          });
        }
        
        // Update final minutes if provided and this is not a question video
        if (finalMinutes !== undefined && !videoName.toLowerCase().includes('q')) {
          updates.push({
            range: `${finalSheetName}!${finalFinalMinutesColumn}${actualRowNumber}`,
            values: [[finalMinutes]]
          });
        }
        
        if (updates.length > 0) {
          // Execute the updates
          await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: finalSpreadsheetId,
            requestBody: {
              valueInputOption: 'RAW',
              data: updates
            }
          });
          
          console.log(`[API] ✅ Updated video: "${videoName}" at row ${actualRowNumber}`);
          results.push({
            videoName,
            status: 'updated',
            details: `Updated at row ${actualRowNumber}${finalMinutes !== undefined ? ' with final minutes' : ''}`
          });
          stats.updated++;
        } else {
          console.log(`[API] ⚠️ No updates needed for: "${videoName}"`);
          results.push({
            videoName,
            status: 'skipped',
            details: 'No updates needed'
          });
          stats.skipped++;
        }
        
      } catch (videoError) {
        console.error(`[API] Error processing video "${video.name}":`, videoError);
        results.push({
          videoName: video.name,
          status: 'error',
          details: videoError.message
        });
        stats.error++;
      }
    }
    
    console.log('[API] Final stats:', stats);
    
    // Prepare response
    const success = stats.updated > 0 || (stats.skipped > 0 && stats.error === 0);
    let message = 'Sheet update completed';
    
    if (stats.updated > 0) {
      message = `Successfully updated ${stats.updated} video${stats.updated > 1 ? 's' : ''}`;
    } else if (stats.skipped > 0 && stats.error === 0) {
      message = `All ${stats.skipped} videos already have embed codes`;
    } else if (stats.notFound > 0) {
      message = `${stats.notFound} video${stats.notFound > 1 ? 's' : ''} not found in sheet`;
    } else if (stats.error > 0) {
      message = `${stats.error} error${stats.error > 1 ? 's' : ''} occurred during update`;
    }
    
    return res.status(200).json({
      success,
      message,
      results,
      stats
    });
    
  } catch (error) {
    console.error('[API] Sheet update error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      results: [],
      stats: { updated: 0, notFound: 0, skipped: 0, error: 1 }
    });
  }
}
