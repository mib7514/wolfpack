import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function supaFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return res;
}

// ─── FRED: US CPI (CPIAUCSL, Seasonally Adjusted, Monthly) ───
async function fetchFredCPI() {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error("FRED_API_KEY 환경변수가 설정되지 않았습니다");

  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&observation_start=1999-01-01&api_key=${key}&file_type=json`;
  const res = await fetch(url, { headers: { "User-Agent": "wolfpack/1.0" } });
  if (!res.ok) throw new Error(`FRED API 오류: ${res.status}`);

  const json = await res.json();
  const data = {};
  for (const obs of json.observations || []) {
    if (obs.value !== ".") {
      const ym = obs.date.slice(0, 7); // "2020-01"
      data[ym] = parseFloat(obs.value);
    }
  }
  return data; // { "1999-01": 164.3, "1999-02": 164.5, ... }
}

// ─── ECOS: Korea CPI (통계표코드: 901Y009, 항목코드: 0 = 총지수, 2020=100) ───
async function fetchEcosCPI() {
  const key = process.env.ECOS_API_KEY;
  if (!key) throw new Error("ECOS_API_KEY 환경변수가 설정되지 않았습니다");

  // ECOS API format: /StatisticSearch/{key}/json/kr/{start}/{end}/{statCode}/{cycle}/{startDate}/{endDate}/{itemCode}/
  // 901Y009 = 소비자물가지수(2020=100) 총지수
  // Try multiple stat codes in case of changes
  const statCodes = ["901Y009", "021Y125"];
  const itemCodes = ["0", "AA", "BBGA00"];

  let data = {};
  let success = false;

  for (const statCode of statCodes) {
    for (const itemCode of itemCodes) {
      if (success) break;
      try {
        const url = `https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/500/${statCode}/M/199901/202612/${itemCode}/`;
        const res = await fetch(url);
        if (!res.ok) continue;

        const json = await res.json();
        const rows = json?.StatisticSearch?.row;
        if (!rows || rows.length === 0) continue;

        for (const row of rows) {
          const time = row.TIME; // "199901" or "2020M01"
          const val = parseFloat(row.DATA_VALUE);
          if (isNaN(val)) continue;

          // Normalize time to "YYYY-MM"
          let ym;
          if (time.length === 6) {
            ym = time.slice(0, 4) + "-" + time.slice(4, 6);
          } else if (time.includes("M")) {
            ym = time.replace("M", "-");
          } else {
            continue;
          }
          data[ym] = val;
        }

        if (Object.keys(data).length > 100) {
          success = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    if (success) break;
  }

  if (!success || Object.keys(data).length === 0) {
    throw new Error("ECOS에서 한국 CPI 데이터를 가져오지 못했습니다. 통계표코드를 확인하세요.");
  }

  return data;
}

// ─── GET: 저장된 CPI 데이터 반환 ───
export async function GET() {
  try {
    const res = await supaFetch(
      "ra_cpi_data?select=id,data,updated_at&order=updated_at.desc&limit=1"
    );
    if (!res.ok) {
      return NextResponse.json({ data: null });
    }
    const rows = await res.json();
    return NextResponse.json({
      data: rows.length > 0 ? rows[0] : null,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST: 관리자 업데이트 ───
export async function POST(request) {
  try {
    const pin = request.headers.get("x-admin-pin");
    if (pin !== process.env.ADMIN_PIN) {
      return NextResponse.json({ error: "관리자 인증 실패" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === "update") {
      const errors = [];
      let usCpi = {};
      let krCpi = {};

      // Fetch US CPI from FRED
      try {
        usCpi = await fetchFredCPI();
      } catch (e) {
        errors.push("US CPI: " + e.message);
      }

      // Fetch Korea CPI from ECOS
      try {
        krCpi = await fetchEcosCPI();
      } catch (e) {
        errors.push("KR CPI: " + e.message);
      }

      if (Object.keys(usCpi).length === 0 && Object.keys(krCpi).length === 0) {
        return NextResponse.json({
          error: "데이터를 가져오지 못했습니다: " + errors.join("; "),
        }, { status: 500 });
      }

      // Build unified month list
      const allMonths = new Set([...Object.keys(usCpi), ...Object.keys(krCpi)]);
      const months = [...allMonths].sort();

      const cpiData = {
        months,
        us_index: months.map(m => usCpi[m] ?? null),
        kr_index: months.map(m => krCpi[m] ?? null),
        us_count: Object.keys(usCpi).length,
        kr_count: Object.keys(krCpi).length,
        errors: errors.length > 0 ? errors : undefined,
      };

      // Upsert to Supabase
      const now = new Date().toISOString();
      const checkRes = await supaFetch("ra_cpi_data?select=id&limit=1");
      const existing = await checkRes.json();

      let saveRes;
      if (existing && existing.length > 0) {
        saveRes = await supaFetch(
          `ra_cpi_data?id=eq.${existing[0].id}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({ data: cpiData, updated_at: now }),
          }
        );
      } else {
        saveRes = await supaFetch("ra_cpi_data", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            id: "cpi_main",
            data: cpiData,
            updated_at: now,
          }),
        });
      }

      if (!saveRes.ok) {
        const errText = await saveRes.text();
        return NextResponse.json({ error: "DB 저장 실패: " + errText }, { status: 500 });
      }

      const saved = await saveRes.json();
      const result = Array.isArray(saved) ? saved[0] : saved;
      return NextResponse.json({ data: result });
    }

    return NextResponse.json({ error: "알 수 없는 액션" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
