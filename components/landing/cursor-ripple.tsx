"use client";

import { useEffect, useRef } from "react";

interface Ripple {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  startTime: number;
}

export function CursorRipple() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const handleMouseMove = (e: MouseEvent) => {
      ripplesRef.current.push({
        x: e.clientX,
        y: e.clientY,
        radius: 0,
        opacity: 0.4,
        startTime: performance.now(),
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

    const animate = (currentTime: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const duration = 600;
      const maxRadius = 80;

      ripplesRef.current = ripplesRef.current.filter((ripple) => {
        const elapsed = currentTime - ripple.startTime;
        const progress = Math.min(elapsed / duration, 1);

        if (progress >= 1) return false;

        ripple.radius = progress * maxRadius;
        ripple.opacity = 0.4 * (1 - progress);

        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(180, 150, 160, ${ripple.opacity})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        return true;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9999] pointer-events-none"
      style={{ willChange: "transform" }}
    />
  );
}
