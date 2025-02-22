import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useToast } from "./ui/use-toast";
import { Badge } from "./ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

interface AnalysisHistoryProps {
  onSelectAnalysis?: (data: any) => void;
}

export function BacktestHistory({ onSelectAnalysis }: AnalysisHistoryProps) {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAnalyses = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/analysis/history", {
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the response as text first to validate it
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse response:", text.substring(0, 1000));
        throw new Error("Invalid JSON response from server");
      }

      // Add more detailed logging
      console.log("Received analyses:", {
        count: data.length,
        firstAnalysis: data[0]
          ? {
              id: data[0].id,
              timestamp: data[0].timestamp,
              hasImage: !!data[0].chart_image,
            }
          : null,
      });

      data.forEach((analysis: any, index: number) => {
        console.log(`Analysis ${index}:`, {
          id: analysis.id,
          hasChartImage: !!analysis.chart_image,
          imageLength: analysis.chart_image?.length,
          imagePreview: analysis.chart_image?.substring(0, 50) + "...",
          timestamp: analysis.timestamp,
          trend: analysis.trend,
          confidence: analysis.confidence,
          recommendation: {
            action: analysis.recommendation?.action,
            reasoning: analysis.recommendation?.reasoning,
          },
          allKeys: Object.keys(analysis),
        });
      });

      // Sort analyses by timestamp in descending order
      const sortedData = [...data].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setAnalyses(sortedData);
    } catch (error) {
      console.error("Error fetching analyses:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch analysis history.",
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
          <CardTitle>Analysis History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {loading && <div className="text-center">Loading...</div>}
            {analyses.map((analysis, index) => (
              <Card key={analysis.id || index} className="hover:bg-muted/50 cursor-pointer overflow-hidden" onClick={() => onSelectAnalysis?.(analysis)}>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Analysis Info */}
                    <div className="space-y-6">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <h3 className="text-sm font-medium">Trend</h3>
                          <p className="text-2xl font-bold capitalize">{analysis.trend || "N/A"}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium">Confidence</h3>
                          <p className="text-2xl font-bold">{analysis.confidence || 0}%</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium">Recommendation</h3>
                          <p className="text-2xl font-bold capitalize">{analysis.recommendation?.action || "N/A"}</p>
                        </div>
                      </div>

                      {/* Price Levels */}
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium mb-2">Support Levels</h3>
                          <div className="flex gap-2 flex-wrap">
                            {analysis.key_levels?.support?.map((level: number, i: number) => (
                              <Badge key={i} variant="outline">
                                {level.toFixed(2)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium mb-2">Resistance Levels</h3>
                          <div className="flex gap-2 flex-wrap">
                            {analysis.key_levels?.resistance?.map((level: number, i: number) => (
                              <Badge key={i} variant="outline">
                                {level.toFixed(2)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Signals and Patterns */}
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium mb-2">Signals</h3>
                          <div className="flex gap-2 flex-wrap">
                            {Object.entries(analysis.signals || {}).map(([key, value]) => (
                              <Badge key={key} variant={value ? "default" : "outline"}>
                                {key.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {analysis.patterns && analysis.patterns.length > 0 && (
                          <div>
                            <h3 className="text-sm font-medium mb-2">Patterns</h3>
                            <div className="flex gap-2 flex-wrap">
                              {analysis.patterns.map((pattern: any, i: number) => (
                                <Badge key={i} variant="secondary">
                                  {pattern.name} ({pattern.confidence}%)
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Reasoning */}
                      {analysis.recommendation?.reasoning && (
                        <div>
                          <h3 className="text-sm font-medium mb-2">Reasoning</h3>
                          <p className="text-sm text-muted-foreground">{analysis.recommendation.reasoning}</p>
                        </div>
                      )}
                    </div>

                    {/* Chart Image */}
                    <div className="space-y-6">
                      {analysis.chart_image && (
                        <div>
                          <h3 className="text-sm font-medium mb-2">Chart Analysis</h3>
                          <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                            <img
                              src={`data:image/png;base64,${analysis.chart_image}`}
                              alt={`Chart Analysis ${analysis.id}`}
                              className="object-contain w-full h-full"
                              onError={(e) => {
                                console.error("Error loading image:", e);
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="mt-4 text-sm text-muted-foreground">Analysis Time: {format(new Date(analysis.timestamp), "PPpp")}</div>
                </CardContent>
              </Card>
            ))}
            {analyses.length === 0 && !loading && <div className="text-center text-muted-foreground">No analysis history available</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
