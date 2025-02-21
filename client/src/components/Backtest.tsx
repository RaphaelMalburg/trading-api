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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<number | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());

    console.log("[Backtest] Submitting request:", data);
    setIsLoading(true);

    try {
      const response = await fetch("/api/backtest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("[Backtest] Received response:", result);
      setResult(result);
    } catch (error) {
      console.error("[Backtest] Error:", error);
      toast({
        title: "Error",
        description: "Failed to run backtest. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Backtest Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol</Label>
                <Input id="symbol" name="symbol" defaultValue="AAPL" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeframe">Timeframe</Label>
                <Select name="timeframe" defaultValue="4Hour">
                  <SelectTrigger>
                    <SelectValue placeholder="Select timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1Hour">1 Hour</SelectItem>
                    <SelectItem value="4Hour">4 Hours</SelectItem>
                    <SelectItem value="1Day">1 Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input id="startDate" name="startDate" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" name="endDate" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="initialBalance">Initial Balance</Label>
                <Input id="initialBalance" name="initialBalance" type="number" defaultValue="1000" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="riskPerTrade">Risk Per Trade (%)</Label>
                <Input id="riskPerTrade" name="riskPerTrade" type="number" step="0.1" defaultValue="1" required />
              </div>
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Run Backtest
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <h3 className="text-sm font-medium">Total Return</h3>
                  <p className="text-2xl font-bold">
                    {result.final_balance && result.initial_balance ? ((result.final_balance / result.initial_balance - 1) * 100).toFixed(2) : "0.00"}%
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Win Rate</h3>
                  <p className="text-2xl font-bold">{result.win_rate ? (result.win_rate * 100).toFixed(2) : "0.00"}%</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Profit Factor</h3>
                  <p className="text-2xl font-bold">${Number(result.profit_factor || 0).toFixed(2)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Max Drawdown</h3>
                  <p className="text-2xl font-bold">${Number(result.max_drawdown_percentage || 0).toFixed(2)}%</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Total Trades</h3>
                  <p className="text-2xl font-bold">{result.total_trades || 0}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Average Win</h3>
                  <p className="text-2xl font-bold">${Number(result.average_win || 0).toFixed(2)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Average Loss</h3>
                  <p className="text-2xl font-bold">${Number(result.average_loss || 0).toFixed(2)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Final Balance</h3>
                  <p className="text-2xl font-bold">${Number(result.final_balance || 0).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Analysis History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {result.analysis_history?.map((analysis, index) => (
                  <div key={index} className="flex flex-col md:flex-row border rounded-lg p-4 space-y-4 md:space-y-0 md:space-x-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium">Analysis {index + 1}</h3>
                      <span className="text-sm text-muted-foreground">{new Date(analysis.timestamp).toLocaleString()}</span>
                      <div className="aspect-video relative mt-2">
                        <img src={`data:image/png;base64,${analysis.chart_image}`} alt={`Chart analysis ${index + 1}`} className="rounded-lg object-contain w-full" />
                      </div>
                    </div>
                    <div className="flex-1 bg-muted p-4 rounded-lg">
                      <h4 className="font-medium mb-2">AI Analysis</h4>
                      <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(analysis.analysis_result, null, 2)}</pre>
                    </div>
                  </div>
                ))}
                {(!result.analysis_history || result.analysis_history.length === 0) && <div className="text-center text-muted-foreground">No analysis history available</div>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Equity Curve</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.equity_curve}>
                    <XAxis dataKey="timestamp" tickFormatter={(timestamp) => new Date(timestamp).toLocaleDateString()} />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
                      formatter={(value) => {
                        const numValue = Number(value);
                        return isNaN(numValue) ? ["N/A", "Balance"] : [`$${numValue.toFixed(2)}`, "Balance"];
                      }}
                    />
                    <Line type="monotone" dataKey="balance" stroke="#2563eb" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
