import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useToast } from "./ui/use-toast";
import { Badge } from "./ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

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
      const response = await fetch("/api/backtests", {
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Sort backtests by timestamp in descending order
      const sortedData = [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setBacktests(sortedData);
    } catch (error) {
      console.error("Error fetching backtests:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch backtest history.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatEquityData = (equityCurve: any[]) => {
    return (
      equityCurve?.map((point) => ({
        time: format(new Date(point.timestamp), "MMM dd HH:mm"),
        balance: point.balance,
      })) || []
    );
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Backtest History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {loading && <div className="text-center">Loading...</div>}
            {backtests.map((backtest) => (
              <Card key={backtest.id} className="hover:bg-muted/50 cursor-pointer overflow-hidden" onClick={() => onSelectBacktest?.(backtest.id)}>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Backtest Info */}
                    <div className="space-y-6">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <h3 className="text-sm font-medium">Symbol</h3>
                          <p className="text-2xl font-bold">{backtest.symbol}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium">Timeframe</h3>
                          <p className="text-2xl font-bold">{backtest.timeframe}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium">Total Trades</h3>
                          <p className="text-2xl font-bold">{backtest.totalTrades}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-sm font-medium">Initial Balance</h3>
                          <p className="text-xl font-bold">${backtest.initialBalance.toLocaleString()}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium">Final Balance</h3>
                          <p className="text-xl font-bold">${backtest.finalBalance.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <h3 className="text-sm font-medium">Win Rate</h3>
                          <p className="text-xl font-bold">{(backtest.winRate * 100).toFixed(1)}%</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium">Profit Factor</h3>
                          <p className="text-xl font-bold">{backtest.profitFactor.toFixed(2)}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium">Max Drawdown</h3>
                          <p className="text-xl font-bold">{backtest.maxDrawdownPercentage.toFixed(1)}%</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-sm font-medium">Average Win</h3>
                          <p className="text-xl font-bold text-green-600">${backtest.averageWin.toFixed(2)}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium">Average Loss</h3>
                          <p className="text-xl font-bold text-red-600">${backtest.averageLoss.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Equity Curve */}
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={formatEquityData(backtest.equityCurve)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="balance" stroke="#2196f3" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Date Range */}
                  <div className="mt-4 text-sm text-muted-foreground">
                    {format(new Date(backtest.startDate), "PPpp")} - {format(new Date(backtest.endDate), "PPpp")}
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
