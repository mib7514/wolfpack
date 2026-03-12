import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const { narrativeName, existingNarratives } = await request.json();

    if (!narrativeName) {
      return NextResponse.json({ error: "내러티브 이름이 필요합니다" }, { status: 400 });
    }

    // Build context about existing narratives for connectivity analysis
    const existingContext = existingNarratives?.length > 0
      ? `\n\n현재 추적 중인 다른 내러티브들:\n${existingNarratives.map(n => `- ${n.name} (${n.stage} 단계, 자산: ${(n.assets || []).map(a => a.asset).join(', ')})`).join('\n')}`
      : '';

    const systemPrompt = `당신은 글로벌 매크로 전략가이자 금융시장 내러티브 분석 전문가입니다.
사용자가 금융시장 내러티브 이름을 주면, 해당 내러티브에 대해 분석하여 정확히 아래 JSON 형식으로만 응답하세요.
JSON 외 다른 텍스트는 절대 포함하지 마세요. 마크다운 백틱도 쓰지 마세요.

응답 JSON 형식:
{
  "description": "내러티브의 배경, 핵심 논리, 시장 전파 경로를 2~3문장으로 설명",
  "category": "경제정책|지정학|기술혁신|금융위기|인플레이션|통화정책|산업전환|기타 중 하나",
  "stage": "birth|strengthen|peak|weaken|extinct 중 현재 가장 적합한 단계",
  "stageReasoning": "왜 이 단계로 판단했는지 1문장 근거",
  "indicators": [
    {"name": "추적 지표명", "description": "이 지표를 왜 봐야 하는지", "currentSignal": "positive|neutral|negative"}
  ],
  "scoring": {
    "marketImpact": 1~10,
    "marketImpactReason": "시장 충격도 판단 근거",
    "mediaIntensity": 1~10,
    "mediaIntensityReason": "미디어 노출 강도 판단 근거",
    "dataSupport": 1~10,
    "dataSupportReason": "데이터 뒷받침 정도 근거",
    "duration": 1~10,
    "durationReason": "지속 기간 판단 근거"
  },
  "assets": [
    {"asset": "자산명(구체적일수록 좋음. SK하이닉스, 원유(WTI), 원/달러 등)", "impact": -2~2, "reason": "영향 근거"}
  ],
  "kelly": {
    "prob": 1~99,
    "odds": 0.5~10.0,
    "reasoning": "승률과 보상비율 판단 근거"
  },
  "connectivity": "다른 내러티브와의 연관성 분석 1문장"
}

중요 규칙:
- indicators는 이 내러티브에 특화된 핵심 지표 5개. 기계적 템플릿이 아니라 내러티브 맥락에 맞는 것으로.
- assets는 영향이 가장 강력한 5개만. 가능한 한 구체적(지수보다 섹터, 섹터보다 개별종목).
- impact: 2=강한긍정, 1=약한긍정, 0=중립, -1=약한부정, -2=강한부정
- stage 판단은 오늘 날짜 기준 시장 상황 반영.
- kelly의 prob는 이 내러티브 기반 투자가 성공할 확률(%), odds는 기대 보상/위험 비율.
- scoring은 현재 시점 기준으로 객관적으로.
- 모든 필드 빠짐없이 채울 것.`;

    const userMessage = `내러티브: "${narrativeName}"

오늘 날짜: ${new Date().toISOString().split('T')[0]}
${existingContext}

위 내러티브를 분석해주세요.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");

    // Parse JSON response
    const cleaned = text.replace(/```json|```/g, "").trim();
    const analysis = JSON.parse(cleaned);

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    console.error("Narrative AI error:", error);
    return NextResponse.json(
      { error: "AI 분석 중 오류가 발생했습니다: " + error.message },
      { status: 500 }
    );
  }
}
