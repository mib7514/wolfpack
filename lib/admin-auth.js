// lib/admin-auth.js
// 공용 관리자 PIN 검증 유틸리티
// 모든 API route에서 import해서 사용

import { NextResponse } from "next/server";

/**
 * API route에서 관리자 PIN을 검증합니다.
 * 
 * 사용법:
 *   import { verifyAdmin } from "@/lib/admin-auth";
 * 
 *   export async function POST(req) {
 *     const authError = verifyAdmin(req);
 *     if (authError) return authError;
 *     // ... 기존 로직 ...
 *   }
 * 
 * @param {Request} req - Next.js request 객체
 * @returns {NextResponse|null} - 인증 실패시 401 응답, 성공시 null
 */
export function verifyAdmin(req) {
  const adminPin = process.env.ADMIN_PIN;
  const userPin = req.headers.get("x-admin-pin");

  if (!adminPin || userPin !== adminPin) {
    return NextResponse.json(
      { error: "관리자 인증이 필요합니다" },
      { status: 401 }
    );
  }

  return null; // 인증 성공
}
