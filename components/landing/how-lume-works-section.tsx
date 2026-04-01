"use client";

import { useState, useEffect, useRef } from "react";

const userFeatures = [
  {
    number: "01",
    title: "Make the best decision",
    description: "Get fully prepared before stepping into the treatment room. Lluna gives you personalised insights, risk profiles, and clear expectations — so you walk in confident.",
  },
  {
    number: "02",
    title: "24/7 support from your clinic",
    description: "Questions at midnight? Reservations on a Sunday? Lluna answers instantly — Q&A, booking, follow-up care, around the clock.",
  },
  {
    number: "03",
    title: "Your lifelong aesthetic consultant",
    description: "Lluna remembers every treatment, wherever you are. A single intelligent partner that knows your history and grows with you over time.",
  },
];

const clinicFeatures = [
  {
    number: "01",
    title: "AI Sales Support",
    description: "Lluna generates a full pre-consult briefing before every session — surfacing each patient's spend history, treatment preferences, and upsell opportunities. Your consultants walk in prepared, not guessing.",
  },
  {
    number: "02",
    title: "Menu Intelligence",
    description: "While patients wait, Lluna's AI chatbot on their phone recommends treatment combos, answers questions, and surfaces active promotions — so they arrive at the consultation already interested in more.",
  },
  {
    number: "03",
    title: "Patient Lifecycle",
    description: "Lluna tracks every treatment, date, and outcome across each patient's journey. Even after they travel or pause, automated follow-ups and personalized recommendations bring them back to your clinic first.",
  },
];

export function HowLumeWorksSection() {
  const [activeTab, setActiveTab] = useState<"users" | "clinics">("users");
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

  const features = activeTab === "users" ? userFeatures : clinicFeatures;

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

          <div className="flex items-center gap-8">
            <button
              onClick={() => setActiveTab("users")}
              className={`text-[13px] pb-2 border-b transition-all duration-300 ${
                activeTab === "users"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              For Users
            </button>
            <button
              onClick={() => setActiveTab("clinics")}
              className={`text-[13px] pb-2 border-b transition-all duration-300 ${
                activeTab === "clinics"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              For Clinics
            </button>
          </div>
        </div>

        <div className="space-y-20">
          {features.map((feature, index) => (
            <div
              key={`${activeTab}-${feature.number}`}
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
