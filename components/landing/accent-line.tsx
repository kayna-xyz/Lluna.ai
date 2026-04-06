"use client";

import { useEffect, useRef, useState } from "react";

export function AccentLine() {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative z-[1] bg-[#F2EFE9] py-20"
      style={{ paddingTop: '80px', paddingBottom: '80px' }}
    >
      <p
        className={`text-center font-display italic text-[20px] text-[#B97070] max-w-[600px] mx-auto px-8 transition-all duration-[600ms] ${
          isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-5"
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        Not software. A revenue-generating member of your team.
      </p>
    </div>
  );
}
