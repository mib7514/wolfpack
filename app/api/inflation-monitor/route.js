import { createClient } from "@supabase/supabase-js";

const supabaseUrl = `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID || "aclamququfgdpwavbjsi"}.supabase.co`;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

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

// GET: Fetch latest data + framework
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

// POST: PIN verify + get API key, or save AI result
export async function POST(request) {
  try {
    const adminPin = request.headers.get("x-admin-pin");
    if (!adminPin || adminPin !== process.env.ADMIN_PIN) {
      return Response.json({ error: "관리자 인증 실패" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    // Action 1: Verify PIN and return API key for client-side AI call
    if (action === "get_api_key") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return Response.json({ error: "ANTHROPIC_API_KEY가 설정되지 않았습니다" }, { status: 500 });
      }
      return Response.json({ success: true, apiKey });
    }

    // Action 2: Save AI analysis result to Supabase
    if (action === "save_result") {
      const { analysisData } = body;
      if (!analysisData) {
        return Response.json({ error: "분석 데이터가 없습니다" }, { status: 400 });
      }

      const supabase = getSupabase();
      const record = {
        data: analysisData,
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
