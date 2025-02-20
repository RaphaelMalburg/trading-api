import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeriesOptions } from "lightweight-charts";
import { getBars, getAccount, getPositions, type Account, type Position } from "@/lib/alpaca";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const { data: account } = useQuery<Account>({
    queryKey: ["/api/account"],
    queryFn: getAccount,
  });

  const { data: positions } = useQuery<Position[]>({
    queryKey: ["/api/positions"],
    queryFn: getPositions,
  });

  useEffect(() => {
    async function initializeChart() {
      console.log("Initializing chart...");

      if (!chartContainerRef.current) {
        console.log("Chart container ref not found");
        return;
      }

      try {
        // Create chart instance
        console.log("Creating chart instance");
        const chart = createChart(chartContainerRef.current, {
          layout: {
            background: { color: "#ffffff" },
            textColor: "#333",
          },
          grid: {
            vertLines: { color: "#f0f0f0" },
            horzLines: { color: "#f0f0f0" },
          },
          width: chartContainerRef.current.clientWidth,
          height: 400,
        });

        console.log("Chart instance created");
        chartRef.current = chart;

        // Create candlestick series
        console.log("Creating candlestick series");
        const series = (chart as any).addCandlestickSeries({
          upColor: "#26a69a",
          downColor: "#ef5350",
          borderVisible: false,
          wickUpColor: "#26a69a",
          wickDownColor: "#ef5350",
        });

        // Fetch data
        console.log("Fetching AAPL data");
        const response = await fetch("http://localhost:5000/api/bars/AAPL");
        console.log("Response status:", response.status);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Received data:", data);

        // Format and set data
        const formattedData = data.map((bar: any) => ({
          time: bar.timestamp / 1000, // Convert to seconds if timestamp is in milliseconds
          open: parseFloat(bar.open),
          high: parseFloat(bar.high),
          low: parseFloat(bar.low),
          close: parseFloat(bar.close),
        }));

        console.log("Formatted data:", formattedData);
        series.setData(formattedData);

        // Handle resize
        const handleResize = () => {
          if (chartContainerRef.current) {
            chart.applyOptions({
              width: chartContainerRef.current.clientWidth,
            });
          }
        };

        window.addEventListener("resize", handleResize);

        // Cleanup
        return () => {
          window.removeEventListener("resize", handleResize);
          chart.remove();
        };
      } catch (error) {
        console.error("Chart initialization error:", error);
        setChartError(error instanceof Error ? error.message : "Failed to initialize chart");
        toast({
          title: "Error",
          description: "Failed to load chart data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }

    // Add small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      initializeChart();
    }, 100);

    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card>
          <CardHeader>
            <CardTitle>Account Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${account?.equity || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Buying Power</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${account?.buying_power || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Open Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{positions?.length || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Apple (AAPL)</CardTitle>
        </CardHeader>
        <CardContent>
          {chartError ? <div className="text-red-500 p-4">Error: {chartError}</div> : <div ref={chartContainerRef} className="w-full h-[400px]" />}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
