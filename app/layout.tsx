import type { Metadata } from "next";
import "./globals.css";
import { AssistantHost } from "@/components/AssistantHost";
import { CommandPalette } from "@/components/CommandPalette";
import { Footer, Header } from "@/components/Shell";
import { ToastHost } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Wayfinder — personalized learning paths",
  description:
    "Describe your goal in plain language and get a sequenced learning path with prerequisites, milestones, projects and an explanation for every recommendation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastHost>
          <AssistantHost>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
            <CommandPalette />
          </AssistantHost>
        </ToastHost>
      </body>
    </html>
  );
}
