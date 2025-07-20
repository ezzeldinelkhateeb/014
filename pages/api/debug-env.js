/**
 * Debug Environment Variables API
 * Shows what environment variables are available
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const envVars = {
      // Core API Keys
      VITE_BUNNY_API_KEY: process.env.VITE_BUNNY_API_KEY ? `${process.env.VITE_BUNNY_API_KEY.substring(0, 8)}...` : 'NOT_SET',
      
      // Google Sheets
      GOOGLE_SHEETS_CREDENTIALS: process.env.GOOGLE_SHEETS_CREDENTIALS ? 'SET (JSON)' : 'NOT_SET',
      GOOGLE_SHEETS_CREDENTIALS_JSON: process.env.GOOGLE_SHEETS_CREDENTIALS_JSON ? 'SET (JSON)' : 'NOT_SET',
      GOOGLE_SHEETS_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_SPREADSHEET_ID ? `${process.env.GOOGLE_SHEETS_SPREADSHEET_ID.substring(0, 8)}...` : 'NOT_SET',
      
      // Vercel Environment
      VERCEL: process.env.VERCEL || 'NOT_SET',
      NODE_ENV: process.env.NODE_ENV || 'NOT_SET',
      
      // Count total environment variables
      TOTAL_ENV_VARS: Object.keys(process.env).length
    };
    
    const googleCredsAvailable = !!(process.env.GOOGLE_SHEETS_CREDENTIALS || process.env.GOOGLE_SHEETS_CREDENTIALS_JSON);
    const spreadsheetIdAvailable = !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    return res.status(200).json({
      success: true,
      environment: envVars,
      googleSheetsReady: googleCredsAvailable && spreadsheetIdAvailable,
      issues: [
        ...(googleCredsAvailable ? [] : ['Google Sheets credentials missing']),
        ...(spreadsheetIdAvailable ? [] : ['Google Sheets spreadsheet ID missing'])
      ],
      allEnvKeys: Object.keys(process.env).filter(key => 
        key.includes('GOOGLE') || 
        key.includes('BUNNY') || 
        key.includes('SHEETS') ||
        key.includes('VERCEL')
      )
    });
    
  } catch (error) {
    console.error('[DEBUG-ENV] Error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to read environment variables',
      message: error.message
    });
  }
}
