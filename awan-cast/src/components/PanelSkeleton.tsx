interface Props {
  height?: number;
}

export function PanelSkeleton({ height = 180 }: Props) {
  return (
    <div className="panel p-5">
      <div className="skeleton h-3 w-24" />
      <div className="mt-3 skeleton h-12 w-40" />
      <div className="mt-5 skeleton w-full" style={{ height }} />
    </div>
  );
}
