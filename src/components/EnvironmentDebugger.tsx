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
  credentialsParseable: { success: boolean; hasClientEmail?: boolean; hasPrivateKey?: boolean; projectId?: string; error?: string };
}

export function EnvironmentDebugger() {
  const [isLoading, setIsLoading] = useState(false);
  const [debugData, setDebugData] = useState<EnvDebugData | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
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
            </ul>
          </div>
        </div>
      )}
    </div>
  );
} 