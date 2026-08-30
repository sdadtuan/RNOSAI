const PHONE = /(?:\+?84|0)(?:3|5|7|8|9)\d{8}\b/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function maskSalesKitPii(text: string): string {
  return String(text ?? '')
    .replace(PHONE, (m) => `***${m.slice(-4)}`)
    .replace(EMAIL, (m) => {
      const at = m.lastIndexOf('@');
      return `***${m.slice(at)}`;
    });
}
