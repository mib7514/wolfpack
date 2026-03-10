import { NextResponse } from 'next/server';
import { QUESTIONS, CATEGORIES } from '@/lib/cycle-constants';

export async function POST(request) {
  try {
    const { country, monthLabel, category, questionNumbers, prevScores, monthIdx } = await request.json();
    const countryName = country === 'KR' ? '한국(Korea)' : '미국(US)';

    const questionsText = questionNumbers.map(qn => {
      const q = QUESTIONS.find(x => x[0] === qn);
      return `Q${qn} [${q[2]}] ${q[3]}: ${q[4]}`;
    }).join('\n');

    const prevMonthScores = questionNumbers.map(qn => {
      const q = QUESTIONS.find(x => x[0] === qn);
      const prevVal = monthIdx > 0 ? (prevScores[qn] || 0) : 0;
      return `Q${qn} [${q[2]}] ${q[3]}: 전월 ${prevVal}점`;
    }).join('\n');

    const prompt = `You are an expert macroeconomic analyst. Analyze the current ${countryName} business cycle for ${monthLabel}.

CATEGORY: ${category}
QUESTIONS (score 0-5, where 0=not applicable, 1=very weak signal, 5=very strong signal):

${questionsText}

PREVIOUS MONTH SCORES for reference:
${prevMonthScores}

INSTRUCTIONS:
1. Use web search to find the latest economic data for ${countryName} as of ${monthLabel}
2. Score each question 0-5 based on current data
3. Respond ONLY in this exact JSON format, no other text:
{"scores":{${questionNumbers.map(qn => `"${qn}":0`).join(",")}},"rationale":"Brief 2-3 sentence summary of key data points and reasoning for ${category}"}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const textBlocks = data.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '';

    let parsed = null;
    try {
      const jsonMatch = textBlocks.match(/\{[\s\S]*"scores"[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      try {
        const cleaned = textBlocks.replace(/```json|```/g, '').trim();
        const jsonMatch2 = cleaned.match(/\{[\s\S]*"scores"[\s\S]*\}/);
        if (jsonMatch2) parsed = JSON.parse(jsonMatch2[0]);
      } catch {}
    }

    if (parsed?.scores) {
      const sanitized = {};
      Object.entries(parsed.scores).forEach(([qn, score]) => {
        sanitized[parseInt(qn)] = Math.min(5, Math.max(0, parseInt(score) || 0));
      });
      return NextResponse.json({
        scores: sanitized,
        rationale: parsed.rationale || '분석 완료',
      });
    }

    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
