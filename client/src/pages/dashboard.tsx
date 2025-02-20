import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getAccount, getPositions, type Account, type Position, type Bar } from "@/lib/alpaca";
import { Loader2 } from "lucide-react";
import { TVChart } from "@/components/TVChart";
import { instrumentCategories } from "../config/instruments";

interface OHLCData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartData {
  symbol: string;
  data: Bar[];
  isLoading: boolean;
}

async function fetchBarsData(symbol: string): Promise<Bar[]> {
  const response = await fetch(`/api/bars/${symbol}`, {
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let data = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    data += decoder.decode(value, { stream: true });
  }

  // Final decode to handle any remaining bytes
  data += decoder.decode();

  try {
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error parsing JSON for ${symbol}:`, error);
    throw new Error("Failed to parse response data");
  }
}

export default function Dashboard() {
  const { toast } = useToast();
  const [chartsData, setChartsData] = useState<Record<string, ChartData>>({});
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const { data: accountData } = useQuery<Account>({
    queryKey: ["/api/account"],
    queryFn: getAccount,
  });

  const { data: positionsData } = useQuery<Position[]>({
    queryKey: ["/api/positions"],
    queryFn: getPositions,
  });

  // Initialize charts data for all instruments
  useEffect(() => {
    const allInstruments = instrumentCategories.flatMap((category) => category.instruments.map((instrument) => instrument.symbol));

    const initialChartsData: Record<string, ChartData> = {};
    allInstruments.forEach((symbol) => {
      initialChartsData[symbol] = {
        symbol,
        data: [],
        isLoading: true,
      };
    });
    setChartsData(initialChartsData);

    // Fetch data sequentially for each instrument
    async function fetchAllData() {
      for (const symbol of allInstruments) {
        try {
          console.log(`[Dashboard] Fetching data for ${symbol}...`);
          const data = await fetchBarsData(symbol);
          setChartsData((prev) => ({
            ...prev,
            [symbol]: {
              symbol,
              data,
              isLoading: false,
            },
          }));
          // Add a small delay between requests to prevent overwhelming the server
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`[Dashboard] Error fetching data for ${symbol}:`, error);
          setChartsData((prev) => ({
            ...prev,
            [symbol]: {
              ...prev[symbol],
              isLoading: false,
            },
          }));
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
      const message = JSON.parse(event.data);
      if (message.type === "bars" && message.symbol) {
        setChartsData((prev) => ({
          ...prev,
          [message.symbol]: {
            ...prev[message.symbol],
            data: message.data,
          },
        }));
      }
    };

    newWs.onopen = () => {
      console.log("WebSocket connected");
      // Subscribe to all instruments
      instrumentCategories.forEach((category) => {
        category.instruments.forEach((instrument) => {
          newWs.send(JSON.stringify({ type: "subscribe", symbol: instrument.symbol }));
        });
      });
    };

    setWs(newWs);

    return () => {
      if (newWs.readyState === WebSocket.OPEN) {
        newWs.close();
      }
    };
  }, []);

  // Fetch account and positions data
  useEffect(() => {
    getAccount()
      .then(setAccount)
      .catch((error) => {
        console.error("Error fetching account:", error);
        setError("Failed to fetch account data");
      });

    getPositions()
      .then(setPositions)
      .catch((error) => {
        console.error("Error fetching positions:", error);
        setError("Failed to fetch positions");
      });
  }, []);

  const handleSymbolChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSymbol = event.target.value;
    setSelectedSymbol(newSymbol);

    // Send unsubscribe message for the old symbol
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "unsubscribe", symbol: selectedSymbol }));
      // Send subscribe message for the new symbol
      ws.send(JSON.stringify({ type: "subscribe", symbol: newSymbol }));
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <select value={selectedSymbol} onChange={handleSymbolChange} className="block w-full p-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
          {instrumentCategories.map((category) => (
            <optgroup key={category.name} label={category.name}>
              {category.instruments.map((instrument) => (
                <option key={instrument.symbol} value={instrument.symbol}>
                  {instrument.symbol} - {instrument.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">{error}</div>}

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

      {instrumentCategories.map((category) => (
        <div key={category.name} className="mb-8">
          <h2 className="text-2xl font-bold mb-4">{category.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {category.instruments.map((instrument) => {
              const chartData = chartsData[instrument.symbol];
              const latestBar = chartData?.data[chartData.data.length - 1];
              const previousBar = chartData?.data[chartData.data.length - 2];
              const priceChange = latestBar && previousBar ? ((latestBar.close - previousBar.close) / previousBar.close) * 100 : 0;

              return (
                <Card key={instrument.symbol} className="min-h-[400px]">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>
                      {instrument.name} ({instrument.symbol})
                    </CardTitle>
                    {latestBar && (
                      <div className="text-right">
                        <p className="text-2xl font-bold">${latestBar.close.toFixed(2)}</p>
                        <p className={`text-sm ${priceChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {priceChange >= 0 ? "▲" : "▼"} {Math.abs(priceChange).toFixed(2)}%
                        </p>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {chartData?.isLoading ? (
                      <div className="flex items-center justify-center h-[300px]">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    ) : (
                      <TVChart
                        data={chartData?.data || []}
                        colors={{
                          backgroundColor: "white",
                          textColor: "black",
                        }}
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

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
