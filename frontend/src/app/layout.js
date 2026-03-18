import "./globals.css";

export const metadata = {
  title: "Molding — Canvas to 3D Mold & G-code",
  description: "Convert 2D drawings, images, and SVGs into 3D mold geometries and machine-ready G-code for FDM printing and laser engraving.",
  keywords: ["3D modeling", "mold", "G-code", "STL", "CNC", "laser engraving", "FDM", "heightmap"],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔧</text></svg>" />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
