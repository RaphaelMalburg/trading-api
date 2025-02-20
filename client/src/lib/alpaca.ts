import { apiRequest } from "./queryClient";

export interface Bar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Position {
  symbol: string;
  qty: number;
  avg_entry_price: string;
  market_value: string;
  unrealized_pl: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
  side: string;
}

export interface Account {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  buying_power: string;
  regt_buying_power: string;
  daytrading_buying_power: string;
  cash: string;
  portfolio_value: string;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  transfers_blocked: boolean;
  account_blocked: boolean;
  created_at: string;
  trade_suspended_by_user: boolean;
  multiplier: string;
  shorting_enabled: boolean;
  equity: string;
  last_equity: string;
  long_market_value: string;
  short_market_value: string;
  initial_margin: string;
  maintenance_margin: string;
  last_maintenance_margin: string;
  sma: string;
  daytrade_count: number;
  positions: Position[];
}

export class AlpacaStream {
  private ws: WebSocket | null = null;
  private barHandler: ((data: any) => void) | null = null;
  private reconnectTimer: number | null = null;

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      console.log("Connecting to WebSocket:", wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!Array.isArray(data)) return;

          console.log("Received bar data:", data);

          // Send bar updates to chart
          if (this.barHandler && typeof this.barHandler === "function") {
            data.forEach((bar) => this.barHandler!(bar));
          }
        } catch (error) {
          console.error("Error processing message:", error);
        }
      };

      this.ws.onclose = () => {
        console.log("WebSocket disconnected, reconnecting in 5s...");
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (error) {
      console.error("Error creating WebSocket:", error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }

  public onBar(handler: (data: any) => void) {
    console.log("Registering bar handler");
    this.barHandler = handler;
  }

  public disconnect() {
    console.log("Disconnecting WebSocket");
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.barHandler = null;
  }
}

export async function getBars(symbol: string, timeframe = "4H"): Promise<Bar[]> {
  try {
    const response = await apiRequest<any[]>("GET", `/api/bars/${symbol}?timeframe=${timeframe}`);
    return response.map((bar) => ({
      timestamp: bar.timestamp,
      open: Number(bar.open),
      high: Number(bar.high),
      low: Number(bar.low),
      close: Number(bar.close),
      volume: Number(bar.volume),
    }));
  } catch (error) {
    console.error(`Error fetching bars for ${symbol}:`, error);
    throw error;
  }
}

export async function getAccount(): Promise<Account> {
  try {
    return await apiRequest("GET", "/api/account");
  } catch (error) {
    console.error("Error fetching account:", error);
    throw error;
  }
}

export async function getPositions(): Promise<Position[]> {
  try {
    return await apiRequest("GET", "/api/positions");
  } catch (error) {
    console.error("Error fetching positions:", error);
    throw error;
  }
}

export async function placeTrade(symbol: string, quantity: number, side: "buy" | "sell"): Promise<any> {
  const response = await apiRequest("POST", "/api/trade", {
    symbol,
    quantity,
    side,
  });
  return response;
}

export async function analyzeChart(chartData: any): Promise<any> {
  const response = await apiRequest("POST", "/api/analyze", chartData);
  return response;
}

export function calculatePositionSize(equity: number, riskPerTrade: number, stopLossPercent: number): number {
  const riskAmount = equity * (riskPerTrade / 100);
  const positionSize = riskAmount / (stopLossPercent / 100);
  return Math.floor(positionSize);
}

export function calculateStopLoss(entryPrice: number, side: "buy" | "sell", stopLossPercent: number): number {
  if (side === "buy") {
    return entryPrice * (1 - stopLossPercent / 100);
  } else {
    return entryPrice * (1 + stopLossPercent / 100);
  }
}

export function calculateEMA(data: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const ema: number[] = [data[0]];

  for (let i = 1; i < data.length; i++) {
    ema.push((data[i] - ema[i - 1]) * multiplier + ema[i - 1]);
  }

  return ema;
}

export function calculateRSI(data: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(Math.max(0, change));
    losses.push(Math.max(0, -change));
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;

  for (let i = period; i < data.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;

    const rs = avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }

  return rsi;
}
