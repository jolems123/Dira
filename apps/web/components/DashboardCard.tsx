type DashboardCardProps = {
  title: string;
  value: string;
  detail: string;
  accent?: 'navy' | 'green' | 'amber' | 'red';
};

const accentMap = {
  navy: 'bg-slate-900 text-white',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
};

export function DashboardCard({ title, value, detail, accent = 'navy' }: DashboardCardProps) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <span className={`badge ${accentMap[accent]}`}>{detail}</span>
      </div>
      <p className="text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
