import React, { useState, useCallback } from 'react';
import { Trash2, Plus, TrendingUp, X, GripVertical } from 'lucide-react';
import { useGraphStore } from '../store/useGraphStore';
import type { Expression } from '../store/useGraphStore';
import { fitRegression } from '@graphx/math-engine';
import type { RegressionType } from '@graphx/math-engine';

interface Props { expression: Expression }

/** Parse a cell value — supports fractions like 1/3, expressions like 2*pi */
function parseCell(raw: string): number {
  if (!raw.trim()) return NaN;
  try {
    // eslint-disable-next-line no-new-func
    const v = Function('"use strict"; return (' + raw.replace(/pi/g, '3.14159265') + ')')();
    return typeof v === 'number' ? v : NaN;
  } catch { return NaN; }
}

const REGRESSION_OPTIONS: { value: RegressionType; label: string }[] = [
  { value: 'linear',      label: 'Linear (y~mx+b)' },
  { value: 'quadratic',   label: 'Quadratic (y~ax²+bx+c)' },
  { value: 'exponential', label: 'Exponential (y~a·bˣ)' },
  { value: 'power',       label: 'Power (y~a·xᵇ)' },
  { value: 'sinusoidal',  label: 'Sinusoidal (y~a·sin(bx+c)+d)' },
];

const ContextMenu: React.FC<{
  x: number; y: number; onDelete: () => void; onClose: () => void;
}> = ({ x, y, onDelete, onClose }) => (
  <>
    <div className="fixed inset-0 z-40" onClick={onClose} />
    <div
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                 rounded-md shadow-xl py-1 min-w-[140px] text-sm"
      style={{ left: x, top: y }}
    >
      <button
        className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/30
                   text-red-600 dark:text-red-400"
        onClick={() => { onDelete(); onClose(); }}
      >
        <Trash2 size={14} /> Delete row
      </button>
    </div>
  </>
);

export const TableExpression: React.FC<Props> = ({ expression }) => {
  const { id, color, visible, tableData } = expression;
  const rows = tableData?.rows ?? [];
  const regression = tableData?.regression;

  const updateTableRow      = useGraphStore(s => s.updateTableRow);
  const addTableRow         = useGraphStore(s => s.addTableRow);
  const removeTableRow      = useGraphStore(s => s.removeTableRow);
  const moveTableRow        = useGraphStore(s => s.moveTableRow);
  const setTableRegression  = useGraphStore(s => s.setTableRegression);
  const removeExpression    = useGraphStore(s => s.removeExpression);
  const updateExpression    = useGraphStore(s => s.updateExpression);

  const [showRegPanel, setShowRegPanel] = useState(false);
  const [selectedReg,  setSelectedReg]  = useState<RegressionType>('linear');
  const [contextMenu,  setContextMenu]  = useState<{ x: number; y: number; rowId: string } | null>(null);
  const [dragFromIdx,  setDragFromIdx]  = useState<number | null>(null);

  // Auto-expand: when last row gets a value, append a new blank row
  const handleCellChange = useCallback(
    (rowId: string, field: 'x' | 'y', value: string) => {
      updateTableRow(id, rowId, { [field]: value });
      // if this is the last row and it now has content, add a new row
      const lastRow = rows[rows.length - 1];
      if (lastRow && lastRow.id === rowId && value.trim()) {
        addTableRow(id);
      }
    },
    [id, rows, updateTableRow, addTableRow],
  );

  // Get valid numeric pairs for regression
  const validPairs = rows
    .map(r => [parseCell(r.x), parseCell(r.y)] as [number, number])
    .filter(([x, y]) => isFinite(x) && isFinite(y));

  const runRegression = () => {
    if (validPairs.length < 2) return;
    const xs = validPairs.map(([x]) => x);
    const ys = validPairs.map(([, y]) => y);
    const result = fitRegression(selectedReg, xs, ys);
    setTableRegression(id, result);
    setShowRegPanel(false);
  };

  const clearRegression = () => setTableRegression(id, undefined);

  // Drag-to-reorder
  const handleDragStart = (idx: number) => setDragFromIdx(idx);
  const handleDrop = (toIdx: number) => {
    if (dragFromIdx !== null && dragFromIdx !== toIdx) {
      moveTableRow(id, dragFromIdx, toIdx);
    }
    setDragFromIdx(null);
  };

  // Right-click
  const handleContextMenu = (e: React.MouseEvent, rowId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, rowId });
  };

  return (
    <div className="border-b border-gray-200 dark:border-gray-800">
      {/* Table header bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900">
        {/* Color dot */}
        <div
          className="w-3.5 h-3.5 rounded-full shrink-0"
          style={{ backgroundColor: visible ? color : 'transparent', border: `2px solid ${color}` }}
        />
        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 flex-1">Table</span>
        {/* Visibility + delete */}
        <button
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 opacity-0 group-hover:opacity-100"
          onClick={() => updateExpression(id, { visible: !visible })}
        >
          {visible ? '👁' : '🙈'}
        </button>
        <button
          className="p-1 text-gray-400 hover:text-red-500"
          onClick={() => removeExpression(id)}
        >
          <X size={15} />
        </button>
      </div>

      {/* Spreadsheet */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-t border-gray-100 dark:border-gray-800">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/60 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <th className="w-6 px-1 py-1" />
              <th className="px-2 py-1.5 text-left border-r border-gray-100 dark:border-gray-700 w-1/2">x</th>
              <th className="px-2 py-1.5 text-left w-1/2">y</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(idx)}
                onContextMenu={e => handleContextMenu(e, row.id)}
                className={`border-t border-gray-100 dark:border-gray-800 hover:bg-blue-50/40
                  dark:hover:bg-blue-900/10 transition-colors
                  ${dragFromIdx === idx ? 'opacity-40' : ''}`}
              >
                {/* Drag handle */}
                <td className="pl-1 pr-0 text-gray-300 cursor-grab active:cursor-grabbing">
                  <GripVertical size={12} />
                </td>
                {/* x cell */}
                <td className="border-r border-gray-100 dark:border-gray-700 p-0">
                  <input
                    type="text"
                    value={row.x}
                    onChange={e => handleCellChange(row.id, 'x', e.target.value)}
                    placeholder="—"
                    className="w-full px-2 py-1.5 bg-transparent focus:outline-none focus:bg-blue-50
                               dark:focus:bg-blue-900/20 text-gray-800 dark:text-gray-200
                               placeholder-gray-300 tabular-nums"
                  />
                </td>
                {/* y cell */}
                <td className="p-0">
                  <input
                    type="text"
                    value={row.y}
                    onChange={e => handleCellChange(row.id, 'y', e.target.value)}
                    placeholder="—"
                    className="w-full px-2 py-1.5 bg-transparent focus:outline-none focus:bg-blue-50
                               dark:focus:bg-blue-900/20 text-gray-800 dark:text-gray-200
                               placeholder-gray-300 tabular-nums"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add row button */}
      <button
        className="flex items-center gap-1.5 w-full px-4 py-1.5 text-xs text-gray-400 hover:text-blue-500
                   hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-t
                   border-gray-100 dark:border-gray-800"
        onClick={() => addTableRow(id)}
      >
        <Plus size={12} /> Add row
      </button>

      {/* Regression result display */}
      {regression && (
        <div className="mx-3 my-2 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">
                {regression.type} regression
              </p>
              <p className="text-sm font-mono font-semibold text-gray-800 dark:text-gray-100">
                {regression.equation}
              </p>
              <p className={`text-xs mt-0.5 font-semibold ${regression.r2 > 0.99 ? 'text-green-600' : regression.r2 > 0.9 ? 'text-yellow-600' : 'text-red-500'}`}>
                R² = {regression.r2.toFixed(4)}
              </p>
            </div>
            <button
              onClick={clearRegression}
              className="text-gray-400 hover:text-red-500 shrink-0 mt-0.5"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Regression panel */}
      {showRegPanel && (
        <div className="mx-3 mb-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Add Regression
          </p>
          <div className="flex flex-col gap-2">
            {REGRESSION_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`reg-${id}`}
                  value={opt.value}
                  checked={selectedReg === opt.value}
                  onChange={() => setSelectedReg(opt.value)}
                  className="accent-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={runRegression}
              disabled={validPairs.length < 2}
              className="flex-1 py-1.5 text-sm font-semibold bg-blue-500 text-white rounded-md
                         hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Fit
            </button>
            <button
              onClick={() => setShowRegPanel(false)}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-md
                         hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Regression trigger button */}
      {!showRegPanel && validPairs.length >= 2 && (
        <button
          onClick={() => setShowRegPanel(true)}
          className="flex items-center gap-1.5 mx-3 mb-2 px-2.5 py-1 text-xs font-semibold
                     text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-md
                     hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors border border-blue-100
                     dark:border-blue-800"
        >
          <TrendingUp size={12} />
          Add regression ({validPairs.length} points)
        </button>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDelete={() => removeTableRow(id, contextMenu.rowId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
