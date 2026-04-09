"use client";

import { useEffect, useRef, useState } from "react";

const clinicFeatures = [
  {
    number: "01",
    title: "AI Pre-Consult Briefing",
    description: "Before every session, Lluna generates a briefing for your consultant — patient history, treatment gaps, upsell windows. Walk in prepared, not guessing.",
  },
  {
    number: "02",
    title: "Smart Menu Chatbot",
    description: "While patients wait, Lluna chats with them on their phone — recommending combos, answering questions, surfacing promotions. They arrive at the chair already interested in more.",
  },
  {
    number: "03",
    title: "Patient Lifecycle Tracking",
    description: "Lluna tracks every treatment and follow-up. Automated nudges bring patients back before they drift. You keep the relationship — Lluna does the work.",
  },
];

export function HowLumeWorksSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="relative z-[1] bg-[#F2EFE9]"
      style={{ paddingTop: '140px', paddingBottom: '140px' }}
    >
      <div
        className={`max-w-[760px] mx-auto px-8 transition-all duration-[600ms] ${
          isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-5"
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="mb-20">
          <span className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground block mb-6">
            How It Works
          </span>
          <h2 className="text-[48px] lg:text-[56px] font-display font-normal leading-[1.1] tracking-[-0.01em] mb-12">
            How Lluna Works
          </h2>
        </div>

        <div className="space-y-20">
          {clinicFeatures.map((feature, index) => (
            <div
              key={feature.number}
              className="relative"
              style={{
                transitionDelay: isVisible ? `${index * 150}ms` : "0ms",
              }}
            >
              <span
                className="absolute -top-8 -left-4 text-[96px] font-display text-[#EBEBE6] leading-none select-none pointer-events-none"
                style={{ zIndex: 0 }}
              >
                {feature.number}
              </span>

              <div className="relative" style={{ zIndex: 1 }}>
                <h3 className="text-[32px] font-display font-normal leading-[1.15] mb-4">
                  {feature.title}
                </h3>
                <p className="text-[15px] leading-[1.75] text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
