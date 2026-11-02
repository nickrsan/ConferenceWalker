/** Escapes dynamic text before it is inserted into an HTML template. */
export function escapeHtml(value: string): string {
  const escapedCharacters: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return value.replace(/[&<>"']/g, (character) => escapedCharacters[character]);
}