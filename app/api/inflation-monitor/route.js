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

// ─── Framework Definition v2.0 ───
// 9개 카테고리: 기존 6 + 환율 승수 + 공급 단절 + 비에너지 식품 쇼크
// 종합지수 = Σ(Wi × Ci) × FX_multiplier
const FRAMEWORK = {
  version: "2.0",
  fx_multiplier_table: {
    thresholds: [1400, 1450, 1500, 1550],
    multipliers: [1.00, 1.05, 1.10, 1.15, 1.25],
    labels: ["< 1,400", "1,400~1,450", "1,450~1,500", "1,500~1,550", "> 1,550"],
  },
  categories: [
    {
      id: "energy_raw",
      name: "에너지/원료 충격",
      emoji: "🛢️",
      weight: 0.15,
      stage: "1차",
      description: "국제유가, 천연가스, 원자재 가격 및 중동 지정학 리스크",
      indicators: [
        { id: "crude_oil", name: "국제유가 (WTI/Brent)", description: "유가 수준 및 변동성, 호르무즈 해협 리스크 반영" },
        { id: "natural_gas", name: "천연가스/LNG", description: "유럽·아시아 LNG 가격, 재고 수준" },
        { id: "commodity_index", name: "원자재 종합지수", description: "CRB/블룸버그 원자재 지수 추이" },
        { id: "middle_east_risk", name: "중동 지정학 리스크", description: "호르무즈 해협, 이란 제재, 예멘 후티 리스크" },
      ],
    },
    {
      id: "fx_multiplier",
      name: "환율 승수",
      emoji: "💱",
      weight: 0.10,
      stage: "승수",
      description: "원/달러 환율 수준 및 수입물가 전이. 독립 점수 + 기존 카테고리 multiplicative 승수 이중 적용",
      indicators: [
        { id: "usdkrw_level", name: "원/달러 환율 수준", description: "현물 환율 (1,400/1,450/1,500/1,550 구간별 스코어링)" },
        { id: "import_price_mom", name: "수입물가지수 MoM", description: "한국은행 수입물가지수 월간 변동률 또는 관세청 수입단가지수 속보" },
        { id: "ndf_implied", name: "NDF 1M 내재 변동률", description: "역외 NDF가 시사하는 환율 방향성 선행 지표" },
      ],
    },
    {
      id: "logistics",
      name: "물류/보험 비용",
      emoji: "🚢",
      weight: 0.12,
      stage: "1.5차",
      description: "해상운임, 항공운임, 보험료, 국내 화물 운임, 공급망 병목",
      indicators: [
        { id: "container_freight", name: "컨테이너 운임 (SCFI/BDI)", description: "상하이 컨테이너 운임지수, 발틱 건화물 지수" },
        { id: "war_risk_premium", name: "전쟁위험 보험료", description: "해상 전쟁위험 할증료 수준" },
        { id: "supply_chain", name: "공급망 압력", description: "NY Fed 글로벌 공급망 압력 지수, 리드타임" },
        { id: "domestic_trucking", name: "국내 화물차 운임", description: "경유가 연동 트럭 운임 변동률 (화물연대 안전운임제 기준)" },
      ],
    },
    {
      id: "supply_disruption",
      name: "공급 단절",
      emoji: "🏭",
      weight: 0.12,
      stage: "2차 선행",
      description: "NCC 가동률, Force Majeure 선언, 나프타 재고 등 물리적 공급 중단 지표. 가격에 선행하는 물량 기반 지표",
      indicators: [
        { id: "ncc_utilization", name: "NCC 가동률", description: "여수/대산/울산 산단별 NCC 가동률 (90%+=안정, 80~90%=주의, 70~80%=경고, 60~70%=위험, <60%=위기)" },
        { id: "force_majeure", name: "Force Majeure 건수", description: "석유화학 업체 불가항력 선언 누적 및 주간 신규 건수" },
        { id: "naphtha_inventory", name: "나프타 재고 일수", description: "업계 추정 재고 일수 (정상 4주+, 현재 약 2주)" },
        { id: "shutdown_count", name: "셧다운/정기보수 전도", description: "가동 중단 공장 수, 정기보수 앞당김 건수, 중간재 납기지연 일수" },
      ],
    },
    {
      id: "intermediate",
      name: "중간재 스프레드",
      emoji: "🧪",
      weight: 0.13,
      stage: "2차",
      description: "석유화학, 철강, 비철금속 등 중간재 가격 전가 상황. 공급 단절 인덱스 60+ 시 '공급 제약 플래그' 자동 부착",
      indicators: [
        { id: "pe_pp_spread", name: "PE/PP 스프레드", description: "폴리에틸렌/폴리프로필렌 마진 방향" },
        { id: "ethylene_price", name: "에틸렌/나프타 가격", description: "에틸렌 현물가 및 나프타 스프레드 추이 (52주 최고가 대비)" },
        { id: "steel_price", name: "철강재 가격", description: "열연/냉연 코일 가격 추이" },
        { id: "ppi_trend", name: "PPI 추이", description: "한국/미국 생산자물가 MoM 추세" },
      ],
    },
    {
      id: "food_shock",
      name: "비에너지 식품 쇼크",
      emoji: "🥩",
      weight: 0.08,
      stage: "독립",
      description: "ASF/HPAI 등 질병 기반 공급 충격, 곡물 가격, 수입 농축산물. 에너지와 무관한 독립 공급 쇼크 추적",
      indicators: [
        { id: "livestock_yoy", name: "축산물 가격 YoY", description: "돼지(삼겹살), 닭고기, 계란 등 주요 축산물 전년비 변동" },
        { id: "grain_rice_yoy", name: "곡물/쌀 가격 YoY", description: "쌀, 밀, 옥수수 등 주요 곡물 가격 전년비" },
        { id: "import_food_price", name: "수입 농축산물 가격", description: "미국산 쇠고기, 수입 과일 등 환율 결합 수입식품 가격 변동" },
        { id: "disease_outbreak", name: "질병/살처분 현황", description: "ASF/HPAI 발생 건수, 살처분 마릿수, 사육 마릿수 전월비" },
      ],
    },
    {
      id: "core_services",
      name: "코어 서비스 물가",
      emoji: "🏠",
      weight: 0.12,
      stage: "3차",
      description: "주거비, 서비스물가, 근원 CPI 추세",
      indicators: [
        { id: "shelter_cpi", name: "주거비/임대료", description: "미국 Shelter CPI, 한국 전월세 지수" },
        { id: "services_cpi", name: "서비스물가 MoM", description: "코어 서비스(주거 제외) 월간 변화" },
        { id: "sticky_cpi", name: "Sticky CPI", description: "애틀랜타 연은 Sticky CPI 추이" },
      ],
    },
    {
      id: "expectations",
      name: "기대인플레/금리",
      emoji: "📊",
      weight: 0.10,
      stage: "심리",
      description: "BEI, 기간프리미엄, 서베이 기반 인플레이션 기대",
      indicators: [
        { id: "bei_5y5y", name: "5Y5Y BEI", description: "5년 후 5년 브레이크이븐 인플레이션" },
        { id: "term_premium", name: "기간프리미엄", description: "ACM 기간프리미엄 모델 추이" },
        { id: "survey_expectations", name: "서베이 기대인플레", description: "미시간대/한은 기대인플레이션" },
      ],
    },
    {
      id: "wage_second",
      name: "임금/2차 파급",
      emoji: "💼",
      weight: 0.08,
      stage: "고착",
      description: "임금 상승, 기업 가격전가, 2차 효과 고착화",
      indicators: [
        { id: "wage_growth", name: "임금 상승률", description: "미국 평균시급, 한국 상용근로자 임금 추이" },
        { id: "corporate_pricing", name: "기업 가격전가", description: "ISM/PMI 가격 컴포넌트, 기업 실적 가이던스" },
        { id: "unit_labor_cost", name: "단위노동비용", description: "단위노동비용 추이 (생산성 대비 임금)" },
      ],
    },
  ],
};

// ─── GET: 최신 데이터 + 프레임워크 + 히스토리 목록 ───
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // 히스토리 전체 조회 (시계열용)
    if (action === "history") {
      const res = await supaFetch(
        "inflation_monitor?select=id,snapshot_date,data,updated_at&order=snapshot_date.desc&limit=100"
      );
      if (!res.ok) {
        return NextResponse.json({ error: "히스토리 조회 실패" }, { status: 500 });
      }
      const rows = await res.json();
      return NextResponse.json({ history: rows });
    }

    // 기본: 최신 1건 + 프레임워크
    const res = await supaFetch(
      "inflation_monitor?order=snapshot_date.desc,updated_at.desc&limit=1"
    );
    if (!res.ok) {
      return NextResponse.json({ framework: FRAMEWORK, data: null });
    }
    const rows = await res.json();
    return NextResponse.json({
      framework: FRAMEWORK,
      data: rows.length > 0 ? rows[0] : null,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST: 관리자 액션 ───
export async function POST(request) {
  try {
    const pin = request.headers.get("x-admin-pin");
    const body = await request.json();
    const { action } = body;

    // API 키 반환 (PIN 검증)
    if (action === "get_api_key") {
      if (pin !== process.env.ADMIN_PIN) {
        return NextResponse.json({ error: "관리자 인증 실패" }, { status: 401 });
      }
      return NextResponse.json({ apiKey: process.env.ANTHROPIC_API_KEY });
    }

    // 분석 결과 저장 (날짜별)
    if (action === "save_result") {
      if (pin !== process.env.ADMIN_PIN) {
        return NextResponse.json({ error: "관리자 인증 실패" }, { status: 401 });
      }

      const { analysisData } = body;
      const now = new Date();
      const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      // 같은 날짜의 기존 데이터가 있는지 확인
      const checkRes = await supaFetch(
        `inflation_monitor?snapshot_date=eq.${kstDate}&select=id`
      );
      const existing = await checkRes.json();

      let saveRes;
      if (existing && existing.length > 0) {
        saveRes = await supaFetch(
          `inflation_monitor?snapshot_date=eq.${kstDate}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
              data: analysisData,
              updated_at: now.toISOString(),
            }),
          }
        );
      } else {
        saveRes = await supaFetch("inflation_monitor", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            data: analysisData,
            snapshot_date: kstDate,
            updated_at: now.toISOString(),
          }),
        });
      }

      if (!saveRes.ok) {
        const errText = await saveRes.text();
        return NextResponse.json(
          { error: "DB 저장 실패: " + errText },
          { status: 500 }
        );
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
