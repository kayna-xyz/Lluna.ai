"use client";

import { useEffect, useRef, useState } from "react";

const clinicFeatures = [
  {
    number: "01",
    label: "IN-CLINIC EXPERIENCE",
    title: "2x deeper patient engagement, before they sit down.",
    description: "Patients scan a QR code and land on your white-labeled treatment menu — with active promotions, treatment details, and clinic info. First impressions that convert.",
  },
  {
    number: "02",
    label: "PATIENT RECOMMENDATION",
    title: "1.6x higher basket value, per visit.",
    description: "A senior-consultant-trained algorithm walks each patient through a personalised treatment recommendation flow. They arrive at the chair knowing what they want — and ready to commit.",
  },
  {
    number: "03",
    label: "CONSULTANT PANEL",
    title: "30 minutes to 5. Less consultation time, but close more.",
    description: "Every consultant — junior, senior, or just the doctor on shift — sees the same high-quality briefing: full patient context, treatment combinations, and upsell opportunities. No experience gaps. No revenue left on the table.",
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
                <span className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground block mb-4">
                  {feature.label}
                </span>
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
