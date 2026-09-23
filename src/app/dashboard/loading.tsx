export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI grid skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-muted rounded-2xl" />
        ))}
      </div>
      {/* Quick actions */}
      <div className="h-24 bg-muted rounded-2xl" />
      {/* Recent orders */}
      <div className="bg-muted rounded-2xl h-48" />
    </div>
  );
}
