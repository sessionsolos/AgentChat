import type { Metadata } from "next";
import "./globals.css";
import { Disclaimer } from "@/components/Disclaimer";

export const metadata: Metadata = {
  title: "Scholarship Finder",
  description:
    "Find scholarships and financial aid matched to your profile — U.S. high school students.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#f8f7f4]">
        {/* Site header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              {/* Logo mark */}
              <div className="w-7 h-7 rounded-md bg-blue-700 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-4 h-4 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                </svg>
              </div>
              <span className="font-bold text-gray-900 text-base tracking-tight">
                ScholarshipFinder
              </span>
            </div>
            <span className="text-xs text-gray-400 hidden sm:block">
              For U.S. high school students
            </span>
          </div>
        </header>

        {/* Global disclaimer — always visible below header */}
        <Disclaimer />

        {/* Page content */}
        <main>{children}</main>

        {/* Footer */}
        <footer className="mt-16 border-t border-gray-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 text-center space-y-2">
            <p className="text-xs text-gray-500">
              <strong>Informational only</strong> — eligibility and award
              details change; always verify with the school or scholarship
              provider before relying on this.
            </p>
            <p className="text-xs text-gray-400">
              ScholarshipFinder is not affiliated with any scholarship provider.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
