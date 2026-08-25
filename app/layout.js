import Script from "next/script";
import "./original.css";
import { AuthProvider } from "./lib/auth-context";

export const metadata = {
  title: "MonitorMaquines",
  description: "Nexa Control — monitoratge de màquines",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ca">
      <body>
        {/* Registra <number-flow>, fet servir a les targetes de màquines
            per animar el comptador de peces d'avui — mateix CDN que l'original. */}
        <Script type="module" src="https://cdn.jsdelivr.net/npm/number-flow/+esm" strategy="beforeInteractive" />
        {/* Chart.js global (window.Chart) — gràfics de producció/històric/consums,
            mateix CDN i versió que l'original per no introduir diferències visuals. */}
        <Script src="https://cdn.jsdelivr.net/npm/chart.js@4" strategy="beforeInteractive" />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
