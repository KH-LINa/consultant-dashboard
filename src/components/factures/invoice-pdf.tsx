import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { Invoice, Contact } from '@/lib/types'
import { OFFER_LABELS } from '@/lib/types'

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  logo: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1d4ed8' },
  subtitle: { fontSize: 10, color: '#6b7280', marginTop: 4 },
  infoBlock: { textAlign: 'right' },
  infoLabel: { fontSize: 9, color: '#9ca3af' },
  infoValue: { fontSize: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#111827' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 8, color: '#374151' },
  twoCol: { flexDirection: 'row', gap: 16 },
  infoBox: { flex: 1, backgroundColor: '#f9fafb', padding: 12, borderRadius: 4 },
  infoBoxLabel: { fontSize: 9, color: '#9ca3af', marginBottom: 4, fontFamily: 'Helvetica-Bold' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#1d4ed8', padding: '7 8', borderRadius: 3, marginBottom: 2 },
  tableRow: { flexDirection: 'row', padding: '6 8', borderBottom: '1px solid #f3f4f6' },
  tableAlt: { flexDirection: 'row', padding: '6 8', backgroundColor: '#f9fafb', borderBottom: '1px solid #f3f4f6' },
  col6: { flex: 6 },
  col2: { flex: 2, textAlign: 'center' },
  col2r: { flex: 2, textAlign: 'right' },
  thText: { fontSize: 9, color: '#ffffff', fontFamily: 'Helvetica-Bold' },
  totalSection: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  totalBox: { minWidth: 220 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalRowFinal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTop: '2px solid #1d4ed8', marginTop: 4 },
  tvaNote: { fontSize: 8, color: '#9ca3af', marginTop: 8, textAlign: 'right' },
  footer: { position: 'absolute', bottom: 32, left: 48, right: 48, borderTop: '1px solid #e5e7eb', paddingTop: 12 },
  footerText: { fontSize: 8, color: '#9ca3af', textAlign: 'center', marginBottom: 2 },
  mentionsBox: { marginTop: 24, padding: 12, backgroundColor: '#eff6ff', borderRadius: 4 },
  mentionsText: { fontSize: 8, color: '#1e40af', lineHeight: 1.5 },
})

const statusColors: Record<string, { bg: string; text: string }> = {
  brouillon: { bg: '#f3f4f6', text: '#6b7280' },
  'envoyée': { bg: '#dbeafe', text: '#1d4ed8' },
  'payée': { bg: '#dcfce7', text: '#15803d' },
  'annulée': { bg: '#fee2e2', text: '#dc2626' },
}

const offreLabel: Record<string, string> = OFFER_LABELS

interface InvoicePDFProps {
  invoice: Invoice
  contact: Contact
  consultantName: string
  siret: string
  email?: string
  telephone?: string
}

export function InvoicePDF({ invoice, contact, consultantName, siret, email, telephone }: InvoicePDFProps) {
  const emissionStr = new Date(invoice.date_emission).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const echeanceStr = invoice.date_echeance
    ? new Date(invoice.date_echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null
  const statusColor = statusColors[invoice.statut] ?? statusColors['brouillon']

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>{consultantName}</Text>
            <Text style={styles.subtitle}>Consultant IA Indépendant — Auto-entrepreneur</Text>
            <Text style={[styles.subtitle, { marginTop: 2 }]}>SIRET : {siret}</Text>
            {email && <Text style={[styles.subtitle, { marginTop: 2 }]}>{email}</Text>}
            {telephone && <Text style={[styles.subtitle, { marginTop: 1 }]}>{telephone}</Text>}
          </View>
          <View style={styles.infoBlock}>
            <Text style={[styles.infoValue, { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#1d4ed8' }]}>FACTURE</Text>
            <Text style={[styles.infoValue, { fontFamily: 'Helvetica-Bold', marginTop: 4 }]}>{invoice.numero}</Text>
            <Text style={[styles.infoLabel, { marginTop: 8 }]}>Date d'émission</Text>
            <Text style={styles.infoValue}>{emissionStr}</Text>
            {echeanceStr && (
              <>
                <Text style={[styles.infoLabel, { marginTop: 6 }]}>Date d'échéance</Text>
                <Text style={[styles.infoValue, { color: '#dc2626', fontFamily: 'Helvetica-Bold' }]}>{echeanceStr}</Text>
              </>
            )}
          </View>
        </View>

        {/* Titre + statut */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{invoice.titre}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={{ color: statusColor.text }}>{invoice.statut.toUpperCase()}</Text>
          </View>
        </View>

        {/* Émetteur / Client */}
        <View style={[styles.twoCol, { marginBottom: 24 }]}>
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxLabel}>ÉMETTEUR</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>{consultantName}</Text>
            <Text style={{ color: '#6b7280' }}>Auto-entrepreneur</Text>
            <Text style={{ color: '#6b7280' }}>SIRET : {siret}</Text>
            {email && <Text style={{ color: '#6b7280' }}>{email}</Text>}
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxLabel}>FACTURÉ À</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>{contact.nom}</Text>
            {contact.entreprise && <Text>{contact.entreprise}</Text>}
            {contact.email && <Text style={{ color: '#6b7280' }}>{contact.email}</Text>}
            {contact.telephone && <Text style={{ color: '#6b7280' }}>{contact.telephone}</Text>}
          </View>
        </View>

        {/* Offre */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 9, color: '#6b7280' }}>
            Prestation : <Text style={{ fontFamily: 'Helvetica-Bold', color: '#1d4ed8' }}>{offreLabel[invoice.offre] ?? invoice.offre}</Text>
          </Text>
        </View>

        {/* Tableau des prestations */}
        <View style={styles.tableHeader}>
          <Text style={[styles.col6, styles.thText]}>Description</Text>
          <Text style={[styles.col2, styles.thText]}>Qté</Text>
          <Text style={[styles.col2r, styles.thText]}>PU HT</Text>
          <Text style={[styles.col2r, styles.thText]}>Total HT</Text>
        </View>
        {invoice.lignes?.map((l, idx) => (
          <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableAlt}>
            <Text style={styles.col6}>{l.description}</Text>
            <Text style={styles.col2}>{l.quantite}</Text>
            <Text style={styles.col2r}>
              {l.prix_unitaire.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </Text>
            <Text style={[styles.col2r, { fontFamily: 'Helvetica-Bold' }]}>
              {(l.quantite * l.prix_unitaire).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </Text>
          </View>
        ))}

        {/* Totaux */}
        <View style={styles.totalSection}>
          <View style={styles.totalBox}>
            <View style={styles.totalRow}>
              <Text style={{ color: '#6b7280' }}>Total HT</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                {invoice.montant_ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={{ color: '#6b7280' }}>TVA</Text>
              <Text style={{ color: '#6b7280' }}>Non applicable</Text>
            </View>
            <View style={styles.totalRowFinal}>
              <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold' }}>TOTAL TTC</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1d4ed8' }}>
                {invoice.montant_ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
              </Text>
            </View>
            <Text style={styles.tvaNote}>TVA non applicable — art. 293 B du CGI</Text>
          </View>
        </View>

        {/* Mentions légales */}
        <View style={styles.mentionsBox}>
          <Text style={styles.mentionsText}>
            Conditions de règlement : {echeanceStr ? `paiement dû le ${echeanceStr}` : 'paiement à réception'}. En cas de retard de paiement, des pénalités de retard au taux légal en vigueur seront appliquées, ainsi qu'une indemnité forfaitaire de recouvrement de 40 €.{'\n'}
            Dispensé d'immatriculation au RCS et au RM. TVA non applicable en vertu de l'article 293 B du Code Général des Impôts.
          </Text>
        </View>

        {/* Pied de page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {consultantName} — Auto-entrepreneur — SIRET : {siret} — TVA non applicable (art. 293 B CGI)
          </Text>
          <Text style={[styles.footerText, { color: '#d1d5db' }]}>
            {invoice.numero} — Émise le {emissionStr}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
