/** @type {import('next').NextConfig} */

// En-têtes de sécurité appliqués à toutes les réponses.
// (CSP volontairement non activée ici : elle nécessite une config nonce fine
//  avec Next/recharts/react-pdf et risquerait de casser l'app. À ajouter séparément.)
const securityHeaders = [
  // Force HTTPS pendant 2 ans (Vercel sert déjà en HTTPS)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Empêche l'app d'être embarquée dans une iframe tierce (clickjacking)
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Empêche le navigateur de "deviner" le type MIME
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Limite les informations de référent envoyées aux sites tiers
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Désactive des APIs sensibles non utilisées
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
]

const nextConfig = {
  eslint: {
    // Le typage TypeScript reste vérifié ; on n'échoue pas le build sur les règles de style ESLint.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
