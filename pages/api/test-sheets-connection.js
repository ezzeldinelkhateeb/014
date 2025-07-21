/*
 * Test Google Sheets connection
 * GET /api/test-sheets-connection
 * Returns { success, message, data? }
 */

const { google } = require('googleapis');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  console.log('[Test Connection] Starting connection test...');
  
  try {
    const credentialsJSON = process.env.GOOGLE_SHEETS_CREDENTIALS || process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
    if (!credentialsJSON) {
      console.error('[Test Connection] No credentials found');
      return res.status(401).json({
        success: false,
        message: 'Google Sheets credentials not configured. Please set GOOGLE_SHEETS_CREDENTIALS or GOOGLE_SHEETS_CREDENTIALS_JSON in Vercel environment variables.'
      });
    }

    console.log('[Test Connection] Credentials found, length:', credentialsJSON.length);

    let credentials;
    try {
      credentials = JSON.parse(credentialsJSON);
      console.log('[Test Connection] Credentials parsed successfully');
    } catch (parseError) {
      console.error('[Test Connection] Failed to parse credentials JSON:', parseError.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid Google Sheets credentials JSON format.',
        error: parseError.message
      });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) {
      console.error('[Test Connection] No spreadsheet ID found');
      return res.status(401).json({
        success: false,
        message: 'GOOGLE_SHEETS_SPREADSHEET_ID environment variable is not set.'
      });
    }

    console.log('[Test Connection] Spreadsheet ID found:', spreadsheetId);

    const sheetName = process.env.GOOGLE_SHEET_NAME || 'Sheet1';
    console.log('[Test Connection] Using sheet name:', sheetName);

    console.log('[Test Connection] Initializing Google Sheets API...');

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    console.log('[Test Connection] Auth initialized, creating sheets client...');

    const sheets = google.sheets({ version: 'v4', auth });

    console.log('[Test Connection] Attempting to read sheet...');
    // Attempt to read a single cell (A1) – minimal quota cost and sufficient to validate access.
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:A1`,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });

    console.log('[Test Connection] Successfully read sheet');
    console.log('[Test Connection] Response data:', {
      hasValues: !!response.data.values,
      valuesLength: response.data.values?.length || 0,
      firstCellValue: response.data.values?.[0]?.[0] || 'empty'
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
    console.error('[Test Connection] Error:', error);
    console.error('[Test Connection] Error details:', {
      code: error.code,
      status: error.status,
      message: error.message,
      response: error.response?.data,
      stack: error.stack?.substring(0, 500)
    });
    
    // Handle specific Google API errors
    if (error.response?.data?.error) {
      const googleError = error.response.data.error;
      console.error('[Test Connection] Google API Error:', googleError);
      
      if (googleError.code === 403) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Please share the spreadsheet with the service account email.',
          error: googleError.message,
          details: googleError
        });
      }
      
      if (googleError.code === 404) {
        return res.status(404).json({
          success: false,
          message: 'Spreadsheet not found. Please check the GOOGLE_SHEETS_SPREADSHEET_ID.',
          error: googleError.message,
          details: googleError
        });
      }
    }
    
    // Check if it's a Google API error
    if (error.code === 403) {
      console.error('[Test Connection] 403 Forbidden - Check permissions for service account');
      return res.status(403).json({
        success: false,
        message: 'Access denied. Please check if the service account has permission to access this spreadsheet.',
        error: error.message
      });
    }
    
    if (error.code === 404) {
      console.error('[Test Connection] 404 Not Found - Check spreadsheet ID');
      return res.status(404).json({
        success: false,
        message: 'Spreadsheet not found. Please check the GOOGLE_SHEETS_SPREADSHEET_ID.',
        error: error.message
      });
    }
    
    // Check for specific Google API errors
    if (error.response?.data?.error?.message) {
      const googleError = error.response.data.error;
      console.error('[Test Connection] Google API Error:', googleError);
      
      if (googleError.message.includes('Requested entity was not found')) {
        return res.status(404).json({
          success: false,
          message: 'Spreadsheet not found or access denied. Please check the spreadsheet ID and permissions.',
          error: googleError.message
        });
      }
      
      if (googleError.message.includes('The caller does not have permission')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Please share the spreadsheet with the service account email.',
          error: googleError.message
        });
      }
    }
    
    const status = error?.response?.status || error?.status || 500;
    const googleMessage = error?.response?.data?.error?.message;
    
    return res.status(status).json({
      success: false,
      message: 'Failed to connect to Google Sheets',
      error: googleMessage || error.message || 'Unknown error occurred'
    });
  }
}; 