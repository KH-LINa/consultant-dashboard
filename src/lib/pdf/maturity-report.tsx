import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer'
import { LEVIERS, NIVEAU_CONFIG } from '@/lib/maturite'
import { PALIER_PUBLIC, EXPLICATION_LEVIER, PISTE_LEVIER, STATS_SOURCEES, type LevierChamp } from '@/lib/maturite-test'
import type { NiveauMaturite, Recommandation } from '@/lib/types'
import { BrandLogo } from '@/lib/pdf/brand-logo'

const BADGE_COLORS: Record<NiveauMaturite, { bg: string; text: string }> = {
  sait_faire: { bg: '#dcfce7', text: '#15803d' },
  partiel: { bg: '#fef3c7', text: '#92400e' },
  ignore: { bg: '#f3f4f6', text: '#4b5563' },
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  logo: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#534AB7', marginTop: 6 },
  subtitle: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  infoBlock: { textAlign: 'right' },
  infoLabel: { fontSize: 8, color: '#9ca3af' },
  infoValue: { fontSize: 10 },
  eyebrow: { fontSize: 9, color: '#534AB7', fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 6 },
  lead: { fontSize: 10.5, color: '#4b5563', lineHeight: 1.4, marginBottom: 16 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
  scoreTrack: { flex: 1, height: 8, backgroundColor: '#e5e7eb', borderRadius: 4 },
  scoreFill: { height: 8, backgroundColor: '#534AB7', borderRadius: 4 },
  scoreLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#534AB7', minWidth: 60, textAlign: 'right' },
  scoreCaption: { fontSize: 8, color: '#9ca3af', marginTop: -14, marginBottom: 18 },
  card: {
    border: '1px solid #e5e7eb', borderRadius: 4, padding: 12, marginBottom: 10,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  cardTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  badge: { fontSize: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cardText: { fontSize: 9.5, color: '#4b5563', lineHeight: 1.4 },
  pisteBox: { marginTop: 6, paddingTop: 6, borderTop: '1px solid #f3f4f6' },
  pisteLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#534AB7', marginBottom: 2 },
  statsSection: { marginTop: 8, marginBottom: 20 },
  statsTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 6 },
  statRow: { flexDirection: 'row', marginBottom: 4 },
  statText: { fontSize: 9, color: '#4b5563', flex: 1 },
  statSource: { fontSize: 8, color: '#9ca3af', marginLeft: 6 },
  disclaimer: { fontSize: 8, color: '#9ca3af', marginTop: 4, lineHeight: 1.4 },
  footer: {
    position: 'absolute', bottom: 32, left: 48, right: 48,
    borderTop: '1px solid #e5e7eb', paddingTop: 12,
  },
  footerText: { fontSize: 8, color: '#9ca3af', textAlign: 'center', marginBottom: 2 },
})

interface MaturityReportPDFProps {
  nom: string
  entreprise: string
  niveaux: Record<LevierChamp, NiveauMaturite>
  score: number
  recommandation: Recommandation
  consultantName: string
  email: string
  telephone: string
}

export function MaturityReportPDF({
  nom, entreprise, niveaux, score, recommandation, consultantName, email, telephone,
}: MaturityReportPDFProps) {
  const palier = PALIER_PUBLIC[recommandation]
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <BrandLogo />
            <Text style={styles.logo}>{consultantName}</Text>
            <Text style={styles.subtitle}>Rapport de test de maturité IA</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Réalisé par</Text>
            <Text style={[styles.infoValue, { fontFamily: 'Helvetica-Bold' }]}>{nom}</Text>
            {entreprise && <Text style={styles.infoValue}>{entreprise}</Text>}
            <Text style={[styles.infoLabel, { marginTop: 6 }]}>Date</Text>
            <Text style={styles.infoValue}>{dateStr}</Text>
          </View>
        </View>

        <Text style={styles.eyebrow}>VOTRE RÉSULTAT</Text>
        <Text style={styles.title}>{palier.titre}</Text>
        <Text style={styles.lead}>{palier.texte}</Text>

        <View style={styles.scoreRow}>
          <View style={styles.scoreTrack}>
            <View style={[styles.scoreFill, { width: `${Math.max(4, score)}%` }]} />
          </View>
          <Text style={styles.scoreLabel}>{score} / 100</Text>
        </View>
        <Text style={styles.scoreCaption}>
          Score indicatif — un repère de synthèse, pas une notation à visée punitive.
        </Text>

        {LEVIERS.map(({ champ, label }) => {
          const niveau = niveaux[champ]
          const colors = BADGE_COLORS[niveau]
          const piste = PISTE_LEVIER[champ][niveau]
          return (
            <View style={styles.card} key={champ} wrap={false}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{label}</Text>
                <Text style={[styles.badge, { backgroundColor: colors.bg, color: colors.text }]}>
                  {NIVEAU_CONFIG[niveau].label}
                </Text>
              </View>
              <Text style={styles.cardText}>{EXPLICATION_LEVIER[champ][niveau]}</Text>
              {piste && (
                <View style={styles.pisteBox}>
                  <Text style={styles.pisteLabel}>PISTE À EXPLORER</Text>
                  <Text style={styles.cardText}>{piste}</Text>
                </View>
              )}
            </View>
          )
        })}

        <View style={styles.statsSection} wrap={false}>
          <Text style={styles.statsTitle}>Pour contexte — la réalité des projets IA industriels</Text>
          {STATS_SOURCEES.map((s, i) => (
            <View style={styles.statRow} key={i}>
              <Text style={styles.statText}>{s.texte}</Text>
              <Text style={styles.statSource}>({s.source})</Text>
            </View>
          ))}
          <Text style={styles.disclaimer}>
            Ce rapport est une auto-évaluation réalisée en ligne, indicative — il ne remplace pas un
            audit mené sur le terrain, mais permet de repérer où porter votre attention en premier.
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {consultantName}
            {email ? ` — ${email}` : ''}
            {telephone ? ` — ${telephone}` : ''}
          </Text>
          <Text style={[styles.footerText, { color: '#d1d5db' }]}>
            Rapport généré le {dateStr} — Yndra, conseil Lean &amp; IA industrielle
          </Text>
        </View>
      </Page>
    </Document>
  )
}
