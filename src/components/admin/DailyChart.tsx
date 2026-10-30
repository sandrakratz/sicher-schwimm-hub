type Point = { day: string; views: number; visitors: number };

const W = 640;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 36 };

const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;

/** Kleines Liniendiagramm (Aufrufe und Besucher je Tag) ohne Zusatzbibliothek. */
export function DailyChart({ data }: { data: Point[] }) {
  const max = Math.max(1, ...data.map((d) => d.views));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const line = (key: "views" | "visitors") =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`)
      .join(" ");
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-64 w-full"
        role="img"
        aria-label="Seitenaufrufe und Besucher pro Tag"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(t) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              {t}
            </text>
          </g>
        ))}
        <path d={line("views")} fill="none" className="stroke-primary" strokeWidth={2} />
        <path d={line("visitors")} fill="none" className="stroke-accent" strokeWidth={2} />
        {data.map((d, i) => (
          <g key={d.day}>
            <circle cx={x(i)} cy={y(d.views)} r={3} className="fill-primary" />
            <circle cx={x(i)} cy={y(d.visitors)} r={3} className="fill-accent" />
          </g>
        ))}
        {data.map((d, i) => (
          <circle key={`hit-${d.day}`} cx={x(i)} cy={y(d.views)} r={8} fill="transparent">
            <title>{`${dm(d.day)}: ${d.views} Aufrufe, ${d.visitors} Besucher`}</title>
          </circle>
        ))}
        {data.length > 0 && (
          <>
            <text x={PAD.left} y={H - 8} className="fill-muted-foreground text-[11px]">
              {dm(data[0]!.day)}
            </text>
            <text
              x={W - PAD.right}
              y={H - 8}
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              {dm(data[data.length - 1]!.day)}
            </text>
          </>
        )}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-primary" /> Seitenaufrufe
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-accent" /> Besucher
        </span>
      </div>
    </div>
  );
}
