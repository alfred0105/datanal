import "./globals.css";

export const metadata = {
  title: "Radar Analysis",
  description: "실험 데이터 상관관계 분석",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
