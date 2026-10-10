// Shared HTML-escaping helper for user-controlled strings (actor/item names, etc.)
// interpolated into chat cards and option labels.
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
