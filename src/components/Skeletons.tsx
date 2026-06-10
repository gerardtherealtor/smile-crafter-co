import { Skeleton } from "@/components/ui/skeleton";

/** Repeating skeleton rows shaped like a time-entry list item. */
export const EntryRowSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <ul className="divide-y divide-border">
    {Array.from({ length: rows }).map((_, i) => (
      <li key={i} className="py-3 flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-6 w-12" />
      </li>
    ))}
  </ul>
);

/** Skeleton table rows for admin tables. */
export const TableRowSkeleton = ({ cols, rows = 4 }: { cols: number; rows?: number }) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r} className="border-b border-border">
        {Array.from({ length: cols }).map((__, c) => (
          <td key={c} className="p-3">
            <Skeleton className="h-4 w-full max-w-[180px]" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

/** Generic stacked content skeleton for card-style sections. */
export const StackedSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="space-y-2 rounded-md border border-border bg-card/40 p-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    ))}
  </div>
);
