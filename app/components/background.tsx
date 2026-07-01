import { useEffect, useMemo, useRef, useState } from "react";
import { useSessionStore } from "~/stores/useSessionStore";

export function Background() {
  const { config } = useSessionStore();
  const bgs = useMemo(() => ["bg", "bg1", "bg2", "bg3", "bg4"], []);
  const [bg, setBg] = useState(bgs[0]);
  let i = 0;

  useEffect(() => {
    const interval = setInterval(() => {
      setBg(bgs[(i + 1) % bgs.length]);
      i++;
    }, 30000);
    return () => clearInterval(interval);
  }, [bgs]);

  return config?.showBackground ? (
    <div
      className="bg-fixed"
      style={{
        background: `url('/images/${bg}.jpg') center center / cover no-repeat`,
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 1,
        opacity: 0.13,
        paddingTop: "220px",
      }}
    />
  ) : null;
}
