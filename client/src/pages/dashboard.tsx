import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getAccount, getPositions, type Account, type Position, type Bar } from "@/lib/alpaca";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import TVChart from "@/components/TVChart";

interface ChartData {
  symbol: string;
  data: Bar[];
  isLoading: boolean;
}

async function fetchBarsData(symbol: string): Promise<Bar[]> {
  const response = await fetch(`/api/bars/${symbol}?timeframe=1Hour&limit=200`, {
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const rawData = await response.json();

  // Transform the data to match expected format
  return rawData.map((bar: any) => ({
    timestamp: bar.Timestamp,
    open: Number(bar.OpenPrice),
    high: Number(bar.HighPrice),
    low: Number(bar.LowPrice),
    close: Number(bar.ClosePrice),
    volume: Number(bar.Volume),
  }));
}

export default function Dashboard() {
  const { toast } = useToast();
  const [chartsData, setChartsData] = useState<Record<string, ChartData>>({});
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const symbols = [
    { value: "AAPL", label: "Apple Inc. (AAPL)" },
    { value: "MSFT", label: "Microsoft Corp. (MSFT)" },
  ];

  // Fetch initial data
  useEffect(() => {
    async function fetchAllData() {
      for (const { value: symbol } of symbols) {
        try {
          console.log(`[Dashboard] Fetching data for ${symbol}...`);
          const data = await fetchBarsData(symbol);

          console.log(`[Dashboard] Data received for ${symbol}:`, {
            length: data.length,
            sample: data[0],
          });

          setChartsData((prev) => ({
            ...prev,
            [symbol]: {
              symbol,
              data,
              isLoading: false,
            },
          }));
        } catch (error) {
          console.error(`[Dashboard] Error fetching data for ${symbol}:`, error);
          toast({
            title: `Error loading ${symbol}`,
            description: error instanceof Error ? error.message : "Failed to fetch data",
            variant: "destructive",
          });
        }
      }
    }

    fetchAllData();
  }, [toast]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const newWs = new WebSocket(`ws://${window.location.host}/ws`);

    newWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "bars" && message.symbol && message.data.length > 0) {
          setChartsData((prev) => ({
            ...prev,
            [message.symbol]: {
              ...prev[message.symbol],
              data: message.data,
            },
          }));
        }
      } catch (error) {
        console.error("[Dashboard] WebSocket: Error processing message:", error);
      }
    };

    newWs.onopen = () => {
      console.log("WebSocket connected");
      symbols.forEach(({ value: symbol }) => {
        newWs.send(JSON.stringify({ type: "subscribe", symbol }));
      });
    };

    setWs(newWs);

    return () => {
      if (newWs) {
        newWs.close();
      }
    };
  }, []);

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex flex-col gap-4">
        {symbols.map(({ value: symbol, label }) => (
          <Card key={symbol} className="w-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{label} - 1H Chart</CardTitle>
            </CardHeader>
            <CardContent>
              {chartsData[symbol]?.isLoading ? (
                <div className="h-[600px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : chartsData[symbol]?.data ? (
                <TVChart
                  data={chartsData[symbol].data}
                  colors={{
                    backgroundColor: "white",
                    textColor: "black",
                  }}
                />
              ) : (
                <div className="h-[600px] flex items-center justify-center">
                  <p className="text-gray-500">No data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-2">Positions</h2>
        {positions && positions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2">Symbol</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2">Avg Price</th>
                  <th className="px-4 py-2">Market Value</th>
                  <th className="px-4 py-2">P/L</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <tr key={position.symbol}>
                    <td className="px-4 py-2">{position.symbol}</td>
                    <td className="px-4 py-2">{position.qty}</td>
                    <td className="px-4 py-2">${position.avg_entry_price}</td>
                    <td className="px-4 py-2">${position.market_value}</td>
                    <td className="px-4 py-2">${position.unrealized_pl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No open positions</p>
        )}
      </div>
    </div>
  );
}
