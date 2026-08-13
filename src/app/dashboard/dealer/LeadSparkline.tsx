/**
 * Inline SVG bar chart. No charting library.
 *
 * A dependency here would cost 40–100 KB of JavaScript to draw thirty
 * rectangles, on a site with a 150 KB budget where most visitors are on a
 * mid-range Android over 4G. This is a server component and ships zero JS.
 */
export function LeadSparkline({
  data,
}: {
  data: { day: string; leads: number }[];
}) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.leads), 1);
  const width = 100;
  const height = 32;
  const gap = 0.6;
  const barWidth = Math.max(0.5, width / data.length - gap);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-24 w-full"
        role="img"
        aria-label={`Phone reveals per day. Peak ${max} on ${
          data.reduce((a, b) => (b.leads > a.leads ? b : a)).day
        }.`}
      >
        {data.map((d, i) => {
          const h = (d.leads / max) * (height - 2);
          return (
            <rect
              key={d.day}
              x={i * (barWidth + gap)}
              y={height - h}
              width={barWidth}
              height={h}
              rx={0.4}
              className="fill-emerald-600"
            >
              <title>{`${d.day}: ${d.leads} reveals`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span>{data[0].day}</span>
        <span>peak {max}</span>
        <span>{data[data.length - 1].day}</span>
      </div>
    </div>
  );
}
