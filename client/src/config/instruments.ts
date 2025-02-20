export interface Instrument {
  symbol: string;
  name: string;
}

export interface InstrumentCategory {
  name: string;
  description: string;
  instruments: Instrument[];
}

export const instrumentCategories: InstrumentCategory[] = [
  {
    name: "Tech & Growth Stocks",
    description: "High Momentum Technology Stocks",
    instruments: [
      { symbol: "AAPL", name: "Apple" },
      { symbol: "MSFT", name: "Microsoft" },
      { symbol: "NVDA", name: "Nvidia" },
      { symbol: "TSLA", name: "Tesla" },
      { symbol: "AMD", name: "AMD" },
    ],
  },
  {
    name: "ETFs",
    description: "Diversified Trend Following",
    instruments: [
      { symbol: "SPY", name: "S&P 500" },
      { symbol: "QQQ", name: "Nasdaq 100" },
      { symbol: "XLF", name: "Financials" },
      { symbol: "XLE", name: "Energy" },
    ],
  },
  {
    name: "High Volatility",
    description: "High Volatility Tech Stocks",
    instruments: [
      { symbol: "AMZN", name: "Amazon" },
      { symbol: "GOOGL", name: "Google" },
      { symbol: "NFLX", name: "Netflix" },
      { symbol: "META", name: "Meta" },
    ],
  },
];
