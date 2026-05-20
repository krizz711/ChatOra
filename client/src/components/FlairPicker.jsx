import React, { useState } from 'react';
import { CHOOSABLE_FLAIRS, MAX_CHOSEN_FLAIRS, parseChosenFlairIds } from '../utils/flairs';

export default function FlairPicker({ user, onSave, onClose }) {
  const [selected, setSelected] = useState(() => new Set(parseChosenFlairIds(user)));

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_CHOSEN_FLAIRS) {
          next.clear();
        }
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = () => {
    onSave([...selected]);
    onClose();
  };

  const atMax = selected.size >= MAX_CHOSEN_FLAIRS;

  return (
    <div className="overlay">
      <div className="modal">
        <div className="header">
          <div className="title">Choose Flair</div>
          <button type="button" className="closeBtn" onClick={onClose}>×</button>
        </div>
        <div className="subtitle">
          Tap to select. ({selected.size}/{MAX_CHOSEN_FLAIRS} selected).
        </div>
        <div className="grid">
          {CHOOSABLE_FLAIRS.map((f) => {
            const active = selected.has(f.id);
            return (
              <button
                key={f.id}
                type="button"
                className={`flairBtn ${active ? 'active' : ''}`}
                onClick={() => toggle(f.id)}
              >
                <span className="flairEmoji">{f.emoji}</span>
                <span className="flairName">{f.label}</span>
                {active && <span className="flairCheck">✓</span>}
              </button>
            );
          })}
        </div>
        <div className="footer">
          <button type="button" className="clearBtn" onClick={() => setSelected(new Set())}>Remove Flair</button>
          <button type="button" className="btn btnPrimary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
