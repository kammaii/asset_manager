"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { LogIn, AlertCircle, Loader2 } from "lucide-react";

// 인증 상태를 전역으로 관리하기 위한 Context
const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // 허용할 이메일 목록
    // 환경 변수가 없으면 일단 임시로 경고를 띄울 수 있도록 빈 배열 처리하거나 본인 이메일을 여기에 하드코딩할 수 있습니다.
    const ENV_EMAILS = process.env.NEXT_PUBLIC_ALLOWED_EMAILS;
    const ALLOWED_EMAILS = ENV_EMAILS
        ? ENV_EMAILS.split(",").map(e => e.trim().toLowerCase())
        : [];

    useEffect(() => {
        // Firebase 인증 상태 변경 구독
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });

        // 컴포넌트 언마운트 시 구독 해제
        return () => unsubscribe();
    }, []);

    const loginWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Google login error:", error);
            alert("로그인 중 오류가 발생했습니다: " + error.message);
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    // 로딩 중일 때 표시할 화면
    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    // 로그인되지 않은 사용자에게 표시할 화면
    if (!user) {
        return (
            <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-50 p-4">
                <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
                    <div className="mb-6 flex justify-center">
                        <div className="rounded-full bg-blue-100 p-3">
                            <LogIn className="h-8 w-8 text-blue-600" />
                        </div>
                    </div>
                    <h1 className="mb-2 text-2xl font-bold text-gray-900">자산 관리자</h1>
                    <p className="mb-8 text-gray-500">가족 구성원만 접근할 수 있는 보호된 화면입니다.</p>

                    <button
                        onClick={loginWithGoogle}
                        className="flex w-full items-center justify-center gap-3 rounded-xl bg-white border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                            <path d="M1 1h22v22H1z" fill="none" />
                        </svg>
                        Google 계정으로 로그인
                    </button>
                </div>
            </div>
        );
    }

    // 로그인된 경우: 이메일이 허용 목록에 있는지 검사
    // ALLOWED_EMAILS가 비어있는 경우(초기 설정 안 됨) 모든 로그인 통과를 원할 경우를 위해 예외처리 필요. 
    // 여기서는 보안을 위해 리스트가 없으면 일단 차단하고 안내 메시지 출력
    const isAllowed = ALLOWED_EMAILS.length === 0 ? false : ALLOWED_EMAILS.includes(user.email.toLowerCase());

    if (!isAllowed) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50 p-4">
                <div className="flex max-w-md flex-col items-center rounded-2xl bg-white p-8 text-center shadow-xl">
                    <div className="mb-6 rounded-full bg-red-100 p-3">
                        <AlertCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <h1 className="mb-2 text-2xl font-bold text-gray-900">접근 거부됨</h1>
                    <p className="mb-8 text-gray-600 font-medium">
                        현재 계정(<span className="font-bold text-gray-900">{user.email}</span>)은 접근 권한이 없습니다.
                        <br /><br />
                        가족 구성원의 이메일이라면 관리자에게 허용 목록(ALLOWED_EMAILS) 추가를 요청하세요.
                    </p>
                    <button
                        onClick={logout}
                        className="w-full rounded-xl bg-gray-900 px-4 py-3 font-semibold text-white transition hover:bg-gray-800"
                    >
                        로그아웃 후 다른 계정으로 시도
                    </button>
                </div>
            </div>
        );
    }

    // 허용된 사용자면 자식 컴포넌트(본래의 앱 내용)를 렌더링
    return (
        <AuthContext.Provider value={{ user, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

// 다른 컴포넌트에서 인증 정보를 쉽게 가져올 수 있는 사용자 정의 훅
export const useAuth = () => useContext(AuthContext);
