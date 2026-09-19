import { useEffect, useMemo, useRef, useState } from 'react'
import { enqueueSnackbar } from 'notistack'
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
import DesignMarketplace from './components/DesignMarketplace.jsx'
import PreviewPane from './components/PreviewPane.jsx'
import { DEFAULT_DESIGN_ID, renderInvoiceHtml } from './designs/index.js'
import { formatDate } from './designs/templates.js'

const emptyClient = { name: '', address: '', email: '', phone: '' }
const emptyBank = { holder: '', bankName: '', bankAddress: '', accountNumber: '', swift: '' }

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

// Both dates are plain YYYY-MM-DD strings; appending T00:00:00 (no "Z")
// parses each as local midnight so their difference isn't skewed by the
// classic UTC-parse/local-format timezone shift.
function daysBetween(startIso, endIso) {
  if (!startIso || !endIso) return null
  const start = new Date(`${startIso}T00:00:00`)
  const end = new Date(`${endIso}T00:00:00`)
  return Math.round((end - start) / (1000 * 60 * 60 * 24))
}

// Recognizes our own auto-generated text so we know it's still safe to
// regenerate — once a user edits notes into something else, we leave it alone.
const AUTO_PAYMENT_NOTE = /^Payment due (within \d+ days? of invoice date|upon receipt)\.$/

function paymentNoteFor(invoiceDate, dueDate) {
  const days = daysBetween(invoiceDate, dueDate)
  if (days === null || days <= 0) return 'Payment due upon receipt.'
  return `Payment due within ${days} day${days === 1 ? '' : 's'} of invoice date.`
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
  const previewFrameRef = useRef(null)
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
  // Which output design (print/PDF/email) is selected — see designs/index.js.
  const [selectedDesignId, setSelectedDesignId] = useLocalStorage('invoiser_selected_design', DEFAULT_DESIGN_ID)
  const [previewOpen, setPreviewOpen] = useLocalStorage('invoiser_preview_open', false)
  // Display preference, not invoice data — persists across invoices like
  // previewOpen. See designs/templates.js for what it changes in the output.
  const [separateItems, setSeparateItems] = useLocalStorage('invoiser_separate_items', false)

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
  // If a saved draft's notes still look like our own auto-generated text,
  // recompute it fresh against the restored invoiceDate/dueDate rather than
  // trusting the stored string — keeps the "X days" figure correct even if
  // it was saved before a change, and self-heals any drift. Custom notes
  // (anything that doesn't match) are restored as-is.
  const [notes, setNotes] = useState(() => {
    const draftNotes = initialDraft?.notes
    if (draftNotes && !AUTO_PAYMENT_NOTE.test(draftNotes.trim())) return draftNotes
    return paymentNoteFor(meta.invoiceDate, meta.dueDate)
  })
  const [bank, setBank] = useState(initialDraft?.bank ?? bankDefault)
  const [signature, setSignature] = useState(initialDraft?.signature ?? signatureDefault)
  const [sameAsBusiness, setSameAsBusiness] = useState(initialDraft?.sameAsBusiness ?? true)
  const [signatoryName, setSignatoryName] = useState(initialDraft?.signatoryName ?? '')

  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [addressBookOpen, setAddressBookOpen] = useState(false)
  const [designsOpen, setDesignsOpen] = useState(false)

  const totals = useMemo(
    () => computeTotals(items, taxPercent, discountAmount, capAmount),
    [items, taxPercent, discountAmount, capAmount],
  )

  // Sole proprietors sign with their own business name — no need to retype
  // it as a separate signatory. Only ask for a distinct name when unchecked.
  const resolvedSignatoryName = sameAsBusiness ? biller.name : signatoryName

  // The full HTML document for the invoice in the selected design — the
  // single source of truth for the preview iframe, Print, and PDF/email
  // export. Recomputing this is cheap (string building); what's expensive
  // is reloading the iframe, which is why refreshing it (below) is
  // debounced instead of happening on every keystroke.
  const invoiceHtml = useMemo(
    () =>
      renderInvoiceHtml(selectedDesignId, {
        biller,
        client,
        meta,
        items,
        notes,
        totals,
        bank,
        signature,
        signatoryName: resolvedSignatoryName,
        separateItems,
      }),
    [selectedDesignId, biller, client, meta, items, notes, totals, bank, signature, resolvedSignatoryName, separateItems],
  )

  // Keep the on-screen preview roughly live while it's open, without
  // reloading the iframe on every keystroke.
  useEffect(() => {
    if (!previewOpen) return
    const timer = setTimeout(() => {
      previewFrameRef.current?.refresh(invoiceHtml)
    }, 300)
    return () => clearTimeout(timer)
  }, [invoiceHtml, previewOpen])

  // ---- Actions ----
  const handleNewInvoice = () => {
    const nextCount = invoiceCounter + 1
    setInvoiceCounter(nextCount)
    setBiller(billerDefault)
    setClient(emptyClient)
    const nextInvoiceDate = todayIso()
    setMeta({
      invoiceNumber: `INV-${String(nextCount).padStart(4, '0')}`,
      invoiceDate: nextInvoiceDate,
      dueDate: '',
      currency: meta.currency,
    })
    setItems([makeEmptyItem()])
    setTaxPercent(0)
    setDiscountAmount(0)
    setCapAmount('')
    setNotes(paymentNoteFor(nextInvoiceDate, ''))
    setBank(bankDefault)
    setSignature(signatureDefault)
    setSameAsBusiness(true)
    setSignatoryName('')
    try {
      window.localStorage.removeItem(DRAFT_KEY)
    } catch {
      // ignore
    }
    enqueueSnackbar('Started a new invoice', { variant: 'info' })
  }

  const handleSaveDraft = () => {
    const draft = {
      biller, client, meta, items, taxPercent, discountAmount, capAmount, notes, bank, signature,
      sameAsBusiness, signatoryName,
    }
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      setDraftStatus('Draft saved')
      enqueueSnackbar('Draft saved', { variant: 'success' })
    } catch {
      setDraftStatus('Could not save draft')
      enqueueSnackbar('Could not save draft', { variant: 'error' })
    }
    setTimeout(() => setDraftStatus(''), 2000)
  }

  const handleImportFile = async (file) => {
    try {
      await importStorageFromFile(file)
      enqueueSnackbar('Data imported — reloading…', { variant: 'success' })
      window.location.reload()
    } catch {
      setDraftStatus('Import failed — invalid file')
      enqueueSnackbar('Import failed — invalid file', { variant: 'error' })
      setTimeout(() => setDraftStatus(''), 2000)
    }
  }

  const handleMetaChange = (nextMeta) => {
    const dueDateChanged = nextMeta.dueDate !== meta.dueDate
    const invoiceDateChanged = nextMeta.invoiceDate !== meta.invoiceDate
    // Keep the payment-terms note in sync with the due date — but only
    // while it still looks like our own auto-generated text, so a
    // user's custom notes are never silently overwritten.
    if ((dueDateChanged || invoiceDateChanged) && AUTO_PAYMENT_NOTE.test(notes.trim())) {
      setNotes(paymentNoteFor(nextMeta.invoiceDate, nextMeta.dueDate))
    }
    setMeta(nextMeta)
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
    if (!client.name.trim()) {
      enqueueSnackbar('Enter a client name first', { variant: 'warning' })
      return
    }
    setClients((prev) => {
      const existing = prev.find((c) => c.name === client.name)
      if (existing) {
        return prev.map((c) => (c.id === existing.id ? { ...existing, ...client } : c))
      }
      return [...prev, { id: crypto.randomUUID(), ...client }]
    })
    enqueueSnackbar('Client saved', { variant: 'success' })
  }

  // No toast here on success — print() can block until the OS dialog
  // closes, so a toast fired after it lands late/out of order. Only
  // surface this if something actually goes wrong.
  const handlePrint = async () => {
    await previewFrameRef.current?.refresh(invoiceHtml)
    previewFrameRef.current?.print()
  }

  const handleDownloadPdf = async () => {
    await previewFrameRef.current?.refresh(invoiceHtml)
    const pages = previewFrameRef.current?.getCapturePages()
    try {
      await downloadInvoicePdf(pages, `${meta.invoiceNumber || 'invoice'}.pdf`)
      enqueueSnackbar('PDF downloaded', { variant: 'success' })
    } catch {
      enqueueSnackbar('Could not generate the PDF', { variant: 'error' })
      throw new Error('PDF generation failed')
    }
  }

  const handleSendEmail = async ({ to, cc, bcc, subject, body }) => {
    // Kick off the PDF download first so it's ready for the user to attach,
    // then hand off to their default mail client with everything prefilled.
    try {
      await handleDownloadPdf()
    } catch {
      return
    }
    const params = new URLSearchParams()
    if (cc) params.set('cc', cc)
    if (bcc) params.set('bcc', bcc)
    if (subject) params.set('subject', subject)
    if (body) params.set('body', body)
    const mailto = `mailto:${encodeURIComponent(to)}?${params.toString()}`
    window.location.href = mailto
    setEmailModalOpen(false)
    enqueueSnackbar('Mail client opened', { variant: 'success' })
  }

  const handleAddAddress = (entry) => {
    setAddressBook((prev) => [...prev, entry])
    enqueueSnackbar('Address saved', { variant: 'success' })
  }

  const handleRemoveAddress = (id) => {
    setAddressBook((prev) => prev.filter((entry) => entry.id !== id))
    enqueueSnackbar('Address removed', { variant: 'warning' })
  }

  const handleSelectDesign = (id) => {
    setSelectedDesignId(id)
    enqueueSnackbar('Design updated', { variant: 'success' })
  }

  const handleExport = () => {
    exportStorageToJson()
    enqueueSnackbar('Backup exported', { variant: 'success' })
  }

  const handleSaveBillerDefault = () => {
    setBillerDefault(biller)
    enqueueSnackbar('Biller info saved as default', { variant: 'success' })
  }

  const handleSaveBankDefault = () => {
    setBankDefault(bank)
    enqueueSnackbar('Bank details saved as default', { variant: 'success' })
  }

  const handleSaveSignatureDefault = () => {
    setSignatureDefault(signature)
    enqueueSnackbar('Signature saved as default', { variant: 'success' })
  }

  const defaultSubject = `Invoice ${meta.invoiceNumber} from ${biller.name || 'me'}`
  const defaultBody =
    `Hi ${client.name || 'there'},\n\n` +
    `Please find attached invoice ${meta.invoiceNumber} for ${meta.currency} ${totals.billed.toFixed(2)}, ` +
    `due ${meta.dueDate ? formatDate(meta.dueDate) : 'on receipt'}.\n\nThanks,\n${biller.name || ''}`

  return (
    <>
      <Toolbar
        onNew={handleNewInvoice}
        onOpenAddressBook={() => setAddressBookOpen(true)}
        onSaveDraft={handleSaveDraft}
        draftStatus={draftStatus}
        onExport={handleExport}
        onImportFile={handleImportFile}
        onPrint={handlePrint}
        onDownloadPdf={handleDownloadPdf}
        onOpenEmail={() => setEmailModalOpen(true)}
        onOpenDesigns={() => setDesignsOpen(true)}
        previewOpen={previewOpen}
        onTogglePreview={() => setPreviewOpen((prev) => !prev)}
      />

      <div className={`app${previewOpen ? ' preview-open' : ''}`}>
        <div className="app-body">
          <main className="sheet">
            <InvoiceMeta meta={meta} onChange={handleMetaChange} />

            <section className="parties">
              <BillerCard
                biller={biller}
                onChange={setBiller}
                onSaveDefault={handleSaveBillerDefault}
              />
              <ClientCard
                client={client}
                clients={clients}
                onChange={setClient}
                onLoadClient={handleLoadClient}
                onSaveClient={handleSaveClient}
              />
            </section>

            <ItemsTable
              items={items}
              currency={meta.currency}
              onChange={setItems}
              separateItems={separateItems}
              onToggleSeparateItems={setSeparateItems}
            />

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
              <BankDetails bank={bank} onChange={setBank} onSaveDefault={handleSaveBankDefault} />
              <SignatureUpload
                signature={signature}
                onChange={setSignature}
                onSaveDefault={handleSaveSignatureDefault}
                billerName={biller.name}
                sameAsBusiness={sameAsBusiness}
                onSameAsBusinessChange={setSameAsBusiness}
                signatoryName={signatoryName}
                onSignatoryNameChange={setSignatoryName}
              />
            </section>
          </main>

          <PreviewPane ref={previewFrameRef} open={previewOpen} />
        </div>

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

        <DesignMarketplace
          open={designsOpen}
          onClose={() => setDesignsOpen(false)}
          selectedDesignId={selectedDesignId}
          onSelect={handleSelectDesign}
        />
      </div>
    </>
  )
}
