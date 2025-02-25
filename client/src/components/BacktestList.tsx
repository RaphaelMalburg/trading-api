import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, isUniqueImage } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import TVChart from "@/components/TVChart";
import { Badge } from "@/components/ui/badge";

interface BacktestListProps {
  backtests: any[];
}

export function BacktestList({ backtests }: BacktestListProps) {
  const [selectedBacktest, setSelectedBacktest] = useState<any>(null);
  const [selectedTab, setSelectedTab] = useState<string>("overview");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);

  // Group backtests by symbol and timeframe
  const groupedBacktests = backtests.reduce((groups: any, backtest: any) => {
    const key = `${backtest.symbol}-${backtest.timeframe}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(backtest);
    return groups;
  }, {});

  const handleBacktestClick = (backtest: any) => {
    setSelectedBacktest(backtest);
    setSelectedTab("overview");
  };

  const renderSignalBadges = (signals: any) => {
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {signals.ema_pullback && <Badge variant="secondary">EMA Pullback</Badge>}
        {signals.mean_reversion && <Badge variant="secondary">Mean Reversion</Badge>}
        {signals.breakout && <Badge variant="secondary">Breakout</Badge>}
      </div>
    );
  };

  const renderLevels = (levels: number[]) => {
    return levels.map((level, idx) => (
      <Badge key={idx} variant="outline" className="mr-1">
        {level.toFixed(2)}
      </Badge>
    ));
  };

  const renderAnalysisHistory = () => {
    if (!selectedBacktest?.analyses) return null;

    const seenImages: string[] = [];
    const uniqueAnalyses = selectedBacktest.analyses.filter((analysis: any) => {
      const isUnique = isUniqueImage(analysis.chart_image, seenImages);
      if (isUnique) {
        seenImages.push(analysis.chart_image);
      }
      return isUnique;
    });

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {uniqueAnalyses.map((analysis: any, index: number) => (
            <Card
              key={index}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => {
                setSelectedAnalysis(analysis);
                setSelectedImage(analysis.chart_image);
              }}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm">{formatDate(analysis.timestamp)}</CardTitle>
                  <Badge variant={analysis.trend === "bullish" ? "success" : analysis.trend === "bearish" ? "destructive" : "secondary"}>{analysis.trend}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="aspect-video relative">
                  <img src={`data:image/png;base64,${analysis.chart_image}`} alt={`Analysis ${index + 1}`} className="w-full h-full object-cover rounded" />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Confidence:</span>
                    <Badge variant={analysis.confidence >= 80 ? "success" : analysis.confidence >= 60 ? "warning" : "destructive"}>{analysis.confidence}%</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Action:</span>
                    <Badge variant={analysis.recommendation.action === "buy" ? "success" : analysis.recommendation.action === "sell" ? "destructive" : "secondary"}>
                      {analysis.recommendation.action}
                    </Badge>
                  </div>
                  {analysis.recommendation.entry_price && (
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Entry:</span>
                      <span>${analysis.recommendation.entry_price.toFixed(2)}</span>
                    </div>
                  )}
                  {renderSignalBadges(analysis.signals)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(groupedBacktests).map(([key, group]: [string, any]) => {
          const [symbol, timeframe] = key.split("-");
          const latestBacktest = group[0];
          return (
            <Card key={key} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleBacktestClick(latestBacktest)}>
              <CardHeader>
                <CardTitle>
                  {symbol} - {timeframe}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  <strong>Total Backtests:</strong> {group.length}
                </p>
                <p>
                  <strong>Latest Result:</strong>
                </p>
                <p>Win Rate: {(latestBacktest.winRate * 100).toFixed(2)}%</p>
                <p>Profit Factor: {latestBacktest.profitFactor.toFixed(2)}</p>
                <p>Last Run: {formatDate(latestBacktest.createdAt)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedBacktest && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>
              {selectedBacktest.symbol} - {selectedBacktest.timeframe} Backtest Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="trades">Trades</TabsTrigger>
                <TabsTrigger value="analysis">Analysis History</TabsTrigger>
                <TabsTrigger value="equity">Equity Curve</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <h3 className="font-semibold">Performance</h3>
                    <p>Initial Balance: ${selectedBacktest.initialBalance.toFixed(2)}</p>
                    <p>Final Balance: ${selectedBacktest.finalBalance.toFixed(2)}</p>
                    <p>Total Return: {((selectedBacktest.finalBalance / selectedBacktest.initialBalance - 1) * 100).toFixed(2)}%</p>
                  </div>
                  <div>
                    <h3 className="font-semibold">Trade Statistics</h3>
                    <p>Total Trades: {selectedBacktest.totalTrades}</p>
                    <p>Win Rate: {(selectedBacktest.winRate * 100).toFixed(2)}%</p>
                    <p>Profit Factor: {selectedBacktest.profitFactor.toFixed(2)}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold">Risk Metrics</h3>
                    <p>Max Drawdown: {selectedBacktest.maxDrawdownPercentage.toFixed(2)}%</p>
                    <p>Average Win: ${selectedBacktest.averageWin.toFixed(2)}</p>
                    <p>Average Loss: ${selectedBacktest.averageLoss.toFixed(2)}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="trades">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="px-4 py-2">Entry Time</th>
                        <th className="px-4 py-2">Exit Time</th>
                        <th className="px-4 py-2">Side</th>
                        <th className="px-4 py-2">Entry Price</th>
                        <th className="px-4 py-2">Exit Price</th>
                        <th className="px-4 py-2">P/L</th>
                        <th className="px-4 py-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBacktest.trades?.map((trade: any, index: number) => (
                        <tr key={index}>
                          <td className="px-4 py-2">{formatDate(trade.entryTime)}</td>
                          <td className="px-4 py-2">{trade.exitTime ? formatDate(trade.exitTime) : "-"}</td>
                          <td className="px-4 py-2">{trade.side}</td>
                          <td className="px-4 py-2">${trade.entryPrice.toFixed(2)}</td>
                          <td className="px-4 py-2">${trade.exitPrice?.toFixed(2) || "-"}</td>
                          <td className="px-4 py-2">${trade.pnl?.toFixed(2) || "-"}</td>
                          <td className="px-4 py-2">{trade.reason || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="analysis">{renderAnalysisHistory()}</TabsContent>

              <TabsContent value="equity">
                {selectedBacktest.equityCurve && (
                  <div className="h-[400px]">
                    <TVChart
                      data={selectedBacktest.equityCurve.map((point: any) => ({
                        timestamp: new Date(point.timestamp).getTime() / 1000,
                        value: point.balance,
                      }))}
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={!!selectedImage}
        onClose={() => {
          setSelectedImage(null);
          setSelectedAnalysis(null);
        }}
        title="Analysis Details">
        <div className="space-y-4">
          <div className="w-full max-h-[60vh]">
            <img src={selectedImage ? `data:image/png;base64,${selectedImage}` : ""} alt="Analysis Chart" className="w-full h-full object-contain" />
          </div>
          {selectedAnalysis && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Analysis Details</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p>
                      <strong>Trend:</strong> {selectedAnalysis.trend}
                    </p>
                    <p>
                      <strong>Confidence:</strong> {selectedAnalysis.confidence}%
                    </p>
                    <p>
                      <strong>Action:</strong> {selectedAnalysis.recommendation.action}
                    </p>
                  </div>
                  <div>
                    <p>
                      <strong>Entry Price:</strong> ${selectedAnalysis.recommendation.entry_price?.toFixed(2) || "N/A"}
                    </p>
                    <p>
                      <strong>Stop Loss:</strong> ${selectedAnalysis.recommendation.stop_loss?.toFixed(2) || "N/A"}
                    </p>
                    <p>
                      <strong>Take Profit:</strong> ${selectedAnalysis.recommendation.take_profit?.toFixed(2) || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Support Levels</h3>
                {renderLevels(selectedAnalysis.key_levels.support)}
              </div>
              <div>
                <h3 className="font-semibold mb-2">Resistance Levels</h3>
                {renderLevels(selectedAnalysis.key_levels.resistance)}
              </div>
              <div>
                <h3 className="font-semibold mb-2">Signals</h3>
                {renderSignalBadges(selectedAnalysis.signals)}
              </div>
              {selectedAnalysis.recommendation.reasoning && (
                <div>
                  <h3 className="font-semibold mb-2">Reasoning</h3>
                  <p className="text-sm">{selectedAnalysis.recommendation.reasoning}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
