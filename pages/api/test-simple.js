module.exports = async function handler(req, res) {
  console.log('[Test Simple] Handler called');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    console.log('[Test Simple] Environment check...');
    
    const envVars = {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      VERCEL_ENV: process.env.VERCEL_ENV || 'not set',
      GOOGLE_SHEETS_CREDENTIALS_JSON: process.env.GOOGLE_SHEETS_CREDENTIALS_JSON ? 'exists' : 'not set',
      GOOGLE_SHEETS_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || 'not set',
      GOOGLE_SHEET_NAME: process.env.GOOGLE_SHEET_NAME || 'not set'
    };

    console.log('[Test Simple] Environment variables:', envVars);

    return res.status(200).json({
      success: true,
      message: 'Simple test successful',
      timestamp: new Date().toISOString(),
      environment: envVars
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