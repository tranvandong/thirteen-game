import { useEffect, useMemo, useState } from "react";
import { useSessionStore } from "~/stores/useSessionStore";

const opacity = 0.18;

export function Background() {
  const { config } = useSessionStore();

  const bgs = useMemo(
    () => [
      "bg",
      "bg1",
      "bg2",
      "bg3",
      "bg4",
      "bg5",
      "bg6",
      "bg7",
      "bg8",
      "bg9",
      "bg10",
      "bg11",
      "bg12",
      "bg13",
      "bg14",
      "bg15",
      "bg16",
      "bg17",
      "bg18",
      "bg19",
      "bg20",
    ],
    [],
  );

  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % bgs.length);
      setVisible((prev) => (prev === 0 ? 1 : 0));
    }, 30000);

    return () => clearInterval(interval);
  }, [bgs.length]);

  return config?.showBackground ? (
    <>
      <div
        className="fixed inset-0 transition-opacity duration-2000"
        style={{
          background: `url('/images/${bgs[visible === 0 ? current : (current + bgs.length - 1) % bgs.length]}.jpg') center/cover no-repeat`,
          opacity: visible === 0 ? opacity : 0,
          zIndex: 1,
        }}
      />

      <div
        className="fixed inset-0 transition-opacity duration-2000"
        style={{
          background: `url('/images/${bgs[visible === 1 ? current : (current + bgs.length - 1) % bgs.length]}.jpg') center/cover no-repeat`,
          opacity: visible === 1 ? opacity : 0,
          zIndex: 1,
        }}
      />
    </>
  ) : null;
}
