/**
 * MathInput — wraps the global MathQuill (loaded from CDN in index.html)
 * directly, avoiding any npm package CJS/ESM incompatibilities.
 *
 * Requires: jQuery + MathQuill 0.10.1 loaded globally (already in index.html).
 */
import React, { useEffect, useRef, useCallback } from 'react';

// ── Type shim for global MathQuill ──────────────────────────────────────────
declare global {
  interface Window {
    MathQuill: any;
  }
}

// Lazy singleton — resolved once MQ is on the window
let MQ: any = null;
function getMQ() {
  if (!MQ && window.MathQuill) {
    MQ = window.MathQuill.getInterface(2);
  }
  return MQ;
}

// Global reference to the last focused MathField
let activeMathField: any = null;

export function sendMathCommand(type: 'cmd' | 'write' | 'keystroke' | 'typedText', value: string) {
  if (activeMathField) {
    activeMathField[type](value);
    activeMathField.focus();
  }
}

// ── MathQuill config factory ────────────────────────────────────────────────
function makeMqConfig(onEnter?: () => void, onChange?: (latex: string) => void) {
  return {
    spaceBehavesLikeTab: false,
    leftRightIntoCmdGoes: 'up',
    restrictMismatchedBrackets: false,
    supSubsRequireOperand: false,
    charsThatBreakOutOfSupSub: '=',
    autoSubscriptNumerals: false,
    autoCommands:
      'pi theta alpha beta gamma delta epsilon zeta eta iota kappa lambda mu nu xi ' +
      'rho sigma tau upsilon phi psi omega sqrt sum prod int infty',
    autoOperatorNames:
      'sin cos tan sec csc cot arcsin arccos arctan arcsinh arccosh arctanh ' +
      'sinh cosh tanh sech csch coth log ln exp ' +
      'abs ceil floor round mod max min sign gcd lcm nthroot cbrt hypot',
    handlers: {
      enter: () => onEnter?.(),
      edit: (mf: any) => onChange?.(mf.latex()),
    },
  };
}

// ── Props ────────────────────────────────────────────────────────────────────
interface MathInputProps {
  latex: string;
  onChange: (latex: string) => void;
  onEnter?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  color?: string;
  hasError?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────
export const MathInput: React.FC<MathInputProps> = ({
  latex,
  onChange,
  onEnter,
  onFocus,
  onBlur,
  color,
  hasError,
}) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const mqFieldRef   = useRef<any>(null);
  // Track the last latex we set so we don't bounce cursor
  const lastLatexRef = useRef<string>(latex);
  const handleMqChange = useCallback((nextLatex: string) => {
    lastLatexRef.current = nextLatex;
    onChange(nextLatex);
  }, [onChange]);

  // Mount — create MathQuill editable field once
  useEffect(() => {
    const mq = getMQ();
    if (!mq || !containerRef.current) return;

    const el = containerRef.current;
    const field = mq.MathField(el, makeMqConfig(onEnter, handleMqChange));
    mqFieldRef.current = field;
    field.latex(latex);
    lastLatexRef.current = latex;

    if (!activeMathField) {
      activeMathField = field;
    }

    // Focus / blur
    el.addEventListener('focusin',  () => {
      activeMathField = field;
      onFocus?.();
    });
    el.addEventListener('focusout', () => onBlur?.());

    return () => {
      // MathQuill doesn't have an official destroy; clearing innerHTML is enough
      mqFieldRef.current = null;
      el.innerHTML = '';
    };
    // Only runs on mount — we manage latex sync via a separate effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-attach handlers when callbacks change (e.g. different row index for onEnter)
  useEffect(() => {
    const field = mqFieldRef.current;
    if (!field) return;
    field.config(makeMqConfig(onEnter, handleMqChange));
  }, [onEnter, handleMqChange]);

  // Sync external latex → MQ (only when value truly changed externally)
  useEffect(() => {
    const field = mqFieldRef.current;
    if (!field) return;
    if (lastLatexRef.current !== latex) {
      lastLatexRef.current = latex;
      field.latex(latex);
    }
  }, [latex]);

  const handleClick = useCallback(() => {
    mqFieldRef.current?.focus();
  }, []);

  return (
    <div
      className={`mq-input-wrapper${hasError ? ' mq-input-error' : ''}`}
      style={color ? ({ '--mq-accent': color } as React.CSSProperties) : undefined}
      onClick={handleClick}
    >
      <span ref={containerRef} />
    </div>
  );
};
