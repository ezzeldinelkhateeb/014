/**
 * Google Sheets Update API - JavaScript version
 * Updates video embed codes in Google Sheets
 */

const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Helper function to normalize strings for matching
const normalizeString = (str) => {
  if (!str) return '';

  console.log('[Normalize] Original:', str);

  let normalized = str
    .trim()
    // Remove file extension first
    .replace(/\.[^/.]+$/, '')
    // Remove multiple spaces and normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove common brackets and parentheses content
    .replace(/[\[\](){}]/g, ' ')
    // Remove multiple dashes and normalize
    .replace(/[-_]+/g, '-')
    // Final cleanup
    .replace(/\s+/g, ' ')
    .trim();

  console.log('[Normalize] Result:', normalized);
  return normalized;
};

// Extract Q numbers from string
const extractQNumbers = (str) => {
  const qMatches = str.match(/Q\d+/gi) || [];
  return qMatches.map(q => q.toUpperCase());
};

// Check if two names match
const namesMatch = (nameA, nameB) => {
  console.log('\n[Match] Comparing:');
  console.log('[Match] A:', nameA);
  console.log('[Match] B:', nameB);

  if (!nameA || !nameB) {
    console.log('[Match] One of the names is empty');
    return false;
  }

  // Direct match
  if (nameA === nameB) {
    console.log('[Match] ✅ Direct match');
    return true;
  }

  // Normalize both strings
  const normalizedA = normalizeString(nameA);
  const normalizedB = normalizeString(nameB);

  console.log('[Match] Normalized A:', normalizedA);
  console.log('[Match] Normalized B:', normalizedB);

  // Check normalized match
  if (normalizedA === normalizedB) {
    console.log('[Match] ✅ Normalized match');
    return true;
  }

  // Extract and compare Q numbers
  const qNumbersA = extractQNumbers(nameA);
  const qNumbersB = extractQNumbers(nameB);

  console.log('[Match] Q numbers A:', qNumbersA);
  console.log('[Match] Q numbers B:', qNumbersB);

  // If both have Q numbers, they must match
  if (qNumbersA.length > 0 && qNumbersB.length > 0) {
    const qMatch = qNumbersA.some(qA => qNumbersB.includes(qA));
    console.log('[Match] Q numbers match:', qMatch);
    
    if (qMatch) {
      // Additional check: verify the base names are similar
      const baseA = normalizedA.replace(/Q\d+/gi, '').trim();
      const baseB = normalizedB.replace(/Q\d+/gi, '').trim();
      
      console.log('[Match] Base A (no Q):', baseA);
      console.log('[Match] Base B (no Q):', baseB);
      
      if (baseA && baseB && (baseA.includes(baseB) || baseB.includes(baseA))) {
        console.log('[Match] ✅ Q number + base name match');
        return true;
      }
    }
  }

  // Partial match check
  if (normalizedA.length > 10 && normalizedB.length > 10) {
    if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
      console.log('[Match] ✅ Partial match (one contains the other)');
      return true;
    }
  }

  console.log('[Match] ❌ No match found');
  return false;
};

// Find matching row in sheet data
const findMatchingRow = (videoName, rows, nameColumnIndex = 0) => {
  console.log(`\n[FindRow] Looking for: "${videoName}"`);
  console.log(`[FindRow] Searching in ${rows.length} rows, column index: ${nameColumnIndex}`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[nameColumnIndex]) continue;

    const cellValue = String(row[nameColumnIndex]).trim();
    if (!cellValue) continue;

    console.log(`[FindRow] Row ${i + 2}: "${cellValue}"`);

    if (namesMatch(videoName, cellValue)) {
      console.log(`[FindRow] ✅ Found match at row ${i + 2}`);
      return i;
    }
  }

  console.log('[FindRow] ❌ No matching row found');
  return -1;
};

// Get column index from letter
const getColumnIndex = (letter) => {
  if (!letter) return 0;
  
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return result - 1;
};

// Convert number to column letter
const getColumnLetter = (index) => {
  let result = '';
  while (index >= 0) {
    result = String.fromCharCode((index % 26) + 'A'.charCodeAt(0)) + result;
    index = Math.floor(index / 26) - 1;
  }
  return result;
};

// Main handler function
async function handler(req, res) {
  console.log('[API] Sheets update handler called');
  console.log('[API] Method:', req.method);

  // CORS handling
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      videos, 
      spreadsheetId, 
      sheetName = 'OPERATIONS',
      nameColumn = 'M',
      embedColumn = 'V', 
      finalMinutesColumn = 'P'
    } = req.body;

    console.log('[API] Request data:', {
      videosCount: videos?.length || 0,
      spreadsheetId: spreadsheetId || 'using default',
      sheetName,
      nameColumn,
      embedColumn,
      finalMinutesColumn
    });

    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Videos array is required'
      });
    }

    // Get Google Sheets credentials - try both possible environment variable names
    const credentials = process.env.GOOGLE_SHEETS_CREDENTIALS || process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
    if (!credentials) {
      console.error('[Sheets] Available environment variables:', Object.keys(process.env).filter(key => key.includes('GOOGLE') || key.includes('SHEETS')));
      throw new Error('Google Sheets credentials not found. Please set GOOGLE_SHEETS_CREDENTIALS or GOOGLE_SHEETS_CREDENTIALS_JSON in Vercel environment variables.');
    }

    console.log('[Sheets] Found credentials, parsing...');
    const parsedCredentials = JSON.parse(credentials);
    console.log('[Sheets] Credentials parsed successfully, service account email:', parsedCredentials.client_email);
    
    const auth = new google.auth.GoogleAuth({
      credentials: parsedCredentials,
      scopes: SCOPES,
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const targetSpreadsheetId = spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    if (!targetSpreadsheetId) {
      throw new Error('Spreadsheet ID not provided');
    }

    console.log('[API] Getting sheet data...');

    // Get all data from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSpreadsheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values || [];
    console.log(`[API] Retrieved ${rows.length} rows from sheet`);

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'No data found',
        message: 'Sheet appears to be empty'
      });
    }

    // Get column indices
    const nameColumnIndex = getColumnIndex(nameColumn);
    const embedColumnIndex = getColumnIndex(embedColumn);
    const finalMinutesColumnIndex = getColumnIndex(finalMinutesColumn);

    console.log('[API] Column mapping:', {
      name: `${nameColumn} (index ${nameColumnIndex})`,
      embed: `${embedColumn} (index ${embedColumnIndex})`,
      finalMinutes: `${finalMinutesColumn} (index ${finalMinutesColumnIndex})`
    });

    // Track existing embed codes to avoid duplicates
    const existingEmbeds = new Map();
    rows.forEach((row, index) => {
      if (row[embedColumnIndex]) {
        existingEmbeds.set(index, row[embedColumnIndex]);
      }
    });

    const results = [];
    const updates = [];

    // Process each video
    for (const video of videos) {
      console.log(`\n[API] Processing video: ${video.name}`);
      
      const rowIndex = findMatchingRow(video.name, rows, nameColumnIndex);
      
      if (rowIndex === -1) {
        results.push({
          videoName: video.name,
          status: 'notFound',
          details: 'No matching row found in sheet'
        });
        console.log('[API] Video not found in sheet');
        continue;
      }

      const actualRowNumber = rowIndex + 1; // Convert to 1-based indexing for sheets

      // Check if embed code already exists and is the same
      const existingEmbed = existingEmbeds.get(rowIndex);
      if (existingEmbed && existingEmbed.trim() === video.embed_code.trim()) {
        results.push({
          videoName: video.name,
          status: 'skipped',
          details: 'Embed code already up to date'
        });
        console.log('[API] Embed code already exists, skipping');
        continue;
      }

      // Prepare update for embed code
      const embedRange = `${sheetName}!${embedColumn}${actualRowNumber}`;
      updates.push({
        range: embedRange,
        values: [[video.embed_code]]
      });

      // Prepare update for final minutes if provided
      if (video.final_minutes !== undefined && finalMinutesColumn) {
        const minutesRange = `${sheetName}!${finalMinutesColumn}${actualRowNumber}`;
        updates.push({
          range: minutesRange,
          values: [[video.final_minutes.toString()]]
        });
      }

      results.push({
        videoName: video.name,
        status: 'updated',
        details: `Updated row ${actualRowNumber}`
      });

      console.log(`[API] Prepared update for row ${actualRowNumber}`);
    }

    // Perform batch update if there are updates
    if (updates.length > 0) {
      console.log(`[API] Performing batch update with ${updates.length} updates...`);

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: targetSpreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates
        }
      });

      console.log('[API] Batch update completed successfully');
    } else {
      console.log('[API] No updates needed');
    }

    // Calculate stats
    const stats = {
      updated: results.filter(r => r.status === 'updated').length,
      notFound: results.filter(r => r.status === 'notFound').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      error: results.filter(r => r.status === 'error').length
    };

    console.log('[API] Update complete. Stats:', stats);

    return res.status(200).json({
      success: true,
      message: `Updated ${stats.updated} videos successfully`,
      results,
      stats
    });

  } catch (error) {
    console.error('[API] Error updating sheet:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      details: error.stack
    });
  }
}

module.exports = handler;
