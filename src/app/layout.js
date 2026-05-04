import './globals.css';

export const metadata = {
  title: 'Neural Pathfinder',
  description: 'A premium, interactive Pathfinding AI Game + Visualizer',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
