"use client";

import { useRef, useEffect, useCallback } from "react";

interface CustomCursorProps {
  isVisible: boolean;
  isOpen: boolean;
}

export default function CustomCursor({ isVisible, isOpen }: CustomCursorProps) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);
  const cursorX = useRef(0);
  const cursorY = useRef(0);
  const targetX = useRef(0);
  const targetY = useRef(0);

  const updateCursor = useCallback(() => {
    cursorX.current += (targetX.current - cursorX.current) * 0.15;
    cursorY.current += (targetY.current - cursorY.current) * 0.15;
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${cursorX.current}px, ${cursorY.current}px, 0)`;
    }
    rafId.current = requestAnimationFrame(updateCursor);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!cursorRef.current) return;
      const bounds = cursorRef.current.getBoundingClientRect();
      targetX.current = e.clientX - (bounds.width * 3) / 4;
      targetY.current = e.clientY - (bounds.height * 3) / 4;
      if (!rafId.current) {
        rafId.current = requestAnimationFrame(updateCursor);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    rafId.current = requestAnimationFrame(updateCursor);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [updateCursor]);

  return (
    <div
      ref={cursorRef}
      className={`gallery-cursor${isVisible ? " is-visible" : ""}${isOpen ? " is-open" : ""}`}
      data-cursor="container"
    >
      <div className="cross_button" />
    </div>
  );
}
