/*
 * Test Google Sheets connection
 * GET /api/test-sheets-connection
 * Returns { success, message, data? }
 */

const { google } = require('googleapis');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Only GET is supported.' });
  }

  try {
    // Retrieve credentials. Support both env var names to remain compatible with existing code.
    const credentialsJSON = process.env.GOOGLE_SHEETS_CREDENTIALS || process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
    if (!credentialsJSON) {
      return res.status(401).json({ success: false, message: 'Google Sheets credentials not configured (GOOGLE_SHEETS_CREDENTIALS or GOOGLE_SHEETS_CREDENTIALS_JSON).' });
    }

    let credentials;
    try {
      credentials = JSON.parse(credentialsJSON);
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to parse Google credentials JSON', error: error instanceof Error ? error.message : String(error) });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) {
      return res.status(500).json({ success: false, message: 'GOOGLE_SHEETS_SPREADSHEET_ID environment variable is not set.' });
    }

    const sheetName = process.env.GOOGLE_SHEET_NAME || 'OPERATIONS';

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Attempt to read a single cell (A1) – minimal quota cost and sufficient to validate access.
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:A1`
    });

    return res.status(200).json({
      success: true,
      message: 'Successfully connected to Google Sheets.',
      data: {
        spreadsheetId,
        sheetName,
        cellA1Value: response.data.values?.[0]?.[0] ?? null,
        hasValuesInRange: !!response.data.values?.length
      }
    });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    const googleMessage = error?.response?.data?.error?.message;
    return res.status(status).json({
      success: false,
      message: 'Failed to connect to Google Sheets',
      error: googleMessage || (error instanceof Error ? error.message : String(error))
    });
  }
} 