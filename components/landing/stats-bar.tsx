"use client";

import { useEffect, useState, useRef } from "react";

const stats = [
  { value: "1.6x", label: "higher basket value per visit" },
  { value: "80%+", label: "of patients arrive consult-ready" },
  { value: "<1hr", label: "to go live — no IT required" },
  { value: "60%+", label: "revenue uplift reported by clinic partners" },
];

export function StatsBar() {
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
      className="relative z-[1] bg-[#F2EFE9]"
      style={{ paddingTop: '60px', paddingBottom: '60px' }}
    >
      <div className="max-w-[760px] mx-auto px-8 mb-16">
        <div className="h-[0.5px] bg-[#D9D5CE]" />
      </div>

      <div
        className={`max-w-[980px] mx-auto px-6 sm:px-8 transition-all duration-[600ms] ${
          isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-5"
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-10">
          YOUR REVENUE HACKER
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-y-10 gap-x-8 xl:gap-x-10">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`min-w-0 flex flex-col transition-all duration-[600ms] ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
              style={{
                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                transitionDelay: isVisible ? `${index * 80}ms` : "0ms",
              }}
            >
              <span className="text-[34px] sm:text-[38px] lg:text-[42px] xl:text-[44px] font-display font-normal text-[#B87879] leading-none tracking-[-0.02em] mb-2">
                {stat.value}
              </span>
              <span className="max-w-[16rem] text-[13px] leading-[1.55] text-muted-foreground">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
