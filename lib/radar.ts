// lib/radar.ts
// Wolf Radar Supabase CRUD

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export type RadarStock = {
  id: string;
  ticker: string;
  name: string;
  exchange: string;
  category: string;
  status: "WATCHING" | "STALKING" | "ENTERED" | "EXITED" | "KILLED";
  thesis_oneliner: string;
  thesis_json: {
    bull_case?: string;
    bear_case?: string;
    catalysts?: string;
    key_metrics?: string;
    entry_exit?: string;
  };
  kelly_win_prob: number;
  kelly_wl_ratio: number;
  added_at: string;
  updated_at: string;
};

const supabase = createClientComponentClient();

export async function fetchStocks(): Promise<RadarStock[]> {
  const { data, error } = await supabase
    .from("radar_stocks")
    .select("*")
    .order("added_at", { ascending: false });

  if (error) {
    console.error("fetchStocks error:", error);
    return [];
  }
  return data || [];
}

export async function addStock(
  stock: Omit<RadarStock, "id" | "added_at" | "updated_at">
): Promise<RadarStock | null> {
  const { data, error } = await supabase
    .from("radar_stocks")
    .insert(stock)
    .select()
    .single();

  if (error) {
    console.error("addStock error:", error);
    return null;
  }
  return data;
}

export async function updateStock(
  id: string,
  updates: Partial<RadarStock>
): Promise<RadarStock | null> {
  const { data, error } = await supabase
    .from("radar_stocks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("updateStock error:", error);
    return null;
  }
  return data;
}

export async function deleteStock(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("radar_stocks")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteStock error:", error);
    return false;
  }
  return true;
}

export async function generateThesis(
  ticker: string,
  exchange: string
): Promise<any> {
  const res = await fetch("/api/radar/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, exchange }),
  });

  if (!res.ok) throw new Error("Generation failed");
  return res.json();
}
