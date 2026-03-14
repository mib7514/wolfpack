"use client";
import { useState, useCallback, useMemo, useEffect } from "react";

const DEFICIT_TYPES = {
  "1":  { label: "1. 매출 미발생", color: "#FF3B3B", bg: "#FF3B3B15", verdict: "투자불가", verdictColor: "#FF3B3B", icon: "🚫", desc: "매출액 자체가 없는 Pre-revenue 단계. 사업 검증 불가." },
  "2a": { label: "2a. GP적자 (진성매출)", color: "#FF5252", bg: "#FF525215", verdict: "투자불가", verdictColor: "#FF3B3B", icon: "🚫", desc: "진성매출(메인사업)이 발생 중인데도 원가 > 매출. 팔수록 손해나는 구조." },
  "2b": { label: "2b. GP적자 (메인 미출시)", color: "#FF8C00", bg: "#FF8C0015", verdict: "투자가능", verdictColor: "#FF8C00", icon: "⚠️", desc: "매출은 있으나 메인 프로젝트가 아직 미출시. 출시 시 구조 변화 기대." },
  "3a": { label: "3a. GP흑자·OP적자 (사이클릭)", color: "#FFB800", bg: "#FFB80015", verdict: "분석 여지", verdictColor: "#FFB800", icon: "🔍", desc: "업황·수주 사이클 하강으로 일시적 OP적자. 사이클 회복 시 자동 흑전. 가장 높은 비대칭매력." },
  "3b": { label: "3b. GP흑자·OP적자 (구조적)", color: "#E6A800", bg: "#E6A80015", verdict: "분석 여지", verdictColor: "#E6A800", icon: "🔍", desc: "의도적 R&D·마케팅 투자가 GP를 초과. 자체적 비용 통제 또는 매출 스케일업 필요." },
  "4a": { label: "4a. OP흑자·계속사업적자 (구조적)", color: "#7B8794", bg: "#7B879415", verdict: "투자불가", verdictColor: "#7B8794", icon: "🚫", desc: "이자비용·지분법손실 등 반복적 구조. 재무구조 자체가 문제." },
  "4b": { label: "4b. OP흑자·계속사업적자 (일회성)", color: "#94A3B8", bg: "#94A3B815", verdict: "관찰 대상", verdictColor: "#94A3B8", icon: "👁️", desc: "환차손·소송비용 등 비반복 일회성. 제거 시 즉시 흑전. 다만 3년 연속이면 4a로 재분류." },
  "5":  { label: "5. 계속사업이익 흑자·NI적자", color: "#A0AEC0", bg: "#A0AEC015", verdict: "거의 없음", verdictColor: "#A0AEC0", icon: "⚪", desc: "중단사업손실 등 극히 예외적 경우." },
  "E":  { label: "E. FCF적자 (NI흑자)", color: "#6B8AFF", bg: "#6B8AFF15", verdict: "별도 관찰", verdictColor: "#6B8AFF", icon: "📐", desc: "손익 전 구간 흑자이나 대규모 Capex로 현금 유출. 투자 사이클 완료 시 FCF 폭발적 개선 기대." },
  "흑자": { label: "흑자", color: "#00CC66", bg: "#00CC6615", verdict: "투자가능", verdictColor: "#00CC66", icon: "✅", desc: "전 구간 흑자. FCF도 양호." },
};

const INVESTABLE_TYPES = new Set(["2b", "3a", "3b", "4b", "E", "흑자"]);
const ASYMMETRIC_TYPES = new Set(["2b", "3a", "3b", "4b"]);

const SEED_COMPANIES = [
  { rank: 1,  name: "에코프로",       cap: 230819, per: -1148.65, roe: -12.57, type: "3a",  detail: "양극재 영업손실 3145억. GP는 유지. 사이클릭 적자" },
  { rank: 2,  name: "알테오젠",       cap: 199577, per: 158.86,   roe: 29.52,  type: "흑자", detail: "ADC 플랫폼 라이선싱 흑자" },
  { rank: 3,  name: "에코프로비엠",   cap: 198097, per: 6328.12,  roe: -6.26,  type: "3a",  detail: "영업손실 402억이나 EBITDA 755억 흑자" },
  { rank: 4,  name: "삼천당제약",     cap: 179215, per: -1572.02, roe: -4.49,  type: "2b", detail: "GLP-1 R&D 투자 확대. 메인 파이프라인 미출시" },
  { rank: 5,  name: "레인보우로보틱스", cap: 161407, per: 8320,    roe: 1.62,   type: "흑자", detail: "극소 흑자. 로봇 초기 단계" },
  { rank: 6,  name: "에이비엘바이오", cap: 105232, per: -360.42,  roe: -46.01, type: "2b", detail: "ADC 임상 단계. 라이선싱 일부 매출. 메인 미출시" },
  { rank: 7,  name: "리노공업",       cap: 96789,  per: 64.24,    roe: 19.21,  type: "흑자", detail: "반도체 검사소켓. 안정 흑자" },
  { rank: 8,  name: "코오롱티슈진",   cap: 94080,  per: -104.92,  roe: -25.91, type: "1",  detail: "유전자치료제 임상. 매출 미발생" },
  { rank: 9,  name: "리가켐바이오",   cap: 72928,  per: -290.38,  roe: 2.04,   type: "2b", detail: "ADC 플랫폼. 라이선싱 일부 수익. 메인 미출시" },
  { rank: 10, name: "케어젠",         cap: 69561,  per: 244.34,   roe: 14.35,  type: "흑자", detail: "바이오 펩타이드. 흑자 고PER" },
  { rank: 11, name: "원익IPS",        cap: 67638,  per: 85.64,    roe: 2.37,   type: "흑자", detail: "반도체 장비. 사이클 회복 대기" },
  { rank: 12, name: "HLB",            cap: 67624,  per: -30.33,   roe: -16.33, type: "2b", detail: "항암제 FDA 승인 대기. 메인 파이프라인 미출시" },
  { rank: 13, name: "펩트론",         cap: 61325,  per: -424.88,  roe: -23.46, type: "1",  detail: "서방형 주사제. 매출 극미 Pre-revenue" },
  { rank: 14, name: "보로노이",       cap: 60607,  per: -128.11,  roe: -96.66, type: "1",  detail: "매출 극소 Pre-revenue 신약개발" },
  { rank: 15, name: "이오테크닉스",   cap: 55808,  per: 98.67,    roe: 7.43,   type: "흑자", detail: "레이저 장비. 흑자 유지" },
  { rank: 16, name: "ISC",            cap: 44832,  per: 97.06,    roe: 10.98,  type: "흑자", detail: "반도체 테스트 소켓. AI 수혜" },
  { rank: 17, name: "에임드바이오",   cap: 42230,  per: -894.52,  roe: -65.72, type: "1",  detail: "바이오 신약. 매출 미발생" },
  { rank: 18, name: "올릭스",         cap: 41793,  per: -91.63,   roe: -120.11,type: "1",  detail: "RNA 치료제. 매출 미발생" },
  { rank: 19, name: "HPSP",           cap: 40194,  per: 48.14,    roe: 31.09,  type: "흑자", detail: "고압수소어닐링. 독점적 지위" },
  { rank: 20, name: "솔브레인",       cap: 38971,  per: 57.87,    roe: 12.47,  type: "흑자", detail: "반도체 소재. 기술 진입장벽" },
  { rank: 21, name: "메지온",         cap: 38007,  per: -171.6,   roe: -36.23, type: "2b", detail: "유데나필 FDA 승인 대기. 메인 미출시" },
  { rank: 22, name: "펄어비스",       cap: 37778,  per: 71.27,    roe: 7.88,   type: "흑자", detail: "게임(검은사막). 신작 효과 흑자" },
  { rank: 23, name: "로보티즈",       cap: 36705,  per: 920.96,   roe: -3.31,  type: "3b",  detail: "로봇 액추에이터. GP흑자. R&D 투자 영업적자" },
  { rank: 24, name: "디앤디파마텍",   cap: 36526,  per: -103.2,   roe: -49.03, type: "1",  detail: "비만/NASH 신약. 매출 미발생" },
  { rank: 25, name: "클래시스",       cap: 36225,  per: 30.69,    roe: 26.54,  type: "흑자", detail: "미용기기 볼뉴머. 고수익 안정" },
  { rank: 26, name: "파두",           cap: 35507,  per: -57.49,   roe: -64.47, type: "2a", detail: "AI SSD 컨트롤러. 양산 시작했으나 GP적자" },
  { rank: 27, name: "현대무벡스",     cap: 35418,  per: 140.09,   roe: 16.17,  type: "흑자", detail: "물류자동화/방산. 흑자" },
  { rank: 28, name: "파마리서치",     cap: 34598,  per: 25.6,     roe: 18.93,  type: "흑자", detail: "리쥬란. 고수익 안정" },
  { rank: 29, name: "유진테크",       cap: 33916,  per: 55.29,    roe: 16.85,  type: "흑자", detail: "반도체 증착장비. 국산화 수혜" },
  { rank: 30, name: "에스티팜",       cap: 33243,  per: 87.53,    roe: 7.82,   type: "흑자", detail: "올리고 CDMO. 비만치료제 수혜" },
  { rank: 31, name: "휴젤",           cap: 32175,  per: 22.96,    roe: 17.51,  type: "흑자", detail: "보톡스/필러. 해외 확대 중" },
  { rank: 32, name: "주성엔지니어링", cap: 31717,  per: 50.79,    roe: 19.76,  type: "흑자", detail: "반도체/디스플레이 장비. 흑자" },
  { rank: 33, name: "비에이치아이",   cap: 29335,  per: 48.42,    roe: 20.64,  type: "흑자", detail: "발전설비. 방산/원전 수혜" },
  { rank: 34, name: "에스피지",       cap: 29141,  per: 221.96,   roe: 5.54,   type: "흑자", detail: "모터/로봇부품. 로봇 프리미엄" },
  { rank: 35, name: "티씨케이",       cap: 29066,  per: 42.57,    roe: 14.78,  type: "흑자", detail: "SiC 링. 독점 기술" },
  { rank: 36, name: "우리기술",       cap: 28735,  per: 207.59,   roe: -3.33,  type: "4a",  detail: "방산/에너지. OP흑자이나 계속사업이익 적자" },
  { rank: 37, name: "동진쎄미켐",     cap: 28278,  per: 26.69,    roe: 17.17,  type: "흑자", detail: "포토레지스트. 안정 흑자" },
  { rank: 38, name: "셀트리온제약",   cap: 28220,  per: 79.75,    roe: 5.68,   type: "흑자", detail: "바이오시밀러 유통" },
  { rank: 39, name: "서진시스템",     cap: 27199,  per: -22,      roe: 12.32,  type: "4b",  detail: "OP흑자이나 환차손으로 계속사업이익 적자" },
  { rank: 40, name: "성호전자",       cap: 26667,  per: -596.83,  roe: 6.54,   type: "4b",  detail: "본업 흑자. 일회성 비용으로 계속사업이익 적자" },
  { rank: 41, name: "테크윙",         cap: 26345,  per: -219.44,  roe: -10.25, type: "3a",  detail: "테스트 핸들러. 반도체 하강기 GP흑자 OP적자" },
  { rank: 42, name: "피에스케이홀딩스",cap: 25293,  per: 22.23,    roe: 24.8,   type: "흑자", detail: "반도체 세정장비 지주. 안정 흑자" },
  { rank: 43, name: "오름테라퓨틱",   cap: 24906,  per: -63.99,   roe: -17.5,  type: "1",  detail: "신약 바이오. 매출 미발생" },
  { rank: 44, name: "원익홀딩스",     cap: 24871,  per: -197.55,  roe: -7.41,  type: "4a",  detail: "지주사. OP흑자이나 지분법손실 계속사업이익 적자" },
  { rank: 45, name: "실리콘투",       cap: 24499,  per: 15.42,    roe: 60.9,   type: "흑자", detail: "K-뷰티유통. ROE 61%" },
  { rank: 46, name: "하나마이크론",   cap: 24014,  per: 110.55,   roe: -6.99,  type: "4a",  detail: "패키징. OP흑자이나 이자비용 계속사업이익 적자" },
  { rank: 47, name: "에스엠",         cap: 23971,  per: 7.79,     roe: 2.64,   type: "흑자", detail: "K-POP 엔터. 흑자 저수익성" },
  { rank: 48, name: "태성",           cap: 23484,  per: -1147.76, roe: 16.61,  type: "4b",  detail: "3D프린터/SW. OP흑자이나 영업외비용 계속사업이익 적자" },
  { rank: 49, name: "JYP Ent.",       cap: 23167,  per: 14.59,    roe: 22.41,  type: "흑자", detail: "K-POP. 안정 흑자" },
  { rank: 50, name: "알지노믹스",     cap: 22879,  per: -16.46,   roe: 19.81,  type: "3b",  detail: "핵산치료제. 라이선싱 매출 < R&D 비용. GP흑자 OP적자" },
  { rank: 51, name: "와이지엔터",     cap: 22500,  per: 18.5,  roe: 15.2,   type: "흑자", detail: "K-POP 엔터. 안정 흑자" },
  { rank: 52, name: "엔켐",           cap: 22100,  per: -85.3, roe: -18.4,  type: "3a",  detail: "전해액. GP흑자이나 R&D/설비투자 OP적자" },
  { rank: 53, name: "카카오게임즈",   cap: 21800,  per: -45.2, roe: -8.7,   type: "3b",  detail: "게임 퍼블리싱. GP흑자 신작부진 OP적자" },
  { rank: 54, name: "포스코DX",       cap: 21500,  per: 35.8,  roe: 22.3,   type: "흑자", detail: "산업 DX/스마트팩토리. 안정 흑자" },
  { rank: 55, name: "네오위즈",       cap: 21200,  per: -32.1, roe: -5.4,   type: "3b",  detail: "게임. GP흑자 후속작 공백 OP적자" },
  { rank: 56, name: "나노신소재",     cap: 20800,  per: -120.5,roe: -15.8,  type: "3a",  detail: "2차전지 소재. GP흑자이나 투자비용 OP적자" },
  { rank: 57, name: "피에스케이",     cap: 20500,  per: 28.4,  roe: 18.6,   type: "흑자", detail: "반도체 세정장비. 안정 흑자" },
  { rank: 58, name: "제이시스메디칼", cap: 20200,  per: 32.1,  roe: 21.4,   type: "흑자", detail: "미용의료기기. 고수익 흑자" },
  { rank: 59, name: "앱클론",         cap: 19900,  per: -78.6, roe: -42.3,  type: "1",  detail: "항체 바이오. 매출 미발생" },
  { rank: 60, name: "큐렉소",         cap: 19600,  per: -156.2,roe: -28.7,  type: "1",  detail: "수술로봇. 매출 미발생" },
  { rank: 61, name: "코미팜",         cap: 19300,  per: 42.8,  roe: 12.5,   type: "흑자", detail: "동물약품. 안정 흑자" },
  { rank: 62, name: "켐트로닉스",     cap: 19000,  per: 38.5,  roe: 14.2,   type: "흑자", detail: "전자부품/방산. 흑자" },
  { rank: 63, name: "심텍",           cap: 18700,  per: -45.8, roe: -8.2,   type: "3a",  detail: "PCB 기판. GP흑자 반도체하강기 OP적자" },
  { rank: 64, name: "인텔리안테크",   cap: 18400,  per: -28.9, roe: -12.5,  type: "3a",  detail: "위성통신 안테나. GP흑자 수주공백 OP적자" },
  { rank: 65, name: "다원시스",       cap: 18100,  per: 85.3,  roe: 8.4,    type: "흑자", detail: "전력변환장치. 방산/원전 수혜" },
  { rank: 66, name: "압타바이오",     cap: 17800,  per: -52.4, roe: -85.2,  type: "1",  detail: "앱타머 신약. 매출 미발생" },
  { rank: 67, name: "고영",           cap: 17500,  per: -65.3, roe: -4.8,   type: "3a",  detail: "3D 검사장비. GP흑자 일시적 OP적자" },
  { rank: 68, name: "네오이뮨텍",     cap: 17200,  per: -42.1, roe: -35.6,  type: "1",  detail: "면역항암제. 매출 미발생" },
  { rank: 69, name: "윈스",           cap: 16900,  per: 22.5,  roe: 16.8,   type: "흑자", detail: "네트워크 보안. 안정 흑자" },
  { rank: 70, name: "차바이오텍",     cap: 16600,  per: -38.7, roe: -7.5,   type: "4a",  detail: "바이오/병원. OP흑자 이자비용 계속사업이익 적자" },
  { rank: 71, name: "에이피알",       cap: 16300,  per: 18.2,  roe: 35.4,   type: "흑자", detail: "메디큐브. 고성장 뷰티테크" },
  { rank: 72, name: "덕산네오룩스",   cap: 16000,  per: 65.4,  roe: 8.9,    type: "흑자", detail: "OLED 소재. 흑자" },
  { rank: 73, name: "비올",           cap: 15700,  per: 24.8,  roe: 28.5,   type: "흑자", detail: "미용의료기기. 고수익" },
  { rank: 74, name: "CJ ENM",         cap: 15400,  per: -18.5, roe: -4.2,   type: "4b",  detail: "미디어/커머스. OP흑자 일회성 계속사업이익 적자" },
  { rank: 75, name: "선익시스템",     cap: 15100,  per: 180.2, roe: 3.5,    type: "흑자", detail: "OLED 증착장비. 극소 흑자" },
  { rank: 76, name: "하이브",         cap: 14800,  per: 45.6,  roe: 8.2,    type: "흑자", detail: "K-POP. BTS/세븐틴" },
  { rank: 77, name: "브이티",         cap: 14500,  per: 16.8,  roe: 32.1,   type: "흑자", detail: "K-뷰티. 리들샷 고성장" },
  { rank: 78, name: "엘앤에프",       cap: 14200,  per: -25.8, roe: -22.4,  type: "3a",  detail: "양극재. GP흑자 2차전지사이클 OP적자" },
  { rank: 79, name: "티로보틱스",     cap: 13900,  per: -210.5,roe: -55.3,  type: "1",  detail: "자율주행로봇. 매출 극미" },
  { rank: 80, name: "네오플럭스",     cap: 13600,  per: 28.4,  roe: 15.7,   type: "흑자", detail: "반도체 테스트. 안정 흑자" },
  { rank: 81, name: "와이엠텍",       cap: 13300,  per: 32.5,  roe: 12.8,   type: "흑자", detail: "2차전지 부품. 흑자" },
  { rank: 82, name: "오스코텍",       cap: 13000,  per: -85.6, roe: -28.4,  type: "1",  detail: "신약개발. 매출 미발생" },
  { rank: 83, name: "씨젠",           cap: 12700,  per: -22.4, roe: -8.5,   type: "3a",  detail: "분자진단. GP흑자 코로나후 매출감소 OP적자" },
  { rank: 84, name: "에이치엘비",     cap: 12400,  per: -42.8, roe: -15.2,  type: "2b", detail: "항암 바이오. 일부 매출. 메인 파이프라인 미출시" },
  { rank: 85, name: "해성디에스",     cap: 12100,  per: 35.2,  roe: 11.5,   type: "흑자", detail: "반도체 리드프레임. 안정 흑자" },
  { rank: 86, name: "가온칩스",       cap: 11800,  per: 42.6,  roe: 18.3,   type: "흑자", detail: "반도체 팹리스. AI 수혜" },
  { rank: 87, name: "코웰패션",       cap: 11500,  per: 12.8,  roe: 22.5,   type: "흑자", detail: "패션 라이선싱. 고ROE" },
  { rank: 88, name: "필에너지",       cap: 11200,  per: -68.4, roe: -35.2,  type: "3a",  detail: "2차전지 장비. GP흑자 수주공백 OP적자" },
  { rank: 89, name: "한국비엔씨",     cap: 10900,  per: -125.3,roe: -42.8,  type: "1",  detail: "바이오 CDMO. 매출 극미" },
  { rank: 90, name: "라이콤",         cap: 10600,  per: 55.2,  roe: 9.4,    type: "흑자", detail: "5G 통신장비. 흑자" },
  { rank: 91, name: "에스앤에스텍",   cap: 10300,  per: 38.7,  roe: 14.6,   type: "흑자", detail: "EUV 블랭크마스크. 독점 기술" },
  { rank: 92, name: "티에스이",       cap: 10000,  per: -35.2, roe: -8.9,   type: "3a",  detail: "반도체 테스트소켓. GP흑자 사이클 OP적자" },
  { rank: 93, name: "유니셈",         cap: 9800,   per: 25.4,  roe: 16.2,   type: "흑자", detail: "반도체 스크러버. 안정 흑자" },
  { rank: 94, name: "지놈앤컴퍼니",   cap: 9600,   per: -18.5, roe: -52.4,  type: "1",  detail: "마이크로바이옴. 매출 미발생" },
  { rank: 95, name: "아이퀘스트",     cap: 9400,   per: 22.8,  roe: 18.5,   type: "흑자", detail: "ERP/기업솔루션. 안정 흑자" },
  { rank: 96, name: "켐트로스",       cap: 9200,   per: -95.4, roe: -22.1,  type: "2a", detail: "반도체 소재. 양산 중이나 GP적자" },
  { rank: 97, name: "SFA반도체",      cap: 9000,   per: 28.6,  roe: 12.4,   type: "흑자", detail: "반도체 패키징. 안정 흑자" },
  { rank: 98, name: "이녹스첨단소재", cap: 8800,   per: 18.5,  roe: 15.8,   type: "흑자", detail: "FPCB 소재. 안정 흑자" },
  { rank: 99, name: "더블유게임즈",   cap: 8600,   per: 8.5,   roe: 24.2,   type: "흑자", detail: "소셜카지노. 고수익 캐시카우" },
  { rank: 100,name: "레뷰코퍼레이션", cap: 8400,   per: -42.5, roe: -18.6,  type: "3b",  detail: "인플루언서 마케팅. GP흑자 마케팅비용 OP적자" },
  { rank: 101,name: "지니틱스",       cap: 8200,  per: -55.2, roe: -25.4, type: "3a",  detail: "터치IC. GP흑자 사이클하강 OP적자" },
  { rank: 102,name: "위메이드",       cap: 8000,  per: -15.8, roe: -12.5, type: "3b",  detail: "게임/블록체인. GP흑자 미르IP OP적자" },
  { rank: 103,name: "에이엔피",       cap: 7800,  per: 35.2,  roe: 12.8,  type: "흑자", detail: "방산/항공부품. 안정 흑자" },
  { rank: 104,name: "에스엘바이오닉스",cap: 7600,  per: -82.4, roe: -32.5, type: "1",  detail: "의료로봇. 매출 미발생" },
  { rank: 105,name: "덕산하이메탈",   cap: 7400,  per: 42.8,  roe: 8.5,   type: "흑자", detail: "반도체 솔더볼. 안정 흑자" },
  { rank: 106,name: "HLB생명과학",    cap: 7200,  per: -28.5, roe: -18.4, type: "1",  detail: "바이오. 매출 미발생" },
  { rank: 107,name: "원익QnC",        cap: 7000,  per: 22.4,  roe: 14.2,  type: "흑자", detail: "쿼츠/세라믹. 반도체 소재" },
  { rank: 108,name: "코아스템켐온",   cap: 6800,  per: -120.5,roe: -45.2, type: "1",  detail: "줄기세포 치료제. 매출 미발생" },
  { rank: 109,name: "젬백스",         cap: 6600,  per: -65.4, roe: -22.8, type: "1",  detail: "면역치료 펩타이드. 매출 미발생" },
  { rank: 110,name: "엠씨넥스",       cap: 6400,  per: 18.5,  roe: 15.4,  type: "흑자", detail: "카메라모듈. 차량용 성장" },
  { rank: 111,name: "아나패스",       cap: 6200,  per: 28.6,  roe: 22.1,  type: "흑자", detail: "디스플레이 IC. 안정 흑자" },
  { rank: 112,name: "에스에프에이",   cap: 6000,  per: 15.8,  roe: 18.5,  type: "흑자", detail: "디스플레이 장비. 안정 흑자" },
  { rank: 113,name: "톱텍",           cap: 5850,  per: 32.4,  roe: 10.8,  type: "흑자", detail: "2차전지 장비. 흑자" },
  { rank: 114,name: "제넥신",         cap: 5700,  per: -35.8, roe: -28.4, type: "1",  detail: "DNA 백신/항암. 매출 미발생" },
  { rank: 115,name: "코엔텍",         cap: 5550,  per: 12.5,  roe: 18.2,  type: "흑자", detail: "폐기물처리. 안정 캐시카우" },
  { rank: 116,name: "나무기술",       cap: 5400,  per: -48.5, roe: -15.2, type: "3b",  detail: "클라우드 보안. GP흑자 R&D투자 OP적자" },
  { rank: 117,name: "FSN",            cap: 5250,  per: 22.8,  roe: 12.5,  type: "흑자", detail: "디지털마케팅. 안정 흑자" },
  { rank: 118,name: "오로스테크놀로지",cap: 5100,  per: 65.4,  roe: 8.2,   type: "흑자", detail: "반도체 열관리. 흑자" },
  { rank: 119,name: "브레인즈컴퍼니", cap: 4950,  per: 18.2,  roe: 16.8,  type: "흑자", detail: "IT서비스/모니터링. 안정 흑자" },
  { rank: 120,name: "에스바이오메딕스",cap: 4800,  per: -92.5, roe: -55.4, type: "1",  detail: "줄기세포. 매출 미발생" },
  { rank: 121,name: "한양이엔지",     cap: 4650,  per: 15.4,  roe: 22.5,  type: "흑자", detail: "반도체 클린룸. 안정 흑자" },
  { rank: 122,name: "에치에프알",     cap: 4500,  per: -42.8, roe: -18.5, type: "3a",  detail: "5G 필터. GP흑자 수요부진 OP적자" },
  { rank: 123,name: "엔피",           cap: 4380,  per: 28.5,  roe: 14.2,  type: "흑자", detail: "2차전지 장비. 흑자" },
  { rank: 124,name: "메디톡스",       cap: 4260,  per: -22.5, roe: -8.4,  type: "4b",  detail: "보톡스. OP흑자 소송비용 계속사업이익 적자" },
  { rank: 125,name: "에이텍",         cap: 4140,  per: 12.8,  roe: 18.5,  type: "흑자", detail: "금융단말기/키오스크. 안정 흑자" },
  { rank: 126,name: "아이씨에이치",   cap: 4020,  per: -75.2, roe: -32.4, type: "1",  detail: "바이오 신약. 매출 미발생" },
  { rank: 127,name: "씨아이에스",     cap: 3900,  per: -28.5, roe: -12.8, type: "3a",  detail: "2차전지 장비. GP흑자 수주감소 OP적자" },
  { rank: 128,name: "나인테크",       cap: 3780,  per: 45.2,  roe: 8.5,   type: "흑자", detail: "디스플레이 장비. 흑자" },
  { rank: 129,name: "인바디",         cap: 3660,  per: 18.5,  roe: 14.8,  type: "흑자", detail: "체성분 분석기. 글로벌 수출" },
  { rank: 130,name: "루트로닉",       cap: 3540,  per: 25.4,  roe: 16.2,  type: "흑자", detail: "미용레이저. 안정 흑자" },
  { rank: 131,name: "제이엘케이",     cap: 3420,  per: -150.2,roe: -65.4, type: "1",  detail: "AI 의료영상. 매출 극미" },
  { rank: 132,name: "셀리드",         cap: 3300,  per: -85.4, roe: -48.2, type: "1",  detail: "면역항암 백신. 매출 미발생" },
  { rank: 133,name: "한글과컴퓨터",   cap: 3200,  per: 15.2,  roe: 12.4,  type: "흑자", detail: "오피스SW. 안정 흑자" },
  { rank: 134,name: "비츠로셀",       cap: 3100,  per: 22.8,  roe: 18.5,  type: "흑자", detail: "리튬1차전지. 방산 수혜" },
  { rank: 135,name: "파워로직스",     cap: 3000,  per: -35.4, roe: -12.5, type: "3b",  detail: "전력반도체. GP흑자 초기투자 OP적자" },
  { rank: 136,name: "큐리엔트",       cap: 2900,  per: -62.5, roe: -42.8, type: "1",  detail: "안과 신약. 매출 미발생" },
  { rank: 137,name: "에프에스티",     cap: 2800,  per: 28.4,  roe: 15.2,  type: "흑자", detail: "반도체 검사장비. 안정 흑자" },
  { rank: 138,name: "맥스트",         cap: 2700,  per: -45.8, roe: -28.5, type: "1",  detail: "AR/메타버스. 매출 극미" },
  { rank: 139,name: "테스",           cap: 2600,  per: 35.2,  roe: 12.8,  type: "흑자", detail: "반도체 CVD장비. 흑자" },
  { rank: 140,name: "한컴위드",       cap: 2520,  per: 18.5,  roe: 14.2,  type: "흑자", detail: "보안솔루션. 안정 흑자" },
  { rank: 141,name: "네오팜",         cap: 2440,  per: 15.8,  roe: 22.4,  type: "흑자", detail: "더마코스메틱. 안정 흑자" },
  { rank: 142,name: "디바이스이엔지", cap: 2360,  per: 42.5,  roe: 8.8,   type: "흑자", detail: "반도체 세정장비. 흑자" },
  { rank: 143,name: "아이엠비디엑스", cap: 2280,  per: -120.4,roe: -55.2, type: "1",  detail: "액체생검. 매출 미발생" },
  { rank: 144,name: "이엠텍",         cap: 2200,  per: 12.4,  roe: 18.8,  type: "흑자", detail: "전자부품. 안정 흑자" },
  { rank: 145,name: "하이록코리아",   cap: 2120,  per: 14.2,  roe: 12.5,  type: "흑자", detail: "밸브/피팅. 안정 수출" },
  { rank: 146,name: "엔젠바이오",     cap: 2040,  per: -38.5, roe: -22.4, type: "2b", detail: "NGS 진단. 일부 매출. 메인 플랫폼 미출시" },
  { rank: 147,name: "라온테크",       cap: 1960,  per: -55.2, roe: -18.5, type: "3b",  detail: "보안 솔루션. GP흑자 R&D OP적자" },
  { rank: 148,name: "제이앤티씨",     cap: 1880,  per: 8.5,   roe: 28.4,  type: "흑자", detail: "광학필름. 고ROE 흑자" },
  { rank: 149,name: "바이오노트",     cap: 1800,  per: 22.5,  roe: 12.8,  type: "흑자", detail: "진단키트. 안정 흑자" },
  { rank: 150,name: "알체라",         cap: 1720,  per: -68.4, roe: -35.2, type: "1",  detail: "AI 영상인식. 매출 극미" },
];

/* Top10 비대칭매력: 펀더멘탈 기본점수(80) + 사이클검증 조정(-8~0) + 모멘텀(20) = 최대100
   
   사이클 검증도 (3a 전용):
   산업 사이클이 오래 검증된 업종(반도체장비 30년+)은 조정 0,
   역사가 짧은 업종(2차전지 5년 미만)은 -6~-8 할인.
   "사이클 회복 시 자동 흑전"이라는 3a의 핵심 전제가 얼마나 신뢰할 수 있는지를 반영.
   
   3b/2b: 사이클 논리가 아니므로 조정 없음 (0)
*/
const TOP10_ASYMMETRIC = [
  { rank: 1, name: "에코프로비엠", code: "247540", type: "3a", fundScore: 74, cycleAdj: -6, reason: "EBITDA 755억 흑자로 GP 건전. 적자폭 축소 중. 다만 2차전지 사이클 역사가 짧아 구조적 과잉 가능성 할인", catalyst: "양극재 출하량 회복 + ASP 반등", momentum: { pct52wHigh: 0.82, maAlign: "full", ma120dir: "up", volRatio: 1.5 } },
  { rank: 2, name: "에코프로", code: "086520", type: "3a", fundScore: 72, cycleAdj: -6, reason: "에코프로비엠 연결 효과. GP 유지. 인니 투자 + 원가혁신. 사이클 불확실성 할인 적용", catalyst: "자회사 실적 턴어라운드", momentum: { pct52wHigh: 0.85, maAlign: "full", ma120dir: "up", volRatio: 1.8 } },
  { rank: 3, name: "로보티즈", code: "108490", type: "3b", fundScore: 66, cycleAdj: 0, reason: "로봇 액추에이터 선도. GP흑자 확인. 삼성 로봇 수혜 기대. 매출 성장 > 비용 증가", catalyst: "로봇 양산 주문 확보", momentum: { pct52wHigh: 0.55, maAlign: "none", ma120dir: "down", volRatio: 0.8 } },
  { rank: 4, name: "테크윙", code: "089030", type: "3a", fundScore: 62, cycleAdj: 0, reason: "반도체 테스트 핸들러. 30년+ 사이클 검증. GP흑자 유지. 사이클 복원 시 즉시 흑전 확실성 높음", catalyst: "반도체 사이클 상승 전환", momentum: { pct52wHigh: 0.60, maAlign: "partial", ma120dir: "down", volRatio: 2.1 } },
  { rank: 5, name: "알지노믹스", code: "536560", type: "3b", fundScore: 60, cycleAdj: 0, reason: "핵산치료제 라이선싱 수익으로 GP흑자. R&D 확대로 OP적자이나 추가 딜 시 즉시 흑전", catalyst: "추가 라이선싱 딜 체결", momentum: { pct52wHigh: 0.90, maAlign: "full", ma120dir: "up", volRatio: 1.6 } },
  { rank: 6, name: "엘앤에프", code: "066970", type: "3a", fundScore: 58, cycleAdj: -6, reason: "양극재 GP흑자 유지. 2차전지 사이클 수혜 기대. 사이클 불확실성 할인", catalyst: "NCMA 출하 증가 + 가동률 회복", momentum: { pct52wHigh: 0.50, maAlign: "none", ma120dir: "flat", volRatio: 1.0 } },
  { rank: 7, name: "삼천당제약", code: "000250", type: "2b", fundScore: 64, cycleAdj: 0, reason: "GLP-1 파이프라인 Phase2. 시장 규모 거대. 기존 제약 매출로 런웨이 확보", catalyst: "GLP-1 임상 Phase3 진입", momentum: { pct52wHigh: 0.70, maAlign: "partial", ma120dir: "up", volRatio: 1.3 } },
  { rank: 8, name: "에이비엘바이오", code: "298380", type: "2b", fundScore: 62, cycleAdj: 0, reason: "ADC 플랫폼. 사노피 파트너십 등 라이선싱 매출. 복수 파이프라인 옵셔널리티 높음", catalyst: "ABL503 Phase2 데이터 / 추가 라이선싱", momentum: { pct52wHigh: 0.65, maAlign: "partial", ma120dir: "up", volRatio: 1.1 } },
  { rank: 9, name: "HLB", code: "028300", type: "2b", fundScore: 58, cycleAdj: 0, reason: "리보세라닙 FDA 승인 대기. 바이너리 이벤트. 승인 시 P&L 전면 전환", catalyst: "FDA 승인 결정", momentum: { pct52wHigh: 0.58, maAlign: "partial", ma120dir: "flat", volRatio: 1.1 } },
  { rank: 10, name: "리가켐바이오", code: "141080", type: "2b", fundScore: 56, cycleAdj: 0, reason: "ADC 링커 플랫폼. 복수 라이선싱 딜 진행. 옵셔널리티 풍부", catalyst: "글로벌 빅파마 라이선싱 딜", momentum: { pct52wHigh: 0.62, maAlign: "partial", ma120dir: "up", volRatio: 1.3 } },
];

function calcMomentum(m) {
  if (!m) return 0;
  const s1 = Math.min(6, Math.round(m.pct52wHigh * 6 * 10) / 10);
  const s2 = m.maAlign === "full" ? 6 : m.maAlign === "partial" ? 3 : 0;
  const s3 = m.ma120dir === "up" ? 4 : m.ma120dir === "flat" ? 0 : -3;
  const s4 = Math.min(4, Math.round(Math.max(0, (m.volRatio - 0.8)) * 5 * 10) / 10);
  return Math.round((s1 + s2 + s3 + s4) * 10) / 10;
}

const INITIAL_TOP10 = TOP10_ASYMMETRIC.map((c) => {
  const momScore = calcMomentum(c.momentum);
  const adjFund = c.fundScore + (c.cycleAdj || 0);
  return { ...c, adjFund, momScore, totalScore: adjFund + momScore };
}).sort((a, b) => b.totalScore - a.totalScore).map((c, i) => ({ ...c, rank: i + 1 }));

/* ETF 데이터 */
const ETF_DATA = [
  { name: "KODEX 코스닥150", code: "229200", aum: "7.5조", fee: "0.20%", note: "코스닥 대표 150종목 패시브. 시총 가중",
    holdings: [{ name: "에코프로", weight: 8.2 },{ name: "에코프로비엠", weight: 7.0 },{ name: "삼천당제약", weight: 3.0 },{ name: "에이비엘바이오", weight: 1.5 },{ name: "HLB", weight: 1.2 },{ name: "리가켐바이오", weight: 1.0 },{ name: "로보티즈", weight: 1.3 },{ name: "테크윙", weight: 0.9 },{ name: "알지노믹스", weight: 0.8 },{ name: "메지온", weight: 0.6 },{ name: "엔켐", weight: 0.7 },{ name: "카카오게임즈", weight: 0.7 },{ name: "나노신소재", weight: 0.5 },{ name: "심텍", weight: 0.5 },{ name: "인텔리안테크", weight: 0.5 },{ name: "고영", weight: 0.4 },{ name: "엘앤에프", weight: 0.6 },{ name: "씨젠", weight: 0.3 },{ name: "필에너지", weight: 0.2 },{ name: "에이치엘비", weight: 0.2 },{ name: "코오롱티슈진", weight: 1.6 },{ name: "보로노이", weight: 1.0 },{ name: "펩트론", weight: 1.0 },{ name: "에임드바이오", weight: 0.7 },{ name: "올릭스", weight: 0.7 },{ name: "디앤디파마텍", weight: 0.6 },{ name: "오름테라퓨틱", weight: 0.4 },{ name: "우리기술", weight: 0.5 },{ name: "원익홀딩스", weight: 0.4 },{ name: "하나마이크론", weight: 0.4 },{ name: "차바이오텍", weight: 0.3 },{ name: "서진시스템", weight: 0.5 },{ name: "성호전자", weight: 0.5 },{ name: "태성", weight: 0.4 },{ name: "CJ ENM", weight: 0.3 },{ name: "메디톡스", weight: 0.1 }] },
  { name: "TIGER 코스닥150", code: "232080", aum: "1.3조", fee: "0.19%", note: "KODEX와 동일 지수. 최저 보수",
    holdings: [{ name: "에코프로", weight: 8.2 },{ name: "에코프로비엠", weight: 7.0 },{ name: "삼천당제약", weight: 3.0 },{ name: "에이비엘바이오", weight: 1.5 },{ name: "HLB", weight: 1.2 },{ name: "리가켐바이오", weight: 1.0 },{ name: "로보티즈", weight: 1.3 },{ name: "테크윙", weight: 0.9 },{ name: "알지노믹스", weight: 0.8 },{ name: "메지온", weight: 0.6 },{ name: "엔켐", weight: 0.7 },{ name: "카카오게임즈", weight: 0.7 },{ name: "나노신소재", weight: 0.5 },{ name: "심텍", weight: 0.5 },{ name: "인텔리안테크", weight: 0.5 },{ name: "고영", weight: 0.4 },{ name: "엘앤에프", weight: 0.6 },{ name: "씨젠", weight: 0.3 },{ name: "필에너지", weight: 0.2 },{ name: "에이치엘비", weight: 0.2 },{ name: "코오롱티슈진", weight: 1.6 },{ name: "보로노이", weight: 1.0 },{ name: "펩트론", weight: 1.0 },{ name: "에임드바이오", weight: 0.7 },{ name: "올릭스", weight: 0.7 },{ name: "디앤디파마텍", weight: 0.6 },{ name: "오름테라퓨틱", weight: 0.4 },{ name: "우리기술", weight: 0.5 },{ name: "원익홀딩스", weight: 0.4 },{ name: "하나마이크론", weight: 0.4 },{ name: "차바이오텍", weight: 0.3 },{ name: "서진시스템", weight: 0.5 },{ name: "성호전자", weight: 0.5 },{ name: "태성", weight: 0.4 },{ name: "CJ ENM", weight: 0.3 },{ name: "메디톡스", weight: 0.1 }] },
  { name: "TIME 코스닥액티브", code: "신규", aum: "4,770억", fee: "0.80%", note: "🆕 3/10 상장. 타임폴리오. 2차전지·바이오 중심",
    holdings: [{ name: "에코프로", weight: 9.76 },{ name: "에코프로비엠", weight: 6.89 },{ name: "알지노믹스", weight: 2.2 },{ name: "로보티즈", weight: 1.8 },{ name: "삼천당제약", weight: 1.5 },{ name: "엘앤에프", weight: 1.5 },{ name: "나노신소재", weight: 0.8 },{ name: "테크윙", weight: 0.7 },{ name: "HLB", weight: 0.5 },{ name: "에이비엘바이오", weight: 0.5 },{ name: "코오롱티슈진", weight: 0.4 }] },
  { name: "KoAct 코스닥액티브", code: "신규", aum: "5,950억", fee: "0.50%", note: "🆕 3/10 상장. 삼성액티브. 공격적 종목 발굴",
    holdings: [{ name: "로보티즈", weight: 3.0 },{ name: "테크윙", weight: 2.0 },{ name: "에코프로비엠", weight: 2.5 },{ name: "에코프로", weight: 2.0 },{ name: "인텔리안테크", weight: 3.0 },{ name: "고영", weight: 1.5 },{ name: "심텍", weight: 1.0 },{ name: "엘앤에프", weight: 1.0 },{ name: "삼천당제약", weight: 0.8 },{ name: "위메이드", weight: 0.5 },{ name: "원익홀딩스", weight: 0.3 },{ name: "서진시스템", weight: 0.5 },{ name: "성호전자", weight: 0.3 }] },
  { name: "KODEX 2차전지산업", code: "305720", aum: "8,500억", fee: "0.45%", note: "2차전지 밸류체인. 3번 유형 사이클 턴어라운드 집중",
    holdings: [{ name: "에코프로비엠", weight: 12.5 },{ name: "에코프로", weight: 8.0 },{ name: "엘앤에프", weight: 5.0 },{ name: "나노신소재", weight: 2.0 },{ name: "엔켐", weight: 3.0 },{ name: "필에너지", weight: 1.5 },{ name: "씨아이에스", weight: 1.0 }] },
  { name: "KODEX 코스닥150IT", code: "261060", aum: "1,100억", fee: "0.25%", note: "코스닥 IT 섹터. 3번 반도체장비 밀집",
    holdings: [{ name: "테크윙", weight: 3.8 },{ name: "심텍", weight: 1.8 },{ name: "고영", weight: 1.5 },{ name: "인텔리안테크", weight: 1.2 },{ name: "티에스이", weight: 1.0 },{ name: "서진시스템", weight: 2.5 },{ name: "태성", weight: 1.8 },{ name: "성호전자", weight: 1.5 }] },
  { name: "TIGER 코리아휴머노이드로봇", code: "490600", aum: "2,800억", fee: "0.45%", note: "휴머노이드 로봇. 3번 로보티즈 10.9%",
    holdings: [{ name: "로보티즈", weight: 10.9 }] },
  { name: "TIGER 코스닥150바이오테크", code: "261070", aum: "3,200억", fee: "0.40%", note: "코스닥 바이오. 2b+3 바이오 집중",
    holdings: [{ name: "알지노믹스", weight: 2.5 },{ name: "삼천당제약", weight: 2.0 },{ name: "에이비엘바이오", weight: 1.8 },{ name: "HLB", weight: 1.5 },{ name: "리가켐바이오", weight: 1.2 },{ name: "메지온", weight: 0.8 },{ name: "에이치엘비", weight: 0.5 }] },
  { name: "KoAct AI인프라액티브", code: "KoAct", aum: "2,100억", fee: "0.50%", note: "삼성액티브. AI 인프라. 3번 반도체장비 집중",
    holdings: [{ name: "테크윙", weight: 4.5 },{ name: "고영", weight: 2.0 },{ name: "심텍", weight: 1.5 }] },
  { name: "PLUS 코스닥150액티브", code: "신규(3/17)", aum: "상장 예정", fee: "0.15%", note: "🔜 3/17 상장 예정. 한화. 네거티브 스크리닝+30종목 압축. 최저 보수",
    holdings: [{ name: "에코프로", weight: 7.0 },{ name: "에코프로비엠", weight: 6.0 },{ name: "로보티즈", weight: 1.5 },{ name: "테크윙", weight: 1.0 },{ name: "엘앤에프", weight: 1.2 },{ name: "삼천당제약", weight: 0.8 }] },
];

const NO_INVEST_TYPES = new Set(["1", "2a", "4a"]);

// 비대칭매력 유형별 가중치 — 유형마다 1% 노출의 가치가 다름
const ASYM_WEIGHT = { "3a": 1.0, "3b": 0.8, "2b": 0.7, "4b": 0.5 };

// 시총 가중 감점: 시총 순위별 감점 계수
function capPenaltyCoeff(rank) {
  if (rank <= 30) return 0.8;
  if (rank <= 70) return 0.5;
  return 0.3;
}

function calcETFScores(allCompanies, top10List) {
  const companyMap = new Map(allCompanies.map(c => [c.name, c]));
  // Top 10 종목별 totalScore 맵 — 보너스 승수 계산용
  const top10ScoreMap = new Map((top10List || []).map(c => [c.name, c.totalScore]));

  return ETF_DATA.map((etf) => {
    const asymHoldings = [];
    const noInvestHoldings = [];

    (etf.holdings || []).forEach(h => {
      const comp = companyMap.get(h.name);
      if (!comp) return;
      const t10score = top10ScoreMap.get(h.name); // undefined if not Top 10
      const entry = { ...h, type: comp.type, detail: comp.detail, rank: comp.rank, top10Score: t10score };
      if (ASYM_WEIGHT[comp.type] !== undefined) asymHoldings.push(entry);
      else if (NO_INVEST_TYPES.has(comp.type)) noInvestHoldings.push(entry);
    });

    const asymExposure = Math.round(asymHoldings.reduce((s, h) => s + h.weight, 0) * 10) / 10;
    // 가중 비대칭 점수: 비중 × 유형가중치 × Top10 보너스(1 + score/100)
    const weightedAsym = Math.round(asymHoldings.reduce((s, h) => {
      const typeW = ASYM_WEIGHT[h.type] || 0;
      const top10Bonus = h.top10Score !== undefined ? (1 + h.top10Score / 100) : 1;
      return s + h.weight * typeW * top10Bonus;
    }, 0) * 10) / 10;
    const noInvestExposure = Math.round(noInvestHoldings.reduce((s, h) => s + h.weight, 0) * 10) / 10;
    const penalty = Math.round(noInvestHoldings.reduce((s, h) => s + h.weight * capPenaltyCoeff(h.rank), 0) * 10) / 10;
    const netScore = Math.round((weightedAsym - penalty) * 10) / 10;

    const byType = { "3a": 0, "3b": 0, "2b": 0, "4b": 0 };
    asymHoldings.forEach(h => { if (byType[h.type] !== undefined) byType[h.type] += h.weight; });
    Object.keys(byType).forEach(k => { byType[k] = Math.round(byType[k] * 10) / 10; });

    const top10InETF = asymHoldings.filter(h => h.top10Score !== undefined).length;

    return { ...etf, matchedHoldings: asymHoldings, noInvestHoldings, asymExposure, weightedAsym, noInvestExposure, penalty, netScore, bdeCount: asymHoldings.length, noInvestCount: noInvestHoldings.length, top10InETF, byType };
  }).sort((a, b) => b.netScore - a.netScore);
}

/* 유틸 컴포넌트 */
function TypeBadge({ type }) {
  const t = DEFICIT_TYPES[type];
  if (!t) return null;
  return (<span style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:700,color:t.color,background:t.bg,border:`1px solid ${t.color}30`,whiteSpace:"nowrap" }}>{type === "흑자" ? "흑자" : type}</span>);
}
function VerdictBadge({ type }) {
  const t = DEFICIT_TYPES[type];
  if (!t) return null;
  const inv = INVESTABLE_TYPES.has(type);
  return (<span style={{ display:"inline-flex",alignItems:"center",gap:3,padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700,color:inv?"#00CC66":type==="5"?"#A0AEC0":"#FF3B3B",background:inv?"#00CC6615":type==="5"?"#A0AEC015":"#FF3B3B15",border:`1px solid ${inv?"#00CC6630":type==="5"?"#A0AEC030":"#FF3B3B30"}` }}>{t.icon} {t.verdict}</span>);
}
function MomentumBadge({ m }) {
  if (!m) return null;
  const labels = [];
  if (m.maAlign==="full") labels.push({text:"정배열",color:"#00CC66"}); else if (m.maAlign==="partial") labels.push({text:"부분정배열",color:"#FFB800"}); else labels.push({text:"역배열",color:"#FF4444"});
  if (m.ma120dir==="up") labels.push({text:"120▲",color:"#00CC66"}); else if (m.ma120dir==="down") labels.push({text:"120▼",color:"#FF4444"});
  if (m.pct52wHigh>=0.9) labels.push({text:"52w高",color:"#FFB800"});
  if (m.volRatio>=1.5) labels.push({text:"거래↑",color:"#4EA8FF"});
  return (<div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{labels.map((l,i)=>(<span key={i} style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:l.color+"20",color:l.color,border:`1px solid ${l.color}30`,fontWeight:600}}>{l.text}</span>))}</div>);
}

/* 메인 페이지 */
export default function DeficitAnalysisPage() {
  const [activeTab, setActiveTab] = useState("top10");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [filterType, setFilterType] = useState("ALL");
  const [filterInvestable, setFilterInvestable] = useState("ALL");
  const [expandedRow, setExpandedRow] = useState(null);
  const [sortBy, setSortBy] = useState("rank");
  const [top10Data, setTop10Data] = useState(INITIAL_TOP10);
  const [lastUpdate, setLastUpdate] = useState("2026.03.06 (초기 수동 데이터)");
  const [companies] = useState(SEED_COMPANIES);
  const [adminPin, setAdminPin] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState('');

  useEffect(() => { const s = sessionStorage.getItem('wolfpack_deficit_pin'); if (s) { setAdminPin(s); setIsAdmin(true); } }, []);

  const handlePinSubmit = async () => {
    try {
      const res = await fetch("/api/deficit-update", { method:"POST", headers:{"Content-Type":"application/json","x-admin-pin":adminPin}, body:JSON.stringify({names:["__pin_check__"],codes:{}}) });
      if (res.status===401) { setPinError("PIN이 일치하지 않습니다"); return; }
      setIsAdmin(true); sessionStorage.setItem('wolfpack_deficit_pin',adminPin); setShowPinModal(false); setPinError('');
    } catch { setPinError("서버 연결 오류"); }
  };
  const handleLogout = () => { setIsAdmin(false); setAdminPin(''); sessionStorage.removeItem('wolfpack_deficit_pin'); };

  const etfScored = useMemo(() => calcETFScores(companies, top10Data), [companies, top10Data]);

  const handleAiUpdate = useCallback(async () => {
    if (!isAdmin) { setShowPinModal(true); return; }
    setAiLoading(true); setAiResult(null);
    try {
      const names = TOP10_ASYMMETRIC.map(c=>c.name);
      const codes = {}; TOP10_ASYMMETRIC.forEach(c=>{ if(c.code) codes[c.name]=c.code; });
      const res = await fetch("/api/deficit-update", { method:"POST", headers:{"Content-Type":"application/json","x-admin-pin":adminPin}, body:JSON.stringify({names,codes}) });
      if (res.status===401) { setIsAdmin(false); sessionStorage.removeItem('wolfpack_deficit_pin'); alert('인증 만료'); setShowPinModal(true); setAiLoading(false); return; }
      const data = await res.json();
      const newsText = data.news || data.error || "업데이트 완료";
      if (data.momentum && Array.isArray(data.momentum)) {
        const updated = TOP10_ASYMMETRIC.map(c => {
          const api = data.momentum.find(m=>m.name===c.name);
          let mom = c.momentum;
          if (api && !api.error) mom = { pct52wHigh:api.pct52wHigh/100, maAlign:api.maAlign, ma120dir:api.ma120dir, volRatio:api.volRatio, currentPrice:api.currentPrice, high52w:api.high52w, ma20:api.ma20, ma60:api.ma60, ma120:api.ma120 };
          const ms = calcMomentum(mom);
          const adjFund = c.fundScore + (c.cycleAdj || 0);
          return { ...c, momentum:mom, adjFund, momScore:ms, totalScore:adjFund+ms };
        }).sort((a,b)=>b.totalScore-a.totalScore).map((c,i)=>({...c,rank:i+1}));
        setTop10Data(updated); setLastUpdate(data.dataDate||new Date().toISOString().split("T")[0]);
        const summary = updated.slice(0,5).map(c=>`${c.rank}위 ${c.name}: 총점 ${c.totalScore} (펀더${c.adjFund}${c.cycleAdj?'[사이클'+c.cycleAdj+']':''}+모멘${c.momScore})`).join("\n");
        setAiResult(`📊 모멘텀 업데이트 완료 (${data.dataDate||"today"})\n\n[Top 5]\n${summary}\n\n[뉴스]\n${newsText}`);
      } else { setAiResult(newsText); }
    } catch(e) { setAiResult("API 오류: "+e.message); }
    setAiLoading(false);
  }, [isAdmin, adminPin]);

  const typeDistribution = useMemo(() => { const d={}; companies.forEach(c=>{d[c.type]=(d[c.type]||0)+1}); return d; }, [companies]);
  const investableCount = useMemo(() => { let y=0,n=0,e=0; companies.forEach(c=>{ if(INVESTABLE_TYPES.has(c.type))y++; else if(c.type==="5")e++; else n++; }); return {yes:y,no:n,etc:e}; }, [companies]);
  const filtered = useMemo(() => { let l=companies; if(filterType!=="ALL")l=l.filter(c=>c.type===filterType); if(filterInvestable==="investable")l=l.filter(c=>INVESTABLE_TYPES.has(c.type)); if(filterInvestable==="notInvestable")l=l.filter(c=>!INVESTABLE_TYPES.has(c.type)&&c.type!=="5"); return l; }, [companies,filterType,filterInvestable]);
  const sorted = useMemo(() => [...filtered].sort((a,b)=>{ if(sortBy==="rank")return a.rank-b.rank; if(sortBy==="cap")return b.cap-a.cap; if(sortBy==="type")return String(a.type).localeCompare(String(b.type)); return 0; }), [filtered,sortBy]);

  return (
    <div className="min-h-screen bg-[#0A0E17] text-[#E0E4EC]" style={{fontFamily:"'Noto Sans KR',sans-serif"}}>
      {/* 헤더 */}
      <div className="px-7 pt-6 pb-0 border-b border-[#1E2636]">
        <div className="flex justify-between items-start flex-wrap gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1"><a href="/" className="text-sm text-[#5A6478] hover:text-[#4EA8FF] transition">← 컨트롤타워</a></div>
            <h1 className="text-xl font-black bg-gradient-to-r from-[#4EA8FF] to-[#FFB800] bg-clip-text text-transparent">🐺 적자기업 투자분석</h1>
            <p className="text-xs text-[#5A6478] mt-1">코스닥 시총 상위 150개 · 손익구간별 5단계 분류 → 비대칭매력 스코어링(펀더80+모멘20) → ETF 매칭 · <span className="text-[#4EA8FF] font-mono">최종: {lastUpdate}</span></p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin ? (<button onClick={handleLogout} className="px-3 py-2.5 rounded-lg border border-[#22c55e50] text-sm text-[#22c55e] bg-[#22c55e10] hover:bg-[#22c55e20] transition">🔓</button>) : (<button onClick={()=>{setShowPinModal(true);setPinError('');}} className="px-3 py-2.5 rounded-lg border border-[#5A647850] text-sm text-[#5A6478] bg-[#5A647810] hover:bg-[#5A647820] transition">🔒</button>)}
            <button onClick={handleAiUpdate} disabled={aiLoading||!isAdmin} className={`px-5 py-2.5 rounded-lg border font-bold text-sm transition flex items-center gap-2 ${isAdmin?'border-[#4EA8FF50] text-[#4EA8FF] bg-gradient-to-br from-[#0D2847] to-[#132E52] hover:from-[#133058] hover:to-[#1A3D6A]':'border-[#5A647830] text-[#5A6478] bg-[#0D1520] cursor-not-allowed'} disabled:opacity-50 disabled:cursor-wait`}>{aiLoading?"⚡ AI 분석 중...":isAdmin?"⚡ AI 업데이트":"🔐 AI 업데이트"}</button>
          </div>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-transparent via-[#4EA8FF] to-transparent opacity-60" />
      </div>

      {/* PIN 모달 */}
      {showPinModal && (<div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}}><div className="bg-[#141924] border border-[#2A3548] rounded-2xl p-8 w-[340px] shadow-2xl"><div className="text-base font-bold text-[#E0E4EC] mb-1 text-center">🔐 관리자 인증</div><div className="text-xs text-[#5A6478] mb-5 text-center">AI 업데이트는 관리자만 가능합니다</div><input type="password" value={adminPin} onChange={e=>{setAdminPin(e.target.value);setPinError('');}} onKeyDown={e=>e.key==='Enter'&&handlePinSubmit()} placeholder="관리자 PIN 입력" autoFocus className="w-full px-4 py-3 rounded-xl border text-center text-base font-bold tracking-[8px] outline-none" style={{background:'#0A0E17',borderColor:pinError?'#FF4444':'#2A3548',color:'#E0E4EC'}} />{pinError&&<div className="text-xs text-[#FF4444] mt-2 text-center">{pinError}</div>}<div className="flex gap-2 mt-5"><button onClick={()=>{setShowPinModal(false);setPinError('');setAdminPin('');}} className="flex-1 py-2.5 rounded-xl text-sm text-[#5A6478] border border-[#2A3548] hover:bg-[#1E2636] transition">취소</button><button onClick={handlePinSubmit} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#4EA8FF] border border-[#4EA8FF50] bg-[#0D2847] hover:bg-[#133058] transition">확인</button></div></div></div>)}

      {aiResult && (<div className="mx-7 mt-4 p-4 bg-[#0D2847] border border-[#4EA8FF30] rounded-lg"><div className="text-xs font-bold text-[#4EA8FF] mb-2">⚡ AI 업데이트 결과</div><div className="text-xs text-[#A0B0CC] leading-relaxed whitespace-pre-wrap">{aiResult}</div><button onClick={()=>setAiResult(null)} className="mt-2 text-[11px] text-[#5A6478] hover:text-[#8892A4]">닫기 ×</button></div>)}

      {/* 분포 요약 */}
      <div className="px-7 py-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="px-5 py-4 rounded-xl text-center border" style={{background:"#00CC6610",borderColor:"#00CC6630"}}><div className="text-3xl font-black font-mono text-[#00CC66]">{investableCount.yes}</div><div className="text-[11px] font-bold text-[#00CC66] opacity-80">투자가능</div><div className="text-[9px] text-[#5A6478] mt-0.5">흑자+2b+3a+3b+4b+E</div></div>
          <div className="px-5 py-4 rounded-xl text-center border" style={{background:"#FF3B3B10",borderColor:"#FF3B3B30"}}><div className="text-3xl font-black font-mono text-[#FF3B3B]">{investableCount.no}</div><div className="text-[11px] font-bold text-[#FF3B3B] opacity-80">투자불가</div><div className="text-[9px] text-[#5A6478] mt-0.5">1+2a+4a</div></div>
          <div className="px-5 py-4 rounded-xl text-center border" style={{background:"#A0AEC010",borderColor:"#A0AEC030"}}><div className="text-3xl font-black font-mono text-[#A0AEC0]">{investableCount.etc}</div><div className="text-[11px] font-bold text-[#A0AEC0] opacity-80">예외</div><div className="text-[9px] text-[#5A6478] mt-0.5">5</div></div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 flex-wrap">
          {Object.entries(DEFICIT_TYPES).map(([key,val])=>(<button key={key} onClick={()=>{setFilterType(filterType===key?"ALL":key);setActiveTab("all");}} className="px-4 py-2.5 rounded-lg min-w-[80px] text-center transition hover:scale-[1.02]" style={{background:filterType===key?val.bg.replace("15","30"):val.bg,border:`1px solid ${val.color}${filterType===key?"60":"20"}`,cursor:"pointer"}}><div className="text-xl font-black font-mono" style={{color:val.color}}>{typeDistribution[key]||0}</div><div className="text-[10px] font-semibold opacity-80" style={{color:val.color}}>{key==="흑자"?"흑자":key}</div></button>))}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 px-7 pb-4 overflow-x-auto">
        {[{id:"top10",label:"🎯 비대칭매력 Top 10"},{id:"all",label:`📊 전체 ${companies.length}종목`},{id:"etf",label:"💼 ETF 매칭"},{id:"framework",label:"📋 분류 프레임워크"}].map(t=>(<button key={t.id} onClick={()=>setActiveTab(t.id)} className={`px-4 py-2 rounded-md text-xs font-semibold border transition whitespace-nowrap ${activeTab===t.id?"bg-gradient-to-br from-[#1A3A5C] to-[#162D4A] text-[#4EA8FF] border-[#4EA8FF40]":"bg-transparent text-[#8892A4] border-[#1E2636] hover:bg-[#1A2030] hover:text-[#C0C8D8]"}`}>{t.label}</button>))}
      </div>

      <div className="px-7 pb-10">

        {/* Top 10 */}
        {activeTab === "top10" && (<div>
          <div className="bg-[#111827] border border-[#1E2636] rounded-lg p-5 mb-4">
            <div className="text-sm font-bold text-[#FFB800] mb-2">비대칭매력 스코어링: 펀더멘탈 기본(80) + 사이클검증 조정(-8~0) + 모멘텀(20)</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[#8892A4] leading-relaxed">
              <div><div className="text-[#FFB800] font-bold mb-1">3a (사이클릭)</div><p>GP마진 건전성(0~20) · 사이클 위치/흑전 거리(0~20) · 영업레버리지(0~15) · 촉매 확실성(0~15) · 재무 안정성(0~10)</p></div>
              <div><div className="text-[#E6A800] font-bold mb-1">3b (구조적)</div><p>GP마진 건전성(0~15) · 매출성장 vs 비용증가(0~20) · 플랫폼 전환점(0~15) · 촉매 확실성(0~15) · 재무 안정성(0~15)</p></div>
              <div><div className="text-[#FF8C00] font-bold mb-1">2b (메인 미출시)</div><p>파이프라인 단계(0~25) · 기존매출 런웨이(0~15) · 옵셔널리티(0~15) · 촉매 확실성(0~15) · 현금 런웨이(0~10)</p></div>
              <div><div className="text-[#FF6B6B] font-bold mb-1">📉 사이클 검증도 (3a 전용)</div><p>산업 사이클 반복 역사가 긴 업종(반도체장비 30년+)은 조정 0, 짧은 업종(2차전지 5년 미만)은 -6~-8 할인. "사이클 회복 시 자동 흑전" 전제의 신뢰도 반영.</p></div>
              <div className="sm:col-span-2"><div className="text-[#4EA8FF] font-bold mb-1">모멘텀 (20점)</div><div className="flex gap-4 flex-wrap font-mono text-[10px]"><span>52주고가 근접도 <span className="text-[#5A6478]">(0~6)</span></span><span>이평선 정배열 <span className="text-[#5A6478]">(0~6)</span></span><span>120일선 방향 <span className="text-[#5A6478]">(-3~+4)</span></span><span>거래량 모멘텀 <span className="text-[#5A6478]">(0~4)</span></span></div></div>
            </div>
          </div>
          <div className="bg-[#111827] border border-[#1E2636] rounded-lg overflow-hidden">
            {top10Data.map((c,i) => { const dt = DEFICIT_TYPES[c.type]; return (
              <div key={c.name} className="px-5 py-4 border-b border-[#1E2636] hover:bg-[#151D2C] transition">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className={`font-mono text-lg font-black min-w-[30px] ${i<3?"text-[#FFB800]":"text-[#5A6478]"}`}>{String(c.rank).padStart(2,"0")}</span>
                  <span className="text-sm font-bold">{c.name}</span>
                  <TypeBadge type={c.type} /><VerdictBadge type={c.type} /><MomentumBadge m={c.momentum} />
                  <div className="flex-1" />
                  <div className="w-36 flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-[#1E2636] overflow-hidden flex">
                      <div className="h-full" style={{width:`${c.adjFund}%`,background:dt?.color||"#4EA8FF"}} />
                      <div className="h-full" style={{width:`${Math.max(0,c.momScore)}%`,background:"#4EA8FF"}} />
                    </div>
                    <span className={`font-mono text-sm font-bold min-w-[35px] text-right ${c.totalScore>=85?"text-[#FFB800]":"text-[#4EA8FF]"}`}>{c.totalScore}</span>
                  </div>
                </div>
                <div className="ml-[42px] flex gap-4 text-[10px] text-[#5A6478] mb-1 font-mono flex-wrap">
                  <span>기본: <span style={{color:dt?.color||"#4EA8FF"}}>{c.fundScore}</span></span>
                  {c.cycleAdj && c.cycleAdj !== 0 && <span>사이클: <span className="text-[#FF6B6B]">{c.cycleAdj}</span></span>}
                  <span>펀더: <span style={{color:dt?.color||"#4EA8FF"}}>{c.adjFund}</span></span>
                  <span>모멘: <span className="text-[#4EA8FF]">{c.momScore>0?"+":""}{c.momScore}</span></span>
                  <span>52w: <span className="text-[#8892A4]">{Math.round(c.momentum.pct52wHigh*100)}%</span></span>
                  <span>Vol: <span className="text-[#8892A4]">{c.momentum.volRatio}x</span></span>
                  {c.momentum.currentPrice && (<><span>현재가: <span className="text-[#E0E4EC]">{Number(c.momentum.currentPrice).toLocaleString()}원</span></span><span>MA: <span className="text-[#8892A4]">{Number(c.momentum.ma20||0).toLocaleString()}/{Number(c.momentum.ma60||0).toLocaleString()}/{Number(c.momentum.ma120||0).toLocaleString()}</span></span></>)}
                </div>
                <div className="text-[11px] text-[#8892A4] ml-[42px] leading-relaxed">{c.reason}</div>
                <div className="text-[10px] ml-[42px] mt-1" style={{color:dt?.color||"#4EA8FF"}}>📌 촉매: {c.catalyst}</div>
              </div>
            ); })}
          </div>
        </div>)}

        {/* 전체 종목 */}
        {activeTab === "all" && (<div>
          <div className="flex gap-1.5 mb-3 flex-wrap">
            <button onClick={()=>setFilterInvestable(filterInvestable==="investable"?"ALL":"investable")} className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition ${filterInvestable==="investable"?"bg-[#00CC6620] text-[#00CC66] border-[#00CC6660]":"bg-transparent text-[#8892A4] border-[#1E2636]"}`}>✅ 투자가능만</button>
            <button onClick={()=>setFilterInvestable(filterInvestable==="notInvestable"?"ALL":"notInvestable")} className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition ${filterInvestable==="notInvestable"?"bg-[#FF3B3B20] text-[#FF3B3B] border-[#FF3B3B60]":"bg-transparent text-[#8892A4] border-[#1E2636]"}`}>🚫 투자불가만</button>
            <span className="w-px bg-[#1E2636] mx-1" />
            <button onClick={()=>setFilterType("ALL")} className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition ${filterType==="ALL"?"bg-[#4EA8FF20] text-[#4EA8FF] border-[#4EA8FF60]":"bg-transparent text-[#8892A4] border-[#1E2636]"}`}>전체 ({companies.length})</button>
            {Object.entries(DEFICIT_TYPES).map(([key,val])=>(<button key={key} onClick={()=>setFilterType(filterType===key?"ALL":key)} className="px-3 py-1 rounded-full text-[11px] font-semibold border transition" style={filterType===key?{background:val.bg.replace("15","30"),color:val.color,borderColor:val.color+"60"}:{background:"transparent",color:"#8892A4",borderColor:"#1E2636"}}>{key==="흑자"?"흑자":key} ({typeDistribution[key]||0})</button>))}
          </div>
          <div className="bg-[#111827] border border-[#1E2636] rounded-lg overflow-auto max-h-[70vh]">
            <table className="w-full border-collapse"><thead><tr>
              {[{key:"rank",label:"#"},{key:"name",label:"종목명",align:"left"},{key:"cap",label:"시총(억)"},{key:"per",label:"PER"},{key:"roe",label:"ROE(%)"},{key:"type",label:"유형"},{key:"verdict",label:"판정"},{key:"detail",label:"분류 근거",align:"left"}].map(h=>(
                <th key={h.key} onClick={()=>["rank","cap","type"].includes(h.key)&&setSortBy(h.key)} className={`px-2 py-2.5 text-[11px] font-bold border-b-2 border-[#1E2636] sticky top-0 bg-[#111827] z-10 whitespace-nowrap ${["rank","cap","type"].includes(h.key)?"cursor-pointer hover:text-[#4EA8FF]":""} ${sortBy===h.key?"text-[#4EA8FF]":"text-[#6B7894]"}`} style={{textAlign:h.align||"center"}}>{h.label}</th>
              ))}
            </tr></thead><tbody>
              {sorted.map(c=>(
                <tr key={c.rank} onClick={()=>setExpandedRow(expandedRow===c.rank?null:c.rank)} className={`hover:bg-[#151D2C] cursor-pointer transition ${!INVESTABLE_TYPES.has(c.type)&&c.type!=="5"?"opacity-50":""}`}>
                  <td className="px-2 py-2.5 text-center font-mono text-[11px] text-[#5A6478] border-b border-[#151D2C]">{c.rank}</td>
                  <td className="px-2 py-2.5 text-left font-semibold text-xs border-b border-[#151D2C]">{c.name}</td>
                  <td className="px-2 py-2.5 text-center font-mono text-[11px] border-b border-[#151D2C]">{(c.cap/10000).toFixed(1)}조</td>
                  <td className={`px-2 py-2.5 text-center font-mono text-[11px] border-b border-[#151D2C] ${c.per<0?"text-[#FF4444]":c.per>100?"text-[#FFB800]":"text-[#8892A4]"}`}>{c.per>999?"999+":c.per<-999?"-999":c.per.toFixed(1)}</td>
                  <td className={`px-2 py-2.5 text-center font-mono text-[11px] border-b border-[#151D2C] ${c.roe<0?"text-[#FF4444]":"text-[#00CC66]"}`}>{c.roe.toFixed(1)}</td>
                  <td className="px-2 py-2.5 text-center border-b border-[#151D2C]"><TypeBadge type={c.type} /></td>
                  <td className="px-2 py-2.5 text-center border-b border-[#151D2C]"><VerdictBadge type={c.type} /></td>
                  <td className="px-2 py-2.5 text-left text-[11px] text-[#6B7894] border-b border-[#151D2C] max-w-[280px]">{expandedRow===c.rank?c.detail:c.detail.slice(0,30)+(c.detail.length>30?"...":"")}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>)}

        {/* ETF 매칭 */}
        {activeTab === "etf" && (<div>
          <div className="bg-[#111827] border border-[#1E2636] rounded-lg p-5 mb-4">
            <div className="text-sm font-bold text-[#4EA8FF] mb-2">ETF 비대칭매력 가중 순점수 매칭</div>
            <div className="text-xs text-[#8892A4] leading-relaxed">
              <span className="text-[#FFB800] font-bold">순점수 = Σ(비중 × 유형가중치 × Top10 보너스) - Σ(투자불가 비중 × 시총 감점)</span><br/>
              유형 가중치: <span className="font-mono text-[#FFB800]">3a ×1.0</span> · <span className="font-mono text-[#E6A800]">3b ×0.8</span> · <span className="font-mono text-[#FF8C00]">2b ×0.7</span> · <span className="font-mono text-[#94A3B8]">4b ×0.5</span> | Top10 보너스: <span className="font-mono text-[#4EA8FF]">×(1+총점/100)</span> — 86점 종목이면 ×1.86<br/>
              투자불가 감점: <span className="font-mono text-[#FF3B3B]">대형 ×0.8</span> · <span className="font-mono text-[#FF8C00]">중형 ×0.5</span> · <span className="font-mono text-[#8892A4]">소형 ×0.3</span>
            </div>
          </div>
          <div className="bg-[#111827] border border-[#1E2636] rounded-lg overflow-hidden">
            <div className="grid gap-3 px-4 py-3 text-[11px] font-bold text-[#6B7894] border-b-2 border-[#1E2636]" style={{gridTemplateColumns:"2fr 65px 65px 65px 55px 55px 3fr"}}><span>ETF명</span><span className="text-center">순점수</span><span className="text-center">가중매력</span><span className="text-center">감점</span><span className="text-center">AUM</span><span className="text-center">보수</span><span>비대칭 편입 (유형×가중치×T10보너스) / 투자불가</span></div>
            {etfScored.map(etf=>(<div key={etf.code||etf.name} className="grid gap-3 px-4 py-3.5 border-b border-[#1E2636] items-start text-xs hover:bg-[#1A2030] transition" style={{gridTemplateColumns:"2fr 65px 65px 65px 55px 55px 3fr"}}>
              <div><div className="font-bold text-sm">{etf.name}</div><div className="text-[10px] text-[#5A6478] font-mono">{etf.code}</div>{etf.top10InETF>0&&<div className="text-[9px] text-[#4EA8FF]">T10: {etf.top10InETF}종목</div>}</div>
              <div className="text-center"><span className={`font-mono text-lg font-black ${etf.netScore>=20?"text-[#FFB800]":etf.netScore>=8?"text-[#4EA8FF]":"text-[#5A6478]"}`}>{etf.netScore}</span><div className="text-[9px] text-[#5A6478]">순점수</div></div>
              <div className="text-center"><span className="font-mono text-sm font-bold text-[#FFB800]">{etf.weightedAsym}</span><div className="text-[9px] text-[#5A6478]">원노출 {etf.asymExposure}%</div></div>
              <div className="text-center"><span className="font-mono text-sm font-bold text-[#FF3B3B]">{etf.penalty>0?"-"+etf.penalty:"—"}</span>{etf.noInvestCount>0&&<div className="text-[9px] text-[#FF3B3B50]">{etf.noInvestCount}종목</div>}</div>
              <div className="text-center font-mono text-[#8892A4]">{etf.aum}</div>
              <div className="text-center font-mono text-[#8892A4]">{etf.fee}</div>
              <div><div className="flex flex-wrap gap-1 mb-1">{etf.matchedHoldings.sort((a,b)=>{const aw=(ASYM_WEIGHT[a.type]||0)*a.weight*(a.top10Score!==undefined?(1+a.top10Score/100):1);const bw=(ASYM_WEIGHT[b.type]||0)*b.weight*(b.top10Score!==undefined?(1+b.top10Score/100):1);return bw-aw;}).map(h=>{const dt=DEFICIT_TYPES[h.type]||DEFICIT_TYPES["흑자"];const w=ASYM_WEIGHT[h.type]||0;const isT10=h.top10Score!==undefined;const bonus=isT10?(1+h.top10Score/100):1;return(<span key={h.name} className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{background:isT10?dt.bg.replace("15","25"):dt.bg,color:dt.color,border:`1px solid ${dt.color}${isT10?"50":"30"}`}}>{isT10?"⭐":""}{h.name} {h.weight}%<span className="opacity-50">×{w}{isT10?"×"+bonus.toFixed(1):""}</span></span>);})}</div>{etf.noInvestHoldings.length>0&&<div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-[#1E263680]">{etf.noInvestHoldings.sort((a,b)=>b.weight-a.weight).slice(0,5).map(h=>{const dt=DEFICIT_TYPES[h.type]||DEFICIT_TYPES["1"];const coeff=capPenaltyCoeff(h.rank);return(<span key={h.name} className="text-[9px] px-1 py-0.5 rounded font-mono opacity-60" style={{background:dt.bg,color:dt.color,border:`1px solid ${dt.color}20`}}>⚠{h.name} {h.weight}%<span className="opacity-50">×{coeff}</span></span>);})}{etf.noInvestHoldings.length>5&&<span className="text-[9px] text-[#5A6478]">+{etf.noInvestHoldings.length-5}개</span>}</div>}<div className="text-[10px] text-[#5A6478] mt-1">{etf.note}</div></div>
            </div>))}
          </div>
          <div className="bg-[#111827] border border-[#1E2636] rounded-lg p-5 mt-4">
            <div className="text-sm font-bold text-[#FFB800] mb-2">💡 2b/3 비대칭매력 투자 전략</div>
            <div className="text-xs text-[#8892A4] leading-relaxed space-y-1">
              <p><strong className="text-[#E0E4EC]">Core (50%)</strong>: KODEX/TIGER 코스닥150 — 2b/3a/3b 전종목 자연 편입. 최저 보수로 광범위 노출</p>
              <p><strong className="text-[#E0E4EC]">사이클 (20%)</strong>: KODEX 2차전지 — 3a(사이클릭) 집중. 업황 회복 시 자동 흑전 레버리지</p>
              <p><strong className="text-[#E0E4EC]">바이오 (15%)</strong>: TIGER 바이오테크 — 2b(메인 미출시) 집중. 파이프라인 바이너리 베팅</p>
              <p><strong className="text-[#E0E4EC]">Active (10%)</strong>: TIME or KoAct 액티브 — 운용역이 3a/3b 오버웨이트. 턴어라운드 타이밍 재량</p>
              <p><strong className="text-[#E0E4EC]">Alpha (5%)</strong>: 4b(일회성) 직접 매수 — 서진시스템·태성 등 ETF에서 '적자'로 저평가된 숨은 흑자</p>
            </div>
          </div>
        </div>)}

        {/* 프레임워크 */}
        {activeTab === "framework" && (<div>
          {/* 전제 검증 */}
          <div className="bg-[#0D2847] border border-[#4EA8FF30] rounded-xl p-5 mb-5">
            <div className="text-sm font-bold text-[#4EA8FF] mb-2">📊 전제 검증: "코스닥 투자 = 적자기업 투자"</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="text-center"><div className="text-xl font-black font-mono text-[#FFB800]">53%</div><div className="text-[10px] text-[#5A6478]">시총 가중 적자 비중</div></div>
              <div className="text-center"><div className="text-xl font-black font-mono text-[#FF3B3B]">60%</div><div className="text-[10px] text-[#5A6478]">Top 20 중 적자 시총</div></div>
              <div className="text-center"><div className="text-xl font-black font-mono text-[#E0E4EC]">70개</div><div className="text-[10px] text-[#5A6478]">150종목 중 적자</div></div>
              <div className="text-center"><div className="text-xl font-black font-mono text-[#00CC66]">200조</div><div className="text-[10px] text-[#5A6478]">적자기업 총 시총</div></div>
            </div>
            <div className="text-xs text-[#8892A4] leading-relaxed">
              종목 수로는 흑자(80개)가 적자(70개)보다 많지만, <span className="text-[#FFB800] font-bold">시총 가중으로 보면 적자 기업이 53%</span>로 더 무겁습니다. 코스닥150 ETF를 사면 돈의 절반 이상이 적자기업에 투입됩니다. 시총 Top 20 중 11개가 적자(에코프로·삼천당·코오롱티슈진 등)이며, 이들이 Top 20 시총의 60%를 차지합니다. <span className="text-[#4EA8FF] font-bold">프레임워크의 전제는 유효합니다.</span>
            </div>
          </div>

          <div className="bg-[#111827] border border-[#1E2636] rounded-xl p-6 mb-5">
            <div className="text-sm font-bold text-[#4EA8FF] mb-4">적자기업 분류 의사결정 흐름</div>
            <div className="flex flex-col gap-2 text-xs">
              {[
                {q:"매출액이 발생하는가?",no:"1. 매출 미발생 → 🚫 투자불가",noC:"#FF3B3B",yes:"다음 ↓",yesC:"#00CC66"},
                {q:"매출총이익(GP)이 흑자인가?",no:"진성매출인가?",noC:"#FF8C00",yes:"다음 ↓",yesC:"#00CC66",sub:[{q:"진성매출(메인사업)이 나오고 있는가?",yes:"2a. GP적자(진성매출) → 🚫 투자불가",yesC:"#FF3B3B",no:"2b. GP적자(메인 미출시) → ⚠️ 투자가능",noC:"#FF8C00"}]},
                {q:"영업이익(OP)이 흑자인가?",no:"사이클릭인가? 구조적인가?",noC:"#FFB800",yes:"다음 ↓",yesC:"#00CC66",sub:[{q:"업황/수주 사이클 하강이 주원인인가?",yes:"3a. 사이클릭 OP적자 → 🔍 최고 비대칭매력",yesC:"#FFB800",no:"3b. 구조적 투자초과 → 🔍 분석 여지",noC:"#E6A800"}]},
                {q:"계속사업이익이 흑자인가?",no:"일회성인가? 구조적인가?",noC:"#7B8794",yes:"다음 ↓",yesC:"#00CC66",sub:[{q:"환차손·소송 등 비반복 일회성인가?",yes:"4b. 일회성 → 👁️ 관찰 대상",yesC:"#94A3B8",no:"4a. 구조적 → 🚫 투자불가",noC:"#7B8794"}]},
                {q:"순이익(NI)이 흑자인가?",no:"5. 계속사업이익 흑자·NI적자 → ⚪ 거의 없음",noC:"#A0AEC0",yes:"다음 ↓",yesC:"#00CC66"},
                {q:"FCF(잉여현금흐름)이 양호한가?",no:"E. FCF적자(NI흑자) → 📐 별도 관찰",noC:"#6B8AFF",yes:"✅ 전 구간 흑자 + FCF 양호",yesC:"#00CC66"},
              ].map((step,i)=>(<div key={i} className="border border-[#1E2636] rounded-lg p-4 bg-[#0D1520]">
                <div className="font-bold text-[#E0E4EC] mb-2">Q{i+1}. {step.q}</div>
                <div className="flex gap-4 ml-4 flex-wrap"><div className="flex items-start gap-1.5"><span className="text-[#00CC66] font-bold text-[11px] mt-0.5">YES →</span><span style={{color:step.yesC}}>{step.yes}</span></div><div className="flex items-start gap-1.5"><span className="text-[#FF4444] font-bold text-[11px] mt-0.5">NO →</span><span style={{color:step.noC}}>{step.no}</span></div></div>
                {step.sub&&step.sub.map((s,j)=>(<div key={j} className="ml-8 mt-2 pl-4 border-l-2 border-[#FF8C0040]"><div className="font-semibold text-[#A0B0CC] mb-1">↳ {s.q}</div><div className="flex gap-4 ml-2 flex-wrap"><div className="flex items-start gap-1.5"><span className="text-[#00CC66] font-bold text-[11px]">YES →</span><span style={{color:s.yesC}}>{s.yes}</span></div><div className="flex items-start gap-1.5"><span className="text-[#FF4444] font-bold text-[11px]">NO →</span><span style={{color:s.noC}}>{s.no}</span></div></div></div>))}
              </div>))}
            </div>
          </div>

          <div className="bg-[#111827] border border-[#FFB80030] rounded-xl p-5 mb-5" style={{borderLeftWidth:3,borderLeftColor:"#FFB800"}}>
            <div className="text-sm font-bold text-[#FFB800] mb-2">⚡ 비대칭매력이 높은 경우</div>
            <div className="text-xs text-[#8892A4] leading-relaxed space-y-3">
              <div><div className="text-[#FFB800] font-bold mb-1">3a (사이클릭 OP적자) — 최고 비대칭매력 <span className="font-mono text-xs opacity-60">가중치 ×1.0</span></div><p>업황 사이클 하강이 주원인. GP마진 건재 + 사이클 회복 시 '자동 흑전'. 별도 구조조정 불필요. 에코프로·테크윙 등 2차전지/반도체 하강기 기업. GP마진 30%+ · 적자폭 분기별 축소 · 사이클 촉매 명확 시 최고.</p></div>
              <div><div className="text-[#E6A800] font-bold mb-1">3b (구조적 투자초과) — 레버리지 기대 <span className="font-mono text-xs opacity-60">가중치 ×0.8</span></div><p>의도적 R&D·마케팅 투자가 GP 초과. 매출 성장률 &gt; 판관비 증가율이면 영업레버리지 전환점. 3a보다 불확실성이 높지만, 플랫폼 기업의 경우 전환 시 폭발력도 큼.</p></div>
              <div><div className="text-[#FF8C00] font-bold mb-1">2b (메인 미출시) — 고위험 고보상 바이너리 <span className="font-mono text-xs opacity-60">가중치 ×0.7</span></div><p>핵심 파이프라인 성공 시 P&L 구조 자체가 바뀜. 복수 파이프라인(옵셔널리티) · 기존매출로 런웨이 확보 · Phase3/NDA 단계일 때 최고.</p></div>
              <div><div className="text-[#94A3B8] font-bold mb-1">4b (일회성 계속사업적자) — 숨은 흑자 <span className="font-mono text-xs opacity-60">가중치 ×0.5</span></div><p>본업 흑자인데 환차손·소송 등 비반복 비용으로 일시 적자. 비용 소멸 시 즉시 흑전. 시장이 '적자'로 할인하는 동안 매수 기회. 단, 3년 연속 '일회성'이면 4a로 격하.</p></div>
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(DEFICIT_TYPES).filter(([k])=>k!=="흑자").map(([key,val])=>{
              const tc = companies.filter(c=>c.type===key);
              return (<div key={key} className="bg-[#111827] border border-[#1E2636] rounded-lg p-5" style={{borderLeftWidth:3,borderLeftColor:val.color}}>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="text-base font-black" style={{color:val.color}}>{val.label}</span>
                  <VerdictBadge type={key} />
                  {ASYMMETRIC_TYPES.has(key)&&<span className="text-[9px] px-2 py-0.5 rounded-full bg-[#FFB80015] text-[#FFB800] border border-[#FFB80030] font-bold">비대칭매력</span>}
                </div>
                <div className="text-xs text-[#8892A4] leading-relaxed mb-3">{val.desc}</div>
                <div className="text-xs text-[#8892A4] leading-relaxed">
                  {key==="1"&&"매출 자체가 없으므로 사업 모델 검증 불가. 바이오 Pre-revenue, 초기 하드웨어 스타트업 등이 해당. 임상 결과·양산 시작 등 매출 발생 이벤트 이후 재검토."}
                  {key==="2a"&&"메인 제품이 시장에 나와 있고 실제 매출이 발생하는데도 원가를 커버하지 못하는 구조. 팔수록 손해. 근본적 비즈니스 모델 의문."}
                  {key==="2b"&&"매출은 있지만 부수적 수익이며 핵심 파이프라인이 미출시. 메인 프로젝트 출시/승인 시 매출 구조가 근본적으로 전환. 플랫폼 옵셔널리티와 현금 런웨이가 핵심 체크포인트."}
                  {key==="3a"&&"업황·수주 사이클 하강이 적자의 주원인. GP마진은 건재하며 사이클 회복 시 별도 구조조정 없이 '자동 흑전'. 체크: 사이클 위치(바닥 근접?), GP마진 유지 여부, 재고·가동률 추이. 2차전지(에코프로·엘앤에프), 반도체(테크윙·심텍) 등이 전형적. 가장 높은 비대칭매력."}
                  {key==="3b"&&"의도적 R&D·마케팅·인력 투자가 GP를 초과하는 구조. 사이클과 무관하게 회사 자체적으로 비용 통제 또는 매출 스케일업이 필요. 체크: 투자성 비용 vs 유지성 비용, 매출 성장률 > 판관비 증가율 여부, 플랫폼 전환점. 로보티즈(R&D), 카카오게임즈(신작 투자) 등."}
                  {key==="4a"&&"이자비용·지분법손실 등이 반복적으로 OP 흑자를 잠식. 3년 이상 계속되면 구조적 비효율. 차입 구조나 자회사 포트폴리오 자체가 문제이므로 근본적 해결이 어려움."}
                  {key==="4b"&&"환차손·소송비용·일회성 충당금 등 비반복적 비용으로 일시 적자. 본업(OP)은 건전. 비용 소멸 시 즉시 흑전하므로 시장 할인 구간이 매수 기회. 단, 동일 사유가 3년 연속 발생하면 4a로 재분류 필요."}
                  {key==="5"&&"계속사업이익까지 흑자인데 순이익만 적자. 중단사업손실 등 극히 예외적 상황에서만 발생."}
                  {key==="E"&&"손익계산서 전 구간 흑자이나 대규모 설비투자(Capex)로 잉여현금흐름(FCF)이 적자. 성장 Capex vs 유지보수 Capex 구분이 핵심. 투자 사이클 완료 시 현금흐름 폭발적 개선 기대. 코스닥 특성상 해당 기업이 드물지만, 반도체 설비투자기에 발생 가능."}
                </div>
                {tc.length>0&&(<div className="mt-3 pt-3 border-t border-[#1E2636]"><div className="text-[10px] text-[#5A6478] mb-1.5">해당 기업 ({tc.length}개)</div><div className="flex flex-wrap gap-1.5">{tc.map(c=>(<span key={c.name} className="text-[10px] px-2 py-1 rounded font-mono" style={{background:val.bg,color:val.color,border:`1px solid ${val.color}20`}}>{c.name}</span>))}</div></div>)}
              </div>);
            })}
          </div>
        </div>)}
      </div>

      <div className="px-7 py-4 border-t border-[#1E2636] text-center">
        <div className="text-[10px] text-[#3A4458]">늑대무리원정단 · 적자기업 투자분석 모듈 · 모멘텀: {lastUpdate} · ⚡ AI 업데이트로 실시간 갱신 가능 · 투자 판단은 본인 책임</div>
      </div>
    </div>
  );
}
