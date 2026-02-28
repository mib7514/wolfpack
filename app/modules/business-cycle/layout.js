import Link from 'next/link';

export default function ModuleLayout({ children }) {
  return (
    <div className="min-h-screen">
      {/* Module Header */}
      <header className="border-b border-white/5 bg-gradient-to-b from-[#111827] to-transparent sticky top-0 z-50 backdrop-blur-xl bg-opacity-80">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/"
            className="text-xs text-gray-500 hover:text-gray-300 transition flex items-center gap-1.5 no-underline"
          >
            <span>🐺</span>
            <span>Control Tower</span>
          </Link>
          <span className="text-gray-700">›</span>
          <span className="text-xs text-gray-400 font-medium">경기순환 체크리스트</span>
        </div>
      </header>
      {children}
    </div>
  );
}
