"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { GradientCanvas } from "./gradient-canvas";
import { getBrowserSupabase } from "@/lib/supabase/browser-client";

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [heroOpacity, setHeroOpacity] = useState(1);
  const rafRef = useRef<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    setIsVisible(true);

    const handleScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        const opacity = Math.max(0, 1 - window.scrollY / 200);
        setHeroOpacity(opacity);
        rafRef.current = null;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleEnterprise = () => {
    router.push("/clinicside/auth");
  };

  return (
    <section
      className="sticky top-0 h-screen z-0"
      style={{
        opacity: heroOpacity,
        willChange: "opacity",
      }}
    >
      <div className="flex h-full">
        {/* Left side — Content */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 lg:px-16 xl:px-24 py-32">
          <div className="max-w-[540px]">
            {/* Eyebrow */}
            <div
              className={`mb-10 transition-opacity duration-700 ${
                isVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <span className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground">
                For aesthetic clinics
              </span>
            </div>

            {/* Headline */}
            <h1
              className={`text-[64px] lg:text-[80px] font-display font-normal leading-[1.05] tracking-[-0.01em] mb-10 transition-opacity duration-1000 ${
                isVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              Aesthetics,<br />
              meet<br />
              intelligence.
            </h1>

            {/* Description */}
            <p
              className={`text-[15px] leading-[1.75] text-muted-foreground max-w-md mb-12 transition-opacity duration-700 delay-200 ${
                isVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              Your aesthetic consultant works 24/7. Lluna is the AI layer between great clinics and the patients who trust them.
            </p>

            {/* CTAs */}
            <div
              className={`flex items-center gap-4 flex-nowrap transition-opacity duration-700 delay-300 ${
                isVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <button
                onClick={handleEnterprise}
                className="bg-foreground text-background px-6 sm:px-8 h-12 text-[14px] sm:text-[15px] hover:bg-gold transition-colors duration-300 whitespace-nowrap"
              >
                Enterprise sign in
              </button>
            </div>
          </div>
        </div>

        {/* Right side — Gradient Canvas */}
        <div className="hidden lg:block w-1/2 h-full">
          <GradientCanvas />
        </div>
      </div>
    </section>
  );
}
