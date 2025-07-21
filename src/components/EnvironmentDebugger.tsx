import { useState } from 'react';
import { Button } from './ui/button';
import { Loader2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface EnvDebugData {
  GOOGLE_SHEETS_CREDENTIALS: { exists: boolean; length: number; preview: string };
  GOOGLE_SHEETS_CREDENTIALS_JSON: { exists: boolean; length: number; preview: string };
  GOOGLE_SHEETS_SPREADSHEET_ID: { exists: boolean; value: string };
  GOOGLE_SHEET_NAME: { exists: boolean; value: string };
  NODE_ENV: string;
  VERCEL_ENV: string;
  credentialsParseable: { success: boolean; hasClientEmail?: boolean; hasPrivateKey?: boolean; projectId?: string; error?: string; clientEmail?: string };
}

export function EnvironmentDebugger() {
  const [isLoading, setIsLoading] = useState(false);
  const [debugData, setDebugData] = useState<EnvDebugData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionTest, setConnectionTest] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [simpleTest, setSimpleTest] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [testingSimple, setTestingSimple] = useState(false);
  const [sheetsBasicTest, setSheetsBasicTest] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [testingSheetsBasic, setTestingSheetsBasic] = useState(false);

  const checkEnvironment = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/debug-env');
      
      if (response.ok) {
        const data = await response.json();
        setDebugData(data.data);
      } else {
        const errorText = await response.text();
        setError(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check environment');
    } finally {
      setIsLoading(false);
    }
  };

  const testSheetsBasic = async () => {
    setTestingSheetsBasic(true);
    setSheetsBasicTest(null);
    
    try {
      const response = await fetch('/api/test-sheets-basic');
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type') || '';
      let data;
      
      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (parseError) {
          const rawText = await response.text();
          setSheetsBasicTest({
            success: false,
            message: `Server returned invalid JSON: ${rawText.substring(0, 100)}...`,
            details: { rawResponse: rawText, status: response.status }
          });
          return;
        }
      } else {
        const rawText = await response.text();
        setSheetsBasicTest({
          success: false,
          message: `Server returned non-JSON response: ${rawText.substring(0, 100)}...`,
          details: { rawResponse: rawText, status: response.status, contentType }
        });
        return;
      }
      
      setSheetsBasicTest({
        success: response.ok,
        message: data.message || 'Sheets basic test completed',
        details: data.data || data.error
      });
    } catch (err) {
      setSheetsBasicTest({
        success: false,
        message: err instanceof Error ? err.message : 'Sheets basic test failed'
      });
    } finally {
      setTestingSheetsBasic(false);
    }
  };

  const testSimpleAPI = async () => {
    setTestingSimple(true);
    setSimpleTest(null);
    
    try {
      const response = await fetch('/api/test-simple');
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type') || '';
      let data;
      
      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (parseError) {
          const rawText = await response.text();
          setSimpleTest({
            success: false,
            message: `Server returned invalid JSON: ${rawText.substring(0, 100)}...`,
            details: { rawResponse: rawText, status: response.status }
          });
          return;
        }
      } else {
        const rawText = await response.text();
        setSimpleTest({
          success: false,
          message: `Server returned non-JSON response: ${rawText.substring(0, 100)}...`,
          details: { rawResponse: rawText, status: response.status, contentType }
        });
        return;
      }
      
      setSimpleTest({
        success: response.ok,
        message: data.message || 'Simple test completed',
        details: data
      });
    } catch (err) {
      setSimpleTest({
        success: false,
        message: err instanceof Error ? err.message : 'Simple test failed'
      });
    } finally {
      setTestingSimple(false);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionTest(null);
    
    try {
      const response = await fetch('/api/test-sheets-connection');
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type') || '';
      let data;
      
      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (parseError) {
          // If JSON parsing fails, get the raw text
          const rawText = await response.text();
          setConnectionTest({
            success: false,
            message: `Server returned invalid JSON: ${rawText.substring(0, 100)}...`,
            details: { rawResponse: rawText, status: response.status }
          });
          return;
        }
      } else {
        // If not JSON, get the raw text
        const rawText = await response.text();
        setConnectionTest({
          success: false,
          message: `Server returned non-JSON response: ${rawText.substring(0, 100)}...`,
          details: { rawResponse: rawText, status: response.status, contentType }
        });
        return;
      }
      
      setConnectionTest({
        success: response.ok,
        message: data.message || 'Connection test completed',
        details: data.data || data.error
      });
    } catch (err) {
      setConnectionTest({
        success: false,
        message: err instanceof Error ? err.message : 'Connection test failed'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const getStatusIcon = (condition: boolean) => {
    return condition ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button 
          onClick={checkEnvironment} 
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <AlertCircle className="mr-2 h-4 w-4" />
              Debug Environment
            </>
          )}
        </Button>
        <Button 
          onClick={testSimpleAPI} 
          disabled={testingSimple}
          variant="outline"
          size="sm"
        >
          {testingSimple ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <AlertCircle className="mr-2 h-4 w-4" />
              Test Simple API
            </>
          )}
        </Button>
        <Button 
          onClick={testSheetsBasic} 
          disabled={testingSheetsBasic}
          variant="outline"
          size="sm"
        >
          {testingSheetsBasic ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <AlertCircle className="mr-2 h-4 w-4" />
              Test Sheets Basic
            </>
          )}
        </Button>
        <Button 
          onClick={testConnection} 
          disabled={testingConnection || !debugData?.credentialsParseable.success}
          variant="outline"
          size="sm"
        >
          {testingConnection ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <AlertCircle className="mr-2 h-4 w-4" />
              Test Connection
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {simpleTest && (
        <div className={`p-3 border rounded-md ${
          simpleTest.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <h4 className={`font-medium text-sm mb-2 ${
            simpleTest.success ? 'text-green-800' : 'text-red-800'
          }`}>
            Simple API Test Result:
          </h4>
          <p className={`text-sm ${
            simpleTest.success ? 'text-green-700' : 'text-red-700'
          }`}>
            {simpleTest.message}
          </p>
          {simpleTest.details && (
            <details className="mt-2">
              <summary className="text-xs cursor-pointer">Show Details</summary>
              <pre className="text-xs mt-1 p-2 bg-gray-100 rounded overflow-auto">
                {JSON.stringify(simpleTest.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {sheetsBasicTest && (
        <div className={`p-3 border rounded-md ${
          sheetsBasicTest.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <h4 className={`font-medium text-sm mb-2 ${
            sheetsBasicTest.success ? 'text-green-800' : 'text-red-800'
          }`}>
            Sheets Basic Test Result:
          </h4>
          <p className={`text-sm ${
            sheetsBasicTest.success ? 'text-green-700' : 'text-red-700'
          }`}>
            {sheetsBasicTest.message}
          </p>
          {sheetsBasicTest.details && (
            <details className="mt-2">
              <summary className="text-xs cursor-pointer">Show Details</summary>
              <pre className="text-xs mt-1 p-2 bg-gray-100 rounded overflow-auto">
                {JSON.stringify(sheetsBasicTest.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {connectionTest && (
        <div className={`p-3 border rounded-md ${
          connectionTest.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <h4 className={`font-medium text-sm mb-2 ${
            connectionTest.success ? 'text-green-800' : 'text-red-800'
          }`}>
            Connection Test Result:
          </h4>
          <p className={`text-sm ${
            connectionTest.success ? 'text-green-700' : 'text-red-700'
          }`}>
            {connectionTest.message}
          </p>
          {connectionTest.details && (
            <details className="mt-2">
              <summary className="text-xs cursor-pointer">Show Details</summary>
              <pre className="text-xs mt-1 p-2 bg-gray-100 rounded overflow-auto">
                {JSON.stringify(connectionTest.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {debugData && (
        <div className="space-y-3">
          <h3 className="font-medium text-sm">Environment Variables Status:</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {getStatusIcon(debugData.GOOGLE_SHEETS_CREDENTIALS_JSON.exists)}
              <span>GOOGLE_SHEETS_CREDENTIALS_JSON:</span>
              <span className="text-gray-600">
                {debugData.GOOGLE_SHEETS_CREDENTIALS_JSON.exists 
                  ? `${debugData.GOOGLE_SHEETS_CREDENTIALS_JSON.length} chars` 
                  : 'Not set'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {getStatusIcon(debugData.GOOGLE_SHEETS_SPREADSHEET_ID.exists)}
              <span>GOOGLE_SHEETS_SPREADSHEET_ID:</span>
              <span className="text-gray-600">
                {debugData.GOOGLE_SHEETS_SPREADSHEET_ID.exists 
                  ? debugData.GOOGLE_SHEETS_SPREADSHEET_ID.value 
                  : 'Not set'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {getStatusIcon(debugData.credentialsParseable.success)}
              <span>Credentials JSON Valid:</span>
              <span className="text-gray-600">
                {debugData.credentialsParseable.success ? 'Yes' : 'No'}
                {!debugData.credentialsParseable.success && debugData.credentialsParseable.error && (
                  <span className="text-red-600 ml-1">({debugData.credentialsParseable.error})</span>
                )}
              </span>
            </div>

            {debugData.credentialsParseable.success && (
              <>
                <div className="flex items-center gap-2">
                  {getStatusIcon(debugData.credentialsParseable.hasClientEmail)}
                  <span>Service Account Email:</span>
                  <span className="text-gray-600">
                    {debugData.credentialsParseable.hasClientEmail ? 'Present' : 'Missing'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusIcon(debugData.credentialsParseable.hasPrivateKey)}
                  <span>Private Key:</span>
                  <span className="text-gray-600">
                    {debugData.credentialsParseable.hasPrivateKey ? 'Present' : 'Missing'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span>Project ID:</span>
                  <span className="text-gray-600">
                    {debugData.credentialsParseable.projectId}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="font-medium text-sm text-blue-800 mb-2">Recommendations:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              {!debugData.GOOGLE_SHEETS_CREDENTIALS_JSON.exists && (
                <li>• Add GOOGLE_SHEETS_CREDENTIALS_JSON environment variable in Vercel</li>
              )}
              {!debugData.GOOGLE_SHEETS_SPREADSHEET_ID.exists && (
                <li>• Add GOOGLE_SHEETS_SPREADSHEET_ID environment variable in Vercel</li>
              )}
              {debugData.credentialsParseable.success === false && (
                <li>• Fix JSON format in GOOGLE_SHEETS_CREDENTIALS_JSON</li>
              )}
              {debugData.credentialsParseable.success && !debugData.credentialsParseable.hasClientEmail && (
                <li>• Service account JSON is missing client_email</li>
              )}
              {debugData.credentialsParseable.success && !debugData.credentialsParseable.hasPrivateKey && (
                <li>• Service account JSON is missing private_key</li>
              )}
              {debugData.GOOGLE_SHEETS_CREDENTIALS_JSON.exists && 
               debugData.GOOGLE_SHEETS_SPREADSHEET_ID.exists && 
               debugData.credentialsParseable.success && (
                <li className="text-green-700">✓ All required environment variables are configured</li>
              )}
              {debugData.GOOGLE_SHEETS_CREDENTIALS_JSON.exists && 
               debugData.GOOGLE_SHEETS_SPREADSHEET_ID.exists && 
               debugData.credentialsParseable.success && (
                <li>• Share the spreadsheet with: {debugData.credentialsParseable.clientEmail || 'service account email'}</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}