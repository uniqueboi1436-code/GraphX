import { create } from 'zustand';
import type { GraphWindow } from '../components/GraphCanvas';
import type { RegressionResult } from '@graphx/math-engine';

// ── Table types ────────────────────────────────────────────────────────────
export interface TableRow {
  id: string;
  x: string;
  y: string;
}

export interface TableData {
  rows: TableRow[];
  regression?: RegressionResult;
}

// ── Expression ─────────────────────────────────────────────────────────────
export interface Expression {
  id: string;
  latex: string;
  color: string;
  visible: boolean;
  kind?: 'expression' | 'table';
  type?: 'equation' | 'inequality' | 'point' | 'parametric' | 'polar' | 'list' | 'assignment' | 'function_def' | 'slider' | 'table' | 'note';
  error?: boolean;
  tableData?: TableData;
}

// ── Slider types ───────────────────────────────────────────────────────────
export interface SliderConfig {
  min: number;
  max: number;
  value: number;
  step: number;
}

// ── Store ──────────────────────────────────────────────────────────────────
interface GraphStore {
  expressions: Expression[];
  window: GraphWindow;
  sliders: Record<string, SliderConfig>;
  activeExpressionId: string | null;
  pinnedPOIs: Record<string, boolean>;
  theme: 'dark' | 'white';
  isKeyboardOpen: boolean;

  // Expression actions
  addExpression:   (index?: number) => void;
  insertTable:     (index?: number) => void;
  updateExpression:(id: string, updates: Partial<Expression>) => void;
  removeExpression:(id: string) => void;
  setWindow:       (w: GraphWindow) => void;

  // Table row actions
  updateTableRow:  (exprId: string, rowId: string, updates: Partial<TableRow>) => void;
  addTableRow:     (exprId: string) => void;
  removeTableRow:  (exprId: string, rowId: string) => void;
  moveTableRow:    (exprId: string, fromIdx: number, toIdx: number) => void;
  setTableRegression: (exprId: string, regression?: RegressionResult) => void;

  // Slider actions
  setSlider:      (varName: string, config: Partial<SliderConfig>) => void;
  setSliderValue: (varName: string, value: number) => void;
  removeSlider:   (varName: string) => void;

  // POI & UI state actions
  setActiveExpressionId: (id: string | null) => void;
  togglePinnedPOI: (id: string) => void;
  setTheme: (theme: 'dark' | 'white') => void;
  setKeyboardOpen: (isOpen: boolean) => void;
}

export const COLORS = ['#c74440', '#2d70b3', '#388c46', '#fa7e19', '#6042a6', '#000000'];
const generateId = () => Math.random().toString(36).substring(2, 9);

const makeBlankRows = (n = 5): TableRow[] =>
  Array.from({ length: n }, () => ({ id: generateId(), x: '', y: '' }));

// ── Store implementation ───────────────────────────────────────────────────
export const useGraphStore = create<GraphStore>((set) => ({
  expressions: [{ id: generateId(), latex: '', color: COLORS[0], visible: true, kind: 'expression' }],
  window: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
  sliders: {},
  activeExpressionId: null,
  pinnedPOIs: {},
  theme: 'dark',
  isKeyboardOpen: false,

  // ── Expression ────────────────────────────────────────────────────────
  addExpression: (index) => {
    set((state) => {
      const expressions = [...state.expressions];
      const newExpr: Expression = {
        id: generateId(),
        latex: '',
        color: COLORS[expressions.length % COLORS.length],
        visible: true,
        kind: 'expression',
      };
      if (index !== undefined) expressions.splice(index + 1, 0, newExpr);
      else expressions.push(newExpr);
      return { expressions };
    });
  },

  insertTable: (index) => {
    set((state) => {
      const expressions = [...state.expressions];
      const newTable: Expression = {
        id: generateId(),
        latex: '',
        color: COLORS[expressions.length % COLORS.length],
        visible: true,
        kind: 'table',
        type: 'table',
        tableData: { rows: makeBlankRows(5) },
      };
      if (index !== undefined) expressions.splice(index + 1, 0, newTable);
      else expressions.push(newTable);
      return { expressions };
    });
  },

  updateExpression: (id, updates) =>
    set((state) => ({
      expressions: state.expressions.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),

  removeExpression: (id) =>
    set((state) => ({
      expressions: state.expressions.filter((e) => e.id !== id),
    })),

  setWindow: (window) => set({ window }),

  // ── Table rows ────────────────────────────────────────────────────────
  updateTableRow: (exprId, rowId, updates) =>
    set((state) => ({
      expressions: state.expressions.map((e) => {
        if (e.id !== exprId || !e.tableData) return e;
        const rows = e.tableData.rows.map((r) =>
          r.id === rowId ? { ...r, ...updates } : r,
        );
        return { ...e, tableData: { ...e.tableData, rows } };
      }),
    })),

  addTableRow: (exprId) =>
    set((state) => ({
      expressions: state.expressions.map((e) => {
        if (e.id !== exprId || !e.tableData) return e;
        return {
          ...e,
          tableData: {
            ...e.tableData,
            rows: [...e.tableData.rows, { id: generateId(), x: '', y: '' }],
          },
        };
      }),
    })),

  removeTableRow: (exprId, rowId) =>
    set((state) => ({
      expressions: state.expressions.map((e) => {
        if (e.id !== exprId || !e.tableData) return e;
        const rows = e.tableData.rows.filter((r) => r.id !== rowId);
        return { ...e, tableData: { ...e.tableData, rows: rows.length ? rows : [{ id: generateId(), x: '', y: '' }] } };
      }),
    })),

  moveTableRow: (exprId, fromIdx, toIdx) =>
    set((state) => ({
      expressions: state.expressions.map((e) => {
        if (e.id !== exprId || !e.tableData) return e;
        const rows = [...e.tableData.rows];
        const [item] = rows.splice(fromIdx, 1);
        rows.splice(toIdx, 0, item);
        return { ...e, tableData: { ...e.tableData, rows } };
      }),
    })),

  setTableRegression: (exprId, regression) =>
    set((state) => ({
      expressions: state.expressions.map((e) =>
        e.id === exprId && e.tableData
          ? { ...e, tableData: { ...e.tableData, regression } }
          : e,
      ),
    })),

  // ── Sliders ───────────────────────────────────────────────────────────
  setSlider: (varName, config) =>
    set((state) => {
      const existing = state.sliders[varName];
      return {
        sliders: {
          ...state.sliders,
          [varName]: existing 
            ? { ...existing, ...config } 
            : { min: -10, max: 10, value: 1, step: 0.01, ...config },
        },
      };
    }),

  setSliderValue: (varName, value) =>
    set((state) => ({
      sliders: { ...state.sliders, [varName]: { ...state.sliders[varName], value } },
    })),

  removeSlider: (varName) =>
    set((state) => {
      const sliders = { ...state.sliders };
      delete sliders[varName];
      return { sliders };
    }),

  setActiveExpressionId: (id) => set({ activeExpressionId: id }),

  togglePinnedPOI: (id) =>
    set((state) => ({
      pinnedPOIs: { ...state.pinnedPOIs, [id]: !state.pinnedPOIs[id] }
    })),

  setTheme: (theme) => set({ theme }),

  setKeyboardOpen: (isOpen) => set({ isKeyboardOpen: isOpen }),
}));
