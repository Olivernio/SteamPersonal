// Type declarations for WebView2 environment (injected by Microsoft Edge WebView2)
// This allows TypeScript to recognize window.chrome.webview without errors.

interface WebView2 {
  postMessage: (message: unknown) => void;
  addEventListener: (type: string, listener: (event: MessageEvent) => void) => void;
  removeEventListener: (type: string, listener: (event: MessageEvent) => void) => void;
}

interface Chrome {
  webview?: WebView2;
}

interface Window {
  chrome?: Chrome;
}
