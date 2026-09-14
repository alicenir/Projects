import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ shell */

export function useMeasure<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    ro.observe(el);
    setWidth(Math.max(240, el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export type TableSpec = { columns: string[]; rows: (string | number)[][] };

type FigureProps = {
  title: string;
  subtitle?: string;
  legend?: { label: string; color: string; shape?: 'line' | 'rect' }[];
  table?: TableSpec;
  footnote?: string;
  action?: ReactNode;
  refetching?: boolean;
  children: ReactNode;
};

/** Every chart ships in this frame: title, legend, and a table-view twin. */
export function Figure({ title, subtitle, legend, table, footnote, action, refetching, children }: FigureProps) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className="card flex flex-col gap-3 p-4 sm:p-5">
      <figcaption className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-2">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {table && (
            <button type="button" className="chip" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
              {showTable ? 'Chart' : 'Table'}
            </button>
          )}
        </div>
      </figcaption>

      {legend && legend.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5 text-xs text-ink-2">
              {item.shape === 'line' ? (
                <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: item.color }} />
              ) : (
                <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: item.color }} />
              )}
              {item.label}
            </li>
          ))}
        </ul>
      )}

      <div className={refetching ? 'is-refetching' : undefined}>
        {showTable && table ? <DataTable {...table} /> : children}
      </div>

      {footnote && <p className="text-xs text-muted">{footnote}</p>}
    </figure>
  );
}

export function DataTable({ columns, rows }: TableSpec) {
  return (
    <div className="max-h-80 overflow-auto rounded-xl border border-line">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-raised text-ink-2">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-line">
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-1.5 ${j ? 'tabular-nums text-ink-2' : 'text-ink'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------- tooltip */

type TipState = { x: number; y: number; content: ReactNode } | null;

function Tooltip({ tip, width }: { tip: TipState; width: number }) {
  if (!tip) return null;
  const flip = tip.x > width * 0.6;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-20 max-w-[16rem] rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-card"
      style={{ left: tip.x, top: tip.y, transform: `translate(${flip ? '-104%' : '4%'}, -50%)` }}
    >
      {tip.content}
    </div>
  );
}

export function TipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      {color && <span className="inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="text-ink-2">{label}</span>
      <span className="ml-auto font-semibold tabular-nums text-ink">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------- bar list */

export type BarRow = { label: string; value: number; color?: string; note?: string; href?: string };

/**
 * Horizontal ranking bars: one hue unless the rows carry their own identity
 * colour, value at the tip, 2px of surface between neighbours.
 */
export function BarList({
  rows,
  format = (v: number) => v.toLocaleString(),
  max,
  onSelect,
}: {
  rows: BarRow[];
  format?: (v: number) => string;
  max?: number;
  onSelect?: (row: BarRow) => void;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-[6px]">
      {rows.map((row) => {
        const pct = Math.max(1.5, (row.value / top) * 100);
        const Tag = onSelect ? 'button' : 'div';
        return (
          <li key={row.label}>
            <Tag
              {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(row) } : {})}
              className={`group grid w-full grid-cols-[minmax(6.5rem,11rem)_1fr_auto] items-center gap-3 rounded-lg py-[3px] text-left ${
                onSelect ? 'hover:bg-raised' : ''
              }`}
            >
              <span className="truncate text-xs text-ink" title={row.label}>
                {row.label}
              </span>
              <span className="relative h-3 rounded-full bg-[color:var(--grid)]">
                <span
                  className="absolute inset-y-0 left-0 rounded-l-sm rounded-r-[4px]"
                  style={{ width: `${pct}%`, background: row.color ?? 'var(--series-1)' }}
                />
              </span>
              <span className="whitespace-nowrap text-xs tabular-nums text-ink-2">
                {format(row.value)}
                {row.note && <span className="ml-1 text-muted">{row.note}</span>}
              </span>
            </Tag>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------- column chart */

export type Column = { label: string; value: number; color?: string; tip?: ReactNode };

export function ColumnChart({
  data,
  height = 200,
  format = (v: number) => v.toLocaleString(),
  labelEvery = 1,
  highlight,
}: {
  data: Column[];
  height?: number;
  format?: (v: number) => string;
  labelEvery?: number;
  highlight?: number;
}) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [tip, setTip] = useState<TipState>(null);
  const pad = { top: 18, right: 8, bottom: 26, left: 8 };
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = (width - pad.left - pad.right) / Math.max(1, data.length);
  const barW = Math.min(24, Math.max(3, slot - 2)); // 2px surface gap between neighbours
  const peak = highlight ?? data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

  return (
    <div ref={ref} className="relative">
      <svg width={width} height={height} role="img">
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="var(--axis)" strokeWidth={1} />
        {data.map((d, i) => {
          const h = Math.max(1, (d.value / max) * plotH);
          const x = pad.left + i * slot + (slot - barW) / 2;
          const y = pad.top + plotH - h;
          return (
            <g key={`${d.label}-${i}`}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={Math.min(4, barW / 2)}
                fill={d.color ?? 'var(--series-1)'}
                opacity={tip && tip.content && i !== peak ? 0.92 : 1}
              />
              {/* square off the baseline end: only the cap is rounded */}
              <rect x={x} y={Math.max(y, pad.top + plotH - Math.max(0, h - 4))} width={barW} height={Math.min(4, h)} fill={d.color ?? 'var(--series-1)'} />
              <rect
                x={pad.left + i * slot}
                y={pad.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onPointerEnter={(e) =>
                  setTip({
                    x: e.nativeEvent.offsetX,
                    y: Math.max(28, y),
                    content: d.tip ?? <TipRow label={d.label} value={format(d.value)} />,
                  })
                }
                onPointerLeave={() => setTip(null)}
                tabIndex={0}
                onFocus={() => setTip({ x: x + barW, y: Math.max(28, y), content: d.tip ?? <TipRow label={d.label} value={format(d.value)} /> })}
                onBlur={() => setTip(null)}
              />
              {i === peak && (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="fill-[color:var(--text-secondary)] text-[10px] tabular-nums">
                  {format(d.value)}
                </text>
              )}
              {i % labelEvery === 0 && (
                <text
                  x={x + barW / 2}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-[color:var(--text-muted)] text-[10px] tabular-nums"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

/* ------------------------------------------------------------ line chart */

/** Round an axis out to human numbers (0 / 1,000 / 2,000) instead of 8 / 664. */
function niceScale(min: number, max: number, zeroBased: boolean): { lo: number; hi: number; ticks: number[] } {
  const base = zeroBased ? Math.min(0, min) : min;
  const raw = Math.max(1e-9, max - base) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw) ?? magnitude * 10;
  const lo = Math.floor(base / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 1000; v += step) ticks.push(Number(v.toPrecision(12)));
  return { lo, hi, ticks };
}

export type Series = { label: string; color: string; points: { x: number; y: number | null }[] };

export function LineChart({
  series,
  height = 240,
  formatX = (v: number) => String(v),
  formatY = (v: number) => v.toFixed(1),
  yDomain,
  area,
  zeroBased,
}: {
  series: Series[];
  height?: number;
  formatX?: (v: number) => string;
  formatY?: (v: number) => string;
  yDomain?: [number, number];
  area?: boolean;
  zeroBased?: boolean;
}) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [hoverX, setHoverX] = useState<number | null>(null);
  const pad = { top: 16, right: 52, bottom: 26, left: 44 };
  const plotW = Math.max(10, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;

  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const ys = series.flatMap((s) => s.points.map((p) => p.y)).filter((v): v is number => v !== null);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const scale = niceScale(Math.min(...ys), Math.max(...ys), Boolean(zeroBased));
  const [yMin, yMax] = yDomain ?? [scale.lo, scale.hi];
  const sx = (x: number) => pad.left + ((x - xMin) / Math.max(1e-9, xMax - xMin)) * plotW;
  const sy = (y: number) => pad.top + plotH - ((y - yMin) / Math.max(1e-9, yMax - yMin)) * plotH;

  const yTicks = yDomain ? Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) * i) / 4) : scale.ticks;
  const tickCount = Math.min(6, Math.max(2, new Set(xs).size));
  const xTicks = Array.from({ length: tickCount }, (_, i) => xMin + ((xMax - xMin) * i) / (tickCount - 1));

  const nearest = useCallback(
    (clientX: number, rect: DOMRect) => {
      const px = clientX - rect.left;
      const value = xMin + ((px - pad.left) / plotW) * (xMax - xMin);
      let best = xs[0];
      for (const x of xs) if (Math.abs(x - value) < Math.abs(best - value)) best = x;
      return best;
    },
    [xs, xMin, xMax, plotW, pad.left],
  );

  const hovered = hoverX === null ? null : hoverX;

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={height}
        role="img"
        onPointerMove={(e) => setHoverX(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onPointerLeave={() => setHoverX(null)}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={sy(t)} y2={sy(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={pad.left - 8} y={sy(t) + 3} textAnchor="end" className="fill-[color:var(--text-muted)] text-[10px] tabular-nums">
              {formatY(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={sx(t)} y={height - 8} textAnchor="middle" className="fill-[color:var(--text-muted)] text-[10px] tabular-nums">
            {formatX(t)}
          </text>
        ))}

        {series.map((s) => {
          const path = s.points
            .filter((p) => p.y !== null)
            .map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y as number).toFixed(1)}`)
            .join(' ');
          const last = [...s.points].reverse().find((p) => p.y !== null);
          return (
            <g key={s.label}>
              {area && (
                <path
                  d={`${path} L${sx(xMax)},${sy(yMin)} L${sx(xMin)},${sy(yMin)} Z`}
                  fill={s.color}
                  opacity={0.1}
                />
              )}
              <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {last && series.length <= 4 && (
                <text x={sx(last.x) + 6} y={sy(last.y as number) + 3} className="fill-[color:var(--text-secondary)] text-[10px] tabular-nums">
                  {formatY(last.y as number)}
                </text>
              )}
            </g>
          );
        })}

        {hovered !== null && (
          <g>
            <line x1={sx(hovered)} x2={sx(hovered)} y1={pad.top} y2={pad.top + plotH} stroke="var(--axis)" strokeWidth={1} />
            {series.map((s) => {
              const p = s.points.find((q) => q.x === hovered);
              if (!p || p.y === null) return null;
              return <circle key={s.label} cx={sx(hovered)} cy={sy(p.y)} r={4} fill={s.color} stroke="var(--surface-1)" strokeWidth={2} />;
            })}
          </g>
        )}
      </svg>

      {hovered !== null && (
        <Tooltip
          tip={{
            x: sx(hovered),
            y: pad.top + plotH / 2,
            content: (
              <div className="flex flex-col gap-1">
                <div className="font-semibold text-ink">{formatX(hovered)}</div>
                {series.map((s) => {
                  const p = s.points.find((q) => q.x === hovered);
                  return p && p.y !== null ? <TipRow key={s.label} color={s.color} label={s.label} value={formatY(p.y)} /> : null;
                })}
              </div>
            ),
          }}
          width={width}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- heatmap */

export function Heatmap({
  rows,
  columns,
  cells,
  format = (v: number) => v.toFixed(2),
  legendLabel,
}: {
  rows: string[];
  columns: string[];
  cells: { row: string; column: string; value: number | null; count?: number }[];
  format?: (v: number) => string;
  legendLabel?: string;
}) {
  const values = cells.map((c) => c.value).filter((v): v is number => v !== null);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Six steps of one hue. The dark theme redefines them light-on-dark, and each
  // step carries its own ink colour so text always clears the fill.
  const ramp = [1, 2, 3, 4, 5, 6].map((i) => ({ bg: `var(--heat-${i})`, ink: `var(--heat-${i}-ink)` }));
  const stepFor = (v: number | null) => {
    if (v === null) return null;
    const t = (v - min) / Math.max(1e-9, max - min);
    return ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))];
  };
  const lookup = new Map(cells.map((c) => [`${c.row}|${c.column}`, c]));

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-[2px] text-xs">
          <thead>
            <tr>
              <th />
              {columns.map((c) => (
                <th key={c} className="px-1 pb-1 text-center font-medium text-muted">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r}>
                <th className="whitespace-nowrap pr-2 text-right font-medium text-ink-2">{r}</th>
                {columns.map((c) => {
                  const cell = lookup.get(`${r}|${c}`);
                  const v = cell?.value ?? null;
                  const step = stepFor(v);
                  return (
                    <td
                      key={c}
                      className="h-10 min-w-[3.5rem] rounded-md text-center tabular-nums"
                      style={{ background: step?.bg ?? 'var(--surface-2)', color: step?.ink ?? 'var(--text-muted)' }}
                      title={cell?.count ? `${cell.count.toLocaleString()} wines` : undefined}
                    >
                      {v === null ? '·' : format(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted">
        <span>{format(min)}</span>
        <span className="flex h-2 flex-1 overflow-hidden rounded-full">
          {ramp.map((c) => (
            <span key={c.bg} className="flex-1" style={{ background: c.bg }} />
          ))}
        </span>
        <span>{format(max)}</span>
        {legendLabel && <span className="ml-2">{legendLabel}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ stacked bar */

export function StackedBar({
  segments,
  format = (v: number) => v.toLocaleString(),
}: {
  segments: { label: string; value: number; color: string }[];
  format?: (v: number) => string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-lg">
        {segments.map((s) => {
          const pct = (s.value / total) * 100;
          return (
            <div
              key={s.label}
              className="group relative flex items-center justify-center first:rounded-l-lg last:rounded-r-lg"
              style={{ width: `${pct}%`, background: s.color }}
              title={`${s.label}: ${format(s.value)} (${pct.toFixed(1)}%)`}
            >
              {pct > 12 && <span className="text-[10px] font-semibold text-black/75">{pct.toFixed(0)}%</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- stat tile */

export function StatTile({
  label,
  value,
  note,
  hero,
}: {
  label: string;
  value: string;
  note?: string;
  hero?: boolean;
}) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span className="label">{label}</span>
      <span className={hero ? 'text-4xl font-semibold leading-none text-ink sm:text-5xl' : 'text-2xl font-semibold leading-none text-ink'}>
        {value}
      </span>
      {note && <span className="text-xs text-ink-2">{note}</span>}
    </div>
  );
}

/** Five-star display for a 0–5 average. */
export function Stars({ value, size = 14 }: { value: number | null; size?: number }) {
  const v = value ?? 0;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={value === null ? 'unrated' : `${v.toFixed(2)} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, v - i));
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden>
            <defs>
              <linearGradient id={`star-${i}-${Math.round(fill * 100)}`}>
                <stop offset={`${fill * 100}%`} stopColor="var(--accent)" />
                <stop offset={`${fill * 100}%`} stopColor="var(--grid)" />
              </linearGradient>
            </defs>
            <path
              d="M10 1.6l2.5 5.3 5.6.8-4.1 4 1 5.7L10 14.7 4.9 17.4l1-5.7-4.1-4 5.6-.8z"
              fill={`url(#star-${i}-${Math.round(fill * 100)})`}
            />
          </svg>
        );
      })}
    </span>
  );
}

/** Lets a page dim its charts while a filter change is in flight. */
export function useDebounced<T>(value: T, ms = 250): T {
  const [state, setState] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setState(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return state;
}
