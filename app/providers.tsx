"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { config } from "@/config/wagmi";
import { ThemeProvider } from "./components/ThemeProvider";
import { NetworkThemeSync } from "./components/NetworkThemeSync";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

const rainbowTheme = darkTheme({
  accentColor: "#50fa7b",
  accentColorForeground: "#282a36",
  borderRadius: "large",
  overlayBlur: "small",
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RainbowKitProvider theme={rainbowTheme}>
            <NetworkThemeSync />
            {children}
            <ToastContainer
              position="bottom-center"
              newestOnTop
              closeOnClick
              pauseOnFocusLoss
              pauseOnHover
              draggable
              hideProgressBar
              theme="light"
              className="steadystake-toast-container"
              toastClassName="steadystake-toast"
              closeButton
            />
          </RainbowKitProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
