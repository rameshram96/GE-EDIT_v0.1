import { useState } from 'react'
import { localStamp, bestPrimers, redesign, checkControls, importControls, toB64, shrinkImage, buildReport, saveBlob } from './api.js'

const now = localStamp
const label = p => p.amplicon_name || `Amplicon_${p.amplicon_num}`
const fmt = v => (v === null || v === undefined ? 'N/A' : `${v} bp`)
const Badge = ({ s }) => <span className={`badge b-${String(s).replace(/ /g, '-')}`}>{s}</span>
const Ov = ({ v }) => <span className={`badge ${v == null ? 'b-Design-Failed' : v >= 50 ? 'b-Success' : 'b-Failed'}`}>{fmt(v)}</span>
const MAX_VERSIONS = 3
const REC = { 'No band': [100, 100, 'Extend both sides for maximum flexibility'], 'Multiple bands': [50, 150, 'Extend right into more unique sequence'],
  'Weak band': [100, 100, 'Extend both to find better primers'], 'Wrong band size': [50, 50, 'Small extension within the same region'],
  'Primer dimer': [150, 150, 'Large extension to force new binding positions'], 'Overlap violation': [150, 0, 'Extend left to raise upstream overlap'],
  'Other': [100, 100, 'Default extension'] }

function Redesign({ p, project, setProject }) {
  const [v, setV] = useState({ ft: p.status === 'Overlap Violation' ? 'Overlap violation' : 'No band', l: 100, r: 100, shift: 0, notes: '' })
  const [prev, setPrev] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const best = bestPrimers(project)
  if ((p.version || 1) >= MAX_VERSIONS) return <div className="note err">Maximum {MAX_VERSIONS} redesign attempts reached.</div>
  const pickFt = ft => setV({ ...v, ft, l: REC[ft][0], r: REC[ft][1] })
  const run = async () => {
    setBusy(true); setErr('')
    try {
      const d = await redesign({ sequence: project.vector_sequence, primer: p, best, ext_l: v.l, ext_r: v.r, fp_shift: v.shift,
        min_overlap: project.design_params?.min_overlap || 50 })
      if (d.results) setPrev(d); else setErr(d.error || 'Redesign failed.')
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const ok = prev && prev.results.every(r => r.redesign_ok !== false && !(r.redesign_violations || []).length)
  const accept = () => {
    let n = project.primers.length
    const added = prev.results.map(r => ({ ...r, status: 'Pending', amplicon_name: label(p) + (r.split_label || ''), _id: n++ }))
    setProject({ ...project,
      primers: [...project.primers.map(x => x._id === p._id ? { ...x, status: 'Redesigned' } : x), ...added],
      redesign_history: [...project.redesign_history, { amplicon_num: p.amplicon_num, old_primer_id: p._id, extension_left: v.l, extension_right: v.r,
        failure_type: v.ft, attempt_num: (p.version || 1) + 1, upstream_overlap_result: prev.results[0].overlap_prev ?? null,
        downstream_overlap_result: prev.results.at(-1).overlap_next ?? null, reason: v.notes, redesign_date: now() }] })
  }
  if (prev) return (
    <div className="note warn">
      {prev.is_split && <p><b>Region exceeds 500 bp:</b> split into two overlapping amplicons (A and B).</p>}
      {prev.results.map((r, i) => (
        <div key={i} style={{ margin: '.6rem 0' }}>
          <b>{label(p)}{r.split_label || ''} v{r.version}</b>: {r.amplicon_length} bp, {r.amplicon_start}–{r.amplicon_end}
          <div className="mono">FP {r.fp_sequence} ({r.fp_length} nt, Tm {r.fp_tm}, GC {r.fp_gc}%)</div>
          <div className="mono">RP {r.rp_sequence} ({r.rp_length} nt, Tm {r.rp_tm}, GC {r.rp_gc}%)</div>
          Upstream <Ov v={r.overlap_prev} /> Downstream <Ov v={r.overlap_next} />
          {r.wraps_origin && <> Circular overlap <Ov v={r.circular_overlap} /></>}
          {(r.redesign_violations || []).map((x, j) => <div key={j} style={{ color: 'var(--danger)' }}>{x}</div>)}
        </div>))}
      <button className="btn btn-primary btn-sm" disabled={!ok} onClick={accept}>Accept and save</button>{' '}
      <button className="btn btn-secondary btn-sm" onClick={() => setPrev(null)}>Reject and try again</button>
      {!ok && <p style={{ color: 'var(--danger)' }}>Fix the rule violations before accepting.</p>}
    </div>)
  return (
    <div className="note warn">
      <b>Redesign primers</b> (attempt {p.version || 1} of {MAX_VERSIONS})
      {p.wraps_origin && <p>This amplicon closes the circle. Use "Shift FP later" if the pre-origin segment is too long to leave room for the overlap.</p>}
      <div className="row c3" style={{ margin: '.6rem 0' }}>
        <div><label>Failure reason</label><select value={v.ft} onChange={e => pickFt(e.target.value)}>{Object.keys(REC).map(k => <option key={k}>{k}</option>)}</select></div>
        <div><label>Upstream extension (bp)</label><input type="number" min="0" max="200" value={v.l} onChange={e => setV({ ...v, l: +e.target.value })} /></div>
        <div><label>Downstream extension (bp)</label><input type="number" min="0" max="200" value={v.r} onChange={e => setV({ ...v, r: +e.target.value })} /></div>
      </div>
      <p>Recommended: {REC[v.ft][2]}</p>
      {p.wraps_origin && <div style={{ maxWidth: 240 }}><label>Shift FP later (bp, negative = earlier)</label><input type="number" value={v.shift} onChange={e => setV({ ...v, shift: +e.target.value })} /></div>}
      <label style={{ marginTop: '.6rem' }}>Notes (optional)</label><input type="text" value={v.notes} onChange={e => setV({ ...v, notes: e.target.value })} />
      <button className="btn btn-primary btn-sm" style={{ marginTop: '.8rem' }} onClick={run} disabled={busy}>{busy ? 'Redesigning…' : 'Run redesign'}</button>
      {err && <div className="note err" style={{ marginTop: '.8rem' }}>{err}</div>}
    </div>)
}

export function Tracker({ project, setProject }) {
  const best = bestPrimers(project), [sel, setSel] = useState({})
  const ids = best.filter(p => sel[p._id]).map(p => p._id)
  const count = s => best.filter(p => s.includes(p.status)).length
  const setStatus = (list, s) => setProject({ ...project, primers: project.primers.map(p => list.includes(p._id) ? { ...p, status: s } : p) })
  const rename = (num, name) => setProject({ ...project, primers: project.primers.map(p => p.amplicon_num === num ? { ...p, amplicon_name: name } : p) })
  const last = best.at(-1)
  const done = count(['Success', 'Done'])
  if (!best.length) return <div className="note">Design primers first.</div>
  return (
    <>
      <div className="note">Progress: <b>{done}/{best.length}</b> amplicons done ({Math.round(done / best.length * 100)}%)
        {last && (last.wraps_origin && (last.circular_overlap || 0) >= 50
          ? <> · Circular closure OK ({last.circular_overlap} bp with Amplicon 1)</>
          : <> · <b style={{ color: 'var(--danger)' }}>Circular closure not satisfied</b>: redesign Amplicon {last.amplicon_num}</>)}</div>
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setSel(Object.fromEntries(best.map(p => [p._id, true])))}>Select all</button>
        <button className="btn btn-secondary btn-sm" onClick={() => setSel({})}>Deselect all</button>
        <button className="btn btn-primary btn-sm" disabled={!ids.length} onClick={() => { setStatus(ids, 'Success'); setSel({}) }}>Mark selected as Success</button>
      </div>
      {best.map(p => (
        <details className="card" key={p._id} style={{ padding: '.8rem 1.2rem' }}>
          <summary style={{ cursor: 'pointer', display: 'flex', gap: '.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="checkbox" checked={!!sel[p._id]} onClick={e => e.stopPropagation()} onChange={e => setSel({ ...sel, [p._id]: e.target.checked })} />
            <b>{label(p)}</b>{p.wraps_origin && <span title="Wraps origin">↻</span>} v{p.version}
            <span>{p.amplicon_start}–{p.amplicon_end} · {p.amplicon_length} bp</span>
            Up <Ov v={p.overlap_prev} /> Down <Ov v={p.overlap_next} /> <Badge s={p.status} />
            <select style={{ width: 'auto', marginLeft: 'auto' }} value={['Pending', 'Success', 'Failed', 'Overlap Violation'].includes(p.status) ? p.status : 'Pending'}
              onClick={e => e.stopPropagation()} onChange={e => setStatus([p._id], e.target.value)}>
              {['Pending', 'Success', 'Failed', 'Overlap Violation'].map(s => <option key={s}>{s}</option>)}</select>
          </summary>
          <div style={{ marginTop: '1rem' }}>
            <label>Amplicon name</label>
            <input type="text" defaultValue={label(p)} onBlur={e => e.target.value.trim() && e.target.value !== label(p) && rename(p.amplicon_num, e.target.value.trim())} />
            <div className="mono" style={{ margin: '.8rem 0 .2rem' }}>FP {p.fp_sequence}</div>
            <small>{p.fp_length} nt · Tm {p.fp_tm} · GC {p.fp_gc}% · hairpin {p.fp_hairpin_tm ?? 0} · 3′ stab {p.fp_end_stability ?? 0} · penalty {p.fp_penalty ?? 0}</small>
            <div className="mono" style={{ margin: '.8rem 0 .2rem' }}>RP {p.rp_sequence}</div>
            <small>{p.rp_length} nt · Tm {p.rp_tm} · GC {p.rp_gc}% · hairpin {p.rp_hairpin_tm ?? 0} · 3′ stab {p.rp_end_stability ?? 0} · penalty {p.rp_penalty ?? 0}</small>
            {p.wraps_origin && <p>Wraps the plasmid origin and overlaps Amplicon 1 by <b>{p.circular_overlap} bp</b>.</p>}
            {['Failed', 'Overlap Violation'].includes(p.status) && <div style={{ marginTop: '1rem' }}><Redesign p={p} project={project} setProject={setProject} /></div>}
          </div>
        </details>))}
    </>)
}

export function Gel({ project, setProject }) {
  const best = bestPrimers(project), ctrls = project.control_primers || []
  const [sel, setSel] = useState(best[0]?._id), [res, setRes] = useState('Pass'), [cs, setCs] = useState([])
  const [file, setFile] = useState(null), [notes, setNotes] = useState(''), [nl, setNl] = useState(1), [labels, setLabels] = useState({}), [flt, setFlt] = useState('all'), [gelMsg, setGelMsg] = useState(null)
  if (!best.length) return <div className="note">Design primers first.</div>
  const p = best.find(x => x._id === +sel) || best[0]
  const MB = b => (b / 1048576).toFixed(2) + ' MB'
  const gsrc = r => `data:${r.gel_image_mime || 'image/png'};base64,${r.gel_image_b64}`
  const save = async () => {
    const img = file ? await shrinkImage(file) : null
    const run = { id: Math.max(0, ...project.pcr_runs.map(r => r.id || 0)) + 1, primer_id: p._id, amplicon_num: p.amplicon_num, fp_sequence: p.fp_sequence, rp_sequence: p.rp_sequence,
      result: res, gel_image_b64: img ? img.b64 : null, gel_image_mime: img ? img.mime : null, lane_labels: Array.from({ length: nl }, (_, i) => labels[i] || `Lane ${i + 1}`),
      control_ids: cs, control_names: ctrls.filter(c => cs.includes(c.id)).map(c => c.name), notes, run_date: now() }
    setProject({ ...project, pcr_runs: [...project.pcr_runs, run],
      primers: project.primers.map(x => x._id === p._id ? { ...x, status: res === 'Pass' ? 'Success' : 'Failed' } : x) })
    setFile(null); setNotes(''); setCs([])
    setGelMsg(!img ? null : img.undecodable ? { w: true, t: 'This browser could not read the image, so it was saved at full size (' + MB(img.before) + ') and cannot be previewed. Convert TIFF files to PNG or JPG for smaller projects.' }
      : img.resized ? { t: `Gel image reduced from ${MB(img.before)} to ${MB(img.after)}.` } : { t: `Gel image kept as is (${MB(img.before)}), already small.` })
  }
  const removeRun = r => {
    if (!window.confirm(`Delete this PCR run (Amplicon ${r.amplicon_num}, ${r.run_date})? This also removes its gel image from the project.`)) return
    setProject({ ...project, pcr_runs: project.pcr_runs.filter(x => x !== r) })
  }
  const runs = project.pcr_runs.filter(r => flt === 'all' || r.amplicon_num === +flt)
  return (
    <>
      <div className="card"><h3>Log a PCR run</h3>
        <div className="row c2">
          <div>
            <label>Primer pair</label><select value={p._id} onChange={e => setSel(e.target.value)}>{best.map(x => <option key={x._id} value={x._id}>{label(x)} (v{x.version})</option>)}</select>
            <label style={{ marginTop: '.8rem' }}>Result</label>
            <select value={res} onChange={e => setRes(e.target.value)}><option>Pass</option><option>Fail</option></select>
            <label style={{ marginTop: '.8rem' }}>Control pair(s) used on this gel</label>
            {ctrls.length ? ctrls.map(c => <label key={c.id}><input type="checkbox" checked={cs.includes(c.id)} onChange={e => setCs(e.target.checked ? [...cs, c.id] : cs.filter(x => x !== c.id))} /> {c.name}</label>)
              : <small>No control primers yet. Add them in the Control primers tab.</small>}
          </div>
          <div>
            <label>Gel image</label><input type="file" accept=".png,.jpg,.jpeg,.tif" onChange={e => setFile(e.target.files[0])} />
            <label style={{ marginTop: '.8rem' }}>Notes</label><textarea style={{ minHeight: 80, fontFamily: 'inherit' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Band size, anomalies…" />
          </div>
        </div>
        <label style={{ marginTop: '1rem' }}>Lanes in this gel image (descriptive; the run records one overall result)</label>
        <input type="number" min="1" max="15" value={nl} style={{ maxWidth: 120 }} onChange={e => setNl(Math.max(1, Math.min(15, +e.target.value || 1)))} />
        <div className="row c3" style={{ margin: '.8rem 0' }}>{Array.from({ length: nl }, (_, i) => (
          <div key={i}><label>Lane {i + 1} label</label><input type="text" placeholder={`Lane ${i + 1}`} value={labels[i] || ''} onChange={e => setLabels({ ...labels, [i]: e.target.value })} /></div>))}</div>
        <button className="btn btn-primary" onClick={save}>Save run</button>
        {gelMsg && <div className={`note ${gelMsg.w ? 'warn' : ''}`} style={{ marginTop: '1rem' }}>{gelMsg.t}</div>}
        {['Failed', 'Overlap Violation'].includes(p.status) && <div className="note warn" style={{ marginTop: '1rem' }}>{label(p)} is {p.status}. Open the Progress tracker to redesign it.</div>}
      </div>
      <div className="section-title">PCR run archive</div>
      <select style={{ maxWidth: 260, marginBottom: '1rem' }} value={flt} onChange={e => setFlt(e.target.value)}>
        <option value="all">All amplicons</option>{[...new Set(project.pcr_runs.map(r => r.amplicon_num))].sort((a, b) => a - b).map(n => <option key={n} value={n}>Amplicon {n}</option>)}</select>
      {!runs.length && <div className="note">No runs logged yet.</div>}
      {runs.map(r => (
        <details className="card" key={r.id} style={{ padding: '.8rem 1.2rem' }}>
          <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' }}>
            <span>Amplicon {r.amplicon_num} · {r.run_date} · <Badge s={r.result === 'Pass' ? 'Success' : 'Failed'} /></span>
            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto', color: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={e => { e.preventDefault(); e.stopPropagation(); removeRun(r) }}>Delete run</button></summary>
          <div className="row c2" style={{ marginTop: '1rem' }}>
            <div><p><b>Controls:</b> {(r.control_names || []).join(', ') || '—'}</p><p><b>Notes:</b> {r.notes || '—'}</p>
              <p><b>Lanes:</b> {(r.lane_labels || []).map((l, i) => `${i + 1}: ${l}`).join('; ') || '—'}</p>
              <div className="mono">FP {r.fp_sequence}</div><div className="mono">RP {r.rp_sequence}</div></div>
            <div>{r.gel_image_b64 ? <><img alt="Gel" style={{ maxWidth: '100%', borderRadius: 8 }} src={gsrc(r)} />
              <a className="btn btn-secondary btn-sm" style={{ marginTop: '.5rem' }} download={`gel_amp${r.amplicon_num}.${(r.gel_image_mime || '').includes('jpeg') ? 'jpg' : 'png'}`} href={gsrc(r)}>Download gel image</a></> : <small>No gel image uploaded.</small>}</div>
          </div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: '1rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => removeRun(r)}>Delete this run</button>
        </details>))}
    </>)
}

const COLS = [['name', 'Control name'], ['target', 'Target gene'], ['fp_sequence', "Forward (5′→3′)"], ['rp_sequence', "Reverse (5′→3′)"], ['expected_size', 'Expected size (bp)'], ['notes', 'Notes']]
export function Controls({ project, setProject }) {
  const cur = project.control_primers || []
  const [rows, setRows] = useState(cur.length ? cur.map(c => ({ ...c })) : [{}]), [msgs, setMsgs] = useState({ e: [], w: [], ok: false })
  const save = async (list = rows) => {
    try {
      const d = await checkControls({ rows: list, existing: cur })
      if (d.errors.length) return setMsgs({ e: d.errors, w: d.warnings, ok: false })
      setProject({ ...project, control_primers: d.controls }); setRows(d.controls.length ? d.controls.map(c => ({ ...c })) : [{}])
      setMsgs({ e: [], w: d.warnings, ok: true })
    } catch (e) { setMsgs({ e: [e.message], w: [], ok: false }) }
  }
  const imp = async f => {
    try { const d = await importControls({ content: await toB64(f), filename: f.name }); await save([...rows.filter(r => r.name || r.fp_sequence || r.rp_sequence), ...d.rows]) }
    catch (e) { setMsgs({ e: [e.message], w: [], ok: false }) }
  }
  const set = (i, k, v) => setRows(rows.map((r, j) => j === i ? { ...r, [k]: v } : r))
  return (
    <>
      <div className="note">One row per primer pair. Tm, GC% and length are calculated on save. For expected size, note whether it is the genomic or cDNA product.</div>
      {msgs.e.map((x, i) => <div className="note err" key={i}>{x}</div>)}{msgs.w.map((x, i) => <div className="note warn" key={i}>{x}</div>)}
      {msgs.ok && <div className="note">Control primers saved. Remember to save the project (.gedit).</div>}
      <div className="card"><label>Import from CSV or Excel (Name, Target, Forward, Reverse, Expected size, Notes)</label>
        <input type="file" accept=".csv,.xlsx" onChange={e => e.target.files[0] && imp(e.target.files[0])} /></div>
      <div className="tbl-wrap"><table><thead><tr>{COLS.map(c => <th key={c[0]}>{c[1]}</th>)}<th></th></tr></thead><tbody>
        {rows.map((r, i) => <tr key={i}>{COLS.map(([k]) => <td key={k}><input type={k === 'expected_size' ? 'number' : 'text'} value={r[k] ?? ''} onChange={e => set(i, k, e.target.value)} /></td>)}
          <td><button className="btn btn-secondary btn-sm" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Delete</button></td></tr>)}</tbody></table></div>
      <div style={{ display: 'flex', gap: '.5rem', margin: '1rem 0' }}>
        <button className="btn btn-secondary" onClick={() => setRows([...rows, {}])}>Add row</button>
        <button className="btn btn-primary" onClick={() => save()}>Save control primers</button></div>
      {cur.length > 0 && <><div className="section-title">Calculated properties</div><div className="tbl-wrap"><table><thead><tr>
        {['Name', 'FP len', 'FP Tm', 'FP GC%', 'RP len', 'RP Tm', 'RP GC%', 'Expected'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>
        {cur.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.fp_length}</td><td>{c.fp_tm}</td><td>{c.fp_gc}</td><td>{c.rp_length}</td><td>{c.rp_tm}</td><td>{c.rp_gc}</td><td>{c.expected_size ?? '—'}</td></tr>)}</tbody></table></div></>}
    </>)
}

export function ReportCard({ project, si }) {
  const [o, setO] = useState({ fmt: 'word', author: '', lab: 'Division of Plant Physiology, ICAR-IARI', include_controls: true, include_gels: true, include_history: true, include_sequence: true, include_comments: true })
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState({ e: '', w: [] })
  const run = async () => {
    setBusy(true); setMsg({ e: '', w: [] })
    const { fmt: f, ...options } = o, w = []
    try {
      for (const k of f === 'both' ? ['word', 'pdf'] : [f]) {
        const r = await buildReport(k, { project, seq_info: si, options: { ...options, include_comments: o.include_comments && k === 'word' } })
        saveBlob(r.blob, `${project.project_name}_report.${k === 'word' ? 'docx' : 'pdf'}`)
        if (r.skipped) w.push(`Word comments skipped: ${r.skipped}.`)
        if (r.mismatches.length) w.push(`These primers do not match the vector at their recorded position: ${r.mismatches.join(', ')}. Check before submission.`)
      }
      setMsg({ e: '', w })
    } catch (e) { setMsg({ e: e.message, w }) } finally { setBusy(false) }
  }
  const T = (k, t) => <label><input type="checkbox" checked={o[k]} onChange={e => setO({ ...o, [k]: e.target.checked })} /> {t}</label>
  return (
    <div className="card"><h3>Full report (Word / PDF)</h3>
      <p style={{ fontSize: '.9rem', marginBottom: '1rem' }}>Project info, design parameters, Rule 1–5 verification, circular map, primer table, control primers, PCR run log, gel images and the annotated vector sequence.</p>
      <div className="row c3">
        <div><label>Format</label><select value={o.fmt} onChange={e => setO({ ...o, fmt: e.target.value })}><option value="word">Word (.docx)</option><option value="pdf">PDF</option><option value="both">Both</option></select></div>
        <div><label>Prepared by (optional)</label><input type="text" value={o.author} onChange={e => setO({ ...o, author: e.target.value })} /></div>
        <div><label>Laboratory / Institute</label><input type="text" value={o.lab} onChange={e => setO({ ...o, lab: e.target.value })} /></div>
      </div>
      <div style={{ margin: '1rem 0', display: 'grid', gap: '.3rem' }}>{T('include_controls', 'Include control primers')}{T('include_gels', 'Include gel images')}{T('include_history', 'Include redesign history')}
        {T('include_sequence', 'Appendix A: vector sequence with annotated primers')}{T('include_comments', 'Word only: add a comment on each primer')}</div>
      <button className="btn btn-primary" disabled={busy || !bestPrimers(project).length} onClick={run}>{busy ? 'Building report…' : 'Generate report'}</button>
      {msg.e && <div className="note err" style={{ marginTop: '1rem' }}>{msg.e}</div>}{msg.w.map((x, i) => <div className="note warn" style={{ marginTop: '1rem' }} key={i}>{x}</div>)}
    </div>)
}
