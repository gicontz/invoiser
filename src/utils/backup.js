// Every localStorage key the app reads/writes, kept in one place so
// export/import can't silently drift from what useLocalStorage actually uses.
export const STORAGE_KEYS = [
  'invoiser_biller_default',
  'invoiser_bank_default',
  'invoiser_signature_default',
  'invoiser_clients',
  'invoiser_address_book',
  'invoiser_invoice_counter',
  'invoiser_draft_invoice',
]

export function exportStorageToJson() {
  const data = {}
  for (const key of STORAGE_KEYS) {
    const raw = window.localStorage.getItem(key)
    if (raw !== null) data[key] = JSON.parse(raw)
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `invoiser-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importStorageFromFile(file) {
  const text = await file.text()
  const data = JSON.parse(text)
  for (const key of STORAGE_KEYS) {
    if (key in data) {
      window.localStorage.setItem(key, JSON.stringify(data[key]))
    }
  }
}
