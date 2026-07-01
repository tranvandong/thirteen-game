import { useEffect, useMemo, useRef, useState } from "react";

export function Background() {
  const ref = useRef<HTMLDivElement>(null);
  const bgs = useMemo(() => ["bg-layout", "bg-layout-1"], []);
  const [bg, setBg] = useState(bgs[0]);
  let i = 0;

  useEffect(() => {
    const interval = setInterval(() => {
      setBg(bgs[(i + 1) % bgs.length]);
      i++;
    }, 10000);
    return () => clearInterval(interval);
  }, [bgs]);

  return (
    <div
      className="bg-fixed"
      style={{
        background: `url('/images/${bg}.jpg') center center / cover no-repeat`,
      }}
    />
  );
}
