// Authentication Test Component
import { useState } from 'react';
import authService from '../Library/Authentication/jwt';
import { threadsApiService } from '../Library/Shared/threadsApi';
import { debugAuthState } from '../Library/Authentication/debug';

export default function AuthTest() {
  const [testResult, setTestResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testAuth = async () => {
    setLoading(true);
    setTestResult('Testing authentication...\n');
    
    try {
      // Debug current auth state
      debugAuthState();
      
      // Test if we're authenticated
      const isAuth = authService.isAuthenticated();
      setTestResult(prev => prev + `Authenticated: ${isAuth}\n`);
      
      if (!isAuth) {
        setTestResult(prev => prev + 'Not authenticated - please login first\n');
        setLoading(false);
        return;
      }

      // Use the new test method
      setTestResult(prev => prev + 'Testing API connection...\n');
      const testResult = await authService.testAuthentication();
      
      if (testResult.success) {
        setTestResult(prev => prev + `✅ Authentication test successful!\n`);
        setTestResult(prev => prev + `Details: ${JSON.stringify(testResult.details, null, 2)}\n`);
      } else {
        setTestResult(prev => prev + `❌ Authentication test failed!\n`);
        setTestResult(prev => prev + `Error: ${testResult.error}\n`);
        if (testResult.details) {
          setTestResult(prev => prev + `Details: ${JSON.stringify(testResult.details, null, 2)}\n`);
        }
      }
      
    } catch (error) {
      setTestResult(prev => prev + `Error: ${error}\n`);
      console.error('Auth test error:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearTest = () => {
    setTestResult('');
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="font-semibold mb-4">Authentication Test</h3>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={testAuth}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Auth & API'}
        </button>
        <button
          onClick={clearTest}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Clear
        </button>
      </div>

      {testResult && (
        <div className="bg-black text-green-400 p-3 rounded font-mono text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
          {testResult}
        </div>
      )}
    </div>
  );
}