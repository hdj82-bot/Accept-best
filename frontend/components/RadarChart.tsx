"use client";

interface RadarChartProps {
  items: { label: string; score: number }[];
  maxScore?: number;
  size?: number;
}

export default function RadarChart({
  items,
  maxScore = 10,
  size = 300,
}: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40;
  const levels = 5;
  const n = items.length;
  const angleStep = (2 * Math.PI) / n;

  function polarToXY(angle: number, r: number) {
    return {
      x: cx + r * Math.sin(angle),
      y: cy - r * Math.cos(angle),
    };
  }

  // Grid rings
  const rings = Array.from({ length: levels }, (_, i) => {
    const r = (radius / levels) * (i + 1);
    const points = Array.from({ length: n }, (_, j) => {
      const p = polarToXY(j * angleStep, r);
      return `${p.x},${p.y}`;
    }).join(" ");
    return points;
  });

  // Axis lines
  const axes = Array.from({ length: n }, (_, i) => {
    const p = polarToXY(i * angleStep, radius);
    return { x1: cx, y1: cy, x2: p.x, y2: p.y };
  });

  // Data polygon
  const dataPoints = items.map((item, i) => {
    const r = (item.score / maxScore) * radius;
    return polarToXY(i * angleStep, r);
  });
  const dataPath = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Labels
  const labels = items.map((item, i) => {
    const labelRadius = radius + 24;
    const p = polarToXY(i * angleStep, labelRadius);
    let anchor: "middle" | "start" | "end" = "middle";
    if (p.x < cx - 10) anchor = "end";
    else if (p.x > cx + 10) anchor = "start";
    return { ...p, label: item.label, score: item.score, anchor };
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto w-full max-w-xs"
      role="img"
      aria-label="논문 진단 레이더 차트"
    >
      {/* Grid rings */}
      {rings.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke="currentColor"
          className="text-zinc-200 dark:text-zinc-700"
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {axes.map((a, i) => (
        <line
          key={i}
          x1={a.x1}
          y1={a.y1}
          x2={a.x2}
          y2={a.y2}
          stroke="currentColor"
          className="text-zinc-200 dark:text-zinc-700"
          strokeWidth={1}
        />
      ))}

      {/* Data polygon */}
      <polygon
        points={dataPath}
        fill="currentColor"
        className="text-blue-500/20 dark:text-blue-400/20"
      />
      <polygon
        points={dataPath}
        fill="none"
        stroke="currentColor"
        className="text-blue-500 dark:text-blue-400"
        strokeWidth={2}
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3}
          fill="currentColor"
          className="text-blue-600 dark:text-blue-400"
        />
      ))}

      {/* Labels */}
      {labels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          textAnchor={l.anchor}
          dominantBaseline="central"
          className="fill-zinc-600 text-[9px] font-medium dark:fill-zinc-400"
        >
          {l.label}
        </text>
      ))}
    </svg>
  );
}
