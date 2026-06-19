"use client";

import { useEffect, useState } from "react";

// True quando a viewport é mobile (abaixo do breakpoint lg do Tailwind).
export function useIsMobile(query = "(max-width: 1023px)") {
  const [is, setIs] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setIs(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return is;
}
