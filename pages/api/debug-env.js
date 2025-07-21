/**
 * Debug Environment Variables API
 * GET /api/debug-env
 * Returns environment variable status for debugging
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const envVars = {
      // Google Sheets related
      GOOGLE_SHEETS_CREDENTIALS: {
        exists: !!process.env.GOOGLE_SHEETS_CREDENTIALS,
        length: process.env.GOOGLE_SHEETS_CREDENTIALS?.length || 0,
        preview: process.env.GOOGLE_SHEETS_CREDENTIALS?.substring(0, 50) + '...' || 'not set'
      },
      GOOGLE_SHEETS_CREDENTIALS_JSON: {
        exists: !!process.env.GOOGLE_SHEETS_CREDENTIALS_JSON,
        length: process.env.GOOGLE_SHEETS_CREDENTIALS_JSON?.length || 0,
        preview: process.env.GOOGLE_SHEETS_CREDENTIALS_JSON?.substring(0, 50) + '...' || 'not set'
      },
      GOOGLE_SHEETS_SPREADSHEET_ID: {
        exists: !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
        value: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || 'not set'
      },
      GOOGLE_SHEET_NAME: {
        exists: !!process.env.GOOGLE_SHEET_NAME,
        value: process.env.GOOGLE_SHEET_NAME || 'not set (will use OPERATIONS)'
      },
      
      // Other important vars
      NODE_ENV: process.env.NODE_ENV || 'not set',
      VERCEL_ENV: process.env.VERCEL_ENV || 'not set',
      
      // Check if credentials can be parsed
      credentialsParseable: (() => {
        const creds = process.env.GOOGLE_SHEETS_CREDENTIALS || process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
        if (!creds) return false;
        try {
          const parsed = JSON.parse(creds);
          return {
            success: true,
            hasClientEmail: !!parsed.client_email,
            hasPrivateKey: !!parsed.private_key,
            projectId: parsed.project_id || 'not found'
          };
        } catch (e) {
          return {
            success: false,
            error: e.message
          };
        }
      })()
    };

    return res.status(200).json({
      success: true,
      message: 'Environment variables debug info',
      data: envVars,
      recommendations: [
        !envVars.GOOGLE_SHEETS_CREDENTIALS.exists && !envVars.GOOGLE_SHEETS_CREDENTIALS_JSON.exists && 
          'Add GOOGLE_SHEETS_CREDENTIALS_JSON environment variable',
        !envVars.GOOGLE_SHEETS_SPREADSHEET_ID.exists && 
          'Add GOOGLE_SHEETS_SPREADSHEET_ID environment variable',
        envVars.credentialsParseable.success === false && 
          'Fix JSON format in GOOGLE_SHEETS_CREDENTIALS_JSON',
        envVars.credentialsParseable.success && !envVars.credentialsParseable.hasClientEmail && 
          'Service account JSON missing client_email',
        envVars.credentialsParseable.success && !envVars.credentialsParseable.hasPrivateKey && 
          'Service account JSON missing private_key'
      ].filter(Boolean)
    });

  } catch (error) {
    console.error('[Debug Env] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to debug environment variables',
      error: error.message
    });
  }
}
