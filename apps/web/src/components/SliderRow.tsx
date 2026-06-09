import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { useGraphStore } from '../store/useGraphStore';
import type { SliderConfig } from '../store/useGraphStore';

interface SliderRowProps {
  varName: string;
  config: SliderConfig;
}

const SPEEDS = [
  { label: 'Slow', ratePerSec: 0.15 },
  { label: 'Med',  ratePerSec: 0.4  },
  { label: 'Fast', ratePerSec: 1.0  },
];

export const SliderRow: React.FC<SliderRowProps> = ({ varName, config }) => {
  const setSlider      = useGraphStore(s => s.setSlider);
  const setSliderValue = useGraphStore(s => s.setSliderValue);

  const [playing,  setPlaying]  = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [editMin,  setEditMin]  = useState(false);
  const [editMax,  setEditMax]  = useState(false);
  const [minText,  setMinText]  = useState(String(config.min));
  const [maxText,  setMaxText]  = useState(String(config.max));

  const rafRef  = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const dirRef  = useRef<1 | -1>(1);

  useEffect(() => { setMinText(String(config.min)); }, [config.min]);
  useEffect(() => { setMaxText(String(config.max)); }, [config.max]);

  /* ── 60 fps animation loop ── */
  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    lastRef.current = 0;

    const tick = (now: number) => {
      if (lastRef.current === 0) lastRef.current = now;
      const dt = Math.min((now - lastRef.current) / 1000, 0.1); // cap at 100 ms
      lastRef.current = now;

      const { sliders } = useGraphStore.getState();
      const cfg   = sliders[varName];
      if (!cfg) return;

      const range = cfg.max - cfg.min;
      const step  = SPEEDS[speedIdx].ratePerSec * range * dt;

      let next = cfg.value + dirRef.current * step;
      if (next >= cfg.max) { next = cfg.max; dirRef.current = -1; }
      if (next <= cfg.min) { next = cfg.min; dirRef.current =  1; }

      setSliderValue(varName, next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [playing, varName, speedIdx, setSliderValue]);

  const commitMin = () => {
    setEditMin(false);
    const v = parseFloat(minText);
    if (!isNaN(v)) setSlider(varName, { min: v });
  };
  const commitMax = () => {
    setEditMax(false);
    const v = parseFloat(maxText);
    if (!isNaN(v)) setSlider(varName, { max: v });
  };

  const displayValue = isNaN(config.value) ? 1 : +config.value.toFixed(3);

  return (
    <div className="flex items-center gap-2 px-3 py-2
      bg-blue-50 dark:bg-blue-950/30
      border-t border-blue-100 dark:border-blue-900/40 select-none">

      {/* Variable name badge */}
      <span className="w-6 text-center text-sm font-bold font-mono text-blue-600 dark:text-blue-400 shrink-0">
        {varName}
      </span>

      {/* Min editable label */}
      {editMin ? (
        <input autoFocus
          className="w-10 text-xs text-center bg-white dark:bg-gray-800 border border-blue-300 rounded px-1 py-0.5 focus:outline-none"
          value={minText}
          onChange={e => setMinText(e.target.value)}
          onBlur={commitMin}
          onKeyDown={e => e.key === 'Enter' && commitMin()}
        />
      ) : (
        <button onClick={() => setEditMin(true)}
          className="text-xs text-gray-400 hover:text-blue-500 w-8 text-right shrink-0 tabular-nums">
          {config.min}
        </button>
      )}

      {/* Drag slider */}
      <input type="range"
        min={config.min} max={config.max} step={config.step ?? 0.01}
        value={config.value}
        onChange={e => setSliderValue(varName, parseFloat(e.target.value))}
        className="flex-1 h-1.5 accent-blue-500 cursor-pointer"
      />

      {/* Max editable label */}
      {editMax ? (
        <input autoFocus
          className="w-10 text-xs text-center bg-white dark:bg-gray-800 border border-blue-300 rounded px-1 py-0.5 focus:outline-none"
          value={maxText}
          onChange={e => setMaxText(e.target.value)}
          onBlur={commitMax}
          onKeyDown={e => e.key === 'Enter' && commitMax()}
        />
      ) : (
        <button onClick={() => setEditMax(true)}
          className="text-xs text-gray-400 hover:text-blue-500 w-8 shrink-0 tabular-nums">
          {config.max}
        </button>
      )}

      {/* Numeric value */}
      <input type="number"
        value={displayValue}
        onChange={e => setSliderValue(varName, parseFloat(e.target.value) || 0)}
        className="w-16 text-xs text-center bg-white dark:bg-gray-800 border border-gray-200
          dark:border-gray-700 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400 tabular-nums"
      />

      {/* Speed cycle button */}
      <button
        onClick={() => setSpeedIdx(i => (i + 1) % SPEEDS.length)}
        title={`Animation speed: ${SPEEDS[speedIdx].label}. Click to cycle.`}
        className="text-[10px] font-bold text-gray-400 hover:text-blue-500 w-8 shrink-0 text-center">
        {SPEEDS[speedIdx].label}
      </button>

      {/* Play / Pause */}
      <button
        onClick={() => setPlaying(p => !p)}
        className={`p-1 rounded-full transition-colors ${
          playing
            ? 'bg-blue-500 text-white hover:bg-blue-600'
            : 'text-gray-400 hover:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30'
        }`}
      >
        {playing ? <Pause size={13} /> : <Play size={13} />}
      </button>
    </div>
  );
};
