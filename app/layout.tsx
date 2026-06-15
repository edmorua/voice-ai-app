import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sofia – Asistente de voz inteligente",
  description: "Habla y obtén respuestas inteligentes con síntesis de voz personalizada",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geist.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
