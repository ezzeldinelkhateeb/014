import { useState } from 'react';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';

export function TestSheetsConnection() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const testConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/test-sheets-connection');

      if (response.ok) {
        const data = await response.json();
        setResult({ success: true, message: data.message || 'Connection successful' });
      } else {
        let errorMessage = `HTTP ${response.status} - ${response.statusText}`;

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // If response is not JSON, fall back to plain text
          try {
            errorMessage = await response.text();
          } catch {}
        }

        setResult({ success: false, message: errorMessage });
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to test connection'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Button 
        onClick={testConnection} 
        disabled={isLoading}
        variant="outline"
        size="sm"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Testing...
          </>
        ) : (
          'Test Connection'
        )}
      </Button>
      {result && (
        <div className={`mt-2 text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
          {result.message}
        </div>
      )}
    </div>
  );
}