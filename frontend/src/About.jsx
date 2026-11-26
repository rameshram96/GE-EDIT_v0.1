import { useState } from 'react'

const DEVS = [
  { name: 'Ramesh Ramasamy', role: 'Lead Developer', details: 'PhD Scholar, Division of Plant Physiology, ICAR-IARI, New Delhi', image: '/images/developer1.png' },
  { name: 'Dr. Soham Ray', role: 'Co-Developer', details: 'Senior Scientist, Division of Plant Physiology, ICAR-IARI, New Delhi', image: '/images/developer2.jpg' },
  { name: 'Dr. Joshitha Vijayan', role: 'Molecular Biology Specialist', details: 'Scientist (Senior Scale), ICAR-National Institute for Plant Biotechnology (NIPB), New Delhi', image: '/images/developer3.jpg' },
  { name: 'Dr. Viswanathan Chinnusamy', role: 'Research Support', details: 'JD (R), Principal Scientist, Division of Plant Physiology, ICAR-IARI, New Delhi', image: '/images/developer4.jpg' },
]
const initials = n => n.replace(/\bDr\.?\s*/i, '').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()

function Dev({ d }) {
  const [bad, setBad] = useState(false)
  return (
    <div className="dev-card">
      {bad ? <div className="dev-img dev-ph">{initials(d.name)}</div>
        : <img className="dev-img" src={d.image} alt={d.name} onError={() => setBad(true)} />}
      <div className="dev-name">{d.name}</div><div className="dev-role">{d.role}</div><div className="dev-det">{d.details}</div>
    </div>)
}

const NAV = [['about-ge-edit', 'About'], ['meet-the-developers', 'Developers'], ['privacy-policy', 'Privacy Policy'], ['data-storage-disclosure', 'Data Storage Disclosure'], ['contact-us', 'Contact']]
const jump = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export default function About({ go }) {
  return (
    <div className="wrap about" style={{ paddingTop: '1.5rem', maxWidth: 1100 }}>
      <style>{`
        .about h2{font-size:1.6rem;margin:2.2rem 0 1rem;padding-bottom:.4rem;border-bottom:2px solid var(--brand-secondary);scroll-margin-top:90px}
        .about p,.about li{font-size:1rem;color:#3E4A42}.about p{margin-bottom:1rem}.about ul{padding-left:1.3rem;margin-bottom:1rem;display:grid;gap:.45rem}
        .pill{padding:.3rem .9rem;border-radius:999px;background:rgba(94,148,112,.12);color:var(--brand-primary);border:1px solid rgba(94,148,112,.3);font:600 .85rem var(--font-body);cursor:pointer}
        .pill:hover{background:rgba(94,148,112,.25)}
        .devs{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1.25rem}
        .dev-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-xl);padding:1.5rem 1rem;text-align:center;box-shadow:var(--shadow);transition:transform .2s,box-shadow .2s}
        .dev-card:hover{transform:translateY(-4px);box-shadow:0 10px 24px rgba(28,43,36,.14)}
        .dev-img{width:120px;height:120px;border-radius:50%;object-fit:cover;border:4px solid rgba(94,148,112,.35);margin:0 auto 1rem;display:block}
        .dev-ph{display:grid;place-items:center;background:rgba(94,148,112,.15);color:var(--brand-primary);font:700 2.2rem var(--font-display)}
        .dev-name{font:700 1.1rem var(--font-display);color:var(--brand-primary);margin-bottom:.2rem}.dev-role{font-weight:600;font-size:.9rem;margin-bottom:.5rem}.dev-det{font-size:.82rem;color:var(--brand-muted);line-height:1.5}
        .about td{text-align:left;vertical-align:top}
      `}</style>

      <button className="btn btn-secondary btn-sm" onClick={() => go('tool')}>← Back to GE-EDIT</button>
      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', margin: '1rem 0 0' }}>
        {NAV.map(([id, t]) => <button key={id} className="pill" onClick={() => jump(id)}>{t}</button>)}</div>

      <h2 id="about-ge-edit">About GE-EDIT</h2>
      <p>GE-EDIT is a tool for designing overlapping PCR primers across full plasmid/vector sequences, built to support regulatory exemption workflows for genome-edited plants and general vector verification in plant molecular biology.</p>
      <p>It automates primer design using Primer3, overlap validation, circular vector closure, PCR progress tracking, and report generation, replacing manual spreadsheet-based primer design workflows.</p>
      <p><b>Developed and maintained by:</b><br />Division of Plant Physiology, ICAR–Indian Agricultural Research Institute (ICAR-IARI), New Delhi.</p>

      <h2 id="meet-the-developers">Meet the Developers</h2>
      <div className="devs">{DEVS.map(d => <Dev key={d.name} d={d} />)}</div>

      <h2 id="privacy-policy">Privacy Policy</h2>
      <p>GE-EDIT does not collect, store, or transmit any personal data.</p>
      <ul>
        <li>No user accounts, logins, or personal identifiers are required or collected.</li>
        <li>No third-party trackers or analytics are used within the application.</li>
        <li>No usage data is logged or sent to any external server by this application. The only exception is a simple page-visit counter, which keeps a single running total of visits and stores no IP address, identifier or other visitor information.</li>
        <li>All uploaded sequences, primers, gel images, and project data are processed only for your active session. They are not written to a database or permanent storage and are not shared with anyone (see <i>Data Storage Disclosure</i> below).</li>
      </ul>
      <p>GE-EDIT is an independent tool developed entirely by the research team of the Division of Plant Physiology, ICAR-Indian Agricultural Research Institute. It is not part of, affiliated with, endorsed by, or linked to the Department of Biotechnology (DBT), Ministry of Science and Technology, Government of India. The tool is designed on the basis of the guidelines issued by the DBT. Users are requested to verify the current official guidelines and cross-check the tool's outputs against them before use or submission.</p>
      <p><b>Note on hosting and fonts:</b> Depending on where this application is deployed or accessed from, the underlying hosting platform (e.g. a web server) may generate standard technical access logs (such as IP address and timestamp) outside of this application's control, as is common for any web-hosted service. GE-EDIT itself does not access, use, or store this information. In addition, the interface loads the Inter, Poppins and Fira Code fonts from Google Fonts, so your browser makes a request to Google's servers when the page loads.</p>
      <p>Because nothing is retained by the application after your session ends, there is nothing for us to access, share, or delete.</p>

      <h2 id="data-storage-disclosure">Data Storage Disclosure</h2>
      <div className="note warn"><b>No auto-save.</b> GE-EDIT does not save your project to any database or user account. If the page refreshes, disconnects or times out, unsaved work is lost. Download your <b>.gedit</b> project file often.</div>
      <div className="tbl-wrap" style={{ marginBottom: '1rem' }}><table><thead><tr><th>Data</th><th>Where it lives</th><th>How long</th></tr></thead><tbody>
        <tr><td>Vector sequence, primers, PCR runs, control primers, redesign history, gel images</td><td>Temporary <b>browser memory</b> (this tab) while your session is open</td><td>Until you close or refresh the page</td></tr>
        <tr><td>Project file (<code>.gedit</code>)</td><td><b>Your own computer</b>, only when you click download</td><td>Until you delete it. You control it</td></tr>
        <tr><td>Excel / CSV / GenBank / Word / PDF exports</td><td>Generated on request and sent to your browser for download</td><td>Not retained by the app after download</td></tr>
      </tbody></table></div>
      <ul>
        <li>The <code>.gedit</code> file is a plain JSON file containing <i>everything</i>: the full vector sequence, primers, run log, control primers, and gel images (embedded). Treat it as confidential if your data are.</li>
        <li>To resume work, upload your <code>.gedit</code> file on the Project Hub.</li>
        <li>While your session is active, the data is held in your browser's memory. It is sent to the server only when you run a design, redesign, control-primer check, export or report, is processed in memory for that single request, and is not stored. The app does not write it to a database or permanent storage.</li>
        <li>Using <b>Close project</b> removes the project from the session.</li>
      </ul>

      <h2 id="contact-us">Contact Us</h2>
      <p>For questions, feedback, or collaboration, please contact the Division of Plant Physiology, ICAR-IARI, New Delhi.</p>
      <button className="btn btn-secondary btn-sm" onClick={() => go('tool')}>← Back to GE-EDIT</button>
    </div>)
}
