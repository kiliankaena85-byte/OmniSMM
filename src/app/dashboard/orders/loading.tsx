export default function OrdersLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-40 bg-muted rounded-xl" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 border-b border-border last:border-0 bg-muted/30 mx-4 my-2 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
