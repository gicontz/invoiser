// Reserved for future account management — there's no auth/account system
// yet (this app has none, see decisions.md D5), so nothing functional lives
// here. Biller info stays editable inline in the invoice editor
// (BillerCard's "Save as default"); email/mailing config is env-var-based
// for now (#27, #30) rather than a Settings UI, until real accounts exist.
export default function SettingsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>
      <div className="empty-state">
        <p>Account settings are coming soon.</p>
        <p>This page will hold account-level preferences once account management exists.</p>
      </div>
    </div>
  )
}
