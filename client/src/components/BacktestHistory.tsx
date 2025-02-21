import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { useToast } from "./ui/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface BacktestHistoryProps {
  onSelectBacktest?: (id: number) => void;
}

export function BacktestHistory({ onSelectBacktest }: BacktestHistoryProps) {
  const [backtests, setBacktests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchBacktests();
  }, []);

  const fetchBacktests = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/backtests");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setBacktests(data);
    } catch (error) {
      console.error("Error fetching backtests:", error);
      toast({
        title: "Error",
        description: "Failed to fetch backtest history.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Backtest History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {backtests.map((backtest) => (
              <Card key={backtest.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => onSelectBacktest?.(backtest.id)}>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <h3 className="text-sm font-medium">Symbol</h3>
                      <p className="text-2xl font-bold">{backtest.symbol}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Timeframe</h3>
                      <p className="text-2xl font-bold">{backtest.timeframe}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Total Return</h3>
                      <p className="text-2xl font-bold">{((backtest.finalBalance / backtest.initialBalance - 1) * 100).toFixed(2)}%</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Win Rate</h3>
                      <p className="text-2xl font-bold">{(backtest.winRate * 100).toFixed(2)}%</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Total Trades</h3>
                      <p className="text-2xl font-bold">{backtest.totalTrades}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Profit Factor</h3>
                      <p className="text-2xl font-bold">{backtest.profitFactor.toFixed(2)}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Max Drawdown</h3>
                      <p className="text-2xl font-bold">{backtest.maxDrawdownPercentage.toFixed(2)}%</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Date</h3>
                      <p className="text-lg">{new Date(backtest.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {backtests.length === 0 && !loading && <div className="text-center text-muted-foreground">No backtest history available</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
