import { Wordmark } from '../components/Wordmark'
import { useState } from 'react'
import { CANDIDATES, coverPick, imgUrl, setCoverPick } from '../lib/look'

/** /#photos — each candidate shown exactly as the cover would look: phone-shaped, dusk shade, wordmark. */
export function PhotoPicker() {
  const [pick, setPick] = useState(coverPick())
  return (
    <div style={{ minHeight: '100vh', background: '#14142A', color: '#F5F0E8', padding: '20px 14px 40px' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Wordmark size={20} />
        <div className="imm-sub">Cover photos · tap one to try it</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, maxWidth: 760, margin: '0 auto' }}>
        {CANDIDATES.map(c => (
          <button key={c.id} onClick={() => { setCoverPick(c.id); setPick(c.id) }} style={{ padding: 0, border: pick === c.id ? '2px solid #E8A868' : '1px solid #34345A', borderRadius: 14, overflow: 'hidden', background: '#1A1A2E', color: 'inherit', textAlign: 'left' }}>
            <div style={{ position: 'relative', aspectRatio: '9 / 17', overflow: 'hidden' }}>
              <img src={imgUrl(c.id)} alt={c.what} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(.85) contrast(1.05)' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(20,20,42,.82) 0%, rgba(20,20,42,.25) 38%, rgba(30,22,36,.35) 62%, rgba(20,20,42,.9) 100%)' }} />
              <div style={{ position: 'absolute', top: '9%', left: 0, right: 0, textAlign: 'center', fontWeight: 800, letterSpacing: '.32em', fontSize: 15 }}>MASTOR</div>
              <div style={{ position: 'absolute', left: '8%', right: '8%', top: '30%', height: '16%', borderRadius: 8, background: 'rgba(37,37,64,.6)', border: '1px solid rgba(245,240,232,.18)' }} />
              <span style={{ position: 'absolute', left: 8, bottom: 8, width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', background: pick === c.id ? '#C97B3F' : 'rgba(20,20,42,.8)', border: '1px solid #E8A868', fontFamily: 'Mono, monospace', fontSize: 13 }}>{c.n}</span>
            </div>
            <div style={{ padding: '8px 10px 10px' }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{c.what}</div>
              <div style={{ fontSize: 11, color: '#B0A898', marginTop: 2 }}>{c.credit} · Unsplash</div>
              {pick === c.id && <div style={{ fontSize: 11, color: '#E8A868', marginTop: 4, fontWeight: 700 }}>✓ Trying this on your cover</div>}
            </div>
          </button>
        ))}
      </div>
      <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: '#B0A898' }}>
        Tap one, then open <a href="/" style={{ color: '#E8A868' }}>Mastor</a> to see it for real. Tell Claude the number you like.
        {pick && <div><button className="linkish" style={{ marginTop: 10 }} onClick={() => { setCoverPick(null); setPick(null) }}>Back to the default</button></div>}
      </div>
    </div>
  )
}
