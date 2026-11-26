import { useState, useMemo, useEffect } from 'react'

const CX = 400, CY = 400
const RING = [{ o: 300, i: 260 }, { o: 248, i: 208 }]          // alternating amplicon bands
const BACKBONE = 322, TICK_OUT = 334, TICK_LBL = 348, LEADER_END = 360, LABEL_R = 372
const COLORS = { Success: '#2F7D4F', Done: '#2F7D4F', Pending: '#B8862B', Failed: '#B3392C',
  'Overlap Violation': '#6A4FA0', 'Design Failed': '#4C5A50', Redesigned: '#1F5C45' }

const polar = (r, deg) => { const a = deg * Math.PI / 180; return [CX + r * Math.sin(a), CY - r * Math.cos(a)] }
const arc = (a1, a2, ro, ri) => {
  const big = a2 - a1 > 180 ? 1 : 0
  const [x1, y1] = polar(ro, a1), [x2, y2] = polar(ro, a2), [x3, y3] = polar(ri, a2), [x4, y4] = polar(ri, a1)
  return `M ${x1} ${y1} A ${ro} ${ro} 0 ${big} 1 ${x2} ${y2} L ${x3} ${y3} A ${ri} ${ri} 0 ${big} 0 ${x4} ${y4} Z`
}
const ovBadge = v => v == null ? 'N/A' : v >= 50 ? `${v} bp` : `${v} bp (below 50)`

export default function VectorMap({ si, primers, projectName }) {
  const title = projectName || si.name
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
  const L = si.length, ang = bp => (bp / L) * 360
  const [sel, setSel] = useState(null), [hover, setHover] = useState(null), [showSeq, setShowSeq] = useState(false)
  useEffect(() => { const f = e => e.key === 'Escape' && setSel(null); window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f) }, [])

  const seqLines = useMemo(() => {
    if (!showSeq) return null
    const s = si.sequence || '', out = []
    for (let i = 0; i < s.length; i += 60) {
      const seg = s.slice(i, i + 60), parts = []
      for (let j = 0; j < seg.length; j += 10) {
        const blk = seg.slice(j, j + 10)
        parts.push(blk.length === 10 ? <span key={j}>{blk.slice(0, 9)}<b style={{ color: 'var(--brand-accent)' }}>{blk[9]}</b></span> : <span key={j}>{blk}</span>)
      }
      out.push(<div key={i}><span style={{ color: '#8A9486', fontSize: 10 }}>{String(i + 1).padStart(6)}  </span>{parts}</div>)
    }
    return out
  }, [showSeq, si.sequence])

  const p = sel != null ? primers[sel] : null
  const col = a => COLORS[a.status] || '#66705F'
  const last = primers[primers.length - 1]
  const Row = ({ k, v }) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '.25rem 0', borderBottom: '1px solid var(--border)', fontSize: '.88rem' }}><span style={{ color: 'var(--brand-muted)' }}>{k}</span><span className="mono" style={{ whiteSpace: 'normal', wordBreak: 'break-all', textAlign: 'right' }}>{v}</span></div>

  return (
    <>
      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ fontSize: '.88rem', marginBottom: '.5rem' }}><b>{title}</b> · {L.toLocaleString()} bp · click any amplicon for details · Esc to close</div>
        <svg viewBox="0 0 800 800" style={{ width: '100%', maxWidth: 680, display: 'block', margin: '0 auto' }} role="img" aria-label="Circular vector map">
          <circle cx={CX} cy={CY} r={BACKBONE} fill="none" stroke="#B9B39E" strokeWidth="2" />
          {Array.from({ length: 10 }, (_, i) => {
            const bp = Math.round(i / 10 * L), a = ang(bp), [x1, y1] = polar(BACKBONE, a), [x2, y2] = polar(TICK_OUT, a), [tx, ty] = polar(TICK_LBL, a)
            return <g key={i}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8A9486" /><text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#66705F">{bp >= 1000 ? (bp / 1000).toFixed(1) + 'k' : bp}</text></g>
          })}
          <text x={CX} y={CY - BACKBONE - 14} textAnchor="middle" fontSize="9" fontWeight="700" fill="#B8862B">1 bp</text>
          {primers.slice(0, -1).map((c, i) => { const n = primers[i + 1]; return c.amplicon_end - n.amplicon_start > 0 &&
            <path key={'o' + i} d={arc(ang(n.amplicon_start), ang(c.amplicon_end), RING[0].o, RING[1].i)} fill="#B8862B" opacity=".18" /> })}
          {last?.wraps_origin && last.amplicon_end > L &&
            <path d={arc(0, ang(last.amplicon_end - L), RING[0].o, RING[1].i)} fill="#2E9CA6" opacity=".25" />}
          {primers.map((a, i) => {
            const r = RING[i % 2], a1 = ang(a.amplicon_start); let a2 = ang(a.amplicon_end); if (a2 <= a1) a2 = a1 + .5
            const mid = (a1 + a2) / 2, mr = (r.o + r.i) / 2, [fx, fy] = polar(mr, a1), [rx, ry] = polar(mr, a2)
            const [lx1, ly1] = polar(r.o, mid), [lx2, ly2] = polar(LEADER_END, mid), [tx, ty] = polar(LABEL_R, mid)
            return (
              <g key={i}>
                <path d={arc(a1, a2, r.o, r.i)} fill={col(a)} opacity={hover === i || sel === i ? 1 : .82} stroke="#fff" strokeWidth=".7" style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setSel(i)} />
                <circle cx={fx} cy={fy} r="4" fill="#fff" opacity=".8" pointerEvents="none" /><circle cx={rx} cy={ry} r="4" fill="#FF8A80" opacity=".9" pointerEvents="none" />
                <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={col(a)} opacity=".8" pointerEvents="none" />
                <text x={tx} y={ty} textAnchor={tx >= CX - 1 ? 'start' : 'end'} dominantBaseline="middle" fontSize="10" fontWeight="700" fill="#1C2B24" pointerEvents="none">A{a.amplicon_num}</text>
              </g>)
          })}
          <text x={CX} y={CY - 18} textAnchor="middle" fontSize={title.length > 24 ? 15 : 20} fontWeight="700" fill="#1F5C45"><title>{title}</title>{clip(title, 36)}</text>
          {projectName && si.name && si.name !== projectName && <text x={CX} y={CY + 4} textAnchor="middle" fontSize="12" fill="#66705F">{clip(si.name, 40)}</text>}
          <text x={CX} y={CY + 26} textAnchor="middle" fontSize="14" fill="#66705F">{L.toLocaleString()} bp (circular)</text>
        </svg>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.9rem', justifyContent: 'center', fontSize: '.8rem', marginTop: '.5rem' }}>
          {['Success', 'Pending', 'Failed', 'Overlap Violation', 'Redesigned'].map(s => <span key={s}><span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: 3, background: COLORS[s], marginRight: 5 }} />{s}</span>)}
          <span><span style={{ display: 'inline-block', width: 11, height: 8, background: '#B8862B', opacity: .4, marginRight: 5 }} />Overlap</span>
          <span><span style={{ display: 'inline-block', width: 11, height: 8, background: '#2E9CA6', opacity: .5, marginRight: 5 }} />Circular overlap</span>
          <span>○ white dot = FP end · red dot = RP end</span>
        </div>
      </div>

      {p && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>{p.amplicon_name} · v{p.version} · <span className={`badge b-${p.status.replace(/ /g, '-')}`}>{p.status}</span></h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setSel(null)}>Close</button>
          </div>
          <div className="row c3" style={{ marginTop: '1rem' }}>
            <div><div className="section-title" style={{ marginTop: 0 }}>Amplicon</div>
              <Row k="Position" v={`${p.amplicon_start} – ${p.amplicon_end} bp`} /><Row k="Length" v={`${p.amplicon_length} bp`} />
              <Row k={`Upstream (Amp ${p.amplicon_num - 1})`} v={ovBadge(p.overlap_prev)} /><Row k={`Downstream (Amp ${p.amplicon_num + 1})`} v={ovBadge(p.overlap_next)} />
              {p.wraps_origin && <Row k="Circular overlap" v={`${p.circular_overlap} bp with Amplicon 1`} />}<Row k="Pair penalty" v={p.pair_penalty ?? 0} /></div>
            <div><div className="section-title" style={{ marginTop: 0 }}>Forward primer</div>
              <Row k="Sequence" v={p.fp_sequence} /><Row k="Length / Tm / GC" v={`${p.fp_length} nt · ${p.fp_tm}°C · ${p.fp_gc}%`} />
              <Row k="Hairpin Tm" v={`${p.fp_hairpin_tm ?? 0}°C`} /><Row k="3′ stability (ΔG)" v={p.fp_end_stability ?? 0} /><Row k="Penalty" v={p.fp_penalty ?? 0} /></div>
            <div><div className="section-title" style={{ marginTop: 0 }}>Reverse primer</div>
              <Row k="Sequence" v={p.rp_sequence} /><Row k="Length / Tm / GC" v={`${p.rp_length} nt · ${p.rp_tm}°C · ${p.rp_gc}%`} />
              <Row k="Hairpin Tm" v={`${p.rp_hairpin_tm ?? 0}°C`} /><Row k="3′ stability (ΔG)" v={p.rp_end_stability ?? 0} /><Row k="Penalty" v={p.rp_penalty ?? 0} /></div>
          </div>
        </div>)}

      <button className="btn btn-secondary btn-sm" onClick={() => setShowSeq(!showSeq)}>{showSeq ? 'Hide vector sequence' : 'Show vector sequence (Ctrl+F searchable)'}</button>
      {showSeq && <div style={{ marginTop: '.8rem', background: '#14211A', color: '#CFE8D4', borderRadius: 8, padding: '12px 14px', maxHeight: 280, overflow: 'auto',
        fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.9, whiteSpace: 'pre' }}>{seqLines}</div>}
    </>)
}
