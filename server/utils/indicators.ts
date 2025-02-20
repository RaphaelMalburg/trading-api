export function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const emaData: number[] = [];
  let ema = data[0];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      emaData.push(ema);
    } else {
      ema = data[i] * k + ema * (1 - k);
      emaData.push(ema);
    }
  }

  return emaData;
}

export function calculateBollingerBands(
  data: number[],
  period: number = 20,
  stdDev: number = 2
): {
  upper: number[];
  middle: number[];
  lower: number[];
} {
  const sma = data.map((_, idx, arr) => {
    if (idx < period - 1) return null;
    const slice = arr.slice(idx - period + 1, idx + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });

  const upper = sma.map((middle, idx) => {
    if (middle === null) return null;
    const slice = data.slice(idx - period + 1, idx + 1);
    const std = Math.sqrt(slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period);
    return middle + stdDev * std;
  });

  const lower = sma.map((middle, idx) => {
    if (middle === null) return null;
    const slice = data.slice(idx - period + 1, idx + 1);
    const std = Math.sqrt(slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period);
    return middle - stdDev * std;
  });

  return {
    upper: upper.filter((x): x is number => x !== null),
    middle: sma.filter((x): x is number => x !== null),
    lower: lower.filter((x): x is number => x !== null),
  };
}

export function calculateRSI(data: number[], period: number = 14): number[] {
  const changes = data.map((price, index) => {
    if (index === 0) return 0;
    return price - data[index - 1];
  });

  const gains = changes.map((change) => (change > 0 ? change : 0));
  const losses = changes.map((change) => (change < 0 ? -change : 0));

  const rsiData: number[] = [];
  let avgGain = gains.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < data.length; i++) {
    if (i > period) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    rsiData.push(rsi);
  }

  return rsiData;
}

export function findPivotPoints(data: { high: number; low: number; close: number }[]): {
  pivotHigh: number[];
  pivotLow: number[];
} {
  const pivotHigh: number[] = [];
  const pivotLow: number[] = [];
  const lookback = 5; // Number of bars to look back and forward

  for (let i = lookback; i < data.length - lookback; i++) {
    const currentHigh = data[i].high;
    const currentLow = data[i].low;

    let isHighPivot = true;
    let isLowPivot = true;

    // Check if it's a pivot high
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (data[j].high > currentHigh) {
        isHighPivot = false;
        break;
      }
    }

    // Check if it's a pivot low
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (data[j].low < currentLow) {
        isLowPivot = false;
        break;
      }
    }

    if (isHighPivot) pivotHigh.push(currentHigh);
    if (isLowPivot) pivotLow.push(currentLow);
  }

  return { pivotHigh, pivotLow };
}

export function identifyTrendlines(data: { high: number; low: number; close: number }[]): {
  resistance: { start: number; end: number }[];
  support: { start: number; end: number }[];
} {
  const { pivotHigh, pivotLow } = findPivotPoints(data);

  // Simple implementation - connect consecutive pivot points
  const resistance = pivotHigh
    .map((high, i) => {
      if (i === 0) return null;
      return {
        start: pivotHigh[i - 1],
        end: high,
      };
    })
    .filter((x): x is { start: number; end: number } => x !== null);

  const support = pivotLow
    .map((low, i) => {
      if (i === 0) return null;
      return {
        start: pivotLow[i - 1],
        end: low,
      };
    })
    .filter((x): x is { start: number; end: number } => x !== null);

  return { resistance, support };
}
