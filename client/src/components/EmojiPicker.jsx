import React, { useState, useMemo } from 'react';

/* ─── Microsoft Fluent Emoji (flat) via Ciffelia CDN ─── */
const FLUENT_CDN = 'https://fluent-emoji.ciffelia.com';

const EMOJI_DATA = [
  { char: '👋', label: 'waving hand',       code: '1f44b' },
  { char: '💩', label: 'pile of poo',        code: '1f4a9' },
  { char: '🧐', label: 'monocle face',       code: '1f9d0' },
  { char: '😄', label: 'grinning smile',     code: '1f604' },
  { char: '✔️', label: 'check mark',         code: '2714-fe0f' },
  { char: '🌱', label: 'seedling',           code: '1f331' },
  { char: '🥊', label: 'boxing glove',       code: '1f94a' },
  { char: '♫',  label: 'beamed notes',       code: null },
  { char: '😏', label: 'smirking face',      code: '1f60f' },
  { char: '😭', label: 'loudly crying',      code: '1f62d' },
  { char: '☆',  label: 'white star',         code: null },
  { char: '🥵', label: 'hot face',           code: '1f975' },
  { char: '🤩', label: 'star struck',        code: '1f929' },
  { char: '💀', label: 'skull',              code: '1f480' },
  { char: '❤️', label: 'red heart',          code: '2764-fe0f' },
  { char: '⏱️', label: 'stopwatch',          code: '23f1-fe0f' },
  { char: '🤔', label: 'thinking face',      code: '1f914' },
  { char: '💎', label: 'gem stone',          code: '1f48e' },
  { char: '♪',  label: 'eighth note',        code: null },
  { char: '🖼️', label: 'framed picture',     code: '1f5bc-fe0f' },
  { char: '🎭', label: 'performing arts',    code: '1f3ad' },
  { char: '🧭', label: 'compass',            code: '1f9ed' },
  { char: '😃', label: 'grinning big eyes',  code: '1f603' },
  { char: '😑', label: 'expressionless',     code: '1f611' },
  { char: '👯', label: 'bunny ears',         code: '1f46f' },
  { char: '☕', label: 'hot beverage',       code: '2615' },
  { char: '😶', label: 'no mouth',           code: '1f636' },
  { char: '🌫️', label: 'fog',               code: '1f32b-fe0f' },
  { char: '😆', label: 'squinting face',     code: '1f606' },
  { char: '😩', label: 'weary face',         code: '1f629' },
  { char: '😦', label: 'frowning open',      code: '1f626' },
  { char: '👌', label: 'ok hand',            code: '1f44c' },
  { char: '⭐', label: 'star',               code: '2b50' },
  { char: '🎀', label: 'ribbon',             code: '1f380' },
  { char: '🔥', label: 'fire',               code: '1f525' },
  { char: '🌸', label: 'cherry blossom',     code: '1f338' },
  { char: '⛰️', label: 'mountain',           code: '26f0-fe0f' },
  { char: '🥶', label: 'cold face',          code: '1f976' },
  { char: '😟', label: 'worried face',       code: '1f61f' },
  { char: '🍑', label: 'peach',              code: '1f351' },
  { char: '⏰', label: 'alarm clock',        code: '23f0' },
  { char: '😨', label: 'fearful face',       code: '1f628' },
  { char: '😎', label: 'sunglasses face',    code: '1f60e' },
  { char: '😕', label: 'confused face',      code: '1f615' },
  { char: '❤️‍🩹', label: 'mending heart',   code: '2764-fe0f-200d-1fa79' },
  { char: '😓', label: 'downcast sweat',     code: '1f613' },
  { char: '🏆', label: 'trophy',             code: '1f3c6' },
  { char: '🤤', label: 'drooling face',      code: '1f924' },
  { char: '🌟', label: 'glowing star',       code: '1f31f' },
  { char: '🤧', label: 'sneezing face',      code: '1f927' },
  { char: '✌️', label: 'victory hand',       code: '270c-fe0f' },
  { char: '⚡', label: 'high voltage',       code: '26a1' },
  { char: '😬', label: 'grimacing face',     code: '1f62c' },
  { char: '🍃', label: 'leaf in wind',       code: '1f343' },
  { char: '😈', label: 'smiling horns',      code: '1f608' },
  { char: '🤯', label: 'exploding head',     code: '1f92f' },
  { char: '🥳', label: 'partying face',      code: '1f973' },
  { char: '🤑', label: 'money mouth',        code: '1f911' },
  { char: '🩷', label: 'pink heart',         code: null },
  { char: '🙃', label: 'upside down',        code: '1f643' },
  { char: '🔔', label: 'bell',               code: '1f514' },
  { char: '😠', label: 'angry face',         code: '1f620' },
  { char: '💧', label: 'droplet',            code: '1f4a7' },
  { char: '🎁', label: 'wrapped gift',       code: '1f381' },
  { char: '🫨', label: 'shaking face',       code: null },
  { char: '🍿', label: 'popcorn',            code: '1f37f' },
  { char: '❤︎', label: 'heart suit',         code: '2764-fe0f' },
  { char: '🪩', label: 'mirror ball',        code: '1faa9' },
  { char: '😵', label: 'crossed eyes',       code: '1f635' },
  { char: '☀️', label: 'sun',                code: '2600-fe0f' },
  { char: '🎂', label: 'birthday cake',      code: '1f382' },
  { char: '🗝️', label: 'old key',            code: '1f5dd-fe0f' },
  { char: '✋', label: 'raised hand',        code: '270b' },
  { char: '🥰', label: 'smiling hearts',     code: '1f970' },
  { char: '😳', label: 'flushed face',       code: '1f633' },
  { char: '😣', label: 'persevering',        code: '1f623' },
  { char: '😔', label: 'pensive face',       code: '1f614' },
  { char: '😖', label: 'confounded face',    code: '1f616' },
  { char: '😲', label: 'astonished face',    code: '1f632' },
  { char: '😡', label: 'pouting face',       code: '1f621' },
  { char: '👏', label: 'clapping hands',     code: '1f44f' },
  { char: '🤣', label: 'rofl',               code: '1f923' },
];

export default function EmojiPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return EMOJI_DATA;
    const q = search.toLowerCase();
    return EMOJI_DATA.filter(e => e.label.includes(q) || e.char === q);
  }, [search]);

  return (
    <div className="picker" role="dialog" aria-label="Emoji picker">
      <div className="searchRow">
        <input
          className="search"
          placeholder="Search emoji..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>
      <div className="grid emojiGrid">
        {filtered.map((e, i) => (
          <button
            key={e.char + i}
            className="emojiBtn msEmoji"
            type="button"
            title={e.label}
            onClick={() => onSelect(e.char)}
          >
            {e.code ? (
              <img
                src={`${FLUENT_CDN}/${e.code}_flat.svg`}
                alt={e.label}
                width="26"
                height="26"
                loading="lazy"
                draggable="false"
                onError={(ev) => {
                  ev.target.style.display = 'none';
                  const span = document.createElement('span');
                  span.className = 'emojiFallback';
                  span.textContent = e.char;
                  ev.target.parentNode.appendChild(span);
                }}
              />
            ) : (
              <span className="emojiFallback">{e.char}</span>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="emojiEmpty">No emoji found</div>
        )}
      </div>
    </div>
  );
}
