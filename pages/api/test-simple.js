module.exports = async function handler(req, res) {
  console.log('[Test Simple] Handler called');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    console.log('[Test Simple] Starting basic test...');
    
    // Basic environment check without any external dependencies
    const basicInfo = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      NODE_ENV: process.env.NODE_ENV || 'not set',
      VERCEL_ENV: process.env.VERCEL_ENV || 'not set',
      hasCredentials: !!process.env.GOOGLE_SHEETS_CREDENTIALS_JSON,
      hasSpreadsheetId: !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      hasSheetName: !!process.env.GOOGLE_SHEET_NAME
    };

    console.log('[Test Simple] Basic info collected:', basicInfo);

    return res.status(200).json({
      success: true,
      message: 'Simple test successful',
      data: basicInfo
    });
  } catch (error) {
    console.error('[Test Simple] Error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Simple test failed',
      error: error.message,
      stack: error.stack?.substring(0, 200)
    });
  }
}; 