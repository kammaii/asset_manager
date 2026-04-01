"use client";

import { createContext, useContext, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import useAssetStore from "@/store/useAssetStore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const initAuth = useAssetStore((s) => s.initAuth);

    // 앱 시작 시 onAuthStateChanged 리스너 등록 → 세션 복원 및 store 동기화
    useEffect(() => {
        initAuth();
    }, [initAuth]);

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (e) {
            console.error("Logout error:", e);
        }
    };

    return (
        <AuthContext.Provider value={{ logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
