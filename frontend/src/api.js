const post = async (url, body, blob) => {
  let r
  try { r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }) }
  catch { throw new Error('Cannot reach the GE-EDIT backend. Start it with: uvicorn api:app --reload --port 8000') }
  if (!r.ok) {
    let m = null; try { m = (await r.json()).detail } catch {}
    throw new Error(m || (r.status >= 500 ? `Server error (${r.status}). Is the backend running on port 8000? Check the uvicorn terminal for details.` : r.statusText))
  }
  return blob ? r.blob() : r.json()
}
export const parseSeq = b => post('/api/parse', b)
export const designPrimers = b => post('/api/design', b)
export const exportFile = (kind, b) => post(`/api/export/${kind}`, b, true)
export const recordVisit = () => post('/api/visit', {})
export const saveBlob = (blob, name) => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
export const bestPrimers = (p) => {
  const m = {}
  for (const x of p.primers || []) if (!m[x.amplicon_num] || (x.version||1) > (m[x.amplicon_num].version||1)) m[x.amplicon_num] = x
  return Object.values(m).sort((a,b) => a.amplicon_num - b.amplicon_num)
}
export const localStamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}` }
export const newProject = (name, si) => ({
  format_version:'1.0', project_name:name, vector_name:si.name, vector_length:si.length,
  vector_sequence:si.sequence, vector_features:si.features||[],
  created_at:localStamp(), last_saved:null,
  primers:[], pcr_runs:[], redesign_history:[], design_params:{}, control_primers:[] })
export const redesign = b => post('/api/redesign', b)
export const checkControls = b => post('/api/controls', b)
export const importControls = b => post('/api/controls/import', b)
export const toB64 = f => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(f) })
export const buildReport = async (fmt, body) => {
  let r
  try { r = await fetch(`/api/report/${fmt}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }) }
  catch { throw new Error('Cannot reach the GE-EDIT backend.') }
  if (!r.ok) { let m = `Server error (${r.status}).`; try { m = (await r.json()).detail || m } catch {} ; throw new Error(m) }
  return { blob: await r.blob(), comments: Number(r.headers.get('X-Comments') || 0), skipped: r.headers.get('X-Skipped'), mismatches: (r.headers.get('X-Mismatches') || '').split(',').filter(Boolean) }
}

// Shrink a gel image in the browser: max width 1600 px, JPEG quality 0.85.
// Keeps the original if it is already smaller or cannot be decoded (e.g. TIFF in Chrome/Firefox).
export const shrinkImage = (file, maxW = 1600, quality = 0.85) => new Promise(resolve => {
  const url = URL.createObjectURL(file), img = new Image()
  const keep = async extra => { URL.revokeObjectURL(url); resolve({ b64: await toB64(file), mime: file.type || 'image/png', before: file.size, after: file.size, resized: false, ...extra }) }
  img.onload = () => {
    const s = Math.min(1, maxW / img.naturalWidth), w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s)
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h)
    c.toBlob(async blob => {
      if (blob && blob.size < file.size) { URL.revokeObjectURL(url); resolve({ b64: await toB64(blob), mime: 'image/jpeg', before: file.size, after: blob.size, resized: true }) }
      else keep({})
    }, 'image/jpeg', quality)
  }
  img.onerror = () => keep({ undecodable: true })
  img.src = url
})
