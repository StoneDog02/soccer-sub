import { useEffect, useState } from "react";
import type { FC } from "react";

export type ActivityOverTimeChartProps = {
  labels: string[];
  profileViews: number[];
  reelPlays: number[];
  saves: number[];
};

/**
 * Chart.js only runs in the browser — load the implementation after mount so SSR
 * never evaluates `chart.js` / canvas.
 */
export function ActivityOverTimeChart(props: ActivityOverTimeChartProps) {
  const [Impl, setImpl] = useState<FC<ActivityOverTimeChartProps> | null>(null);

  useEffect(() => {
    void import("./activity-over-time-chart.impl").then((m) => {
      setImpl(() => m.ActivityOverTimeChartImpl);
    });
  }, []);

  if (!Impl) {
    return (
      <div
        className="h-[260px] w-full animate-pulse rounded-xl bg-white/[0.04]"
        aria-hidden
      />
    );
  }

  return <Impl {...props} />;
}
