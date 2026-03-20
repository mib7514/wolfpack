import { NextResponse } from 'next/server';

export async function POST(request) {
  const pin = request.headers.get('x-admin-pin');
  if (pin !== process.env.ADMIN_PIN) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
