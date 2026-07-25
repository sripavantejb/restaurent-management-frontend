"use client";

/** Open a thermal-friendly receipt window and trigger print. */
export function printInvoiceText(text: string, title = "Invoice") {
  const w = window.open("", "_blank", "noopener,noreferrer,width=420,height=640");
  if (!w) return;
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  w.document.write(`<!doctype html><html><head><title>${title}</title>
<style>
  body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;padding:16px;white-space:pre-wrap;color:#12100e;background:#fff}
  @media print{body{padding:0}}
</style></head><body>${escaped}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 250);
}
