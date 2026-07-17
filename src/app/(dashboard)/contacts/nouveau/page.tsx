import { ContactForm } from '@/components/contacts/contact-form'

export default function NouveauContactPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Nouveau contact</h1>
        <p className="text-gray-500 mt-1">Ajoutez un prospect ou client</p>
      </div>
      <ContactForm />
    </div>
  )
}
