import { NextResponse } from "next/server";
export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [
          {
            role: "user",
            content: `You are a macro data assistant. Search for the latest data and respond ONLY with a JSON object (no markdown, no backticks, no preamble):
{
  "us_cpi": <latest US CPI YoY % number>,
  "kr_cpi": <latest Korea CPI YoY % number>,
  "us_rate": <current US Fed Funds upper bound rate number>,
  "kr_rate": <current Korea BOK base rate number>,
  "brent_oil": <current Brent crude oil price USD number>,
  "wti_oil": <current WTI crude oil price USD number>,
  "usdkrw": <current USD/KRW exchange rate, rounded to nearest 10>,
  "data_date": "<YYYY-MM-DD of data>",
  "notes": "<brief 1-line summary of latest CPI trend>"
}
Search for: latest US CPI, Korea CPI, Fed funds rate, BOK base rate, Brent crude oil price, WTI crude oil price, USD KRW exchange rate. Return ONLY the JSON.`,
          },
        ],
      }),
    });
    const result = await response.json();
    const textBlocks = result.content?.filter((b) => b.type === "text") || [];
    const raw = textBlocks.map((b) => b.text).join("");
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Oil-CPI AI update error:", error);
    return NextResponse.json(
      { error: "Failed to fetch latest data" },
      { status: 500 }
    );
  }
}
