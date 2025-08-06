import "./globals.css";
import type { Metadata } from "next";
import Provider from "@/app/_trpc/Provider";
export const metadata: Metadata = {
  title: "ChatGPT Clone",
  description: "A ChatGPT-like interface built with Next.js and Bootstrap"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
