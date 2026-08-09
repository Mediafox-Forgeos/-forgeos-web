/**
 * Kylum Console (WO-ARGOS-031) — a dependency-free trend visualization for
 * /analytics. No charting library exists in this workspace today, and
 * design principles call for exactly a couple of simple trends here, not a
 * chart per widget everywhere (docs/product/KYLUM_CONSOLE_DESIGN_PRINCIPLES.md) —
 * plain proportional bars are enough, and adding a new dependency for two
 * bar charts would be the wrong trade.
 */
const MAX_BAR_HEIGHT_PX = 96;

export function SimpleBarTrend({
  points,
}: {
  points: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...points.map((p) => p.value));

  return (
    <div
      className="flex items-end gap-1.5"
      style={{ height: MAX_BAR_HEIGHT_PX + 20 }}
    >
      {points.map((point) => (
        <div
          key={point.label}
          className="flex flex-1 flex-col items-center justify-end gap-1.5"
        >
          <div
            className="bg-movos-blue w-full rounded-t-sm"
            style={{
              height: Math.max(
                2,
                Math.round((point.value / max) * MAX_BAR_HEIGHT_PX),
              ),
            }}
            title={`${point.label}: ${point.value}`}
          />
          <span className="text-muted-foreground text-[10px]">
            {point.label}
          </span>
        </div>
      ))}
    </div>
  );
}
