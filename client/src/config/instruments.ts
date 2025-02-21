interface Instrument {
  symbol: string;
  name: string;
  type: "stock";
}

interface InstrumentCategory {
  name: string;
  instruments: Instrument[];
}

export const instrumentCategories: InstrumentCategory[] = [
  {
    name: "US Stocks",
    instruments: [
      { symbol: "AAPL", name: "Apple Inc.", type: "stock" },
      { symbol: "MSFT", name: "Microsoft Corporation", type: "stock" },
      { symbol: "GOOGL", name: "Alphabet Inc.", type: "stock" },
      { symbol: "AMZN", name: "Amazon.com Inc.", type: "stock" },
      { symbol: "META", name: "Meta Platforms Inc.", type: "stock" },
      { symbol: "TSLA", name: "Tesla Inc.", type: "stock" },
      { symbol: "NVDA", name: "NVIDIA Corporation", type: "stock" },
      { symbol: "JPM", name: "JPMorgan Chase & Co.", type: "stock" },
      { symbol: "V", name: "Visa Inc.", type: "stock" },
      { symbol: "WMT", name: "Walmart Inc.", type: "stock" },
    ],
  },
];
