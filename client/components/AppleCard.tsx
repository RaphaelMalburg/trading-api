import React, { useEffect, useState } from "react";
import CandlestickChart from "./CandlestickChart";

interface Bar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const AppleCard: React.FC = () => {
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/bars/aapl");
        if (!response.ok) {
          throw new Error("Failed to fetch data");
        }
        const data = await response.json();
        setBars(data);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setLoading(false);
      }
    };

    fetchData();

    // Set up WebSocket connection for real-time updates
    const ws = new WebSocket(`ws://${window.location.host}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "bars") {
          setBars(data.data);
        }
      } catch (err) {
        console.error("Error processing WebSocket message:", err);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  if (loading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3 mt-4">
            <div className="h-60 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  const latestBar = bars[bars.length - 1];
  const previousBar = bars[bars.length - 2];
  const priceChange = latestBar && previousBar ? ((latestBar.close - previousBar.close) / previousBar.close) * 100 : 0;

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold">AAPL</h2>
          <p className="text-gray-600">Apple Inc.</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">${latestBar?.close.toFixed(2)}</p>
          <p className={`text-sm ${priceChange >= 0 ? "text-green-500" : "text-red-500"}`}>
            {priceChange >= 0 ? "▲" : "▼"} {Math.abs(priceChange).toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="h-[400px]">
        <CandlestickChart data={bars} symbol="AAPL" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-600">Open</p>
          <p className="font-medium">${latestBar?.open.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-600">High</p>
          <p className="font-medium">${latestBar?.high.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-600">Low</p>
          <p className="font-medium">${latestBar?.low.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-600">Volume</p>
          <p className="font-medium">{latestBar?.volume.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

export default AppleCard;
