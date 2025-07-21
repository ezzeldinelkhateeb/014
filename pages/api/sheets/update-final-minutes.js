/*
 * Update Final Minutes API
 * POST /api/sheets/update-final-minutes
 * Body: { videos: [{ name, final_minutes }], spreadsheetId?, sheetName?, nameColumn?, finalMinutesColumn? }
 */

const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Utility: convert column letter to zero-based index (A -> 0, B -> 1, ...)
const getColumnIndex = (letter) => {
  return letter.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
};

// Utility: basic name normalisation (remove extension, extra spaces, brackets)
const normalizeString = (str) => {
  if (!str) return '';
  return str
    .trim()
    .replace(/\.[^/.]+$/, '') // remove extension
    .replace(/\s+/g, ' ') // collapse spaces
    .replace(/[\[\](){}]/g, ' ') // remove brackets
    .replace(/[-_]+/g, '-') // normalise dashes/underscores
    .replace(/\s+/g, ' ') // collapse again
    .trim();
};

// Simple matcher – reuse logic from update-bunny-embeds (exact or normalized match)
const namesMatch = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  return normalizeString(a) === normalizeString(b);
};

const findMatchingRow = (videoName, rows, nameColumnIndex) => {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[nameColumnIndex]) continue;
    if (namesMatch(String(row[nameColumnIndex]).trim(), videoName)) {
      return i; // zero-based index
    }
  }
  return -1;
};

module.exports = async function handler(req, res) {
  // CORS preflight
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
      finalMinutesColumn = 'P'
    } = req.body;

    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({ error: 'Videos array is required' });
    }

    const credentialsJSON = process.env.GOOGLE_SHEETS_CREDENTIALS || process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
    if (!credentialsJSON) {
      return res.status(401).json({ success: false, message: 'Google Sheets credentials not configured (GOOGLE_SHEETS_CREDENTIALS or GOOGLE_SHEETS_CREDENTIALS_JSON).' });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(credentialsJSON),
      scopes: SCOPES
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const targetSpreadsheetId = spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!targetSpreadsheetId) {
      return res.status(500).json({ error: 'Spreadsheet ID not provided' });
    }

    // Fetch entire sheet (up to Z) – cheap and simplifies matching
    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSpreadsheetId,
      range: `${sheetName}!A:Z`
    });
    const rows = sheetResponse.data.values || [];

    const nameIdx = getColumnIndex(nameColumn);
    const minutesIdx = getColumnIndex(finalMinutesColumn);

    const updates = [];
    const results = [];

    for (const video of videos) {
      const rowIndex = findMatchingRow(video.name, rows, nameIdx);
      if (rowIndex === -1) {
        results.push({ videoName: video.name, status: 'notFound', details: 'Name not found in sheet' });
        continue;
      }

      // Check if minutes already equal to avoid redundant writes
      const currentValue = rows[rowIndex][minutesIdx];
      if (currentValue && parseInt(currentValue, 10) === video.final_minutes) {
        results.push({ videoName: video.name, status: 'skipped', details: 'Minutes already up-to-date' });
        continue;
      }

      const rowNumber = rowIndex + 1; // sheets are 1-based
      const range = `${sheetName}!${finalMinutesColumn}${rowNumber}`;
      updates.push({ range, values: [[String(video.final_minutes)]] });
      results.push({ videoName: video.name, status: 'updated', details: `Row ${rowNumber}` });
    }

    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: targetSpreadsheetId,
        requestBody: { valueInputOption: 'RAW', data: updates }
      });
    }

    const stats = {
      updated: results.filter((r) => r.status === 'updated').length,
      notFound: results.filter((r) => r.status === 'notFound').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      error: results.filter((r) => r.status === 'error').length
    };

    return res.status(200).json({ success: true, message: 'Final minutes update finished', results, stats });
  } catch (error) {
    console.error('[API] update-final-minutes error:', error);
    const status = error?.response?.status || error?.status || 500;
    const googleMessage = error?.response?.data?.error?.message;
    return res.status(status).json({ success: false, message: googleMessage || error?.message || 'Failed to update final minutes', error: error?.message || String(error) });
  }
}; 