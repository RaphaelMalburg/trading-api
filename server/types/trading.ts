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

export interface Trade {
  symbol: string;
  side: "long" | "short";
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  size: number;
  entry_time: string;
  exit_time?: string;
  exit_price?: number;
  pnl?: number;
  pnl_percentage?: number;
  reason?: string;
}

export interface EquityCurvePoint {
  timestamp: string;
  balance: number;
}

export interface TechnicalSignals {
  trend: "bullish" | "bearish" | "neutral";
  strength: number; // 0-1
  support: number[];
  resistance: number[];
  rsi: number;
  macd: {
    line: number;
    signal: number;
    histogram: number;
  };
  volume: {
    current: number;
    average: number;
    trend: "increasing" | "decreasing" | "neutral";
  };
}

export interface BacktestResult {
  symbol: string;
  timeframe: string;
  start_date: string;
  end_date: string;
  initial_balance: number;
  final_balance: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  average_win: number;
  average_loss: number;
  profit_factor: number;
  max_drawdown: number;
  max_drawdown_percentage: number;
  trades: Trade[];
  equity_curve: EquityCurvePoint[];
  analysis_history: AnalysisEntry[];
}

export interface AnalysisEntry {
  timestamp: string;
  chart_image: string;
  analysis_result: AnalysisResult;
  technical_signals: TechnicalSignals;
}

export interface AnalysisResult {
  trend: "bullish" | "bearish" | "neutral";
  confidence: number;
  key_levels: {
    support: number[];
    resistance: number[];
  };
  signals: {
    ema_pullback: boolean;
    mean_reversion: boolean;
    breakout: boolean;
  };
  recommendation: {
    action: "buy" | "sell" | "hold";
    entry_price: number;
    stop_loss: number;
    take_profit: number;
    timeframe: string;
    reasoning: string;
    risk_percentage: number;
  };
  patterns: {
    name: string;
    confidence: number;
    location: {
      start_index: number;
      end_index: number;
    };
  }[];
}
