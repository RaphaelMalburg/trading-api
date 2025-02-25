import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { useToast } from "./ui/use-toast";
import { Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { instrumentCategories } from "../config/instruments";
import { BacktestHistory } from "./BacktestHistory";
import { BacktestDetail } from "./BacktestDetail";

interface BacktestResult {
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
  trades: Array<{
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
  }>;
  equity_curve: Array<{
    timestamp: string;
    balance: number;
  }>;
  analysis_history: {
    timestamp: string;
    chart_image: string; // base64 encoded image
    analysis_result: any;
  }[];
}

export function Backtest() {
  const [symbol, setSymbol] = useState("AAPL");
  const [timeframe, setTimeframe] = useState("4Hour");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [initialBalance, setInitialBalance] = useState("100000");
  const [riskPerTrade, setRiskPerTrade] = useState("1");
  const [loading, setLoading] = useState(false);
  const [selectedBacktestId, setSelectedBacktestId] = useState<number | null>(null);
  const { toast } = useToast();

  const symbols = [
    { value: "AAPL", label: "Apple Inc. (AAPL)" },
    { value: "MSFT", label: "Microsoft Corp. (MSFT)" },
    { value: "GOOGL", label: "Alphabet Inc. (GOOGL)" },
    { value: "AMZN", label: "Amazon.com Inc. (AMZN)" },
    { value: "META", label: "Meta Platforms Inc. (META)" },
    { value: "TSLA", label: "Tesla Inc. (TSLA)" },
    { value: "NVDA", label: "NVIDIA Corp. (NVDA)" },
    { value: "JPM", label: "JPMorgan Chase & Co. (JPM)" },
    { value: "V", label: "Visa Inc. (V)" },
    { value: "JNJ", label: "Johnson & Johnson (JNJ)" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/api/backtest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol,
          timeframe,
          startDate,
          endDate,
          initialBalance: parseFloat(initialBalance),
          riskPerTrade: parseFloat(riskPerTrade),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setSelectedBacktestId(result.id);
      toast({
        title: "Success",
        description: "Backtest completed successfully.",
      });
    } catch (error) {
      console.error("Error running backtest:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to run backtest.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickBacktest = async () => {
    try {
      setLoading(true);
      // Calculate dates relative to today
      const today = new Date("2025-02-25"); // Hardcode today's date for testing
      console.log(`[Client] ====== Quick Backtest ======`);
      console.log(`[Client] System Date: ${today.toISOString()}`);

      // Use data from Feb 1-10 2025 for testing
      const endDate = new Date("2025-02-10");
      const startDate = new Date("2025-02-01");
      console.log(`[Client] Test Period: ${startDate.toISOString()} to ${endDate.toISOString()}`);

      const response = await fetch("http://localhost:5000/api/backtest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol: "AAPL",
          timeframe: "1Day",
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          initialBalance: 100000,
          riskPerTrade: 1,
          quickDevelopmentMode: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setSelectedBacktestId(result.id);
      console.log(`[Client] ====== Completed ======`);
      toast({
        title: "Quick Backtest Complete",
        description: `Win Rate: ${(result.win_rate * 100).toFixed(1)}%, Profit Factor: ${result.profit_factor.toFixed(2)}`,
      });
    } catch (error) {
      console.error("[Client] Error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to run backtest",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Run New Backtest</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Button variant="outline" onClick={handleQuickBacktest} disabled={loading} className="mb-4">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running Quick Backtest...
                </>
              ) : (
                "Quick Backtest AAPL (Last 10 Days)"
              )}
            </Button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol</Label>
                <Select value={symbol} onValueChange={setSymbol}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {symbols.map((sym) => (
                      <SelectItem key={sym.value} value={sym.value}>
                        {sym.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeframe">Timeframe</Label>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1Min">1 Minute</SelectItem>
                    <SelectItem value="5Min">5 Minutes</SelectItem>
                    <SelectItem value="15Min">15 Minutes</SelectItem>
                    <SelectItem value="1Hour">1 Hour</SelectItem>
                    <SelectItem value="4Hour">4 Hours</SelectItem>
                    <SelectItem value="1Day">1 Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="initialBalance">Initial Balance</Label>
                <Input id="initialBalance" type="number" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} placeholder="Enter initial balance" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="riskPerTrade">Risk Per Trade (%)</Label>
                <Input
                  id="riskPerTrade"
                  type="number"
                  step="0.1"
                  value={riskPerTrade}
                  onChange={(e) => setRiskPerTrade(e.target.value)}
                  placeholder="Enter risk percentage"
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running Backtest...
                </>
              ) : (
                "Run Backtest"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {selectedBacktestId ? <BacktestDetail backtestId={selectedBacktestId} /> : <BacktestHistory onSelectBacktest={setSelectedBacktestId} />}
    </div>
  );
}
