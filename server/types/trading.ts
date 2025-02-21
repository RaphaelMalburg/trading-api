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
  size: number;
  entry_price: number;
  current_price: number;
  market_value: number;
  unrealized_pl: number;
  stop_loss: number;
  take_profit: number;
  risk_percentage: number;
}

export interface TradeOrder {
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  qty: number;
  time_in_force: "day" | "gtc" | "ioc";
  limit_price?: number;
  stop_price?: number;
}
