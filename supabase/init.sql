-- =============================================
-- 늑대무리원정단 - Supabase 데이터베이스 초기 설정
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- =============================================

-- 경기순환 체크리스트 스코어 테이블
CREATE TABLE IF NOT EXISTS business_cycle_scores (
  country TEXT PRIMARY KEY,  -- 'KR' or 'US'
  scores JSONB NOT NULL,     -- { "1": [0,1,2,...], "2": [0,1,2,...], ... }
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security 비활성화 (개인용이므로)
ALTER TABLE business_cycle_scores ENABLE ROW LEVEL SECURITY;

-- 모든 접근 허용 정책 (anon key로 접근 가능)
CREATE POLICY "Allow all access" ON business_cycle_scores
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 향후 모듈 확장용 범용 저장소 (선택사항)
CREATE TABLE IF NOT EXISTS module_data (
  id TEXT PRIMARY KEY,        -- 'credit-monitor:HDEC', 'sector-watch:건설' 등
  module TEXT NOT NULL,       -- 모듈 이름
  data JSONB NOT NULL,        -- 모듈별 자유 형식 데이터
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE module_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON module_data
  FOR ALL
  USING (true)
  WITH CHECK (true);
