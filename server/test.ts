import { getHistoricalBars } from "./services/alpaca";

async function main() {
  try {
    // Get historical AAPL data
    const data = await getHistoricalBars("AAPL", 100);
    console.log("Historical AAPL data:", data);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
