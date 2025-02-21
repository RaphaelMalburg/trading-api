import { jest } from "@jest/globals";

// Mock environment variables
process.env.GOOGLE_API_KEY = "test-api-key";
process.env.APCA_API_KEY_ID = "test-key-id";
process.env.APCA_API_SECRET_KEY = "test-secret-key";
process.env.APCA_API_BASE_URL = "https://paper-api.alpaca.markets/v2";

// Global test timeout
jest.setTimeout(30000); // 30 seconds

// Mock WebSocket
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  onopen: () => void = () => {};
  onclose: () => void = () => {};
  onmessage: (event: any) => void = () => {};
  onerror: (error: any) => void = () => {};
  readyState: number = MockWebSocket.CONNECTING;

  constructor(url: string | URL, protocols?: string | string[]) {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen();
    }, 0);
  }

  send(data: string): void {}
  close(): void {
    this.readyState = MockWebSocket.CLOSING;
    this.onclose();
    this.readyState = MockWebSocket.CLOSED;
  }
}

// @ts-ignore - Override global WebSocket
global.WebSocket = MockWebSocket as any;
