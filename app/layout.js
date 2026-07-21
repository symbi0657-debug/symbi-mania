import "./globals.css";
import { Aurora } from "@/components/holo/Aurora";
import { TopNav } from "@/components/holo/TopNav";
import { BottomNav } from "@/components/holo/BottomNav";
import { Toaster } from "sonner";
import { ReloadGuard } from "@/components/holo/ReloadGuard";

export const metadata = {
  title: "Fresho Mania 3.0",
  description:
    "SYMBI FRESHO Mania 3.0 · 8 Aug 2026 · College fresher party by Black Fox Entertainment. Grab your pass — limited drop.",
  openGraph: {
    title: "Fresho Mania 3.0 ",
    description: "Holographic rave night · 8 Aug 2026 · Passes selling fast.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/fresho-logo.png" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0014",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Space+Grotesk:wght@400;500;600;700&family=Great+Vibes&family=Cormorant+Garamond:ital,wght@1,600&display=swap"
        />
      </head>
      <body>
        <ReloadGuard />
        <Aurora />
        <TopNav />
        <main className="grain min-h-screen pb-24 text-white md:pb-0">
          {children}
        </main>
        <BottomNav />
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: {
              background: "rgba(10,0,20,0.85)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "white",
              backdropFilter: "blur(20px)",
            },
          }}
        />
      </body>
    </html>
  );
}
