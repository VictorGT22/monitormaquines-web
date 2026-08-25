/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build estatic (HTML/JS/CSS purs) — necessari perque Electron i Capacitor
  // empaqueten aquest mateix directori 'out' sense servidor Node al darrere.
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
