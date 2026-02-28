# 🐺 늑대무리원정단 — 배포 가이드

## 전체 순서
1. GitHub에 코드 올리기
2. Supabase 데이터베이스 설정
3. Vercel에 배포
4. (선택) Anthropic API 키 설정

---

## Step 1: GitHub에 코드 올리기

1. **GitHub 접속** → 오른쪽 위 `+` → `New repository`
2. Repository name: `wolfpack` (또는 원하는 이름)
3. **Private** 선택 (개인용이니까)
4. `Create repository` 클릭
5. 아직 아무것도 업로드하지 마세요 — Vercel 연결 후 설명드릴게요

### 파일 업로드 방법 (가장 쉬운 방법)
1. 생성된 repository 페이지에서 `uploading an existing file` 클릭
2. 이 프로젝트의 **모든 파일과 폴더**를 드래그 앤 드롭
3. `Commit changes` 클릭

⚠️ **주의**: `.env.local` 파일은 올리지 마세요! (API 키가 들어있으므로)
`.env.local.example` 파일만 올리면 됩니다.

---

## Step 2: Supabase 데이터베이스 설정

1. **Supabase Dashboard** (supabase.com) 접속
2. 만들어둔 프로젝트 (`control-tower`) 클릭
3. 왼쪽 메뉴에서 **SQL Editor** 클릭
4. `supabase/init.sql` 파일의 내용을 복사해서 붙여넣기
5. **Run** 클릭 → "Success" 확인

### Supabase 키 확인
1. 왼쪽 메뉴 **Settings** → **API**
2. 다음 두 값을 메모해두세요:
   - `Project URL` → 예: `https://xxxxx.supabase.co`
   - `anon public` 키 → `eyJhbGciOiJIUzI1NiIs...` 같은 긴 문자열

---

## Step 3: Vercel에 배포

1. **Vercel Dashboard** (vercel.com) 접속
2. `Add New...` → `Project`
3. `Import Git Repository` → GitHub 연결 → `wolfpack` 선택
4. **Framework Preset**: Next.js (자동 감지됨)
5. **Environment Variables** 설정 (중요!):

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase에서 복사한 Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase에서 복사한 anon public 키 |
| `ANTHROPIC_API_KEY` | (선택) Anthropic API 키 — AI 업데이트용 |
| `CRON_SECRET` | 아무 랜덤 문자열 — 예: `wolfpack-secret-2026` |

6. **Deploy** 클릭
7. 2~3분 후 배포 완료! → `wolfpack-xxxxx.vercel.app` 주소 생성

---

## Step 4: (선택) Anthropic API 키 발급

AI 업데이트 기능을 사용하려면 Anthropic API 키가 필요합니다.

1. https://console.anthropic.com 접속
2. 가입/로그인
3. **API Keys** → `Create Key`
4. 복사해서 Vercel Environment Variables에 `ANTHROPIC_API_KEY`로 추가
5. Vercel Dashboard → 프로젝트 → Settings → Environment Variables에서 추가 후
6. **Deployments** → 최신 배포 옆 `...` → `Redeploy` 클릭

---

## 프로젝트 구조

```
wolfpack/
├── app/
│   ├── layout.js              # 전체 레이아웃
│   ├── page.js                # 🐺 컨트롤 타워 메인
│   ├── globals.css            # 스타일
│   ├── api/
│   │   └── ai-update/
│   │       └── route.js       # AI 업데이트 API
│   └── modules/
│       └── business-cycle/
│           ├── layout.js      # 모듈 레이아웃
│           └── page.js        # 경기순환 대시보드
├── lib/
│   ├── supabase.js            # Supabase 연결
│   └── cycle-constants.js     # 경기순환 데이터 정의
├── supabase/
│   └── init.sql               # DB 테이블 생성 SQL
├── package.json
├── next.config.js
├── tailwind.config.js
├── jsconfig.json
└── .env.local.example         # 환경변수 템플릿
```

---

## 향후 모듈 추가 방법

새 모듈을 추가하려면:
1. `app/modules/새모듈이름/page.js` 파일 생성
2. `app/page.js`의 MODULES 배열에 항목 추가
3. 필요하면 `supabase/init.sql`에 테이블 추가
4. GitHub에 push → Vercel이 자동 배포

---

## 문제 해결

- **화면이 안 뜸**: Vercel 로그 확인 (Dashboard → Deployments → 최신 → Functions)
- **데이터가 안 저장됨**: Supabase URL/Key가 정확한지 확인
- **AI 업데이트 안 됨**: ANTHROPIC_API_KEY가 설정되어 있는지 확인
- **변경사항 반영 안 됨**: GitHub에 push 후 Vercel이 자동 배포되는지 확인
