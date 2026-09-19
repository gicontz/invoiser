function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ))
}

// Styled with the app's own Ledgerline tokens (see DESIGN.md) — cream
// ground, white card, 24px radius, tinted shadow — not the invoice
// document's own design system (designs/*.css), which is a deliberately
// separate thing (see designs/index.js). Inline styles only, no external
// font/stylesheet loading: most email clients (Outlook especially) don't
// support either, so this degrades to plain system fonts rather than
// relying on Fredoka/Nunito actually being available.
export function renderEmailHtml({ billerName, bodyText }) {
  const paragraphs = escapeHtml(bodyText).split(/\n{2,}/).map((block) =>
    `<p style="margin:0 0 16px; white-space:pre-line;">${block}</p>`,
  ).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:32px 16px; background:#FFF8F0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px; margin:0 auto; background:#FFFFFF; border-radius:24px; padding:32px; box-shadow:0 8px 20px rgba(31,58,95,0.10);">
    <p style="margin:0 0 24px; font-size:15px; font-weight:800; color:#1F3A5F; letter-spacing:0.01em;">🧾 ${escapeHtml(billerName || 'Invoiser')}</p>
    <div style="font-size:15px; line-height:1.6; color:#26263A;">${paragraphs}</div>
    <hr style="border:none; border-top:1px solid rgba(38,38,58,0.1); margin:24px 0;">
    <p style="margin:0; font-size:13px; color:#63607A;">📎 Invoice PDF attached</p>
  </div>
</body>
</html>`
}
