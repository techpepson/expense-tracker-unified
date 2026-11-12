/** Triggers a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(text: string, filename: string, type = 'text/csv;charset=utf-8'): void {
  // BOM so Excel opens UTF-8 CSVs (₵, accents) correctly.
  downloadBlob(new Blob(['\uFEFF', text], { type }), filename)
}

