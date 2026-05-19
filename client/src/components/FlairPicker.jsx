import React, { useState } from 'react';
import { CHOOSABLE_FLAIRS, getFlairById } from '../utils/flairs';

export default function FlairPicker({ current, onChoose, onClose }) {
  const [selected, setSelected] = useState(current?.id || null);

  return (
    <div className="overlay">
      <div className="modal">
        <div className="header">
          <div className="title">Choose a Flair</div>
          <button className="closeBtn" onClick={onClose}>×</button>
        </div>
        <div className="subtitle">Flairs help express your identity. Pick one.</div>
        <div className="grid">
          {CHOOSABLE_FLAIRS.map(f => (
            <button key={f.id} className={`flairBtn ${selected === f.id ? 'active' : ''}`} onClick={() => setSelected(f.id)}>
              <span className="flairEmoji">{f.emoji}</span>
              <span className="flairName">{f.label}</span>
            </button>
          ))}
        </div>
        <div className="footer">
          <button className="clearBtn" onClick={() => { setSelected(null); onChoose(null); onClose(); }}>Clear</button>
          <button className="btn btnPrimary" onClick={() => { onChoose(selected ? getFlairById(selected).id : null); onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}
