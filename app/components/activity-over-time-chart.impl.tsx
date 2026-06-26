import type { ChartOptions } from "chart.js";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { ActivityOverTimeChartProps } from "./activity-over-time-chart";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const ACCENT = "#3ee07a";
const REEL = "#38bdf8";
const SAVES = "#f472b6";

export function ActivityOverTimeChartImpl({
  labels,
  profileViews,
  reelPlays,
  saves,
}: ActivityOverTimeChartProps) {
  const savesScaled = saves.map((s) => s * 15);

  const data = {
    labels,
    datasets: [
      {
        label: "Profile views",
        data: profileViews,
        borderColor: ACCENT,
        backgroundColor: "rgba(62, 224, 122, 0.12)",
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: ACCENT,
        pointBorderColor: "#07120a",
        pointBorderWidth: 1,
        fill: false,
      },
      {
        label: "Reel plays",
        data: reelPlays,
        borderColor: REEL,
        backgroundColor: "rgba(56, 189, 248, 0.1)",
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: REEL,
        pointBorderColor: "#07120a",
        pointBorderWidth: 1,
        fill: false,
      },
      {
        label: "Saves",
        data: savesScaled,
        borderColor: SAVES,
        backgroundColor: "rgba(244, 114, 182, 0.1)",
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: SAVES,
        pointBorderColor: "#07120a",
        pointBorderWidth: 1,
        fill: false,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(7, 18, 10, 0.94)",
        titleColor: "rgba(244, 255, 247, 0.95)",
        bodyColor: "rgba(244, 255, 247, 0.85)",
        borderColor: "rgba(62, 224, 122, 0.25)",
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label(ctx) {
            const label = ctx.dataset.label ?? "";
            let raw = ctx.parsed.y;
            if (raw == null) return label;
            if (ctx.datasetIndex === 2) raw = Math.round(raw / 15);
            return ` ${label}: ${raw}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(255,255,255,0.06)" },
        ticks: {
          color: "rgba(255,255,255,0.4)",
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
          font: { size: 11 },
        },
        border: { color: "rgba(255,255,255,0.08)" },
      },
      y: {
        min: 0,
        max: 80,
        grid: { color: "rgba(255,255,255,0.06)" },
        ticks: {
          color: "rgba(255,255,255,0.4)",
          stepSize: 20,
          font: { size: 11 },
        },
        border: { color: "rgba(255,255,255,0.08)" },
      },
    },
  };

  return (
    <div className="h-[260px] w-full min-w-0">
      <Line data={data} options={options} />
    </div>
  );
}
