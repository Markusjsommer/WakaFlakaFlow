import { useEffect, useRef, useState } from 'react';
import { getPanelMarkers, setPanelMarkers } from '../api.js';

// Collapsible "Marker names (panel editor)" card.
//
// Lets the user map each FCS channel to a marker name (e.g. BUV395-A -> CD19) so
// fluorophore-named files can be auto-annotated with cell types. The mapping is
// stored per-session on the backend and applied on the next Run (or, if a run is
// already shown, re-applied instantly via the parent's onApplied -> reannotate).
//
// Props:
//   sid       - session id
//   fileId    - currently-selected FCS file id (re-fetches on change)
//   onApplied - callback fired after the mapping is saved
export default function PanelEditor({ sid, fileId, onApplied }) {
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState([]);
  const [values, setValues] = useState({}); // channel_name -> marker text
  const [paste, setPaste] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // (Re)load the current mapping on mount and whenever the session or file changes.
  useEffect(() => {
    if (!sid) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setStatus('');
    (async () => {
      try {
        const chans = await getPanelMarkers(sid, fileId);
        if (cancelled) return;
        setChannels(chans);
        const init = {};
        for (const c of chans) init[c.channel_name] = c.marker || '';
        setValues(init);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sid, fileId]);

  function setMarker(channel, marker) {
    setValues((cur) => ({ ...cur, [channel]: marker }));
    setStatus('');
  }

  // Parse pasted lines "channel,marker" / "channel<TAB>marker" / "channel marker"
  // and fill matching inputs (channel matched case-insensitively).
  function fillFromPaste() {
    if (!paste.trim()) return;
    const byLower = new Map(channels.map((c) => [c.channel_name.toLowerCase(), c.channel_name]));
    const next = { ...values };
    let matched = 0;
    for (const raw of paste.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      let parts;
      if (line.includes(',')) parts = line.split(',');
      else if (line.includes('\t')) parts = line.split('\t');
      else parts = line.split(/\s+/);
      if (parts.length < 2) continue;
      const chan = parts[0].trim();
      const marker = parts.slice(1).join(' ').trim();
      const canonical = byLower.get(chan.toLowerCase());
      if (canonical) {
        next[canonical] = marker;
        matched += 1;
      }
    }
    setValues(next);
    setStatus(matched > 0 ? `Filled ${matched} channel${matched === 1 ? '' : 's'} from paste.` : 'No channels matched the pasted lines.');
  }

  async function apply() {
    if (!sid) return;
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const markers = {};
      for (const c of channels) {
        const v = (values[c.channel_name] || '').trim();
        if (v) markers[c.channel_name] = v;
      }
      const res = await setPanelMarkers(sid, markers);
      const n = res && typeof res.n === 'number' ? res.n : Object.keys(markers).length;
      setStatus(`Saved — ${n} marker name${n === 1 ? '' : 's'} mapped.`);
      if (onApplied) await onApplied();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <h2 className="card__title" style={{ margin: 0 }}>
          Marker names (panel editor)
        </h2>
        <button
          type="button"
          className="engine-toggle__btn"
          style={{ border: '1px solid var(--border)', borderRadius: 8 }}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
        >
          {open ? 'Hide' : 'Edit'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 16 }}>
          <p className="field__hint" style={{ marginTop: 0, marginBottom: 16 }}>
            Map each channel to a marker (e.g. BUV395-A &rarr; CD19) so populations can be
            auto-labelled with cell types. Files that already carry marker names need no
            changes.
          </p>

          {error && (
            <div className="error card" role="alert" style={{ marginTop: 0 }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {loading ? (
            <p className="field__hint" style={{ marginTop: 0 }}>
              Loading channels…
            </p>
          ) : (
            <>
              {/* Channel -> marker grid ------------------------------------ */}
              <div className="field">
                <span className="field__label">
                  Channels — {channels.length}
                </span>
                <div style={grid}>
                  {channels.map((c) => {
                    const excluded = c.is_scatter || !c.include_in_clustering;
                    return (
                      <div key={c.channel_name} style={row}>
                        <span
                          style={{
                            ...channelCell,
                            color: excluded ? 'var(--muted)' : 'var(--fg)',
                          }}
                          title={c.channel_name}
                        >
                          {c.channel_name}
                          {excluded && <span style={excludedTag}>excluded</span>}
                        </span>
                        <input
                          type="text"
                          value={values[c.channel_name] || ''}
                          onChange={(e) => setMarker(c.channel_name, e.target.value)}
                          placeholder="marker (e.g. CD19)"
                          disabled={saving}
                          style={{
                            ...markerInput,
                            background: excluded ? 'var(--bg)' : '#fff',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <span className="field__hint">
                  Channel names are read-only. Scatter / Time channels are shown greyed and
                  tagged as excluded, but can still be mapped if you want.
                </span>
              </div>

              {/* Bulk paste ------------------------------------------------ */}
              <div className="field">
                <span className="field__label">Bulk paste</span>
                <textarea
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  placeholder={'Paste lines like:\nBUV395-A, CD19\nBB515-A\tCD3\nFITC-A CD4'}
                  rows={5}
                  disabled={saving}
                  style={textarea}
                />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="engine-toggle__btn"
                    style={{ border: '1px solid var(--border)', borderRadius: 8 }}
                    onClick={fillFromPaste}
                    disabled={saving || !paste.trim()}
                  >
                    Fill from paste
                  </button>
                  <span className="field__hint" style={{ margin: 0 }}>
                    Accepts <code>channel,marker</code>, <code>channel&lt;TAB&gt;marker</code>, or{' '}
                    <code>channel marker</code>. Matched by channel name (case-insensitive).
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="run-btn"
                  onClick={apply}
                  disabled={saving}
                >
                  {saving ? 'Applying…' : 'Apply marker names'}
                </button>
                {status && (
                  <span style={{ color: '#2f9e6f', fontSize: '0.9rem', fontWeight: 600 }}>
                    {status}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const grid = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: '6px',
  maxHeight: '260px',
  overflowY: 'auto',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  padding: '8px',
  marginTop: '4px',
};

const row = {
  display: 'grid',
  gridTemplateColumns: 'minmax(140px, 1fr) minmax(140px, 1.2fr)',
  gap: '10px',
  alignItems: 'center',
};

const channelCell = {
  fontSize: '13px',
  fontFamily: "'SF Mono', Menlo, Consolas, monospace",
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const excludedTag = {
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--muted)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  padding: '0 4px',
  flexShrink: 0,
};

const markerInput = {
  width: '100%',
  padding: '6px 9px',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  fontSize: '0.9rem',
  color: 'var(--fg)',
};

const textarea = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid var(--border)',
  borderRadius: '7px',
  fontSize: '0.9rem',
  fontFamily: "'SF Mono', Menlo, Consolas, monospace",
  color: 'var(--fg)',
  background: '#fff',
  resize: 'vertical',
};
