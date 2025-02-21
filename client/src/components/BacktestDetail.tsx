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
    const chartImage = analysis.chart_image;
    const analysisData = safeJsonParse(analysis.analysis_result, {});

    return (
      <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg mb-4 bg-white">
        <div className="col-span-1">
          <h4 className="text-lg font-semibold mb-2">Chart Analysis</h4>
          {chartImage && <img src={`data:image/png;base64,${chartImage}`} alt="Analysis Chart" className="w-full rounded-lg shadow-sm" />}
        </div>

        <div className="col-span-1 space-y-4">
          <div>
            <h4 className="text-lg font-semibold mb-2">Market Analysis</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Trend:</span>
                <Badge variant={analysisData.trend === "bullish" ? "default" : analysisData.trend === "bearish" ? "destructive" : "secondary"}>{analysisData.trend || "N/A"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Confidence:</span>
                <Badge variant={analysisData.confidence >= 80 ? "default" : analysisData.confidence >= 60 ? "secondary" : "destructive"}>{analysisData.confidence || 0}%</Badge>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-2">Key Levels</h4>
            <div className="space-y-2">
              <div>
                <span className="text-gray-600">Support:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {analysisData.key_levels?.support?.map((level: number, idx: number) => (
                    <Badge key={idx} variant="outline">
                      {level.toFixed(2)}
                    </Badge>
                  )) || "N/A"}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Resistance:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {analysisData.key_levels?.resistance?.map((level: number, idx: number) => (
                    <Badge key={idx} variant="outline">
                      {level.toFixed(2)}
                    </Badge>
                  )) || "N/A"}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-2">Trading Signals</h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <Badge variant={analysisData.signals?.ema_pullback ? "default" : "secondary"}>EMA Pullback</Badge>
              </div>
              <div className="text-center">
                <Badge variant={analysisData.signals?.mean_reversion ? "default" : "secondary"}>Mean Reversion</Badge>
              </div>
              <div className="text-center">
                <Badge variant={analysisData.signals?.breakout ? "default" : "secondary"}>Breakout</Badge>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-2">Patterns</h4>
            <div className="space-y-2">
              {analysisData.patterns?.map((pattern: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-gray-600">{pattern.name}:</span>
                  <Badge variant={pattern.confidence >= 80 ? "default" : "secondary"}>{pattern.confidence}%</Badge>
                </div>
              )) || "No patterns detected"}
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-2">Recommendation</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Action:</span>
                <Badge variant={analysisData.recommendation?.action === "buy" ? "default" : analysisData.recommendation?.action === "sell" ? "destructive" : "secondary"}>
                  {analysisData.recommendation?.action || "N/A"}
                </Badge>
              </div>
              {analysisData.recommendation?.action !== "hold" && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Entry Price:</span>
                    <span>{analysisData.recommendation?.entry_price?.toFixed(2) || "N/A"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Stop Loss:</span>
                    <span>{analysisData.recommendation?.stop_loss?.toFixed(2) || "N/A"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Take Profit:</span>
                    <span>{analysisData.recommendation?.take_profit?.toFixed(2) || "N/A"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Risk %:</span>
                    <span>{analysisData.recommendation?.risk_percentage?.toFixed(1)}%</span>
                  </div>
                </>
              )}
              {analysisData.recommendation?.reasoning && (
                <div className="mt-2">
                  <span className="text-gray-600">Reasoning:</span>
                  <p className="mt-1 text-sm">{analysisData.recommendation.reasoning}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
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
