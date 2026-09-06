export default function AnalyticsPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          ['Total spend', 'P845k'],
          ['RFQ turnaround', '6.2 days'],
          ['On-time delivery', '96%'],
        ].map(([title, value]) => (
          <div key={title} className="card p-5">
            <p className="text-sm text-slate-500">{title}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
