"use client";

import { useEffect, useRef, useState } from "react";

const posts = [
  {
    tag: "REVENUE",
    title: "How Frost Aesthetics increased basket value by 60% in 30 days",
    description:
      "A breakdown of how one NYC medspa used Lluna's pre-consult briefings to lift per-visit revenue from day one.",
  },
  {
    tag: "PRODUCT",
    title: "Why your treatment menu is losing you money",
    description:
      "Most clinic menus are built for operations, not sales. Here's what Lluna's menu intelligence actually changes.",
  },
  {
    tag: "GROWTH",
    title: "The $500 upsell your consultants are missing every session",
    description:
      "Treatment synergies are the highest-margin opportunity in aesthetics. Here's why they go unspoken — and how to fix it.",
  },
];

export function BlogSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="blog"
      className="relative z-[1] bg-[#F2EFE9]"
      style={{ paddingTop: "140px", paddingBottom: "140px" }}
    >
      <div className="max-w-[960px] mx-auto px-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[960px] px-8">
          <div className="h-px bg-[#D9D5CE]" />
        </div>
      </div>

      <div
        className={`max-w-[960px] mx-auto px-8 transition-all duration-[600ms] ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        <div className="mb-16">
          <span className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground block mb-6">
            Blog
          </span>
          <h2 className="text-[48px] lg:text-[56px] font-display font-normal leading-[1.1] tracking-[-0.01em]">
            From the clinic floor.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {posts.map((post, index) => (
            <div
              key={post.tag + index}
              className="p-8 border border-[#D9D5CE] bg-transparent flex flex-col"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 600ms cubic-bezier(0.16, 1, 0.3, 1), transform 600ms cubic-bezier(0.16, 1, 0.3, 1)",
                transitionDelay: isVisible ? `${index * 100}ms` : "0ms",
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <span className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground">
                  {post.tag}
                </span>
                <span className="text-[11px] tracking-[0.08em] uppercase text-muted-foreground border border-[#D9D5CE] px-2.5 py-1">
                  Coming soon
                </span>
              </div>

              <h3 className="text-[20px] font-display font-normal leading-[1.25] mb-4 flex-1">
                {post.title}
              </h3>

              <p className="text-[14px] leading-[1.65] text-muted-foreground">
                {post.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
