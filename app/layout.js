import './globals.css';

export const metadata = {
  title: '늑대무리원정단 — Control Tower',
  description: 'Macro · Credit · Portfolio 통합 모니터링 시스템',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
