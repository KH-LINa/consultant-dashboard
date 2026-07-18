import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer'
import { BrandLogo } from '@/lib/pdf/brand-logo'

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 9.5, fontFamily: 'Helvetica', color: '#1a1a1a', lineHeight: 1.5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28, borderBottom: '2px solid #534AB7', paddingBottom: 12 },
  logo: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#534AB7' },
  subtitle: { fontSize: 9, color: '#6b7280', marginTop: 3 },
  infoBlock: { textAlign: 'right' },
  infoLabel: { fontSize: 8, color: '#9ca3af' },
  infoValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  docTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 20, marginTop: 8, color: '#111827' },
  body: { marginTop: 8 },
  articleHeader: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 3, color: '#534AB7' },
  paragraph: { marginBottom: 4 },
  footer: {
    position: 'absolute', bottom: 28, left: 48, right: 48,
    borderTop: '1px solid #e5e7eb', paddingTop: 8,
  },
  footerText: { fontSize: 7.5, color: '#9ca3af', textAlign: 'center', marginBottom: 2 },
  pageNumber: { fontSize: 7.5, color: '#d1d5db', textAlign: 'center', marginTop: 2 },
})

interface ContractPDFProps {
  numero: string
  contenu: string
  consultantName: string
  siret: string
  createdAt: string
}

export function ContractPDF({ numero, contenu, consultantName, siret, createdAt }: ContractPDFProps) {
  const dateStr = new Date(createdAt).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  type Segment = { type: 'title' | 'article' | 'blank' | 'text'; text: string }
  const segments: Segment[] = contenu.split('\n').map((line): Segment => {
    const t = line.trim()
    if (!t) return { type: 'blank', text: '' }
    if (t === 'CONTRAT DE PRESTATION DE SERVICES') return { type: 'title', text: t }
    if (/^ARTICLE\s+\d+/.test(t)) return { type: 'article', text: t }
    return { type: 'text', text: t }
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header} fixed>
          <View>
            <BrandLogo height={20} />
            <Text style={[styles.logo, { marginTop: 5 }]}>{consultantName}</Text>
            <Text style={styles.subtitle}>Auto-entrepreneur — Consultant IA Indépendant</Text>
            <Text style={[styles.subtitle, { marginTop: 1 }]}>SIRET : {siret}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Numéro de contrat</Text>
            <Text style={styles.infoValue}>{numero}</Text>
            <Text style={[styles.infoLabel, { marginTop: 6 }]}>Date</Text>
            <Text style={styles.infoValue}>{dateStr}</Text>
          </View>
        </View>

        {/* Corps du contrat */}
        <View style={styles.body}>
          {segments.map((seg, i) => {
            if (seg.type === 'title') return <Text key={i} style={styles.docTitle}>{seg.text}</Text>
            if (seg.type === 'article') return <Text key={i} style={styles.articleHeader}>{seg.text}</Text>
            if (seg.type === 'blank') return <Text key={i} style={{ marginBottom: 4 }}> </Text>
            return <Text key={i} style={styles.paragraph}>{seg.text}</Text>
          })}
        </View>

        {/* Pied de page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {consultantName} — Auto-entrepreneur — SIRET : {siret}
          </Text>
          <Text style={styles.footerText}>
            Dispensé d'immatriculation au RCS et au RM — TVA non applicable, art. 293 B du CGI
          </Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
