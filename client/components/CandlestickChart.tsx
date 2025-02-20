import React from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, ChartOptions } from "chart.js";
import { Line } from "react-chartjs-2";
import "chartjs-adapter-date-fns";

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale);

interface Bar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlestickChartProps {
  data: Bar[];
  symbol: string;
}

const CandlestickChart: React.FC<CandlestickChartProps> = ({ data, symbol }) => {
  const chartData = {
    labels: data.map((bar) => new Date(bar.timestamp)),
    datasets: [
      {
        label: "Price",
        data: data.map((bar) => bar.close),
        borderColor: "rgb(75, 192, 192)",
        tension: 0.1,
        pointRadius: 0,
      },
      {
        label: "High",
        data: data.map((bar) => bar.high),
        borderColor: "rgba(75, 192, 192, 0.2)",
        tension: 0.1,
        pointRadius: 0,
      },
      {
        label: "Low",
        data: data.map((bar) => bar.low),
        borderColor: "rgba(75, 192, 192, 0.2)",
        tension: 0.1,
        pointRadius: 0,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `${symbol} Price Chart (4H)`,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const index = context.dataIndex;
            const bar = data[index];
            return [
              `Open: $${bar.open.toFixed(2)}`,
              `High: $${bar.high.toFixed(2)}`,
              `Low: $${bar.low.toFixed(2)}`,
              `Close: $${bar.close.toFixed(2)}`,
              `Volume: ${bar.volume.toLocaleString()}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        type: "timeseries" as const,
        time: {
          unit: "day",
        },
        title: {
          display: true,
          text: "Date",
        },
      },
      y: {
        title: {
          display: true,
          text: "Price ($)",
        },
      },
    },
  };

  return (
    <div style={{ height: "400px", width: "100%" }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default CandlestickChart;
