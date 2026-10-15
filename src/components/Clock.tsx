"use client";

import { useEffect, useState } from "react";
import { clock } from "@/lib/time";

/** A live local clock. Renders "--:--" on the server to avoid hydration drift. */
export function Clock({ tz, seconds = false }: { tz: string; seconds?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const id = setInterval(update, seconds ? 1000 : 10_000);
    return () => clearInterval(id);
  }, [seconds]);

  return (
    <time suppressHydrationWarning dateTime={now?.toISOString()}>
      {now ? clock(tz, now, seconds) : seconds ? "--:--:--" : "--:--"}
    </time>
  );
}
