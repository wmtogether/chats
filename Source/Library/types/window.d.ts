// Window interface extensions for wry IPC
declare global {
  interface Window {
    ipc?: {
      invoke: (command: string, args?: any) => Promise<any>;
    };
  }
}

export {};