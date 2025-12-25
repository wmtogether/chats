/**
 * Native dialog API for desktop application
 * Interfaces with the Rust backend dialog functions via WRY IPC
 */

declare global {
  interface Window {
    ipc?: {
      postMessage: (message: string) => void;
    };
  }
}

export interface DialogOptions {
  title: string;
  message: string;
  okText?: string;
  cancelText?: string;
}

/**
 * Send IPC message and wait for response
 * Uses the WRY IPC mechanism with result checking via window object
 */
async function sendDialogIPC(payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      if (!window.ipc) {
        throw new Error('IPC not available');
      }

      // Create a unique request ID for this dialog
      const requestId = `dialog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      payload.requestId = requestId;

      console.log('📤 Sending dialog IPC:', payload);

      // Send the IPC message
      window.ipc.postMessage(JSON.stringify(payload));

      let pollCount = 0;
      const maxPolls = 100; // 5 seconds with 50ms intervals
      
      const pollForResult = () => {
        pollCount++;
        
        // Check if result is available in the global scope (set by backend via evaluate_script)
        const resultKey = `dialogResult_${requestId}`;
        console.log(`🔍 Polling attempt ${pollCount}/${maxPolls} - Looking for: ${resultKey}`);
        
        // Debug: Log all dialog-related properties on window
        const dialogKeys = Object.keys(window).filter(key => key.startsWith('dialogResult_'));
        console.log('🔍 Available dialog keys on window:', dialogKeys);
        
        if ((window as any)[resultKey] !== undefined) {
          const result = (window as any)[resultKey];
          console.log('📥 Dialog result received:', result);
          delete (window as any)[resultKey]; // Clean up
          
          // Parse the result
          if (result === 'true' || result === 'false') {
            resolve(result === 'true');
          } else if (result === 'ok') {
            resolve(true);
          } else if (!isNaN(parseInt(result))) {
            resolve(parseInt(result));
          } else {
            resolve(result);
          }
          return;
        }
        
        // Continue polling if not timed out
        if (pollCount < maxPolls) {
          setTimeout(pollForResult, 50);
        } else {
          console.error('❌ Dialog timeout after', maxPolls * 50, 'ms');
          console.error('❌ Final window dialog keys:', Object.keys(window).filter(key => key.startsWith('dialogResult_')));
          reject(new Error('Dialog timeout'));
        }
      };

      // Start polling after a short delay to allow IPC to process
      setTimeout(pollForResult, 100);

    } catch (error) {
      console.error('❌ Dialog IPC error:', error);
      reject(error);
    }
  });
}

/**
 * Show a confirmation dialog with Yes/No buttons
 */
export async function showConfirmDialog(options: DialogOptions): Promise<boolean> {
  const result = await sendDialogIPC({
    action: 'show_dialog',
    type: 'confirm',
    title: options.title,
    message: options.message,
    okText: options.okText || 'OK',
    cancelText: options.cancelText || 'Cancel'
  });
  return result as boolean;
}

/**
 * Show an information dialog
 */
export async function showInfoDialog(title: string, message: string): Promise<void> {
  await sendDialogIPC({
    action: 'show_dialog',
    type: 'info',
    title,
    message
  });
}

/**
 * Show an error dialog
 */
export async function showErrorDialog(title: string, message: string): Promise<void> {
  await sendDialogIPC({
    action: 'show_dialog',
    type: 'error',
    title,
    message
  });
}

/**
 * Show a warning dialog
 */
export async function showWarningDialog(title: string, message: string): Promise<void> {
  await sendDialogIPC({
    action: 'show_dialog',
    type: 'warning',
    title,
    message
  });
}

/**
 * Show an OK/Cancel dialog
 */
export async function showOkCancelDialog(title: string, message: string): Promise<boolean> {
  const result = await sendDialogIPC({
    action: 'show_dialog',
    type: 'ok_cancel',
    title,
    message
  });
  return result as boolean;
}

/**
 * Show a Yes/No/Cancel dialog
 * Returns: 0 = Yes, 1 = No, 2 = Cancel
 */
export async function showYesNoCancelDialog(title: string, message: string): Promise<number> {
  const result = await sendDialogIPC({
    action: 'show_dialog',
    type: 'yes_no_cancel',
    title,
    message
  });
  return result as number;
}

/**
 * Show a text input dialog
 */
export async function showInputDialog(title: string, message: string, defaultValue?: string): Promise<string | null> {
  // For now, use browser prompt as native input dialogs are more complex
  // TODO: Implement proper native input dialog in Rust backend
  return prompt(`${title}\n\n${message}`, defaultValue || '');
}