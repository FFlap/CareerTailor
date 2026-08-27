import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ActivityWeek = {
  label: string;
  jobs: number;
  documents: number;
};

export default function ActivityChart({ data }: { data: ActivityWeek[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 4, right: 4, bottom: 0, left: -26 }}
        barCategoryGap="26%"
        barGap={2}
      >
        <CartesianGrid
          vertical={false}
          stroke="currentColor"
          className="text-slate-200 dark:text-slate-800"
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "currentColor" }}
          className="text-slate-400"
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={40}
          tick={{ fontSize: 11, fill: "currentColor" }}
          className="text-slate-400"
        />
        <Tooltip
          cursor={{ fill: "currentColor", opacity: 0.05 }}
          content={<WeekTooltip />}
        />
        <Bar
          dataKey="jobs"
          name="Jobs tracked"
          fill="currentColor"
          fillOpacity={0.75}
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="documents"
          name="Documents written"
          fill="currentColor"
          fillOpacity={0.22}
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function WeekTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-1.5 font-medium text-slate-900 dark:text-slate-100">
        Week of {label}
      </div>
      <ul className="space-y-0.5">
        {payload.map((entry: any) => (
          <li
            key={entry.dataKey}
            className="flex items-center justify-between gap-6 text-slate-500 dark:text-slate-400"
          >
            <span>{entry.name}</span>
            <span className="tabular-nums text-slate-900 dark:text-slate-100">
              {entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
