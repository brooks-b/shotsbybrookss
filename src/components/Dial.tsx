"use client";

import { useRef, useState } from "react";

type Props = {
  labels: string[];
  value: number;
  onChange: (index: number) => void;
  /** Enter / double-click: open the selected item. */
  onActivate?: (index: number) => void;
  label: string;
  /** Spoken value for screen readers. */
  valueText: (index: number) => string;
  size?: number;
};

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * A knurled top-plate dial, like the X-T50's mode and film-sim dials.
 * It's an ARIA slider underneath: arrow keys step one detent, Home/End
 * jump, and pointer drags rotate it (mouse, pen or touch).
 */
export function Dial({ labels, value, onChange, onActivate, label, valueText, size = 200 }: Props) {
  const n = labels.length;
  const step = 360 / n;
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startAngle: number; startRotation: number; moved: boolean } | null>(null);
  // Continuous rotation so the dial never spins the long way round.
  const [rotation, setRotation] = useState(-value * step);
  const [dragging, setDragging] = useState(false);

  // Keep rotation in sync when the value changes from outside (hover on a row).
  const target = -value * step;
  const delta = mod(target - rotation + 180, 360) - 180;
  if (!dragging && Math.abs(delta) > 0.5) setRotation(rotation + delta);

  const angleOf = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    ref.current?.setPointerCapture(e.pointerId);
    drag.current = { startAngle: angleOf(e), startRotation: rotation, moved: false };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const d = mod(angleOf(e) - drag.current.startAngle + 180, 360) - 180;
    if (Math.abs(d) > 2) drag.current.moved = true;
    const next = drag.current.startRotation + d;
    setRotation(next);
    const index = mod(Math.round(-next / step), n);
    if (index !== value) onChange(index);
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    // Snap to the selected detent by the shortest way round.
    setRotation(rotation + (mod(-value * step - rotation + 180, 360) - 180));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys: Record<string, number> = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
      PageUp: 3,
      PageDown: -3,
    };
    if (e.key in keys) {
      e.preventDefault();
      onChange(mod(value + keys[e.key], n));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(n - 1);
    } else if (e.key === "Enter" && onActivate) {
      e.preventDefault();
      onActivate(value);
    }
  };

  return (
    <div className="relative select-none" style={{ width: size, height: size }}>
      {/* Index mark */}
      <div
        className="absolute left-1/2 top-0 z-10 h-2 w-[2px] -translate-x-1/2 -translate-y-2.5 bg-signal"
        aria-hidden
      />
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={n}
        aria-valuenow={value + 1}
        aria-valuetext={valueText(value)}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => onActivate?.(value)}
        className="h-full w-full cursor-grab touch-none rounded-full active:cursor-grabbing"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: dragging ? "none" : "transform 520ms cubic-bezier(0.34, 1.4, 0.5, 1)",
        }}
      >
        <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
          {/* Fine knurling on the rim */}
          {Array.from({ length: 90 }, (_, i) => (
            <line
              key={i}
              x1="100"
              y1="3"
              x2="100"
              y2="10"
              stroke="rgb(237 232 223 / 0.18)"
              strokeWidth="1"
              transform={`rotate(${i * 4} 100 100)`}
            />
          ))}
          <circle cx="100" cy="100" r="86" fill="#151411" stroke="rgb(237 232 223 / 0.14)" />
          {/* One detent per chapter */}
          {labels.map((l, i) => (
            <line
              key={l + i}
              x1="100"
              y1="22"
              x2="100"
              y2={i === value ? 40 : 32}
              stroke={i === value ? "#ede8df" : "rgb(237 232 223 / 0.35)"}
              strokeWidth={i === value ? 3 : 2}
              transform={`rotate(${i * step} 100 100)`}
            />
          ))}
          <circle cx="100" cy="100" r="40" fill="#0e0d0b" />
        </svg>
      </div>
    </div>
  );
}
