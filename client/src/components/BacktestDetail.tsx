import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface BacktestDetailProps {
  backtestId: number;
}

// Helper function to safely parse JSON
const safeJsonParse = (jsonString: string | null | undefined, fallback: any = []): any => {
  if (!jsonString) return fallback;
  try {
    const parsed = JSON.parse(jsonString);
    return parsed || fallback;
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return fallback;
  }
};

export function BacktestDetail({ backtestId }: BacktestDetailProps) {
  const [backtest, setBacktest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBacktest = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/backtests/${backtestId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setBacktest(data);
      } catch (error) {
        console.error("Error fetching backtest:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBacktest();
  }, [backtestId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!backtest) {
    return <div>No backtest data found</div>;
  }

  // Render the analysis section with safe JSON parsing
  const renderAnalysis = (analysis: any) => {
    const supportLevels = safeJsonParse(analysis.supportLevels, []);
    const resistanceLevels = safeJsonParse(analysis.resistanceLevels, []);
    const signals = safeJsonParse(analysis.signals, []);
    const patterns = safeJsonParse(analysis.patterns, []);

    return (
      <Card key={analysis.id}>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart Image */}
            <div className="w-full">
              <h3 className="text-lg font-semibold mb-2">Market Analysis at {new Date(analysis.timestamp).toLocaleString()}</h3>
              <img src={`data:image/png;base64,${analysis.chartImage}`} alt={`Analysis chart at ${analysis.timestamp}`} className="w-full rounded-lg shadow-lg" />
            </div>

            {/* Analysis Details */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Market Conditions</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Trend</h4>
                    <p className="text-lg">{analysis.trend || "N/A"}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Confidence</h4>
                    <p className="text-lg">{analysis.confidence ? `${(analysis.confidence * 100).toFixed(1)}%` : "N/A"}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Key Levels</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Support</h4>
                    <p className="text-sm">
                      {Array.isArray(supportLevels) && supportLevels.length > 0 ? supportLevels.map((level: number) => `$${level.toFixed(2)}`).join(", ") : "N/A"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Resistance</h4>
                    <p className="text-sm">
                      {Array.isArray(resistanceLevels) && resistanceLevels.length > 0 ? resistanceLevels.map((level: number) => `$${level.toFixed(2)}`).join(", ") : "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Trading Signals</h3>
                <div className="grid grid-cols-2 gap-4">
                  {Array.isArray(signals) &&
                    signals.map((signal: any, idx: number) => (
                      <div key={idx}>
                        <h4 className="text-sm font-medium text-gray-500">{signal.name}</h4>
                        <Badge variant={signal.value ? "default" : "secondary"}>{signal.value ? "Active" : "Inactive"}</Badge>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Trade Recommendation</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={analysis.action === "buy" ? "default" : analysis.action === "sell" ? "destructive" : "secondary"}>{analysis.action || "HOLD"}</Badge>
                    {analysis.riskPercentage && <Badge variant="outline">Risk: {(analysis.riskPercentage * 100).toFixed(1)}%</Badge>}
                  </div>
                  {analysis.entryPrice && (
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="font-medium">Entry:</span> ${analysis.entryPrice.toFixed(2)}
                      </div>
                      <div>
                        <span className="font-medium">Stop:</span> ${analysis.stopLoss.toFixed(2)}
                      </div>
                      <div>
                        <span className="font-medium">Target:</span> ${analysis.takeProfit.toFixed(2)}
                      </div>
                    </div>
                  )}
                  {analysis.reasoning && <p className="text-sm text-gray-600 mt-2">{analysis.reasoning}</p>}
                </div>
              </div>

              {patterns && patterns.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Patterns Detected</h3>
                  <div className="flex flex-wrap gap-2">
                    {patterns.map((pattern: any, idx: number) => (
                      <Badge key={idx} variant="outline">
                        {pattern.name} ({pattern.confidence}%)
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="equity">Equity Curve</TabsTrigger>
        <TabsTrigger value="trades">Trades</TabsTrigger>
        <TabsTrigger value="analysis">Analysis History</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Initial Balance:</span>
                  <span>${backtest.initialBalance?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Final Balance:</span>
                  <span>${backtest.finalBalance?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Return:</span>
                  <span>{((backtest.finalBalance / backtest.initialBalance - 1) * 100).toFixed(2)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trade Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Trades:</span>
                  <span>{backtest.totalTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span>Win Rate:</span>
                  <span>{(backtest.winRate * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Profit Factor:</span>
                  <span>{backtest.profitFactor?.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Max Drawdown:</span>
                  <span>{backtest.maxDrawdownPercentage?.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Win:</span>
                  <span>${backtest.averageWin?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Loss:</span>
                  <span>${backtest.averageLoss?.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="equity">
        <Card>
          <CardHeader>
            <CardTitle>Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={backtest.equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" tickFormatter={(timestamp) => new Date(timestamp).toLocaleDateString()} />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, "Balance"]} labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()} />
                  <Line type="monotone" dataKey="balance" stroke="#2196f3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="trades">
        <div className="space-y-4">
          {backtest.trades?.map((trade: any, index: number) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <h3 className="text-sm font-medium">Entry</h3>
                    <p>{new Date(trade.entryTime).toLocaleString()}</p>
                    <p>${trade.entryPrice?.toFixed(2)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Exit</h3>
                    <p>{trade.exitTime ? new Date(trade.exitTime).toLocaleString() : "Open"}</p>
                    <p>{trade.exitPrice ? `$${trade.exitPrice.toFixed(2)}` : "-"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Position</h3>
                    <Badge variant={trade.side === "long" ? "default" : "destructive"}>{trade.side}</Badge>
                    <p>{trade.size} units</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">P&L</h3>
                    <p className={trade.pnl >= 0 ? "text-green-600" : "text-red-600"}>
                      ${trade.pnl?.toFixed(2)} ({trade.pnlPercentage?.toFixed(2)}%)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="analysis">
        <div className="space-y-4">{backtest.analyses?.map((analysis: any) => renderAnalysis(analysis))}</div>
      </TabsContent>
    </Tabs>
  );
}
