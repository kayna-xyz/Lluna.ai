"use client";

import { useEffect, useRef, useState } from "react";

export function ProblemSection() {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative z-[1] bg-[#F2EFE9]"
      style={{ paddingTop: "80px", paddingBottom: "100px" }}
    >
      <div className="max-w-[760px] mx-auto px-8">
        <div className="h-px bg-[#D9D5CE] mb-16" />
      </div>

      <div
        className={`max-w-[760px] mx-auto px-8 transition-all duration-[600ms] ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        <h2 className="text-[40px] lg:text-[52px] font-display font-normal leading-[1.1] tracking-[-0.01em] mb-8">
          You&apos;re losing revenue before the consultation even starts.
        </h2>

        <p className="text-[15px] leading-[1.8] text-muted-foreground max-w-[520px]">
          Every consultant has a different level of experience. But with Lluna — trained on senior aesthetic consultant logic and optimized for treatment synergies — every member of your team performs at the same level. No missed combinations. No lost $500+ upsell windows. Patients get better recommendations. Consultants close more. Everyone wins.
        </p>
      </div>
    </div>
  );
}
