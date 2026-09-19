import { useMemo, useRef, useState } from 'react'
import { useLocalStorage } from './hooks/useLocalStorage.js'
import { computeTotals, makeEmptyItem } from './utils/calc.js'
import { downloadInvoicePdf } from './utils/pdf.js'
import { exportStorageToJson, importStorageFromFile } from './utils/backup.js'

import Toolbar from './components/Toolbar.jsx'
import InvoiceMeta from './components/InvoiceMeta.jsx'
import BillerCard from './components/BillerCard.jsx'
import ClientCard from './components/ClientCard.jsx'
import ItemsTable from './components/ItemsTable.jsx'
import Totals from './components/Totals.jsx'
import BankDetails from './components/BankDetails.jsx'
import SignatureUpload from './components/SignatureUpload.jsx'
import EmailModal from './components/EmailModal.jsx'
import AddressBookModal from './components/AddressBookModal.jsx'

const emptyClient = { name: '', address: '', email: '', phone: '' }
const emptyBank = { holder: '', bankName: '', bankAddress: '', accountNumber: '', swift: '' }

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

// Seeded draft: PMC B2B WordPress hours, Sept 15-18 2026. Rates left blank to fill in.
const draftItemsSeed = [
  { description: 'Sept 15–16 (2:00 PM–1:00 AM) — Initial dev', qty: 11 },
  { description: 'Sept 16 (9:00–9:30 AM) — Meeting', qty: 0.5 },
  { description: 'Sept 16 (9:30 AM–4:00 PM) — Polishes', qty: 6.5 },
  { description: 'Sept 16 (4:00–4:30 PM) — Meeting', qty: 0.5 },
  { description: 'Sept 16 (4:30–6:00 PM) — Last polishes', qty: 1.5 },
  { description: 'Sept 16 (8:00–10:00 PM) — Troubleshoot staging env access', qty: 2 },
  { description: 'Sept 17 (9:00 AM–12:00 PM) — Deployment and troubleshooting', qty: 3 },
  { description: 'Sept 17 (4:00–4:30 PM) — Meeting with Nate and Shin', qty: 0.5 },
  { description: "Sept 17 (4:30–5:30 PM) — Polishes from Nate's feedback", qty: 1 },
  { description: 'Sept 18 (8:30–10:00 AM) — Production deployment', qty: 1.5 },
  { description: 'Sept 18 (11:00 AM–12:00 PM) — Troubleshooting and finalization with JP', qty: 1 },
].map((entry) => ({ id: crypto.randomUUID(), unit: 'per hour', rate: '', ...entry }))

const DRAFT_KEY = 'invoiser_draft_invoice'

function readSavedDraft() {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function App() {
  const sheetRef = useRef(null)
  const [initialDraft] = useState(readSavedDraft)
  const [draftStatus, setDraftStatus] = useState('')

  // ---- Persisted defaults / lists (survive across invoices) ----
  const [billerDefault, setBillerDefault] = useLocalStorage('invoiser_biller_default', {
    name: '', address: '', email: '', phone: '',
  })
  const [bankDefault, setBankDefault] = useLocalStorage('invoiser_bank_default', emptyBank)
  const [signatureDefault, setSignatureDefault] = useLocalStorage('invoiser_signature_default', null)
  const [clients, setClients] = useLocalStorage('invoiser_clients', [])
  const [addressBook, setAddressBook] = useLocalStorage('invoiser_address_book', [])
  const [invoiceCounter, setInvoiceCounter] = useLocalStorage('invoiser_invoice_counter', 1)

  // ---- Current invoice state (restored from a saved draft, if any) ----
  const [biller, setBiller] = useState(initialDraft?.biller ?? billerDefault)
  const [client, setClient] = useState(initialDraft?.client ?? emptyClient)
  const [meta, setMeta] = useState(
    initialDraft?.meta ?? {
      invoiceNumber: `INV-${String(invoiceCounter).padStart(4, '0')}`,
      invoiceDate: todayIso(),
      dueDate: '',
      currency: 'PHP',
    },
  )
  const [items, setItems] = useState(initialDraft?.items ?? draftItemsSeed)
  const [taxPercent, setTaxPercent] = useState(initialDraft?.taxPercent ?? 0)
  const [discountAmount, setDiscountAmount] = useState(initialDraft?.discountAmount ?? 0)
  const [capAmount, setCapAmount] = useState(initialDraft?.capAmount ?? '')
  const [notes, setNotes] = useState(initialDraft?.notes ?? 'Payment due within 7 days of invoice date.')
  const [bank, setBank] = useState(initialDraft?.bank ?? bankDefault)
  const [signature, setSignature] = useState(initialDraft?.signature ?? signatureDefault)

  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [addressBookOpen, setAddressBookOpen] = useState(false)

  const totals = useMemo(
    () => computeTotals(items, taxPercent, discountAmount, capAmount),
    [items, taxPercent, discountAmount, capAmount],
  )

  // ---- Actions ----
  const handleNewInvoice = () => {
    const nextCount = invoiceCounter + 1
    setInvoiceCounter(nextCount)
    setBiller(billerDefault)
    setClient(emptyClient)
    setMeta({
      invoiceNumber: `INV-${String(nextCount).padStart(4, '0')}`,
      invoiceDate: todayIso(),
      dueDate: '',
      currency: meta.currency,
    })
    setItems([makeEmptyItem()])
    setTaxPercent(0)
    setDiscountAmount(0)
    setCapAmount('')
    setNotes('Payment due within 7 days of invoice date.')
    setBank(bankDefault)
    setSignature(signatureDefault)
    try {
      window.localStorage.removeItem(DRAFT_KEY)
    } catch {
      // ignore
    }
  }

  const handleSaveDraft = () => {
    const draft = { biller, client, meta, items, taxPercent, discountAmount, capAmount, notes, bank, signature }
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      setDraftStatus('Draft saved')
    } catch {
      setDraftStatus('Could not save draft')
    }
    setTimeout(() => setDraftStatus(''), 2000)
  }

  const handleImportFile = async (file) => {
    try {
      await importStorageFromFile(file)
      window.location.reload()
    } catch {
      setDraftStatus('Import failed — invalid file')
      setTimeout(() => setDraftStatus(''), 2000)
    }
  }

  const handleLoadClient = (savedClient) => {
    setClient({
      name: savedClient.name || '',
      address: savedClient.address || '',
      email: savedClient.email || '',
      phone: savedClient.phone || '',
    })
  }

  const handleSaveClient = () => {
    if (!client.name.trim()) return
    setClients((prev) => {
      const existing = prev.find((c) => c.name === client.name)
      if (existing) {
        return prev.map((c) => (c.id === existing.id ? { ...existing, ...client } : c))
      }
      return [...prev, { id: crypto.randomUUID(), ...client }]
    })
  }

  const handlePrint = () => window.print()

  const handleDownloadPdf = () => {
    downloadInvoicePdf(sheetRef.current, `${meta.invoiceNumber || 'invoice'}.pdf`)
  }

  const handleSendEmail = ({ to, cc, bcc, subject, body }) => {
    // Kick off the PDF download first so it's ready for the user to attach,
    // then hand off to their default mail client with everything prefilled.
    downloadInvoicePdf(sheetRef.current, `${meta.invoiceNumber || 'invoice'}.pdf`).finally(() => {
      const params = new URLSearchParams()
      if (cc) params.set('cc', cc)
      if (bcc) params.set('bcc', bcc)
      if (subject) params.set('subject', subject)
      if (body) params.set('body', body)
      const mailto = `mailto:${encodeURIComponent(to)}?${params.toString()}`
      window.location.href = mailto
      setEmailModalOpen(false)
    })
  }

  const handleAddAddress = (entry) => setAddressBook((prev) => [...prev, entry])
  const handleRemoveAddress = (id) => setAddressBook((prev) => prev.filter((entry) => entry.id !== id))

  const defaultSubject = `Invoice ${meta.invoiceNumber} from ${biller.name || 'me'}`
  const defaultBody =
    `Hi ${client.name || 'there'},\n\n` +
    `Please find attached invoice ${meta.invoiceNumber} for ${meta.currency} ${totals.billed.toFixed(2)}, ` +
    `due ${meta.dueDate || 'on receipt'}.\n\nThanks,\n${biller.name || ''}`

  return (
    <div className="app">
      <Toolbar
        onNew={handleNewInvoice}
        onOpenAddressBook={() => setAddressBookOpen(true)}
        onSaveDraft={handleSaveDraft}
        draftStatus={draftStatus}
        onExport={exportStorageToJson}
        onImportFile={handleImportFile}
        onPrint={handlePrint}
        onDownloadPdf={handleDownloadPdf}
        onOpenEmail={() => setEmailModalOpen(true)}
      />

      <main className="sheet" ref={sheetRef}>
        <InvoiceMeta meta={meta} onChange={setMeta} />

        <section className="parties">
          <BillerCard
            biller={biller}
            onChange={setBiller}
            onSaveDefault={() => setBillerDefault(biller)}
          />
          <ClientCard
            client={client}
            clients={clients}
            onChange={setClient}
            onLoadClient={handleLoadClient}
            onSaveClient={handleSaveClient}
          />
        </section>

        <ItemsTable items={items} currency={meta.currency} onChange={setItems} />

        <div className="card notes">
          <label htmlFor="notes">Notes / Terms</label>
          <textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="card">
          <Totals
            subtotal={totals.subtotal}
            tax={totals.tax}
            taxPercent={taxPercent}
            discount={discountAmount}
            grandTotal={totals.grandTotal}
            capAmount={capAmount}
            billed={totals.billed}
            capped={totals.capped}
            currency={meta.currency}
            onTaxChange={setTaxPercent}
            onDiscountChange={setDiscountAmount}
            onCapChange={setCapAmount}
          />
        </div>

        <section className="foot-grid">
          <BankDetails bank={bank} onChange={setBank} onSaveDefault={() => setBankDefault(bank)} />
          <SignatureUpload
            signature={signature}
            onChange={setSignature}
            onSaveDefault={() => setSignatureDefault(signature)}
          />
        </section>
      </main>

      <EmailModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        addressBook={addressBook}
        defaultSubject={defaultSubject}
        defaultBody={defaultBody}
        onSend={handleSendEmail}
      />

      <AddressBookModal
        open={addressBookOpen}
        onClose={() => setAddressBookOpen(false)}
        addresses={addressBook}
        onAdd={handleAddAddress}
        onRemove={handleRemoveAddress}
      />
    </div>
  )
}
