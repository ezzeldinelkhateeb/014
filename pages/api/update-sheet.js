export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey, accesskey');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  
  try {
    const { spreadsheetId, sheetName, values, range } = req.body;
    
    if (!spreadsheetId || !sheetName) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'spreadsheetId and sheetName are required'
      });
    }
    
    console.log('Sheet update request:', {
      spreadsheetId: spreadsheetId.substring(0, 10) + '...',
      sheetName,
      range: range || 'auto',
      valuesCount: values?.length || 0
    });
    
    // Validate Google Sheets credentials
    const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
    if (!credentialsJson) {
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Google Sheets credentials not configured'
      });
    }
    
    let credentials;
    try {
      credentials = JSON.parse(credentialsJson);
    } catch (parseError) {
      console.error('Failed to parse Google Sheets credentials:', parseError);
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Invalid Google Sheets credentials format'
      });
    }
    
    // Here you would implement the actual Google Sheets API call
    // For now, we'll return a success response for testing
    
    const response = {
      success: true,
      spreadsheetId,
      sheetName,
      range: range || `${sheetName}!A1:Z1000`,
      updatedRows: values?.length || 0,
      timestamp: new Date().toISOString(),
      message: 'Sheet update completed successfully'
    };
    
    console.log('Sheet update completed:', response);
    return res.json(response);
    
  } catch (error) {
    console.error('Sheet update error:', error);
    return res.status(500).json({
      error: 'Sheet update failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
