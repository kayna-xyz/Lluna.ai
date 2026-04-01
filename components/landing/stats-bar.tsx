"use client";

import { useEffect, useState, useRef } from "react";

const stats = [
  { value: "20%+", label: "overall revenue boost from day one" },
  { value: "$70→$20", label: "patient acquisition cost via referrals" },
  { value: "10–20%", label: "higher basket value per visit" },
  { value: "80%+", label: "reduction in consultation time but 2x more efficient" },
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
        className={`max-w-[760px] mx-auto px-8 transition-all duration-[600ms] ${
          isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-5"
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-10">
          YOUR REVENUE HACKER
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-12">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`flex flex-col transition-all duration-[600ms] ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
              style={{
                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                transitionDelay: isVisible ? `${index * 80}ms` : "0ms",
              }}
            >
              <span className="text-[36px] lg:text-[44px] font-display font-normal text-[#B87879] leading-none mb-2">
                {stat.value}
              </span>
              <span className="text-[13px] leading-[1.5] text-muted-foreground">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
