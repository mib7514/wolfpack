import { createClient } from "@supabase/supabase-js";

const supabaseUrl = `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID || "aclamququfgdpwavbjsi"}.supabase.co`;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const INDICATOR_FRAMEWORK = {
  categories: [
    {
      id: "energy_raw",
      name: "에너지/원료 충격",
      emoji: "🛢️",
      weight: 0.20,
      description: "1차 충격: 원유·나프타·LPG 등 원료 가격과 크랙스프레드",
      indicators: [
        { id: "brent_level", name: "Brent 유가 수준", description: "Brent 원유 현물/선물 가격 수준 및 변동폭" },
        { id: "naphtha_lpg", name: "나프타/LPG 가격", description: "석유화학 핵심 원료인 나프타·LPG 현물가격 및 유가 대비 프리미엄" },
        { id: "crack_spread", name: "제품 크랙스프레드", description: "가솔린/디젤/항공유 크랙마진. 정제마진이 확대되면 에너지 비용이 광범위하게 전이" },
        { id: "oil_curve", name: "원유 선물곡선 구조", description: "백워데이션/콘탱고 구조. 뒷단(6-12개월)까지 상승하면 시장이 장기 차질을 가격에 반영 중" }
      ]
    },
    {
      id: "logistics",
      name: "물류/보험 비용",
      emoji: "🚢",
      weight: 0.20,
      description: "1.5차 전이: 해상운임·보험료·우회항로가 비용 구조로 고착화되는지",
      indicators: [
        { id: "freight_rate", name: "해상운임 지수", description: "SCFI/BDI 등 컨테이너·벌크 운임. 이벤트성 스파이크 vs 고점 유지 구분이 핵심" },
        { id: "war_insurance", name: "전쟁위험 보험료", description: "호르무즈/홍해 등 고위험 해역 통과 시 추가 보험료. 고착화되면 원가의 상시 항목화" },
        { id: "route_diversion", name: "우회항로/리드타임", description: "주요 항로 우회에 따른 항해일수 증가, 선복 부족, 체선 비용" },
        { id: "logistics_duration", name: "물류비 지속기간", description: "운임·보험료 상승이 수주 vs 분기 vs 반년 이상 지속되는지 판단" }
      ]
    },
    {
      id: "intermediate",
      name: "중간재 스프레드",
      emoji: "🧪",
      weight: 0.15,
      description: "2차 전이: 올레핀/수지/포장재 등 중간재 가격과 마진 변동",
      indicators: [
        { id: "pe_pp_spread", name: "PE/PP 스프레드", description: "PE/PP 제품가 - 원료가 마진. 가격 상승이 마진 개선으로 이어지는지가 핵심" },
        { id: "ethylene_margin", name: "에틸렌/프로필렌 마진", description: "기초유분 마진. 원료 대비 올레핀 스프레드가 확대·유지되는지" },
        { id: "packaging_cost", name: "포장재/화학 단가", description: "플라스틱 필름, 골판지, 화학원료 등 산업 전반의 포장·소재 단가" }
      ]
    },
    {
      id: "core_services",
      name: "코어 서비스 물가",
      emoji: "🏪",
      weight: 0.20,
      description: "3차 전이(구조적 결정): 서비스 물가가 끈적하게 올라붙는지",
      indicators: [
        { id: "dining_services", name: "외식/개인서비스", description: "외식비, 미용, 세탁 등 개인서비스. 한국에서 체감이 가장 빠른 서비스 물가" },
        { id: "housing_cost", name: "주거비", description: "임대료, 관리비 등 주거 관련 비용. 한번 오르면 잘 안 내려오는 대표적 끈적한 항목" },
        { id: "transport_services", name: "운송서비스", description: "택시/버스/택배/항공 등 운송서비스 가격. 에너지 비용 전가의 직접 경로" }
      ]
    },
    {
      id: "expectations",
      name: "기대인플레/금리",
      emoji: "📊",
      weight: 0.15,
      description: "시장의 '기간(duration)' 평가: 기대인플레와 기간프리미엄 움직임",
      indicators: [
        { id: "breakeven_5y5y", name: "5Y5Y 브레이크이븐", description: "5년후 5년 기대인플레. 추세적 재상승이면 시장이 구조적 인플레를 가격에 반영" },
        { id: "term_premium", name: "기간프리미엄", description: "장기금리에서 기대단기금리를 뺀 부분. 인플레 불확실성이 커질 때 상승" },
        { id: "cb_communication", name: "중앙은행 커뮤니케이션", description: "연준/한은이 '헤드라인 무시' 스탠스를 유지하는지, 2차 파급 경계로 전환하는지" }
      ]
    },
    {
      id: "wage_second",
      name: "임금/2차 파급",
      emoji: "💼",
      weight: 0.10,
      description: "고착화 루프: 임금·가격결정력·소비자 기대가 인플레를 자기강화하는지",
      indicators: [
        { id: "wage_growth", name: "임금 상승률", description: "명목임금 증가율. '원가 상승 → 임금 인상 요구'로 번지면 2차 파급의 핵심" },
        { id: "pricing_power", name: "기업 가격전가 행태", description: "실적 콜에서 '원가 전가'가 아니라 '리스트프라이스 인상+유지'가 반복되는지" },
        { id: "consumer_expectation", name: "소비자 기대인플레", description: "한은/미시간대 소비자 기대인플레 서베이. 고착화되면 구조적 인플레의 마지막 퍼즐" }
      ]
    }
  ]
};

function extractJSON(text) {
  // Robust JSON extraction with brace matching
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          return JSON.parse(text.substring(start, i + 1));
        } catch (e) {
          start = -1;
        }
      }
    }
  }
  return null;
}

async function callClaude(systemPrompt, userPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
        },
      ],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  const textBlocks = (data.content || []).filter((b) => b.type === "text").map((b) => b.text);
  return textBlocks.join("\n");
}

// GET: Fetch latest data
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("inflation_monitor")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      data: data || null,
      framework: INDICATOR_FRAMEWORK,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST: AI Update (admin only)
export async function POST(request) {
  try {
    const adminPin = request.headers.get("x-admin-pin");
    if (!adminPin || adminPin !== process.env.ADMIN_PIN) {
      return Response.json({ error: "관리자 인증 실패" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === "ai_update") {
      // AI updates all categories at once
      const systemPrompt = `당신은 인플레이션 확산 모니터링 전문 분석가입니다. 현재 중동발 에너지/물류 쇼크가 다양한 품목으로 확산되어 CPI가 상승할 우려가 있는 상황을 모니터링하고 있습니다.

각 지표에 대해 최신 데이터와 뉴스를 검색하여 분석해주세요.
점수 기준:
- 0~25: 안정 (인플레 확산 위험 낮음)
- 26~50: 주의 (일부 상승 신호, 아직 제한적)
- 51~75: 경고 (확산 진행 중, 모니터링 강화 필요)
- 76~100: 위험 (광범위한 확산, 구조적 인플레 위험)

반드시 web_search를 사용하여 최신 데이터를 확인하세요. 한국과 미국 양쪽 모두 고려하되 글로벌 관점에서 분석하세요.
오늘 날짜: ${new Date().toISOString().split("T")[0]}

응답은 반드시 다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "categories": {
    "[category_id]": {
      "score": number,
      "status": "안정|주의|경고|위험",
      "summary": "카테고리 전체 요약 (2-3문장)",
      "indicators": {
        "[indicator_id]": {
          "score": number,
          "trend": "상승|하락|보합|급등|급락",
          "analysis": "지표별 분석 (2-3문장, 구체적 수치/사실 포함)"
        }
      }
    }
  },
  "overall_index": number,
  "overall_status": "안정|주의|경고|위험",
  "overall_summary": "전체 CPI 확산 위험 종합 판단 (3-5문장)",
  "key_signals": ["주요 신호 1", "주요 신호 2", "주요 신호 3"],
  "scenario_update": {
    "base": "베이스 시나리오 업데이트 (2-3문장)",
    "upside": "상방(구조적 인플레) 시나리오 변화 (2-3문장)",
    "downside": "하방(스파이크 후 둔화) 시나리오 변화 (2-3문장)"
  }
}`;

      const categories = INDICATOR_FRAMEWORK.categories;
      const categoryDescriptions = categories.map((c) => {
        const indDesc = c.indicators.map((ind) => `  - ${ind.id}: ${ind.name} — ${ind.description}`).join("\n");
        return `### ${c.name} (${c.id}, 가중치 ${c.weight})\n${c.description}\n${indDesc}`;
      }).join("\n\n");

      const userPrompt = `다음 인플레이션 확산 모니터링 프레임워크의 모든 카테고리와 지표를 최신 데이터 기반으로 업데이트해주세요.

${categoryDescriptions}

특히 다음을 중점 확인하세요:
1. 호르무즈/중동 리스크가 에너지·원료 가격에 미치는 현재 영향
2. 해상운임/보험료가 이벤트성 스파이크인지, 고점 고착화인지
3. PE/PP 등 중간재 스프레드 방향
4. 미국/한국 코어 서비스 물가 최근 추이 (MoM)
5. 5Y5Y 브레이크이븐, 기간프리미엄 움직임
6. 임금/기업 가격전가 최근 동향

JSON 형식으로만 응답하세요.`;

      const aiResponse = await callClaude(systemPrompt, userPrompt);
      const parsed = extractJSON(aiResponse);

      if (!parsed) {
        return Response.json({ error: "AI 응답 파싱 실패", raw: aiResponse.substring(0, 500) }, { status: 500 });
      }

      // Save to Supabase
      const supabase = getSupabase();
      const record = {
        data: parsed,
        framework_version: "1.0",
        updated_at: new Date().toISOString(),
        updated_by: "ai_auto",
      };

      const { data: saved, error: saveError } = await supabase
        .from("inflation_monitor")
        .insert(record)
        .select()
        .single();

      if (saveError) {
        return Response.json({ error: saveError.message }, { status: 500 });
      }

      return Response.json({ success: true, data: saved });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
