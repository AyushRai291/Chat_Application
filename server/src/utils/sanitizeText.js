const htmlEscapes = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const normalizeStoredText = (value = "") =>
  value
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();

export const escapeHtml = (value = "") =>
  value.replace(/[&<>"']/g, (character) => htmlEscapes[character]);

export const buildSafeHtml = (value = "") =>
  escapeHtml(normalizeStoredText(value)).replace(/\n/g, "<br>");
