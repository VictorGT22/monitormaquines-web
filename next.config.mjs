/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build estatic (HTML/JS/CSS purs) — necessari perque Electron i Capacitor
  // empaqueten aquest mateix directori 'out' sense servidor Node al darrere.
  output: 'export',
  // Els hostings estàtics (Render, Electron amb servidor local i Capacitor)
  // serveixen de forma fiable /login/ -> login/index.html. Sense barra final
  // el build generava login.html i Render responia 404 a /login.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
