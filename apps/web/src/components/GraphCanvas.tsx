import React, { useEffect, useRef, useCallback } from 'react';
import type { POI, InequalityRegion } from '@graphx/math-engine';
import { formatCoordinates } from '@graphx/math-engine';
import { useGraphStore } from '../store/useGraphStore';

export interface Point2D { x: number; y: number; }
export interface GraphWindow { xMin: number; xMax: number; yMin: number; yMax: number; }
export interface ExpressionData { 
  id: string; 
  color: string; 
  points: Point2D[]; 
  type: 'curve' | 'point' | 'area' | 'segments' | 'integral_area' | 'inequality'; 
  pois?: POI[];
  evalFn?: (x: number) => number;
  inequalityRegion?: InequalityRegion;
}

/** Parse a CSS hex color string into [r, g, b] 0-255 components. */
function hexToRgb(hex: string): [number, number, number] {
  // Handle shorthand #abc → #aabbcc
  const short = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(short, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 255];
}

export interface GraphCanvasProps {
  expressions: ExpressionData[];
  window: GraphWindow;
  onWindowChange: (w: GraphWindow) => void;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({ expressions, window, onWindowChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeExpressionId = useGraphStore(s => s.activeExpressionId);
  const pinnedPOIs = useGraphStore(s => s.pinnedPOIs);
  const togglePinnedPOI = useGraphStore(s => s.togglePinnedPOI);
  const theme = useGraphStore(s => s.theme);
  
  const hoveredPointRef = useRef<{ x: number, y: number, cx: number, cy: number, label?: string, poiId?: string } | null>(null);
  const activeExpressionIdRef = useRef<string | null>(activeExpressionId);
  const pinnedPOIsRef = useRef<Record<string, boolean>>(pinnedPOIs);
  
  // Keep refs to avoid rebinding requestAnimationFrame logic continuously
  const windowRef = useRef<GraphWindow>(window);
  const expressionsRef = useRef<ExpressionData[]>(expressions);
  const themeRef = useRef(theme);

  useEffect(() => {
    themeRef.current = theme;
    requestRender();
  }, [theme]);

  useEffect(() => {
    activeExpressionIdRef.current = activeExpressionId;
    requestRender();
  }, [activeExpressionId]);

  useEffect(() => {
    pinnedPOIsRef.current = pinnedPOIs;
    requestRender();
  }, [pinnedPOIs]);

  useEffect(() => {
    windowRef.current = window;
    requestRender();
  }, [window]);

  useEffect(() => {
    expressionsRef.current = expressions;
    requestRender();
  }, [expressions]);

  const renderFrameRef = useRef<number | undefined>(undefined);

  const requestRender = useCallback(() => {
    if (!renderFrameRef.current) {
      renderFrameRef.current = requestAnimationFrame(() => {
        render();
        renderFrameRef.current = undefined;
      });
    }
  }, []);

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { clientWidth, clientHeight } = canvas;
    const dpr = globalThis.window.devicePixelRatio || 1;
    canvas.width = clientWidth * dpr;
    canvas.height = clientHeight * dpr;

    ctx.scale(dpr, dpr);

    const w = windowRef.current;
    
    const worldToCanvas = (x: number, y: number) => {
      const cx = ((x - w.xMin) / (w.xMax - w.xMin)) * clientWidth;
      const cy = clientHeight - ((y - w.yMin) / (w.yMax - w.yMin)) * clientHeight;
      return { cx, cy };
    };

    const palette = themeRef.current === 'white'
      ? {
          background: '#ffffff',
          minorGrid: 'rgba(0, 0, 0, 0.08)',
          majorGrid: 'rgba(0, 0, 0, 0.22)',
          axis: 'rgba(0, 0, 0, 0.7)',
          label: 'rgba(17, 24, 39, 0.9)',
          crosshair: 'rgba(17, 24, 39, 0.28)',
          pointStroke: '#ffffff',
          hoverDotFill: '#ffffff',
          tooltipBg: 'rgba(17, 24, 39, 0.9)',
          tooltipText: '#f9fafb',
        }
      : {
          background: '#111827',
          minorGrid: 'rgba(255, 255, 255, 0.05)',
          majorGrid: 'rgba(255, 255, 255, 0.15)',
          axis: 'rgba(255, 255, 255, 0.4)',
          label: 'rgba(255, 255, 255, 0.7)',
          crosshair: 'rgba(255, 255, 255, 0.3)',
          pointStroke: '#ffffff',
          hoverDotFill: '#ffffff',
          tooltipBg: 'rgba(17, 24, 39, 0.9)',
          tooltipText: '#f9fafb',
        };

    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, clientWidth, clientHeight);

    const xRange = w.xMax - w.xMin;
    const yRange = w.yMax - w.yMin;

    const getStep = (range: number) => {
      const p = Math.pow(10, Math.floor(Math.log10(range / 5)));
      const f = (range / 5) / p;
      let step10 = 1;
      if (f > 5) step10 = 5;
      else if (f > 2) step10 = 2;
      return step10 * p;
    };

    const xStep = getStep(xRange);
    const yStep = getStep(yRange);

    ctx.lineWidth = 1;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const drawGridLines = (step: number, isMinor: boolean) => {
      ctx.strokeStyle = isMinor ? palette.minorGrid : palette.majorGrid;
      ctx.beginPath();
      
      const startX = Math.floor(w.xMin / step) * step;
      for (let x = startX; x <= w.xMax; x += step) {
        const { cx } = worldToCanvas(x, 0);
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, clientHeight);
      }

      const startY = Math.floor(w.yMin / step) * step;
      for (let y = startY; y <= w.yMax; y += step) {
        const { cy } = worldToCanvas(0, y);
        ctx.moveTo(0, cy);
        ctx.lineTo(clientWidth, cy);
      }
      ctx.stroke();
    };

    drawGridLines(xStep / 5, true);
    drawGridLines(xStep, false);

    ctx.strokeStyle = palette.axis;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const origin = worldToCanvas(0, 0);
    
    if (origin.cy >= 0 && origin.cy <= clientHeight) {
      ctx.moveTo(0, origin.cy);
      ctx.lineTo(clientWidth, origin.cy);
    }
    if (origin.cx >= 0 && origin.cx <= clientWidth) {
      ctx.moveTo(origin.cx, 0);
      ctx.lineTo(origin.cx, clientHeight);
    }
    ctx.stroke();

    ctx.fillStyle = palette.label;
    const startXLabel = Math.floor(w.xMin / xStep) * xStep;
    for (let x = startXLabel; x <= w.xMax; x += xStep) {
      if (Math.abs(x) < 1e-10) continue;
      const { cx } = worldToCanvas(x, 0);
      let labelY = origin.cy + 5;
      if (labelY > clientHeight - 20) labelY = clientHeight - 20;
      if (labelY < 5) labelY = 5;
      ctx.fillText(parseFloat(x.toPrecision(4)).toString(), cx, labelY);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const startYLabel = Math.floor(w.yMin / yStep) * yStep;
    for (let y = startYLabel; y <= w.yMax; y += yStep) {
      if (Math.abs(y) < 1e-10) continue;
      const { cy } = worldToCanvas(0, y);
      let labelX = origin.cx - 5;
      if (labelX < 20) labelX = 20;
      if (labelX > clientWidth - 5) labelX = clientWidth - 5;
      ctx.fillText(parseFloat(y.toPrecision(4)).toString(), labelX, cy);
    }
    
    ctx.fillText('0', origin.cx - 5, origin.cy + 10);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, clientWidth, clientHeight);
    ctx.clip();

    (expressionsRef.current ?? []).forEach(expr => {
      if (!expr.points || expr.points.length === 0) return;

      if (expr.type === 'point') {
        ctx.fillStyle = expr.color;
        expr.points.forEach(p => {
          if (!isFinite(p.y)) return;
          const { cx, cy } = worldToCanvas(p.x, p.y);
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
          ctx.fill();
        });
      } else if (expr.type === 'segments') {
        ctx.strokeStyle = expr.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < expr.points.length; i += 2) {
          if (i + 1 >= expr.points.length) break;
          const p1 = expr.points[i];
          const p2 = expr.points[i+1];
          if (!isFinite(p1.y) || !isFinite(p2.y)) continue;
          
          const c1 = worldToCanvas(p1.x, p1.y);
          const c2 = worldToCanvas(p2.x, p2.y);
          ctx.moveTo(c1.cx, c1.cy);
          ctx.lineTo(c2.cx, c2.cy);
        }
        ctx.stroke();
      } else if (expr.type === 'curve') {
        ctx.strokeStyle = expr.color;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        let first = true;
        expr.points.forEach(p => {
          if (!isFinite(p.y)) {
            first = true;
            return;
          }
          const { cx, cy } = worldToCanvas(p.x, p.y);
          if (first) {
            ctx.moveTo(cx, cy);
            first = false;
          } else {
            ctx.lineTo(cx, cy);
          }
        });
        ctx.stroke();
      } else if (expr.type === 'area' || expr.type === 'integral_area') {
        ctx.fillStyle = expr.color;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        let first = true;
        const validPoints = expr.points.filter(p => isFinite(p.y));
        if (validPoints.length === 0) {
          ctx.globalAlpha = 1.0;
          return;
        }

        const { cx: firstCx } = worldToCanvas(validPoints[0].x, validPoints[0].y);
        validPoints.forEach(p => {
          const { cx, cy } = worldToCanvas(p.x, p.y);
          if (first) {
            ctx.moveTo(cx, cy);
            first = false;
          } else {
            ctx.lineTo(cx, cy);
          }
        });
        const lastP = validPoints[validPoints.length - 1];
        const { cx: lastCx } = worldToCanvas(lastP.x, lastP.y);
        const { cy: bottomCy } = worldToCanvas(0, expr.type === 'integral_area' ? 0 : w.yMin);
        ctx.lineTo(lastCx, bottomCy);
        ctx.lineTo(firstCx, bottomCy);
        ctx.closePath();
        ctx.fill();

        if (expr.type === 'integral_area') {
          ctx.globalAlpha = 1.0;
          ctx.strokeStyle = expr.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          let f = true;
          validPoints.forEach(p => {
             const { cx, cy } = worldToCanvas(p.x, p.y);
             if (f) { ctx.moveTo(cx, cy); f = false; }
             else ctx.lineTo(cx, cy);
          });
          ctx.stroke();
        }

        ctx.globalAlpha = 1.0;
      } else if (expr.type === 'inequality' && expr.inequalityRegion) {
        // ── Inequality: filled pixel region + boundary curve ────────────────
        const region = expr.inequalityRegion;
        const [r, g, b] = hexToRgb(expr.color);

        // ── Fill: render mask onto a small offscreen canvas, then scale up ──
        const offscreen = new OffscreenCanvas(region.cols, region.rows);
        const offCtx = offscreen.getContext('2d')!;
        const imgData = offCtx.createImageData(region.cols, region.rows);
        const data = imgData.data;

        for (let idx = 0; idx < region.rows * region.cols; idx++) {
          if (region.mask[idx]) {
            const pixBase = idx * 4;
            data[pixBase]     = r;
            data[pixBase + 1] = g;
            data[pixBase + 2] = b;
            data[pixBase + 3] = 64; // ~25% opacity — multiple overlapping regions compound naturally
          }
        }
        offCtx.putImageData(imgData, 0, 0);

        // Smooth scaling from grid resolution to canvas size
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(offscreen, 0, 0, clientWidth, clientHeight);
        ctx.imageSmoothingEnabled = true; // restore

        // ── Boundary: draw the zero-contour segments ─────────────────────────
        ctx.strokeStyle = expr.color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        // Dashed for strict inequalities, solid for non-strict
        if (region.isStrict) {
          ctx.setLineDash([6, 5]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        for (const [p1, p2] of region.boundary) {
          const c1 = worldToCanvas(p1.x, p1.y);
          const c2 = worldToCanvas(p2.x, p2.y);
          ctx.moveTo(c1.cx, c1.cy);
          ctx.lineTo(c2.cx, c2.cy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Draw POIs
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    (expressionsRef.current ?? []).forEach(expr => {
      if (expr.id === activeExpressionIdRef.current && expr.pois) {
        expr.pois.forEach((poi) => {
          const { cx, cy } = worldToCanvas(poi.x, poi.y);
          const poiId = `${expr.id}_${poi.x}_${poi.y}`;
          const isHovered = hoveredPointRef.current?.poiId === poiId;
          const isPinned = pinnedPOIsRef.current[poiId];

          ctx.beginPath();
          ctx.arc(cx, cy, isHovered ? 6 : 4, 0, 2 * Math.PI);
          ctx.fillStyle = isHovered ? '#6b7280' : '#9ca3af';
          ctx.fill();
          ctx.strokeStyle = palette.pointStroke;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          if (isHovered || isPinned) {
            const text = poi.label || formatCoordinates(poi.x, poi.y);
            const textWidth = ctx.measureText(text).width;
            const pad = 8;
            const boxW = textWidth + pad * 2;
            const boxH = 24;
            let bx = cx + 12;
            let by = cy - boxH / 2;
            if (bx + boxW > clientWidth - 4) bx = cx - boxW - 12;
            if (by < 4) by = 4;

            ctx.fillStyle = isPinned ? 'rgba(37,99,235,0.92)' : palette.tooltipBg;
            ctx.beginPath();
            ctx.roundRect(bx, by, boxW, boxH, 4);
            ctx.fill();
            ctx.fillStyle = palette.tooltipText;
            ctx.fillText(text, bx + pad, by + boxH / 2);

            // If pinned, draw a small pin indicator circle
            if (isPinned) {
              ctx.beginPath();
              ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
              ctx.fillStyle = '#2563eb';
              ctx.fill();
              ctx.strokeStyle = palette.pointStroke;
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }
          }
        });
      }
    });

    // Draw active hover point (curve trace)
    if (hoveredPointRef.current && !hoveredPointRef.current.poiId) {
      const hPoint = hoveredPointRef.current;

      // Draw crosshair lines
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = palette.crosshair;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hPoint.cx, 0); ctx.lineTo(hPoint.cx, clientHeight);
      ctx.moveTo(0, hPoint.cy); ctx.lineTo(clientWidth, hPoint.cy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Draw dot
      ctx.beginPath();
      ctx.arc(hPoint.cx, hPoint.cy, 5, 0, 2 * Math.PI);
      ctx.fillStyle = palette.hoverDotFill;
      ctx.fill();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw tooltip
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const text = formatCoordinates(hPoint.x, hPoint.y);
      const textWidth = ctx.measureText(text).width;
      const pad = 8;
      const boxW = textWidth + pad * 2;
      const boxH = 24;
      let bx = hPoint.cx + 12;
      let by = hPoint.cy - boxH / 2;
      if (bx + boxW > clientWidth - 4) bx = hPoint.cx - boxW - 12;
      if (by < 4) by = 4;

      ctx.fillStyle = palette.tooltipBg;
      ctx.beginPath();
      ctx.roundRect(bx, by, boxW, boxH, 4);
      ctx.fill();
      ctx.fillStyle = palette.tooltipText;
      ctx.fillText(text, bx + pad, by + boxH / 2);
    }

    ctx.restore();
  };

  const isDragging = useRef(false);
  const dragStartPos = useRef<{x: number, y: number} | null>(null);
  const lastMousePos = useRef<{x: number, y: number} | null>(null);

  const canvasToWorldDelta = (dx: number, dy: number) => {
    if (!canvasRef.current) return { dxWorld: 0, dyWorld: 0 };
    const w = windowRef.current;
    const { clientWidth, clientHeight } = canvasRef.current;
    const dxWorld = (dx / clientWidth) * (w.xMax - w.xMin);
    const dyWorld = (dy / clientHeight) * (w.yMax - w.yMin);
    return { dxWorld, dyWorld };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = false;  // will be set true once we move far enough
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (canvasRef.current) {
      canvasRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (lastMousePos.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      const totalDx = dragStartPos.current ? e.clientX - dragStartPos.current.x : dx;
      const totalDy = dragStartPos.current ? e.clientY - dragStartPos.current.y : dy;
      const totalDist = Math.hypot(totalDx, totalDy);

      if (totalDist > 5) {
        isDragging.current = true;
      }

      if (isDragging.current) {
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        const { dxWorld, dyWorld } = canvasToWorldDelta(dx, dy);
        const w = windowRef.current;
        const newWindow = {
          xMin: w.xMin - dxWorld,
          xMax: w.xMax - dxWorld,
          yMin: w.yMin + dyWorld,
          yMax: w.yMax + dyWorld,
        };
        windowRef.current = newWindow;
        requestRender();
        onWindowChange(newWindow);
        return;
      }
    }

    // Hover logic
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const w = windowRef.current;
    const { clientWidth, clientHeight } = canvasRef.current;
    const mouseXWorld = w.xMin + (clientX / clientWidth) * (w.xMax - w.xMin);

    let closestPoint: typeof hoveredPointRef.current = null;
    const activeExpr = expressionsRef.current.find(e => e.id === activeExpressionIdRef.current);

    if (activeExpr) {
      // 1. Check POIs
      if (activeExpr.pois) {
        for (const poi of activeExpr.pois) {
          const cx = ((poi.x - w.xMin) / (w.xMax - w.xMin)) * clientWidth;
          const cy = clientHeight - ((poi.y - w.yMin) / (w.yMax - w.yMin)) * clientHeight;
          const dist = Math.hypot(cx - clientX, cy - clientY);
          if (dist < 15) {
            closestPoint = { x: poi.x, y: poi.y, cx, cy, label: poi.label, poiId: `${activeExpr.id}_${poi.x}_${poi.y}` };
            break;
          }
        }
      }

      // 2. Check nearest curve point (trace)
      if (!closestPoint && activeExpr.evalFn) {
        const y = activeExpr.evalFn(mouseXWorld);
        if (isFinite(y)) {
          const cx = ((mouseXWorld - w.xMin) / (w.xMax - w.xMin)) * clientWidth;
          const cy = clientHeight - ((y - w.yMin) / (w.yMax - w.yMin)) * clientHeight;
          const dist = Math.hypot(cx - clientX, cy - clientY);
          if (dist < 60) {
            closestPoint = { x: mouseXWorld, y, cx, cy };
          }
        }
      }
    }

    if (
      closestPoint?.poiId !== hoveredPointRef.current?.poiId ||
      Math.abs((closestPoint?.x || 0) - (hoveredPointRef.current?.x || 0)) > 1e-5
    ) {
      hoveredPointRef.current = closestPoint;
      requestRender();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    // Pin POI only if it was a clean click (no drag)
    if (!isDragging.current && hoveredPointRef.current?.poiId) {
      togglePinnedPOI(hoveredPointRef.current.poiId);
      requestRender();
    }
    isDragging.current = false;
    dragStartPos.current = null;
    lastMousePos.current = null;
    if (canvasRef.current) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }
  };

  const handlePointerLeave = () => {
    if (hoveredPointRef.current) {
      hoveredPointRef.current = null;
      requestRender();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const w = windowRef.current;
      const { clientWidth, clientHeight } = canvas;
      
      const xWorld = w.xMin + (mouseX / clientWidth) * (w.xMax - w.xMin);
      const yWorld = w.yMax - (mouseY / clientHeight) * (w.yMax - w.yMin);

      const zoomFactor = Math.pow(1.002, e.deltaY > 0 ? 50 : -50);

      const newWindow = { 
        xMin: xWorld - (xWorld - w.xMin) * zoomFactor, 
        xMax: xWorld + (w.xMax - xWorld) * zoomFactor, 
        yMin: yWorld - (yWorld - w.yMin) * zoomFactor, 
        yMax: yWorld + (w.yMax - yWorld) * zoomFactor 
      };
      
      windowRef.current = newWindow;
      requestRender();
      onWindowChange(newWindow);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [onWindowChange, requestRender]);

  const touchDistance = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchDistance.current = Math.sqrt(dx * dx + dy * dy);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchDistance.current !== null) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const zoomFactor = touchDistance.current / dist;
        touchDistance.current = dist;

        const rect = canvas.getBoundingClientRect();
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

        const w = windowRef.current;
        const { clientWidth, clientHeight } = canvas;
        const xWorld = w.xMin + (centerX / clientWidth) * (w.xMax - w.xMin);
        const yWorld = w.yMax - (centerY / clientHeight) * (w.yMax - w.yMin);

        const newWindow = { 
          xMin: xWorld - (xWorld - w.xMin) * zoomFactor, 
          xMax: xWorld + (w.xMax - xWorld) * zoomFactor, 
          yMin: yWorld - (yWorld - w.yMin) * zoomFactor, 
          yMax: yWorld + (w.yMax - yWorld) * zoomFactor 
        };
        
        windowRef.current = newWindow;
        requestRender();
        onWindowChange(newWindow);
      }
    };

    const handleTouchEnd = () => { touchDistance.current = null; };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [onWindowChange, requestRender]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => requestRender());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [requestRender]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      style={{ 
        width: '100%', 
        height: '100%', 
        touchAction: 'none', 
        cursor: 'crosshair',
        backgroundColor: theme === 'white' ? '#ffffff' : '#111827'
      }}
    />
  );
};
