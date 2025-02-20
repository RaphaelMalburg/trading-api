import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeChart(chartData: any) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert stock market analyst. Analyze the given chart data and provide trading signals in a structured JSON format. Include: trend (string: bullish/bearish/neutral), confidence (number: 0-1), key_levels (object with support and resistance), and recommendation (string: buy/sell/hold).",
        },
        {
          role: "user",
          content: JSON.stringify(chartData),
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    return content ? JSON.parse(content) : null;
  } catch (error) {
    console.error("Error analyzing chart:", error);
    throw new Error("Failed to analyze chart data");
  }
}
