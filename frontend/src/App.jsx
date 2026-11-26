import { useState, useEffect } from 'react'
import About from './About.jsx'
import VectorMap from './VectorMap.jsx'
import { Tracker, Gel, Controls, ReportCard } from './Tabs.jsx'
import { localStamp, parseSeq, designPrimers, exportFile, saveBlob, bestPrimers, newProject, recordVisit } from './api.js'

const fmt = v => (v === null || v === undefined ? 'N/A' : v)
const Badge = ({ s }) => <span className={`badge b-${String(s).replace(/ /g, '-')}`}>{s}</span>

const LOGOS = [['ICAR', 'icar.png'], ['IARI', 'iari.png']]
function Logo({ name, file, size = 40 }) {
  const [bad, setBad] = useState(false)
  const st = { height: size, width: size }
  return bad ? <div className="logo" style={st}>{name}</div>
    : <img className="logo" style={{ ...st, objectFit: 'contain', padding: 3 }} src={`/logos/${file}`} alt={`${name} logo`} onError={() => setBad(true)} />
}

function Navbar({ page, setPage }) {
  const [sc, setSc] = useState(false)
  useEffect(() => { const f = () => setSc(window.scrollY > 20); window.addEventListener('scroll', f); return () => window.removeEventListener('scroll', f) }, [])
  const items = [['home', 'Home'], ['tool', 'Tool'], ['about', 'About & Policies']]
  return (
    <header className={`navbar ${sc ? 'scrolled' : ''}`}><div className="wrap nav-in">
      <div className="brand">
        {LOGOS.map(([n, f]) => <Logo key={n} name={n} file={f} />)}
        <h2>GE-EDIT</h2>
      </div>
      <ul className="nav-menu">{items.map(([k, t]) => (
        <li key={k}><button className={`nav-link ${page === k ? 'active' : ''}`} onClick={() => setPage(k)}>{t}</button></li>))}
      </ul>
    </div></header>
  )
}

function Footer() {
  const [n, setN] = useState(null)
  useEffect(() => { recordVisit().then(d => setN(d.total_visits)).catch(() => setN(null)) }, [])
  return (
    <footer className="footer"><div className="footer-in">
      <div className="footer-top">{LOGOS.slice(0, 1).map(([n, f]) => <Logo key={n} name={n} file={f} size={56} />)}<div><h3>GE-EDIT</h3>
        <p>Division of Plant Physiology, ICAR-Indian Agricultural Research Institute</p>
        <span className="counter">Page visitors: {n === null ? '—' : n.toLocaleString()}</span></div>{LOGOS.slice(1).map(([n, f]) => <Logo key={n} name={n} file={f} size={56} />)}</div>
      <p>Your project lives in this browser tab only. Download the .gedit file often to avoid losing work.</p>
    </div></footer>
  )
}

function Home({ go }) {
  return (
    <div className="wrap">
      <section className="hero">
        <div>
          <h1>GE-EDIT</h1>
          <p className="sub">Overlapping PCR primer design and progress monitoring for genome-edited plants</p>
          <p>Design a set of overlapping amplicons that cover your whole circular vector, track each PCR on the bench, and export the evidence needed for the genome-edited plant exemption.</p>
          <button className="btn btn-primary" onClick={() => go('tool')}>Launch GE-EDIT</button>
        </div>
        <img src="/hero-illustration.png" alt="Circular plasmid covered by overlapping PCR amplicons around a seedling" style={{ width: '100%', maxWidth: 520, justifySelf: 'center' }} />
      </section>
      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Protocol rules enforced</h3>
        <ul className="rules">
          <li>Amplicon 1 forward primer starts at base 1</li>
          <li>Every amplicon is 150–500 bp</li>
          <li>Consecutive amplicons overlap by at least 50 bp</li>
          <li>Full vector coverage with no gaps</li>
          <li>Circular closure: the last amplicon overlaps Amplicon 1 across the origin</li>
        </ul>
      </div>
    </div>
  )
}

function Hub({ onOpen }) {
  const [name, setName] = useState(''), [mode, setMode] = useState('file'), [text, setText] = useState('')
  const [file, setFile] = useState(null), [si, setSi] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    setErr(''); setSi(null)
    if (mode === 'file' ? !file : !text.trim()) return
    let stale = false
    const t = setTimeout(async () => {
      setBusy(true)
      try {
        const body = mode === 'file' ? { text: await file.text(), filename: file.name } : { text, name: name || 'Pasted_Sequence' }
        const r = await parseSeq(body)
        if (!stale) setSi(r)
      } catch (e) { if (!stale) setErr(e.message) } finally { if (!stale) setBusy(false) }
    }, 400)
    return () => { stale = true; clearTimeout(t) }
  }, [mode, file, text])
  const openGedit = async f => {
    try {
      const p = JSON.parse(await f.text())
      if (!p.project_name) throw new Error('Not a valid GE-EDIT (.gedit) file.')
      onOpen({ project: { design_params: {}, control_primers: [], ...p },
        si: { name: p.vector_name, sequence: p.vector_sequence, length: p.vector_length, features: p.vector_features || [] } })
    } catch (e) { setErr(e.message) }
  }
  return (
    <>
      <div className="note warn"><b>No server-side saving.</b> Your project stays in this browser tab. Use Save Project (.gedit) often and re-open it to resume.</div>
      <div className="card"><h3>Create a new project</h3>
        <div className="row c2">
          <div><label>Project name</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Optional. Defaults to the sequence name" /></div>
          <div><label>Sequence input</label>
            <select value={mode} onChange={e => { setMode(e.target.value); setSi(null) }}>
              <option value="file">Upload file (FASTA or GenBank)</option><option value="paste">Paste sequence</option></select></div>
        </div>
        <div style={{ margin: '1rem 0' }}>
          {mode === 'file'
            ? <input type="file" accept=".fa,.fasta,.fna,.gb,.gbk,.genbank" onChange={e => setFile(e.target.files[0])} />
            : <textarea value={text} onChange={e => setText(e.target.value)} placeholder={'>MyPlasmid\nATGC…  or a GenBank record, or raw letters'} />}
        </div>
        {busy && <div className="note">Reading sequence…</div>}
        {err && <div className="note err" style={{ marginTop: '1rem' }}>{err}</div>}
        {si && <div style={{ marginTop: '1rem' }}>
          <div className="note">Read <b>{si.name}</b>: {si.length.toLocaleString()} bp, {si.features.length} features. It will be treated as a circular plasmid.</div>
          <button className="btn btn-primary" onClick={() => onOpen({ project: newProject(name.trim() || si.name, si), si })}>Create project</button></div>}
      </div>
      <div className="card"><h3>Open a saved project</h3>
        <input type="file" accept=".gedit,.json" onChange={e => e.target.files[0] && openGedit(e.target.files[0])} />
      </div>
    </>
  )
}

function Downloads({ primers, project, si, title }) {
  const [err, setErr] = useState('')
  const n = project.project_name
  const dl = (kind, file) => async () => {
    setErr('')
    try { saveBlob(await exportFile(kind, { primers, project_name: n, seq_info: si }), file) }
    catch (e) { setErr(e.message) }
  }
  const saveProject = () => saveBlob(new Blob([JSON.stringify({ ...project, last_saved: localStamp() }, null, 2)], { type: 'application/json' }), `${n}.gedit`)
  return (
    <div className="card"><h3>{title}</h3>
      <div className="row" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        <button className="btn btn-secondary" onClick={dl('order-csv', `${n}_order_primers.csv`)}>Order primers (CSV)</button>
        <button className="btn btn-secondary" onClick={dl('excel', `${n}_primers_full.xlsx`)}>Full results (Excel, long format)</button>
        <button className="btn btn-secondary" onClick={dl('summary-excel', `${n}_primers_summary.xlsx`)}>Summary results (Excel, short format)</button>
        <button className="btn btn-secondary" onClick={dl('genbank', `${n}_annotated.gb`)}>GenBank (.gb)</button>
        <button className="btn btn-primary" onClick={saveProject}>Save project (.gedit)</button>
      </div>
      {err && <div className="note err" style={{ marginTop: '1rem' }}>{err}</div>}
    </div>
  )
}

function DesignTab({ project, setProject, si }) {
  const [v, setV] = useState({ max_amp: 500, min_over: 50, opt_tm: 60, min_tm: 58, max_tm: 62 })
  const [replace, setReplace] = useState(false), [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null), [err, setErr] = useState('')
  const set = k => e => setV({ ...v, [k]: Number(e.target.value) })
  const run = async () => {
    setBusy(true); setErr('')
    try {
      const d = await designPrimers({ sequence: project.vector_sequence, ...v })
      const base = replace ? [] : project.primers
      const off = base.length
      const added = d.primers.map(p => ({ ...p, _id: p._id + off }))
      setProject({ ...project, primers: [...base, ...added], design_params: { ...d.design_params, designed_at: localStamp() } })
      setRes(d)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const best = bestPrimers(project)
  const Num = (k, lbl, min, max, step = 1) => (
    <div><label>{lbl}</label><input type="number" min={min} max={max} step={step} value={v[k]} onChange={set(k)} /></div>)
  return (
    <>
      <div className="note">Circular plasmid mode: the last amplicon is designed to read through the origin and overlap Amplicon 1.</div>
      <div className="card"><h3>Design parameters</h3>
        <div className="row c3">
          <div className="row">{Num('max_amp', 'Max amplicon size (bp)', 300, 500, 50)}{Num('min_over', 'Min overlap (bp)', 50, 150, 10)}</div>
          <div className="row">{Num('opt_tm', 'Optimal Tm (°C)', 55, 65, .5)}{Num('min_tm', 'Min Tm (°C)', 50, 60, .5)}{Num('max_tm', 'Max Tm (°C)', 60, 70, .5)}</div>
          <div><label>Fixed by protocol</label><p style={{ fontSize: '.9rem' }}>Min amplicon 150 bp<br />Primer length 18–25 nt<br />GC 40–60%<br />Amplicon 1 starts at base 1</p></div>
        </div>
        {best.length > 0 && <label style={{ margin: '1rem 0' }}><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} /> Replace the existing primer set (otherwise the new run is added alongside it)</label>}
        <button className="btn btn-primary" onClick={run} disabled={busy}>{busy ? 'Designing with Primer3…' : 'Design primers'}</button>
        {err && <div className="note err" style={{ marginTop: '1rem' }}>{err}</div>}
      </div>
      {res && (res.violations.length
        ? <div className="note err"><b>Rule violations</b>{res.violations.map((x, i) => <div key={i}>{x}</div>)}</div>
        : <div className="note">All protocol rules passed.</div>)}
      {best.length > 0 && <Downloads primers={res ? res.primers : best} project={project} si={si}
        title={res ? 'Download this design run' : 'Download the current primer set'} />}
      {best.length > 0 && <>
        <div className="section-title">Current primer set</div>
        <div className="tbl-wrap"><table><thead><tr>
          {['Amp', 'Name', 'Status', 'Forward (5′→3′)', 'Tm', 'GC%', 'Reverse (5′→3′)', 'Tm', 'GC%', 'Length', 'Overlap up', 'Overlap down'].map(h => <th key={h}>{h}</th>)}
        </tr></thead><tbody>{best.map(p => (
          <tr key={p._id}><td>{p.amplicon_num}</td><td>{p.amplicon_name}</td><td><Badge s={p.status} /></td>
            <td className="mono">{p.fp_sequence}</td><td>{p.fp_tm}</td><td>{p.fp_gc}</td>
            <td className="mono">{p.rp_sequence}</td><td>{p.rp_tm}</td><td>{p.rp_gc}</td>
            <td>{p.amplicon_length}</td><td>{fmt(p.overlap_prev)}</td><td>{fmt(p.overlap_next)}</td></tr>))}
        </tbody></table></div></>}
    </>
  )
}

function ExportTab({ project, si }) {
  const [err, setErr] = useState('')
  const best = bestPrimers(project), n = project.project_name
  const dl = (kind, file, all) => async () => {
    setErr('')
    try { saveBlob(await exportFile(kind, { primers: all ? project.primers : best, project_name: n, seq_info: si }), file) }
    catch (e) { setErr(e.message) }
  }
  const saveProject = () => saveBlob(new Blob([JSON.stringify({ ...project, last_saved: localStamp() }, null, 2)], { type: 'application/json' }), `${n}.gedit`)
  return (
    <>
      <div className="card"><h3>Save project</h3>
        <button className="btn btn-primary" onClick={saveProject}>Download .gedit project file</button>
        <p style={{ marginTop: '.75rem', fontSize: '.9rem' }}>Holds primers, gel images, PCR runs, control primers and redesign history.</p></div>
      <div className="card"><h3>Result files</h3>
        {!best.length && <div className="note warn">Design primers first.</div>}
        <div className="row c2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
          <button className="btn btn-secondary" disabled={!best.length} onClick={dl('order-csv', `${n}_order_primers.csv`)}>Order primers (CSV)</button>
          <button className="btn btn-secondary" disabled={!best.length} onClick={dl('summary-excel', `${n}_primers_summary.xlsx`)}>Summary (Excel)</button>
          <button className="btn btn-secondary" disabled={!best.length} onClick={dl('excel', `${n}_primers_full.xlsx`, true)}>Full results (Excel)</button>
          <button className="btn btn-secondary" disabled={!best.length} onClick={dl('genbank', `${n}_annotated.gb`)}>GenBank (.gb)</button>
        </div>
        {err && <div className="note err" style={{ marginTop: '1rem' }}>{err}</div>}
      </div>
      <ReportCard project={project} si={si} />
    </>
  )
}

const Soon = ({ t }) => <div className="card soon"><h3>{t}</h3><p>Coming in the next build. The backend modules for this tab already exist.</p></div>

function Tool({ state, setState, tab, setTab }) {
  if (!state) return <div className="wrap" style={{ paddingTop: '2rem' }}><div className="section-title">Project hub</div><Hub onOpen={setState} /></div>
  const { project, si } = state
  const setProject = p => setState({ ...state, project: p })
  const best = bestPrimers(project)
  const cnt = s => best.filter(p => s.includes(p.status)).length
  const tabs = [['design', 'Design primers'], ['map', 'Vector map'], ['controls', 'Control primers'], ['tracker', 'Progress tracker'], ['gel', 'Gel upload'], ['export', 'Export']]
  return (
    <div className="wrap" style={{ paddingTop: '1.5rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.8rem 1.25rem' }}>
        <div><b>{project.project_name}</b> <span style={{ color: 'var(--brand-muted)', fontSize: '.85rem' }}>{project.vector_name} · {project.vector_length.toLocaleString()} bp · created {project.created_at}</span></div>
        <button className="btn btn-secondary btn-sm" onClick={() => setState(null)}>Close project</button>
      </div>
      <div className="metrics">
        {[[best.length, 'Total amplicons'], [cnt(['Success', 'Done']), 'Success'], [cnt(['Pending']), 'Pending'], [cnt(['Failed', 'Overlap Violation']), 'Failed']].map(([a, b]) =>
          <div className="metric" key={b}><b>{a}</b><span>{b}</span></div>)}
      </div>
      <nav className="tabs">{tabs.map(([k, t]) => <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{t}</button>)}</nav>
      <div style={{ display: tab === 'design' ? 'block' : 'none' }}><DesignTab project={project} setProject={setProject} si={si} /></div>
      {tab === 'export' && <ExportTab project={project} si={si} />}
      {tab === 'map' && (best.length ? <VectorMap si={si} primers={best} projectName={project.project_name} /> : <div className="note">Design primers first.</div>)}
      {tab === 'controls' && <Controls project={project} setProject={setProject} />}
      {tab === 'tracker' && <Tracker project={project} setProject={setProject} />}
      {tab === 'gel' && <Gel project={project} setProject={setProject} />}
    </div>
  )
}

const PAGES = ['home', 'tool', 'about']
const TITLES = { home: 'GE-EDIT | Overlapping PCR primer design for genome-edited plants', tool: 'GE-EDIT | Primer design tool', about: 'GE-EDIT | About and policies' }
const TAB_KEYS = ['design', 'map', 'controls', 'tracker', 'gel', 'export']
// Routes: #/home  #/about  #/tool  #/tool/<tab>
const readRoute = () => {
  const [pg, tb] = window.location.hash.replace(/^#\/?/, '').split('/')
  return { page: PAGES.includes(pg) ? pg : 'home', tab: TAB_KEYS.includes(tb) ? tb : 'design', hasTab: TAB_KEYS.includes(tb) }
}

export default function App() {
  const [route, setRoute] = useState(readRoute)
  const page = route.page
  useEffect(() => {
    const f = () => { const r = readRoute(); setRoute(prev => ({ page: r.page, tab: r.hasTab ? r.tab : prev.tab })); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f)
  }, [])
  useEffect(() => { document.title = TITLES[page] }, [page])
  const setPage = p => { window.location.hash = p === 'tool' ? `/tool/${route.tab}` : '/' + p }
  const setTab = t => { window.location.hash = `/tool/${t}` }
  const [state, setState] = useState(null)
  useEffect(() => {
    if (!state) return
    const f = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', f); return () => window.removeEventListener('beforeunload', f)
  }, [state])
  return (
    <>
      <Navbar page={page} setPage={setPage} />
      <main style={{ minHeight: '70vh' }}>
        {page === 'home' && <Home go={setPage} />}
        {page === 'tool' && <Tool state={state} setState={setState} tab={route.tab} setTab={setTab} />}
        {page === 'about' && <About go={setPage} />}
      </main>
      <Footer />
    </>
  )
}
