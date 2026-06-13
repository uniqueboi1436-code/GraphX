import React, { useState } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { sendMathCommand } from './MathInput';
import { Delete, ArrowLeft, ArrowRight, CornerDownLeft, ChevronDown } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Key action types
// ─────────────────────────────────────────────────────────────────────────────
type Action =
  | { do: 'cmd';       val: string }          // MathQuill LaTeX command (structural)
  | { do: 'write';     val: string }          // MathQuill write (LaTeX string)
  | { do: 'typedText'; val: string }          // simulates typing (triggers autoOperatorNames)
  | { do: 'keystroke'; val: string }          // keyboard shortcut
  | { do: 'tab';       val: 'main' | 'abc' } // switch layout
  | { do: 'toggleFn' };                       // toggle function popup

type KeyboardTab = 'main' | 'abc';

interface KeyDef {
  label: React.ReactNode;
  action: Action;
  flex?: number;   // flex-grow factor, default 1
  dark?: boolean;  // use darker background (number keys)
  blue?: boolean;  // blue accent
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — build a typedText action that inserts "name(" with cursor inside
// ─────────────────────────────────────────────────────────────────────────────
const fn = (name: string): Action => ({ do: 'typedText', val: `${name}(` });

// ─────────────────────────────────────────────────────────────────────────────
// MAIN KEYBOARD LAYOUT  (4 rows × 8 keys + right nav)
// ─────────────────────────────────────────────────────────────────────────────
const MAIN_ROWS: KeyDef[][] = [
  [
    { label: 'x',                        action: { do: 'typedText', val: 'x' } },
    { label: 'y',                        action: { do: 'typedText', val: 'y' } },
    { label: <span>a<sup>2</sup></span>, action: { do: 'cmd',       val: '^2' } },
    { label: <span>a<sup>b</sup></span>, action: { do: 'cmd',       val: '^' } },
    { label: '7',  action: { do: 'typedText', val: '7' }, dark: true },
    { label: '8',  action: { do: 'typedText', val: '8' }, dark: true },
    { label: '9',  action: { do: 'typedText', val: '9' }, dark: true },
    { label: '÷',  action: { do: 'cmd',       val: '\\div' } },
  ],
  [
    { label: '(',  action: { do: 'typedText', val: '(' } },
    { label: ')',  action: { do: 'typedText', val: ')' } },
    { label: '<',  action: { do: 'typedText', val: '<' } },
    { label: '>',  action: { do: 'typedText', val: '>' } },
    { label: '4',  action: { do: 'typedText', val: '4' }, dark: true },
    { label: '5',  action: { do: 'typedText', val: '5' }, dark: true },
    { label: '6',  action: { do: 'typedText', val: '6' }, dark: true },
    { label: '×',  action: { do: 'cmd',       val: '\\times' } },
  ],
  [
    { label: <span><sup>a</sup>⁄<sub>b</sub></span>, action: { do: 'cmd', val: '\\frac' } },
    { label: '|a|', action: { do: 'typedText', val: '|' } },
    { label: '≤',   action: { do: 'typedText', val: '<=' } },
    { label: '≥',   action: { do: 'typedText', val: '>=' } },
    { label: '1',  action: { do: 'typedText', val: '1' }, dark: true },
    { label: '2',  action: { do: 'typedText', val: '2' }, dark: true },
    { label: '3',  action: { do: 'typedText', val: '3' }, dark: true },
    { label: '−',  action: { do: 'typedText', val: '-' } },
  ],
  [
    { label: 'ABC',  action: { do: 'tab',      val: 'abc' } },
    { label: '√',    action: { do: 'cmd',      val: '\\sqrt' } },
    { label: 'π',    action: { do: 'cmd',      val: '\\pi' } },
    { label: 'func', action: { do: 'toggleFn' } },
    { label: '0',  action: { do: 'typedText', val: '0' }, dark: true },
    { label: '.',  action: { do: 'typedText', val: '.' }, dark: true },
    { label: '=',  action: { do: 'typedText', val: '=' } },
    { label: '+',  action: { do: 'typedText', val: '+' } },
  ],
];

// ─────────────────────────────────────────────────────────────────────────────
// ABC KEYBOARD  (QWERTY + variables)
// ─────────────────────────────────────────────────────────────────────────────
const ABC_ROWS: Array<Array<{ label: string; action: Action }>> = [
  ['q','w','e','r','t','y','u','i','o','p'].map(c => ({ label: c, action: { do: 'typedText', val: c } as Action })),
  ['a','s','d','f','g','h','j','k','l'].map(c => ({ label: c, action: { do: 'typedText', val: c } as Action }))
    .concat([{ label: 'θ', action: { do: 'cmd', val: '\\theta' } }]),
  ['z','x','c','v','b','n','m'].map(c => ({ label: c, action: { do: 'typedText', val: c } as Action }))
    .concat([
      { label: 'π', action: { do: 'cmd',      val: '\\pi'  } },
      { label: 'e', action: { do: 'typedText', val: 'e'    } },
      { label: 't', action: { do: 'typedText', val: 't'    } },
    ]),
];

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTIONS POPUP  —  grouped sections
// ─────────────────────────────────────────────────────────────────────────────
const FUNC_SECTIONS: Array<{ title: string; keys: Array<{ label: React.ReactNode; action: Action }> }> = [
  {
    title: 'TRIG',
    keys: ['sin','cos','tan','sec','csc','cot'].map(f => ({
      label: f,
      action: fn(f),
    })),
  },
  {
    title: 'INVERSE TRIG',
    keys: ['arcsin','arccos','arctan','arcsec','arccsc','arccot'].map(f => ({
      label: <>{f.replace('arc','')}<sup>-1</sup></>,
      action: fn(f),
    })),
  },
  {
    title: 'HYPERBOLIC',
    keys: ['sinh','cosh','tanh','sech','csch','coth'].map(f => ({
      label: f,
      action: fn(f),
    })),
  },
  {
    title: 'INV. HYPERBOLIC',
    keys: ['arcsinh','arccosh','arctanh'].map(f => ({
      label: <>{f.replace('arc','')}<sup>-1</sup></>,
      action: fn(f),
    })),
  },
  {
    title: 'LOG / EXP',
    keys: [
      { label: 'ln',    action: fn('ln') },
      { label: 'log',   action: fn('log') },
      { label: 'log₂',  action: fn('log2') },
      { label: 'exp',   action: fn('exp') },
    ],
  },
  {
    title: 'ROOTS',
    keys: [
      { label: '√',        action: { do: 'cmd', val: '\\sqrt' } as Action },
      { label: '∛',        action: fn('cbrt') },
      { label: <span><sup>n</sup>√</span>, action: fn('nthroot') },
      { label: 'hypot',    action: fn('hypot') },
    ],
  },
  {
    title: 'ROUNDING',
    keys: [
      { label: 'floor',    action: fn('floor') },
      { label: 'ceil',     action: fn('ceil') },
      { label: 'round',    action: fn('round') },
      { label: 'abs',      action: fn('abs') },
    ],
  },
  {
    title: 'NUMBER THEORY',
    keys: [
      { label: 'mod',      action: fn('mod') },
      { label: 'gcd',      action: fn('gcd') },
      { label: 'lcm',      action: fn('lcm') },
      { label: 'sign',     action: fn('sign') },
    ],
  },
  {
    title: 'MISC',
    keys: [
      { label: 'max',  action: fn('max') },
      { label: 'min',  action: fn('min') },
      { label: 'pow',  action: fn('pow') },
      { label: 'log₁₀', action: fn('log10') },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export const VirtualKeyboard: React.FC = () => {
  const isKeyboardOpen  = useGraphStore(s => s.isKeyboardOpen);
  const setKeyboardOpen = useGraphStore(s => s.setKeyboardOpen);
  const [tab, setTab]   = useState<KeyboardTab>('main');
  const [showFn, setShowFn] = useState(false);

  if (!isKeyboardOpen) return null;

  // ── Dispatch an action ──────────────────────────────────────────────────
  const dispatch = (e: React.MouseEvent, action: Action) => {
    e.preventDefault();
    switch (action.do) {
      case 'cmd':       sendMathCommand('cmd',       action.val); break;
      case 'write':     sendMathCommand('write',     action.val); break;
      case 'typedText': sendMathCommand('typedText', action.val); break;
      case 'keystroke': sendMathCommand('keystroke', action.val); break;
      case 'tab':       setTab(action.val); setShowFn(false);    break;
      case 'toggleFn':  setShowFn(f => !f);                     break;
    }
  };

  // ── Reusable key button ─────────────────────────────────────────────────
  const Btn: React.FC<{
    label: React.ReactNode;
    action: Action;
    flex?: number;
    className?: string;
  }> = ({ label, action, flex = 1, className = '' }) => (
    <button
      onMouseDown={e => dispatch(e, action)}
      style={{ flex }}
      className={
        'min-w-0 h-12 flex items-center justify-center rounded-lg border text-sm font-medium ' +
        'transition-all duration-75 active:scale-95 select-none ' +
        className
      }
    >
      {label}
    </button>
  );

  // ── Key style helpers ───────────────────────────────────────────────────
  const numCls  = 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600';
  const defCls  = 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800';
  const grayBtn = 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600';
  const blueBtn = 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white border-blue-600';

  const getCls = (key: KeyDef) => {
    if (key.dark) return numCls;
    if (key.blue) return blueBtn;
    if (['ABC','func'].includes(typeof key.label === 'string' ? key.label : '')) return grayBtn;
    return defCls;
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 shadow-2xl select-none"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* ── Title bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-300 dark:bg-gray-950 border-t border-gray-400 dark:border-gray-700">
        <span className="text-[10px] font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400">
          GraphX Keyboard
        </span>
        <div className="flex gap-2 items-center">
          <button
            onMouseDown={e => { e.preventDefault(); setTab('main'); setShowFn(false); }}
            className={`text-xs px-2 py-0.5 rounded font-semibold transition-colors ${tab === 'main' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >123</button>
          <button
            onMouseDown={e => { e.preventDefault(); setTab('abc'); setShowFn(false); }}
            className={`text-xs px-2 py-0.5 rounded font-semibold transition-colors ${tab === 'abc' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >ABC</button>
          <button
            onClick={() => setKeyboardOpen(false)}
            className="p-1 rounded hover:bg-gray-400 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            title="Hide keyboard"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="bg-gray-100 dark:bg-gray-800 px-2 pt-2 pb-3">
        <div className="flex gap-2 w-full max-w-5xl mx-auto relative">

          {/* ── Functions popup ─────────────────────────────────────────── */}
          {showFn && (
            <div
              className="absolute bottom-full mb-2 right-28 max-h-[60vh] overflow-y-auto w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-3 z-50"
              onMouseDown={e => e.preventDefault()}
            >
              {FUNC_SECTIONS.map(section => (
                <div key={section.title} className="mb-3 last:mb-0">
                  <div className="text-[10px] font-bold tracking-widest text-blue-500 mb-1.5">
                    {section.title}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {section.keys.map((k, i) => (
                      <button
                        key={i}
                        onMouseDown={e => { dispatch(e, k.action); setShowFn(false); }}
                        className="h-9 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-800 dark:text-gray-200 transition-colors"
                      >
                        {k.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Main key area ─────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col gap-1.5">

            {/* ── Main numeric / operator layout ── */}
            {tab === 'main' && MAIN_ROWS.map((row, i) => (
              <div key={i} className="flex gap-1.5">
                {row.map((key, j) => (
                  <Btn
                    key={j}
                    label={key.label}
                    action={key.action}
                    flex={key.flex}
                    className={getCls(key)}
                  />
                ))}
              </div>
            ))}

            {/* ── ABC layout ── */}
            {tab === 'abc' && (
              <div className="flex flex-col gap-1.5">
                {ABC_ROWS.map((row, i) => (
                  <div key={i} className={`flex gap-1.5 ${i === 1 ? 'px-4' : i === 2 ? 'px-2' : ''}`}>
                    {row.map((key, j) => (
                      <Btn key={j} label={key.label} action={key.action} className={defCls} />
                    ))}
                  </div>
                ))}

                {/* Bottom row: 123 | space | backspace */}
                <div className="flex gap-1.5">
                  <Btn
                    label="123"
                    action={{ do: 'tab', val: 'main' }}
                    flex={2}
                    className={grayBtn + ' font-bold'}
                  />
                  <Btn
                    label="space"
                    action={{ do: 'typedText', val: ' ' }}
                    flex={6}
                    className={defCls + ' text-gray-400 dark:text-gray-500'}
                  />
                  <button
                    onMouseDown={e => { e.preventDefault(); sendMathCommand('keystroke', 'Backspace'); }}
                    style={{ flex: 2 }}
                    className={`h-12 flex items-center justify-center rounded-lg border transition-all active:scale-95 ${grayBtn}`}
                  >
                    <Delete size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Right nav column ──────────────────────────────────────────── */}
          <div className="w-[88px] flex flex-col gap-1.5 shrink-0">
            {/* Cursor arrows */}
            <div className="flex gap-1.5 h-12">
              <button
                onMouseDown={e => { e.preventDefault(); sendMathCommand('keystroke', 'Left'); }}
                className={`flex-1 h-12 flex items-center justify-center rounded-lg border transition-all active:scale-95 ${grayBtn}`}
              ><ArrowLeft size={18} /></button>
              <button
                onMouseDown={e => { e.preventDefault(); sendMathCommand('keystroke', 'Right'); }}
                className={`flex-1 h-12 flex items-center justify-center rounded-lg border transition-all active:scale-95 ${grayBtn}`}
              ><ArrowRight size={18} /></button>
            </div>

            {/* Backspace */}
            <button
              onMouseDown={e => { e.preventDefault(); sendMathCommand('keystroke', 'Backspace'); }}
              className={`h-12 flex items-center justify-center rounded-lg border transition-all active:scale-95 ${grayBtn}`}
            ><Delete size={18} /></button>

            {/* Enter — fills remaining height */}
            <button
              onMouseDown={e => { e.preventDefault(); sendMathCommand('keystroke', 'Enter'); }}
              className={`flex-1 flex items-center justify-center rounded-lg transition-all active:scale-95 ${blueBtn}`}
              style={{ minHeight: '3rem' }}
            ><CornerDownLeft size={20} /></button>
          </div>

        </div>
      </div>
    </div>
  );
};
