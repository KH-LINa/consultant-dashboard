import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer'
import type { Quote, Contact } from '@/lib/types'
import { OFFER_LABELS } from '@/lib/types'
import { BrandLogo } from '@/lib/pdf/brand-logo'

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  logo: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#534AB7' },
  subtitle: { fontSize: 10, color: '#6b7280', marginTop: 4 },
  infoBlock: { textAlign: 'right' },
  infoLabel: { fontSize: 9, color: '#9ca3af' },
  infoValue: { fontSize: 10 },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  badge: {
    backgroundColor: '#EEEBFA', color: '#534AB7', fontSize: 9,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start',
  },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 8, color: '#374151' },
  contactBox: {
    backgroundColor: '#f9fafb', padding: 12, borderRadius: 4,
    borderLeft: '3px solid #534AB7',
  },
  tableHeader: {
    flexDirection: 'row', backgroundColor: '#f3f4f6',
    padding: '6 8', borderRadius: 3, marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row', padding: '6 8',
    borderBottom: '1px solid #f3f4f6',
  },
  col6: { flex: 6 },
  col2: { flex: 2, textAlign: 'center' },
  col2r: { flex: 2, textAlign: 'right' },
  col2total: { flex: 2, textAlign: 'right' },
  tableHeaderText: { fontSize: 9, color: '#6b7280', fontFamily: 'Helvetica-Bold' },
  totalBox: {
    flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12,
  },
  totalInner: {
    backgroundColor: '#EEEBFA', padding: 12, borderRadius: 4, minWidth: 200,
  },
  totalLabel: { fontSize: 9, color: '#6b7280' },
  totalAmount: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#534AB7', marginTop: 2 },
  tvaNote: { fontSize: 8, color: '#9ca3af', marginTop: 4 },
  footer: {
    position: 'absolute', bottom: 32, left: 48, right: 48,
    borderTop: '1px solid #e5e7eb', paddingTop: 12,
  },
  footerText: { fontSize: 8, color: '#9ca3af', textAlign: 'center', marginBottom: 2 },
})

const offreLabel: Record<string, string> = OFFER_LABELS

interface QuotePDFProps {
  quote: Quote
  contact: Contact
  consultantName: string
  siret: string
}

export function QuotePDF({ quote, contact, consultantName, siret }: QuotePDFProps) {
  const dateStr = new Date(quote.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const quoteNumber = `DEV-${new Date(quote.created_at).getFullYear()}-${quote.id.slice(0, 6).toUpperCase()}`

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <View>
            <BrandLogo />
            <Text style={[styles.logo, { marginTop: 6 }]}>{consultantName}</Text>
            <Text style={styles.subtitle}>Consultant IA Indépendant</Text>
            <Text style={[styles.subtitle, { marginTop: 2 }]}>SIRET : {siret}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Numéro de devis</Text>
            <Text style={[styles.infoValue, { fontFamily: 'Helvetica-Bold' }]}>{quoteNumber}</Text>
            <Text style={[styles.infoLabel, { marginTop: 8 }]}>Date</Text>
            <Text style={styles.infoValue}>{dateStr}</Text>
          </View>
        </View>

        {/* Titre et offre */}
        <Text style={styles.title}>{quote.titre}</Text>
        <View style={styles.badge}>
          <Text>{offreLabel[quote.offre] ?? quote.offre}</Text>
        </View>

        {/* Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client</Text>
          <View style={styles.contactBox}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>{contact.nom}</Text>
            {contact.entreprise && <Text>{contact.entreprise}</Text>}
            {contact.email && <Text style={{ color: '#6b7280' }}>{contact.email}</Text>}
            {contact.telephone && <Text style={{ color: '#6b7280' }}>{contact.telephone}</Text>}
          </View>
        </View>

        {/* Lignes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prestations</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.col6, styles.tableHeaderText]}>Description</Text>
            <Text style={[styles.col2, styles.tableHeaderText]}>Qté</Text>
            <Text style={[styles.col2r, styles.tableHeaderText]}>Prix unit. HT</Text>
            <Text style={[styles.col2total, styles.tableHeaderText]}>Total HT</Text>
          </View>
          {quote.lignes?.map((ligne, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={styles.col6}>{ligne.description}</Text>
              <Text style={styles.col2}>{ligne.quantite}</Text>
              <Text style={styles.col2r}>
                {ligne.prix_unitaire.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </Text>
              <Text style={[styles.col2total, { fontFamily: 'Helvetica-Bold' }]}>
                {(ligne.quantite * ligne.prix_unitaire).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.totalBox}>
          <View style={styles.totalInner}>
            <Text style={styles.totalLabel}>Montant total HT</Text>
            <Text style={styles.totalAmount}>
              {quote.montant_ht.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </Text>
            <Text style={styles.tvaNote}>TVA non applicable — art. 293 B du CGI</Text>
          </View>
        </View>

        {/* Pied de page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {consultantName} — Auto-entrepreneur — SIRET : {siret}
          </Text>
          <Text style={styles.footerText}>
            TVA non applicable en vertu de l'article 293 B du Code Général des Impôts
          </Text>
          <Text style={[styles.footerText, { color: '#d1d5db' }]}>
            {quoteNumber} — Devis valable 30 jours à compter du {dateStr}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
