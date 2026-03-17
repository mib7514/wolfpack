// lib/useAdminPin.js
// 공용 관리자 PIN 인증 React Hook
// 각 모듈의 page.js에서 import해서 사용
//
// 사용법:
//   import { useAdminPin, AdminPinModal, AdminLockButton } from "@/lib/useAdminPin";
//
//   export default function MyModule() {
//     const admin = useAdminPin("my-module");
//     
//     const handleUpdate = async () => {
//       if (!admin.isAdmin) { admin.openModal(); return; }
//       const res = await fetch("/api/my-api", {
//         method: "POST",
//         headers: { "Content-Type": "application/json", "x-admin-pin": admin.pin },
//         body: JSON.stringify({ ... }),
//       });
//       if (res.status === 401) { admin.handleAuthExpired(); return; }
//       // ...
//     };
//
//     return (
//       <>
//         <AdminLockButton admin={admin} />
//         <button onClick={handleUpdate} disabled={!admin.isAdmin}>업데이트</button>
//         <AdminPinModal admin={admin} verifyUrl="/api/my-api" />
//       </>
//     );
//   }

"use client";

import { useState, useEffect, useCallback } from "react";

export function useAdminPin(moduleKey) {
  const storageKey = `wolfpack_admin_${moduleKey}`;
  const [pin, setPin] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      setPin(saved);
      setIsAdmin(true);
    }
  }, [storageKey]);

  const openModal = useCallback(() => {
    setPinError("");
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setPinError("");
  }, []);

  const logout = useCallback(() => {
    setIsAdmin(false);
    setPin("");
    sessionStorage.removeItem(storageKey);
  }, [storageKey]);

  const handleAuthExpired = useCallback(() => {
    setIsAdmin(false);
    setPin("");
    sessionStorage.removeItem(storageKey);
    alert("인증이 만료되었습니다. 다시 PIN을 입력해주세요.");
    setShowModal(true);
  }, [storageKey]);

  const verify = useCallback(
    async (inputPin, verifyUrl) => {
      try {
        const res = await fetch(verifyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-pin": inputPin,
          },
          body: JSON.stringify({ __pin_check: true }),
        });
        if (res.status === 401) {
          setPinError("PIN이 일치하지 않습니다");
          return false;
        }
        setPin(inputPin);
        setIsAdmin(true);
        sessionStorage.setItem(storageKey, inputPin);
        setShowModal(false);
        setPinError("");
        return true;
      } catch {
        setPinError("서버 연결 오류");
        return false;
      }
    },
    [storageKey]
  );

  return {
    pin,
    setPin,
    isAdmin,
    showModal,
    pinError,
    openModal,
    closeModal,
    logout,
    verify,
    handleAuthExpired,
  };
}

// ─── 🔒 잠금 버튼 컴포넌트 ───
export function AdminLockButton({ admin }) {
  if (admin.isAdmin) {
    return (
      <button
        onClick={admin.logout}
        className="px-3 py-2 rounded-lg border border-[#22c55e50] text-sm text-[#22c55e] bg-[#22c55e10] hover:bg-[#22c55e20] transition"
        title="관리자 잠금 해제됨 (클릭하면 잠금)"
      >
        🔓
      </button>
    );
  }
  return (
    <button
      onClick={admin.openModal}
      className="px-3 py-2 rounded-lg border border-[#5A647850] text-sm text-[#5A6478] bg-[#5A647810] hover:bg-[#5A647820] transition"
      title="관리자 잠금 (클릭하여 PIN 입력)"
    >
      🔒
    </button>
  );
}

// ─── PIN 입력 모달 컴포넌트 ───
export function AdminPinModal({ admin, verifyUrl }) {
  const [inputPin, setInputPin] = useState("");

  if (!admin.showModal) return null;

  const handleSubmit = async () => {
    await admin.verify(inputPin, verifyUrl);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={admin.closeModal}
    >
      <div
        className="bg-[#1a1f2e] border border-[#2a3040] rounded-2xl p-6 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-bold text-base mb-1">🔐 관리자 인증</h3>
        <p className="text-gray-400 text-xs mb-4">
          업데이트 기능은 관리자만 사용할 수 있습니다
        </p>
        <input
          type="password"
          placeholder="PIN 입력"
          value={inputPin}
          onChange={(e) => setInputPin(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="w-full px-4 py-3 bg-[#0d1117] border border-[#2a3040] rounded-lg text-white text-center text-lg tracking-[0.3em] mb-3 outline-none focus:border-[#4EA8FF]"
          autoFocus
        />
        {admin.pinError && (
          <p className="text-red-400 text-xs text-center mb-3">
            {admin.pinError}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={admin.closeModal}
            className="flex-1 py-2.5 rounded-lg border border-[#2a3040] text-gray-400 text-sm hover:bg-[#151a27] transition"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-lg bg-[#4EA8FF] text-white text-sm font-bold hover:bg-[#3d8ee0] transition"
          >
            인증
          </button>
        </div>
      </div>
    </div>
  );
}
