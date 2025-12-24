// Source/Pages/Login.tsx
import React, { useState } from 'react';
import authService from '../Library/Authentication/jwt';
import { debugAuthState } from '../Library/Authentication/debug';
import { threadsApiService } from '../Library/Shared/threadsApi';
import { messagesApiService } from '../Library/Shared/messagesApi';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState('');

  const testAPIs = async () => {
    setTestResult('Testing APIs...');
    try {
      // Test threads API
      console.log('Testing threads API...');
      const threadsResponse = await threadsApiService.getThreads({ limit: 5 });
      console.log('Threads test result:', threadsResponse);
      
      let messageTest = 'No threads to test messages';
      if (threadsResponse.threads.length > 0) {
        // Test messages API with first thread
        const firstThread = threadsResponse.threads[0];
        const identifier = messagesApiService.getMessageIdentifier(firstThread);
        console.log('Testing messages API with identifier:', identifier);
        
        const messagesResponse = await messagesApiService.getMessages(identifier, { limit: 5 });
        console.log('Messages test result:', messagesResponse);
        messageTest = `Messages: ${messagesResponse.messages.length} found`;
      }
      
      setTestResult(`✅ API Test Results:
Threads: ${threadsResponse.threads.length} found
${messageTest}
Check console for detailed logs`);
    } catch (error) {
      console.error('API test failed:', error);
      setTestResult(`❌ API test failed: ${error}`);
    }
  };

  const testProxy = async () => {
    setTestResult('Testing proxy server...');
    try {
      // Test health endpoint
      const healthResponse = await fetch('http://localhost:8640/health');
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        
        // Test session info
        const sessionResponse = await fetch('http://localhost:8640/sessions');
        const sessionData = sessionResponse.ok ? await sessionResponse.json() : null;
        
        // Test auth status
        const authResponse = await fetch('http://localhost:8640/auth/status', {
          headers: {
            'X-Session-Id': (window as any).sessionId || 'desktop-session'
          }
        });
        const authData = authResponse.ok ? await authResponse.json() : null;
        
        setTestResult(`✅ Proxy server is running on port 8640!
Status: ${healthData.status}
Sessions: ${sessionData?.totalSessions || 0}
Current session authenticated: ${authData?.authenticated || false}
Storage file: ${sessionData?.storageFile || 'N/A'}`);
      } else {
        setTestResult(`❌ Proxy server responded with status: ${healthResponse.status}`);
      }
    } catch (error) {
      setTestResult(`❌ Cannot connect to proxy server on port 8640: ${error}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!identifier) {
      setError('Please enter your username or UID.');
      setIsLoading(false);
      return;
    }

    try {
      const result = await authService.login({
        identifier: identifier.trim(),
        password: password || undefined,
      });
      
      if (result.success) {
        console.log('Login successful, user data:', result.user);
        
        // Force refresh auth state to ensure it's loaded
        authService.refreshAuthState();
        
        // Small delay to ensure state is updated
        setTimeout(() => {
          onLoginSuccess();
        }, 100);
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Login failed:', error);
      setError(error instanceof Error ? error.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 transition-colors duration-300">
      <div className="w-full max-w-sm">
        
        {/* Header Section */}
        <div className="mb-8 flex flex-col items-center text-center">
          <h1 className="headline-medium text-on-surface">Welcome back</h1>
          <p className="body-medium mt-2 text-on-surface-variant">
            Please enter your UID or username to sign in
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          {/* Username/UID Field */}
          <div className="group relative">
            <input
              type="text"
              id="identifier"
              className="peer w-full rounded-full border border-outline bg-transparent px-4 py-3 text-on-surface placeholder-transparent outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Username or UID"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={isLoading}
            />
            <label
              htmlFor="identifier"
              className="body-medium text-on-surface-variant absolute left-3 top-0 -translate-y-1/2 bg-surface px-1 transition-all 
              peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-primary"
            >
              Username or UID
            </label>
          </div>

          {/* Password Field */}
          <div className="group relative">
            <input
              type="password"
              id="password"
              className="peer w-full rounded-full border border-outline bg-transparent px-4 py-3 text-on-surface placeholder-transparent outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Password (optional)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
            <label
              htmlFor="password"
              className="body-medium text-on-surface-variant absolute left-3 top-0 -translate-y-1/2 bg-surface px-1 transition-all 
              peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-primary"
            >
              Password (optional)
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-error-container p-3 text-center">
              <p className="body-medium text-on-error-container">{error}</p>
            </div>
          )}

          {/* Test Buttons */}
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={testProxy}
              className="label-medium w-full text-primary hover:text-primary/80 hover:underline"
            >
              Test Proxy Server
            </button>
            <button
              type="button"
              onClick={testAPIs}
              className="label-medium w-full text-secondary hover:text-secondary/80 hover:underline"
            >
              Test APIs (Threads & Messages)
            </button>
            <button
              type="button"
              onClick={() => {
                debugAuthState();
                console.log('Current auth state:', {
                  isAuthenticated: authService.isAuthenticated(),
                  user: authService.getUser(),
                  token: authService.getToken() ? 'Present' : 'None'
                });
                // Also check proxy session
                authService.checkProxySession().then(proxyStatus => {
                  console.log('Proxy session status:', proxyStatus);
                });
              }}
              className="label-medium w-full text-tertiary hover:text-tertiary/80 hover:underline"
            >
              Debug Auth State
            </button>
            {testResult && (
              <div className="mt-2 p-2 rounded bg-surface-variant text-on-surface-variant text-sm whitespace-pre-line">
                {testResult}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-2 flex flex-col gap-4">
            <button
              type="submit"
              disabled={isLoading}
              className="label-large relative flex w-full items-center justify-center overflow-hidden rounded-full bg-primary py-3 text-on-primary shadow-sm transition-all hover:shadow-md hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Login'}
            </button>

            <button
              type="button"
              className="label-large text-primary hover:text-primary/80 hover:underline"
              disabled={isLoading}
            >
              Need help?
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}