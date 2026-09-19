import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { enqueueSnackbar } from 'notistack'
import { api } from '../api/client.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { computeTotals } from '../utils/calc.js'

import InvoiceMeta from '../components/InvoiceMeta.jsx'
import BillerCard from '../components/BillerCard.jsx'
import ClientCard from '../components/ClientCard.jsx'
import ItemsTable from '../components/ItemsTable.jsx'
import Totals from '../components/Totals.jsx'
import BankDetails from '../components/BankDetails.jsx'
import SignatureUpload from '../components/SignatureUpload.jsx'
import EmailModal from '../components/EmailModal.jsx'
import AddressBookModal from '../components/AddressBookModal.jsx'
import DesignMarketplace from '../components/DesignMarketplace.jsx'
import PreviewPane from '../components/PreviewPane.jsx'
import ErrorCard from '../components/ErrorCard.jsx'
import Skeleton from '../components/Skeleton.jsx'
import AsyncButton from '../components/AsyncButton.jsx'
import { DEFAULT_DESIGN_ID, renderInvoiceHtml } from '../designs/index.js'
import { formatDate } from '../designs/templates.js'

const emptyBiller = { name: '', address: '', email: '', phone: '' }
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

export default function InvoiceEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const previewFrameRef = useRef(null)

  const [loadState, setLoadState] = useState('loading') // loading | ready | error
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  const isHydrating = useRef(true)

  const [signatureDefault, setSignatureDefault] = useLocalStorage('invoiser_signature_default', null)
  const [addressBook, setAddressBook] = useLocalStorage('invoiser_address_book', [])
  const [selectedDesignId, setSelectedDesignId] = useLocalStorage('invoiser_selected_design', DEFAULT_DESIGN_ID)
  const [previewOpen, setPreviewOpen] = useLocalStorage('invoiser_preview_open', false)
  const [separateItems, setSeparateItems] = useState(false)

  const [savedClients, setSavedClients] = useState([])
  const [savedBankAccounts, setSavedBankAccounts] = useState([])

  const [invoiceId, setInvoiceId] = useState(null)
  const [biller, setBiller] = useState(emptyBiller)
  const [client, setClient] = useState(emptyClient)
  const [clientId, setClientId] = useState(null)
  const [meta, setMeta] = useState({ invoiceNumber: '', invoiceDate: todayIso(), dueDate: '', currency: 'PHP' })
  const [items, setItems] = useState([])
  const [taxPercent, setTaxPercent] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [capAmount, setCapAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [bank, setBank] = useState(emptyBank)
  const [bankAccountId, setBankAccountId] = useState(null)
  const [signature, setSignature] = useState(null)
  const [sameAsBusiness, setSameAsBusiness] = useState(true)
  const [signatoryName, setSignatoryName] = useState('')

  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [addressBookOpen, setAddressBookOpen] = useState(false)
  const [designsOpen, setDesignsOpen] = useState(false)

  // ---- Load (or create) the invoice, plus the settings/clients/banks it draws from ----
  useEffect(() => {
    let cancelled = false
    isHydrating.current = true
    setLoadState('loading')

    const load = async () => {
      const [settings, clients, banks] = await Promise.all([
        api.getSettings(),
        api.listClients(),
        api.listBankAccounts(),
      ])
      let invoice
      if (id === 'new') {
        const defaultBank = banks.find((b) => b.isDefault) || null
        invoice = await api.createInvoice({
          invoiceDate: todayIso(),
          bank: defaultBank ? { ...emptyBank, ...defaultBank } : null,
          bankAccountId: defaultBank?.id || null,
        })
      } else {
        invoice = await api.getInvoice(id)
      }
      return { settings, clients, banks, invoice }
    }

    load()
      .then(({ settings, clients, banks, invoice }) => {
        if (cancelled) return
        if (id === 'new') {
          navigate(`/invoices/${invoice.id}`, { replace: true })
          return
        }
        setSavedClients(clients)
        setSavedBankAccounts(banks)
        setInvoiceId(invoice.id)
        setBiller(settings.biller || emptyBiller)
        setClient(invoice.client || emptyClient)
        setClientId(invoice.clientId || null)
        setMeta({
          invoiceNumber: invoice.invoiceNumber || '',
          invoiceDate: invoice.invoiceDate || todayIso(),
          dueDate: invoice.dueDate || '',
          currency: invoice.currency || 'PHP',
        })
        setItems(invoice.items || [])
        setTaxPercent(invoice.taxPercent || 0)
        setDiscountAmount(invoice.discountAmount || 0)
        setCapAmount(invoice.capAmount || '')
        const savedNotes = invoice.notes
        setNotes(
          savedNotes && !AUTO_PAYMENT_NOTE.test(savedNotes.trim())
            ? savedNotes
            : paymentNoteFor(invoice.invoiceDate, invoice.dueDate),
        )
        setBank(invoice.bank || emptyBank)
        setBankAccountId(invoice.bankAccountId || null)
        setSignature(invoice.signature ?? signatureDefault)
        setSameAsBusiness(invoice.sameAsBusiness ?? true)
        setSignatoryName(invoice.signatoryName || '')
        setSelectedDesignId(invoice.selectedDesignId || DEFAULT_DESIGN_ID)
        setSeparateItems(invoice.separateItems || false)
        setLoadState('ready')
        // Defer clearing the hydration flag so the autosave effect's first
        // run (triggered by the state updates above) is skipped too.
        setTimeout(() => { isHydrating.current = false }, 0)
      })
      .catch((error) => {
        if (cancelled) return
        setLoadState('error')
        enqueueSnackbar(error.message || 'Could not load this invoice', { variant: 'error' })
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const totals = useMemo(
    () => computeTotals(items, taxPercent, discountAmount, capAmount),
    [items, taxPercent, discountAmount, capAmount],
  )

  // Sole proprietors sign with their own business name — no need to retype
  // it as a separate signatory. Only ask for a distinct name when unchecked.
  const resolvedSignatoryName = sameAsBusiness ? biller.name : signatoryName

  // The full HTML document for the invoice in the selected design — the
  // single source of truth for the preview iframe, Print, and PDF/email
  // export.
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

  useEffect(() => {
    if (!previewOpen) return
    const timer = setTimeout(() => {
      previewFrameRef.current?.refresh(invoiceHtml)
    }, 300)
    return () => clearTimeout(timer)
  }, [invoiceHtml, previewOpen])

  // ---- Autosave: debounced PATCH whenever the invoice's own fields change ----
  useEffect(() => {
    if (loadState !== 'ready' || isHydrating.current || !invoiceId) return
    setSaveStatus('saving')
    const timer = setTimeout(() => {
      api.updateInvoice(invoiceId, {
        client, clientId, invoiceNumber: meta.invoiceNumber, invoiceDate: meta.invoiceDate,
        dueDate: meta.dueDate, currency: meta.currency, items, taxPercent, discountAmount,
        capAmount, notes, bank, bankAccountId, signature, sameAsBusiness, signatoryName,
        selectedDesignId, separateItems,
      })
        .then(() => setSaveStatus('saved'))
        .catch(() => {
          setSaveStatus('error')
          enqueueSnackbar('Could not save changes', { variant: 'error' })
        })
    }, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    client, clientId, meta, items, taxPercent, discountAmount, capAmount, notes, bank,
    bankAccountId, signature, sameAsBusiness, signatoryName, selectedDesignId, separateItems,
  ])

  // ---- Actions ----
  const handleMetaChange = (nextMeta) => {
    const dueDateChanged = nextMeta.dueDate !== meta.dueDate
    const invoiceDateChanged = nextMeta.invoiceDate !== meta.invoiceDate
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
    setClientId(savedClient.id)
  }

  const handleSaveClient = async () => {
    if (!client.name.trim()) {
      enqueueSnackbar('Enter a client name first', { variant: 'warning' })
      return
    }
    try {
      const existing = savedClients.find((c) => c.name === client.name)
      if (existing) {
        const updated = await api.updateClient(existing.id, client)
        setClientId(updated.id)
        setSavedClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      } else {
        const created = await api.createClient(client)
        setClientId(created.id)
        setSavedClients((prev) => [...prev, created])
      }
      enqueueSnackbar('Client saved', { variant: 'success' })
    } catch {
      enqueueSnackbar('Could not save client', { variant: 'error' })
    }
  }

  const handleSaveBillerDefault = async () => {
    try {
      await api.updateSettings({ biller })
      enqueueSnackbar('Biller info saved as default', { variant: 'success' })
    } catch {
      enqueueSnackbar('Could not save biller info', { variant: 'error' })
    }
  }

  const handleSaveBankDefault = async () => {
    try {
      if (bankAccountId) {
        const updated = await api.updateBankAccount(bankAccountId, { ...bank, isDefault: true })
        setSavedBankAccounts((prev) => prev.map((b) => (b.id === updated.id ? updated : { ...b, isDefault: false })))
      } else {
        const created = await api.createBankAccount({ ...bank, isDefault: true })
        setBankAccountId(created.id)
        setSavedBankAccounts((prev) => [...prev.map((b) => ({ ...b, isDefault: false })), created])
      }
      enqueueSnackbar('Bank details saved as default', { variant: 'success' })
    } catch {
      enqueueSnackbar('Could not save bank details', { variant: 'error' })
    }
  }

  const handleSaveSignatureDefault = () => {
    setSignatureDefault(signature)
    enqueueSnackbar('Signature saved as default', { variant: 'success' })
  }

  // No toast here on success — print() can block until the OS dialog
  // closes, so a toast fired after it lands late/out of order. Only
  // surface this if something actually goes wrong.
  const handlePrint = async () => {
    await previewFrameRef.current?.refresh(invoiceHtml)
    previewFrameRef.current?.print()
  }

  // Server-rendered via Playwright (api/invoices/[id]/pdf.js) — the same
  // real-Chromium pipeline already used for emailed invoices, so this no
  // longer depends on html2canvas's approximate text layout (the source of
  // the old margin/letter-spacing export bugs).
  const handleDownloadPdf = async () => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`)
      if (!res.ok) throw new Error('Could not generate the PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${meta.invoiceNumber || 'invoice'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      enqueueSnackbar('PDF downloaded', { variant: 'success' })
    } catch {
      enqueueSnackbar('Could not generate the PDF', { variant: 'error' })
      throw new Error('PDF generation failed')
    }
  }

  const handleSendEmail = async ({ to, cc, bcc, subject, body }) => {
    try {
      const result = await api.sendEmail({ invoiceId, to, cc, bcc, subject, body })
      if (result?.sent) {
        enqueueSnackbar('Email sent', { variant: 'success' })
        setEmailModalOpen(false)
        return
      }
    } catch (error) {
      // 501 = sending isn't configured on this instance — fall through to
      // the mailto handoff silently. Any other failure gets a toast, but we
      // still fall through so the user isn't stuck.
      if (error.status && error.status !== 501) {
        enqueueSnackbar(error.message || 'Could not send the email — opening your mail app instead', { variant: 'error' })
      }
    }

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

  const handleRemoveAddress = (entryId) => {
    setAddressBook((prev) => prev.filter((entry) => entry.id !== entryId))
    enqueueSnackbar('Address removed', { variant: 'warning' })
  }

  const handleSelectDesign = (designId) => {
    setSelectedDesignId(designId)
    enqueueSnackbar('Design updated', { variant: 'success' })
  }

  if (loadState === 'loading' || id === 'new') {
    return (
      <div className="page">
        <Skeleton rows={6} />
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="page">
        <ErrorCard message="Couldn't load this invoice." onRetry={() => window.location.reload()} />
      </div>
    )
  }

  const defaultSubject = `Invoice ${meta.invoiceNumber} from ${biller.name || 'me'}`
  const defaultBody =
    `Hi ${client.name || 'there'},\n\n` +
    `Please find attached invoice ${meta.invoiceNumber} for ${meta.currency} ${totals.billed.toFixed(2)}, ` +
    `due ${meta.dueDate ? formatDate(meta.dueDate) : 'on receipt'}.\n\nThanks,\n${biller.name || ''}`

  const saveStatusLabel = {
    saving: 'Saving…',
    saved: 'Saved',
    error: 'Could not save',
    idle: '',
  }[saveStatus]

  return (
    <>
      <div className="editor-toolbar no-print">
        <Link to="/invoices" className="btn-tiny">← Back to Invoices</Link>
        <span className="save-status">{saveStatusLabel}</span>
        <div className="editor-toolbar-actions">
          <button type="button" className="btn-tiny" onClick={() => setAddressBookOpen(true)}>Address Book</button>
          <button type="button" className="btn-tiny" onClick={() => setDesignsOpen(true)}>Design</button>
          <button type="button" className="btn-tiny" onClick={() => setPreviewOpen((prev) => !prev)}>
            {previewOpen ? 'Hide Preview' : 'Show Preview'}
          </button>
          <AsyncButton className="btn-tiny" onClick={handlePrint}>Print</AsyncButton>
          <AsyncButton className="btn-tiny" onClick={handleDownloadPdf}>Download PDF</AsyncButton>
          <button type="button" className="btn btn-primary" onClick={() => setEmailModalOpen(true)}>Email</button>
        </div>
      </div>

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
                clients={savedClients}
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
