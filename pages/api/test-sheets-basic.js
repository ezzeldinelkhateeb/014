const { google } = require('googleapis');

module.exports = async function handler(req, res) {
  console.log('[Test Sheets Basic] Handler called');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    console.log('[Test Sheets Basic] Starting test...');
    
    // Step 1: Check credentials
    const credentialsJSON = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
    if (!credentialsJSON) {
      console.log('[Test Sheets Basic] No credentials found');
      return res.status(401).json({
        success: false,
        message: 'No Google Sheets credentials found'
      });
    }

    console.log('[Test Sheets Basic] Credentials found, length:', credentialsJSON.length);

    // Step 2: Parse credentials
    let credentials;
    try {
      credentials = JSON.parse(credentialsJSON);
      console.log('[Test Sheets Basic] Credentials parsed successfully');
    } catch (parseError) {
      console.error('[Test Sheets Basic] Failed to parse credentials:', parseError.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials JSON format',
        error: parseError.message
      });
    }

    // Step 3: Check spreadsheet ID
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) {
      console.log('[Test Sheets Basic] No spreadsheet ID found');
      return res.status(401).json({
        success: false,
        message: 'No spreadsheet ID found'
      });
    }

    console.log('[Test Sheets Basic] Spreadsheet ID found:', spreadsheetId);

    // Step 4: Initialize Google Auth
    console.log('[Test Sheets Basic] Initializing Google Auth...');
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    console.log('[Test Sheets Basic] Auth initialized');

    // Step 5: Create sheets client
    console.log('[Test Sheets Basic] Creating sheets client...');
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('[Test Sheets Basic] Sheets client created');

    // Step 6: Test connection with minimal request
    console.log('[Test Sheets Basic] Testing connection...');
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [],
      includeGridData: false
    });

    console.log('[Test Sheets Basic] Connection successful');
    console.log('[Test Sheets Basic] Spreadsheet title:', response.data.properties?.title);

    return res.status(200).json({
      success: true,
      message: 'Google Sheets connection successful',
      data: {
        spreadsheetId,
        title: response.data.properties?.title || 'Unknown',
        sheets: response.data.sheets?.map(s => s.properties?.title) || []
      }
    });

  } catch (error) {
    console.error('[Test Sheets Basic] Error:', error);
    console.error('[Test Sheets Basic] Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status
    });

    // Handle specific Google API errors
    if (error.response?.data?.error) {
      const googleError = error.response.data.error;
      console.error('[Test Sheets Basic] Google API Error:', googleError);
      
      if (googleError.code === 403) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Please share the spreadsheet with the service account.',
          error: googleError.message
        });
      }
      
      if (googleError.code === 404) {
        return res.status(404).json({
          success: false,
          message: 'Spreadsheet not found. Please check the spreadsheet ID.',
          error: googleError.message
        });
      }
    }

    // Handle other errors
    if (error.code === 403) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Please check permissions.',
        error: error.message
      });
    }
    
    if (error.code === 404) {
      return res.status(404).json({
        success: false,
        message: 'Spreadsheet not found.',
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Google Sheets connection failed',
      error: error.message
    });
  }
}; 