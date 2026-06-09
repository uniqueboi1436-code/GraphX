import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Trash2, Table2, FunctionSquare } from 'lucide-react';
import { useGraphStore, COLORS } from '../store/useGraphStore';
import type { Expression } from '../store/useGraphStore';
import { detectType, getUndefinedVariables } from '@graphcalc/math-engine';
import { SliderRow } from './SliderRow';
import { TableExpression } from './TableExpression';
import { MathInput } from './MathInput';

const KNOWN_VARS = ['x', 'y', 't', 'theta', 'r'];

// ── Add-menu dropdown ──────────────────────────────────────────────────────
const AddMenu: React.FC<{ onAddExpr: () => void; onAddTable: () => void }> = ({
  onAddExpr, onAddTable,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-2xl leading-none text-blue-500 hover:text-blue-600 focus:outline-none
          px-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
      >
        +
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 bg-white dark:bg-gray-800 border border-gray-200
          dark:border-gray-700 rounded-xl shadow-2xl py-1 w-44 overflow-hidden">
          <button
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200
              hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            onClick={() => { onAddExpr(); setOpen(false); }}
          >
            <FunctionSquare size={15} className="text-blue-500" />
            Expression
          </button>
          <button
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200
              hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            onClick={() => { onAddTable(); setOpen(false); }}
          >
            <Table2 size={15} className="text-green-500" />
            Table
          </button>
        </div>
      )}
    </div>
  );
};

// ── Single expression row ──────────────────────────────────────────────────
const ExpressionRow: React.FC<{ index: number; expression: Expression }> = ({
  index, expression,
}) => {
  const updateExpression = useGraphStore(s => s.updateExpression);
  const removeExpression = useGraphStore(s => s.removeExpression);
  const addExpression    = useGraphStore(s => s.addExpression);
  const sliders          = useGraphStore(s => s.sliders);
  const setSlider        = useGraphStore(s => s.setSlider);
  const setActiveExpressionId = useGraphStore(s => s.setActiveExpressionId);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [sliderVars,      setSliderVars]      = useState<string[]>([]);
  const [isFocused,       setIsFocused]       = useState(false);

  useEffect(() => {
    if (!expression.latex || expression.type === 'note' || expression.type === 'slider') {
      setSliderVars([]);
      return;
    }
    const undef = getUndefinedVariables(expression.latex, KNOWN_VARS);
    setSliderVars(undef);
    undef.forEach(v => { if (!sliders[v]) setSlider(v, { min: -10, max: 10, value: 1, step: 0.01 }); });
  }, [expression.latex, expression.type]);

  const handleLatexChange = (latex: string) => {
    let type: Expression['type'] = 'equation';
    if (latex.startsWith('"') || latex.startsWith('`')) {
      type = 'note';
    } else {
      type = detectType(latex) as Expression['type'];
      if (type === 'assignment' && /=\s*-?\d+(\.\d+)?$/.test(latex)) type = 'slider';
    }
    updateExpression(expression.id, { latex, type });
  };

  const handleEnter = () => {
    addExpression(index);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setActiveExpressionId(expression.id);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <div
      className={`flex flex-col border-b border-gray-200 dark:border-gray-800 group
        ${isFocused ? 'bg-white dark:bg-gray-900' : 'bg-white dark:bg-gray-900'}`}
    >
      <div className="flex items-start p-2 gap-2 relative bg-white dark:bg-gray-900 transition-colors">

        {/* Color circle */}
        <div className="flex flex-col items-center gap-2 pt-2 z-20">
          <div className="relative">
            <button
              className="w-5 h-5 rounded-full border-2 focus:outline-none transition-transform hover:scale-110"
              style={{
                borderColor: expression.color,
                backgroundColor: expression.visible ? expression.color : 'transparent',
              }}
              onClick={() => setShowColorPicker(!showColorPicker)}
            />
            {showColorPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowColorPicker(false)} />
                <div className="absolute top-6 left-0 z-20 bg-white shadow-xl rounded-md p-2 grid grid-cols-3 gap-2 border dark:bg-gray-800 dark:border-gray-700">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      className="w-6 h-6 rounded-full focus:outline-none ring-2 ring-transparent hover:ring-gray-300"
                      style={{ backgroundColor: c }}
                      onClick={() => { updateExpression(expression.id, { color: c }); setShowColorPicker(false); }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Math input */}
        <div className="flex-1 min-w-0 relative">
          {expression.type === 'note' ? (
            // Note expressions use plain text
            <div className="bg-white dark:bg-gray-900 flex items-center px-2 min-h-[40px]">
              <span className="text-gray-500 italic text-lg px-2">
                {expression.latex.replace(/^"|``?/, '')}
              </span>
            </div>
          ) : (
            <MathInput
              latex={expression.latex}
              onChange={handleLatexChange}
              onEnter={handleEnter}
              onFocus={handleFocus}
              onBlur={handleBlur}
              color={expression.color}
              hasError={expression.error}
            />
          )}

          {expression.type && expression.latex.length > 0 && expression.type !== 'note' && (
            <div className="mt-0.5 flex gap-1">
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5
                bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 rounded">
                {expression.type}
              </span>
            </div>
          )}
        </div>

        {/* Eye + Trash */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
          <button
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
            onClick={() => updateExpression(expression.id, { visible: !expression.visible })}
          >
            {expression.visible ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
          <button
            className="p-1.5 text-gray-400 hover:text-red-500 focus:outline-none"
            onClick={() => removeExpression(expression.id)}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Auto-slider rows */}
      {sliderVars.map(v => (
        <SliderRow key={v} varName={v} config={sliders[v] ?? { min: -10, max: 10, value: 1, step: 0.01 }} />
      ))}
    </div>
  );
};

// ── ExpressionList ─────────────────────────────────────────────────────────
export const ExpressionList: React.FC = () => {
  const expressions   = useGraphStore(s => s.expressions);
  const addExpression = useGraphStore(s => s.addExpression);
  const insertTable   = useGraphStore(s => s.insertTable);

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-900 shadow-xl overflow-hidden border-r border-gray-200 dark:border-gray-800">
      <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700
        font-bold text-gray-700 dark:text-gray-200 shadow-sm z-10 flex justify-between items-center">
        <span className="text-lg tracking-wide">Expressions</span>
        <AddMenu onAddExpr={() => addExpression()} onAddTable={() => insertTable()} />
      </div>
      <div className="flex-1 overflow-y-auto">
        {expressions.map((expr, index) =>
          expr.kind === 'table' ? (
            <div key={expr.id} className="group">
              <TableExpression expression={expr} />
            </div>
          ) : (
            <ExpressionRow key={expr.id} index={index} expression={expr} />
          ),
        )}
      </div>
    </div>
  );
};
