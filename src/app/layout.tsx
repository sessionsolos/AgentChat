import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
