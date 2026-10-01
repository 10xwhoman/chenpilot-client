"use client";

import React, { useEffect } from "react";
import { Provider } from "react-redux";
import toast, { Toaster } from "react-hot-toast";
import { store } from "@/store";
import { initializeAuth } from "@/store/slices/authSlice";
import { initializeUI } from "@/store/slices/uiSlice";
import { ThemeProvider } from "./ThemeProvider";
import apiService from "@/services/api";
import { SocketProvider } from "./SocketProvider";
import { TransactionToastListener } from "@/components/TransactionToastListener";
import { ToastOverflowManager } from "@/components/providers/ToastOverflowManager";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    apiService.loadTokenFromStorage();
    // Initialize authentication state from localStorage
    store.dispatch(initializeAuth());
    // Initialize UI state (theme, etc.)
    store.dispatch(initializeUI());
  }, []);

  return (
    <Provider store={store}>
      <ThemeProvider>
        <SocketProvider
          configKey="default"
          config={{
            url: process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001",
            options: {
              transports: ["websocket", "polling"],
              autoConnect: true,
              reconnection: true,
              reconnectionDelay: 1000,
              reconnectionAttempts: 5,
              timeout: 20000,
            },
          }}
          autoConnect={true}
        >
          {children}
          <TransactionToastListener />
          <ToastOverflowManager />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#363636",
                color: "#fff",
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: "#10B981",
                  secondary: "#fff",
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: "#EF4444",
                  secondary: "#fff",
                },
              },
            }}
            containerStyle={{
              top: "calc(env(safe-area-inset-top, 0px) + 4.5rem)",
              right: "max(env(safe-area-inset-right, 0px), 1rem)",
              maxWidth: "min(24rem, calc(100vw - 2rem))",
            }}
          >
            {(item) => (
              <div
                role={item.type === "error" ? "alert" : "status"}
                aria-live={item.type === "error" ? "assertive" : "polite"}
                className="flex max-w-full items-center justify-between gap-3 rounded-lg bg-gray-800 px-4 py-3 text-white shadow-lg"
              >
                <span className="min-w-0 break-words">{item.message}</span>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => toast.dismiss(item.id)}
                  className="shrink-0 rounded px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-white"
                >
                  Dismiss
                </button>
              </div>
            )}
          </Toaster>
        </SocketProvider>
      </ThemeProvider>
    </Provider>
  );
}
