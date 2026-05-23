export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="skeleton h-4 w-40 rounded-lg" />
      </div>
      <div className="glass-card p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="skeleton h-8 w-48 rounded-lg" />
            <div className="skeleton h-3 w-32 rounded-lg" />
          </div>
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[var(--bg-secondary)] rounded-xl p-4 space-y-2">
              <div className="skeleton h-2.5 w-16 rounded-lg" />
              <div className="skeleton h-4 w-28 rounded-lg" />
            </div>
          ))}
        </div>

        {/* Countdown placeholder */}
        <div className="flex justify-center py-4">
          <div className="skeleton h-36 w-36 rounded-full" />
        </div>

        {/* Buttons */}
        <div className="flex gap-4 justify-center">
          <div className="skeleton h-12 w-44 rounded-xl" />
          <div className="skeleton h-12 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
