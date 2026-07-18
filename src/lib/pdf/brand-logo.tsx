import { Svg, Path, Circle } from '@react-pdf/renderer'

/**
 * Marque « boucle infinie » i·a·infinity pour les documents PDF.
 * Reproduite à l'identique depuis le site vitrine
 * (src/app/(public)/site/Vitrine.tsx → InfinityMark) pour une cohérence
 * de marque entre le site et les documents générés (devis, factures, contrats).
 *
 * Couleur de marque par défaut : violet #534AB7 (charte i·a·infinity).
 */
const BRAND = '#534AB7'
const INFINITY_PATH =
  'M70 90 C70 48, 130 48, 170 90 C210 132, 270 132, 270 90 C270 48, 210 48, 170 90 C130 132, 70 132, 70 90 Z'

export function BrandLogo({
  height = 24,
  color = BRAND,
}: {
  height?: number
  color?: string
}) {
  // viewBox recadré sur le tracé (le SVG source réserve du vide autour).
  const width = Math.round((232 / 112) * height)
  return (
    <Svg viewBox="52 34 232 112" width={width} height={height}>
      <Path
        d={INFINITY_PATH}
        fill="none"
        stroke={color}
        strokeWidth={16}
        strokeLinecap="round"
      />
      <Circle cx={70} cy={90} r={13} fill={color} />
    </Svg>
  )
}
