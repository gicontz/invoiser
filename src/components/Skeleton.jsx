export default function Skeleton({ rows = 4 }) {
  return (
    <div className="list-card skeleton-row">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-bar" style={{ width: `${90 - i * 8}%` }} />
      ))}
    </div>
  )
}
