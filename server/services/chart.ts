import { createCanvas } from "canvas";

interface OHLCData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function generateCandlestickChart(data: OHLCData[]): Promise<Buffer> {
  const width = 800;
  const height = 400;
  const padding = 50;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Set background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Find min and max values
  const minPrice = Math.min(...data.map((bar) => bar.low));
  const maxPrice = Math.max(...data.map((bar) => bar.high));
  const priceRange = maxPrice - minPrice;

  // Calculate scaling
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;
  const barWidth = chartWidth / data.length;
  const priceToY = (price: number) => height - padding - ((price - minPrice) / priceRange) * chartHeight;

  // Draw price axis
  ctx.strokeStyle = "#666666";
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.stroke();

  // Draw price labels
  ctx.fillStyle = "#333333";
  ctx.font = "12px Arial";
  for (let i = 0; i <= 5; i++) {
    const price = minPrice + (priceRange * i) / 5;
    const y = priceToY(price);
    ctx.fillText(price.toFixed(2), 5, y + 4);
  }

  // Draw candlesticks
  data.forEach((bar, i) => {
    const x = padding + i * barWidth;
    const centerX = x + barWidth / 2;

    // Draw wick
    ctx.strokeStyle = bar.close >= bar.open ? "#26a69a" : "#ef5350";
    ctx.beginPath();
    ctx.moveTo(centerX, priceToY(bar.high));
    ctx.lineTo(centerX, priceToY(bar.low));
    ctx.stroke();

    // Draw body
    const bodyTop = priceToY(Math.max(bar.open, bar.close));
    const bodyBottom = priceToY(Math.min(bar.open, bar.close));
    const bodyHeight = Math.max(1, bodyBottom - bodyTop); // Ensure minimum height of 1px

    ctx.fillStyle = bar.close >= bar.open ? "#26a69a" : "#ef5350";
    ctx.fillRect(x + 2, bodyTop, barWidth - 4, bodyHeight);
  });

  // Draw title
  ctx.fillStyle = "#333333";
  ctx.font = "bold 16px Arial";
  ctx.fillText("AAPL Stock Price", padding, 25);

  return canvas.toBuffer();
}

export async function generateVolumeChart(data: OHLCData[]): Promise<Buffer> {
  const width = 800;
  const height = 400;
  const padding = 50;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Set background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Find max volume
  const maxVolume = Math.max(...data.map((bar) => bar.volume));

  // Calculate scaling
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;
  const barWidth = chartWidth / data.length;
  const volumeToHeight = (volume: number) => (volume / maxVolume) * chartHeight;

  // Draw volume bars
  data.forEach((bar, i) => {
    const x = padding + i * barWidth;
    const barHeight = volumeToHeight(bar.volume);

    ctx.fillStyle = bar.close >= bar.open ? "rgba(38, 166, 154, 0.6)" : "rgba(239, 83, 80, 0.6)";
    ctx.fillRect(x + 1, height - padding - barHeight, barWidth - 2, barHeight);
  });

  // Draw volume axis
  ctx.strokeStyle = "#666666";
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.stroke();

  // Draw volume labels
  ctx.fillStyle = "#333333";
  ctx.font = "12px Arial";
  for (let i = 0; i <= 5; i++) {
    const volume = (maxVolume * i) / 5;
    const y = height - padding - volumeToHeight(volume);
    ctx.fillText(volume.toLocaleString(), 5, y + 4);
  }

  // Draw title
  ctx.fillStyle = "#333333";
  ctx.font = "bold 16px Arial";
  ctx.fillText("AAPL Trading Volume", padding, 25);

  return canvas.toBuffer();
}
