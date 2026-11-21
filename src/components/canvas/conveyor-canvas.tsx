"use client";

import React, { useEffect, useRef } from "react";
import { SongSchema, TimelineEvent } from "@/songs/song-schema";
import { GUITAR_STRINGS } from "@/audio/types";

interface ConveyorCanvasProps {
  song: SongSchema;
  getCurrentTime: () => number;
  speed: number;
  isPaused: boolean;
  isWaitModeActive: boolean;
  activeWaitEvent: TimelineEvent | null;
  lastHitFeedback: "perfect" | "good" | "miss" | null;
  feedbackTimestamp: number;
}

// Zero-GC Particle Pool
const MAX_PARTICLES = 30;
class ParticlePool {
  public active: boolean[] = new Array(MAX_PARTICLES).fill(false);
  public x: Float32Array = new Float32Array(MAX_PARTICLES);
  public y: Float32Array = new Float32Array(MAX_PARTICLES);
  public vx: Float32Array = new Float32Array(MAX_PARTICLES);
  public vy: Float32Array = new Float32Array(MAX_PARTICLES);
  public alpha: Float32Array = new Float32Array(MAX_PARTICLES);
  public size: Float32Array = new Float32Array(MAX_PARTICLES);
  public color: string[] = new Array(MAX_PARTICLES).fill("#22C55E");

  public spawn(originX: number, originY: number, count: number = 20, color: string = "#22C55E") {
    let spawned = 0;
    for (let i = 0; i < MAX_PARTICLES && spawned < count; i++) {
      if (!this.active[i]) {
        this.active[i] = true;
        this.x[i] = originX;
        this.y[i] = originY;
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        this.vx[i] = Math.cos(angle) * speed;
        this.vy[i] = Math.sin(angle) * speed;
        this.alpha[i] = 1.0;
        this.size[i] = 3 + Math.random() * 3;
        this.color[i] = color;
        spawned++;
      }
    }
  }

  public updateAndDraw(ctx: CanvasRenderingContext2D) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.active[i]) {
        this.x[i] += this.vx[i];
        this.y[i] += this.vy[i];
        this.alpha[i] -= 0.04;

        if (this.alpha[i] <= 0) {
          this.active[i] = false;
        } else {
          ctx.save();
          ctx.globalAlpha = Math.max(0, this.alpha[i]);
          ctx.fillStyle = this.color[i];
          ctx.beginPath();
          ctx.arc(this.x[i], this.y[i], this.size[i], 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }
}

export function ConveyorCanvas({
  song,
  getCurrentTime,
  speed,
  isPaused,
  isWaitModeActive,
  activeWaitEvent,
  lastHitFeedback,
  feedbackTimestamp,
}: ConveyorCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlePoolRef = useRef<ParticlePool>(new ParticlePool());
  const lastProcessedFeedbackTimeRef = useRef<number>(0);

  // Trigger particles on new hit feedback
  useEffect(() => {
    if (feedbackTimestamp > lastProcessedFeedbackTimeRef.current) {
      lastProcessedFeedbackTimeRef.current = feedbackTimestamp;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const hitX = canvas.width * 0.15;
      const centerY = canvas.height / 2;

      if (lastHitFeedback === "perfect") {
        particlePoolRef.current.spawn(hitX, centerY, 20, "#22C55E");
      } else if (lastHitFeedback === "good") {
        particlePoolRef.current.spawn(hitX, centerY, 10, "#F59E0B");
      }
    }
  }, [feedbackTimestamp, lastHitFeedback]);

  // Main 60 FPS Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let rafId: number;
    let isRunning = true;

    // Handle high DPI and auto-resize
    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(container);
    resizeCanvas();

    const particles = particlePoolRef.current;

    const render = () => {
      if (!isRunning) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      // 1. Clear background
      ctx.fillStyle = "#0F172A"; // Slate 900
      ctx.fillRect(0, 0, width, height);

      // Layout coordinates
      const hitZoneBaseX = width * 0.15;
      const trackPaddingTop = 40;
      const trackHeight = height - trackPaddingTop - 35;
      const stringSpacing = trackHeight / 5; // 6 strings = 5 spaces

      // Guitar tablature standard: string 1 (E4, high) at top, string 6 (E2, low) at bottom
      const getStringY = (stringNumber: number) => {
        // stringNumber: 1 (E4) -> index 0 (top), 6 (E2) -> index 5 (bottom)
        const idx = stringNumber - 1;
        return trackPaddingTop + idx * stringSpacing;
      };

      // Shake animation on Miss
      let hitZoneX = hitZoneBaseX;
      const now = performance.now();
      if (
        lastHitFeedback === "miss" &&
        now - lastProcessedFeedbackTimeRef.current < 200
      ) {
        const shakePhase = (now - lastProcessedFeedbackTimeRef.current) / 50;
        hitZoneX += Math.sin(shakePhase * Math.PI * 4) * 6;
      }

      // 2. Draw 6 Horizontal Strings
      for (let s = 1; s <= 6; s++) {
        const y = getStringY(s);
        const strSpec = GUITAR_STRINGS.find((gs) => gs.stringNumber === s);
        const color = strSpec ? strSpec.color : "#64748B";

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.lineWidth = 2.5 - (s - 1) * 0.25; // thicker bass strings
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.65;
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // String Name Label on Left Margin
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.fillStyle = color;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(strSpec ? strSpec.name : `C${s}`, hitZoneBaseX - 18, y);
      }

      // 3. Draw Timeline Events (Chords and Notes)
      const currentTime = getCurrentTime();
      // Speed factor: at 100% speed, pixelsPerSecond = (bpm / 60) * 120
      const pixelsPerSecond = ((song.bpm * speed) / 60) * 140;

      for (let i = 0; i < song.timeline.length; i++) {
        const ev = song.timeline[i];
        const eventX = hitZoneX + (ev.timeSec - currentTime) * pixelsPerSecond;
        const eventWidth = ev.durationSec * pixelsPerSecond;

        // Skip events completely out of screen bounds
        if (eventX + eventWidth < -50 || eventX > width + 100) {
          continue;
        }

        const isWaitHighlighted =
          isWaitModeActive && activeWaitEvent && activeWaitEvent.id === ev.id;

        if (ev.type === "chord" && ev.chordId) {
          // Draw Chord Block
          const chordDef = song.chordsUsed[ev.chordId];
          const topY = getStringY(1) - 14;
          const bottomY = getStringY(6) + 14;
          const blockHeight = bottomY - topY;
          const blockWidth = Math.max(70, eventWidth - 6);

          ctx.save();

          // Wait Mode Pulsing Aura
          if (isWaitHighlighted) {
            ctx.shadowColor = "#38BDF8";
            ctx.shadowBlur = 16;
            ctx.strokeStyle = "#38BDF8";
            ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
          } else {
            ctx.fillStyle = "rgba(30, 41, 59, 0.85)";
            ctx.strokeStyle = "#475569";
          }

          ctx.lineWidth = isWaitHighlighted ? 3 : 1.5;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(eventX, topY, blockWidth, blockHeight, 12);
          } else {
            ctx.rect(eventX, topY, blockWidth, blockHeight);
          }
          ctx.fill();
          ctx.stroke();

          // Chord Name
          ctx.font = "bold 18px system-ui, sans-serif";
          ctx.fillStyle = isWaitHighlighted ? "#38BDF8" : "#F8FAFC";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "rgba(0,0,0,0.8)";
          ctx.shadowBlur = 4;
          ctx.fillText(
            chordDef?.displayName || ev.chordId,
            eventX + blockWidth / 2,
            topY + 22
          );

          // Strum arrow at bottom
          ctx.font = "12px system-ui, sans-serif";
          ctx.fillStyle = "#94A3B8";
          ctx.fillText("↓ batida", eventX + blockWidth / 2, bottomY - 14);

          // Lyrics label if present
          if (ev.lyrics) {
            ctx.font = "italic 11px system-ui, sans-serif";
            ctx.fillStyle = "#E2E8F0";
            ctx.fillText(ev.lyrics, eventX + blockWidth / 2, bottomY + 18);
          }

          ctx.restore();
        } else if (ev.type === "single-note" && ev.notes) {
          // Draw Individual Note Tokens
          for (const note of ev.notes) {
            const noteY = getStringY(note.string);
            const strSpec = GUITAR_STRINGS.find(
              (gs) => gs.stringNumber === note.string
            );
            const tokenColor = strSpec ? strSpec.color : "#10B981";

            ctx.save();
            ctx.beginPath();
            ctx.arc(eventX, noteY, 14, 0, Math.PI * 2);

            if (isWaitHighlighted) {
              ctx.shadowColor = "#38BDF8";
              ctx.shadowBlur = 14;
              ctx.fillStyle = "#38BDF8";
            } else {
              ctx.fillStyle = tokenColor;
            }
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#FFFFFF";
            ctx.stroke();

            // Fret Number (0 = Open String)
            ctx.font = "bold 12px system-ui, sans-serif";
            ctx.fillStyle = "#FFFFFF";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(note.fret.toString(), eventX, noteY);
            ctx.restore();
          }
        }
      }

      // 4. Draw Hit Zone (Execution Line)
      ctx.save();
      const hitGrad = ctx.createLinearGradient(
        hitZoneX,
        trackPaddingTop - 20,
        hitZoneX,
        trackPaddingTop + trackHeight + 20
      );

      if (
        lastHitFeedback === "perfect" &&
        now - lastProcessedFeedbackTimeRef.current < 250
      ) {
        hitGrad.addColorStop(0, "rgba(34, 197, 94, 0)");
        hitGrad.addColorStop(0.5, "#22C55E");
        hitGrad.addColorStop(1, "rgba(34, 197, 94, 0)");
        ctx.shadowColor = "#22C55E";
        ctx.shadowBlur = 20;
      } else if (
        lastHitFeedback === "good" &&
        now - lastProcessedFeedbackTimeRef.current < 250
      ) {
        hitGrad.addColorStop(0, "rgba(245, 158, 11, 0)");
        hitGrad.addColorStop(0.5, "#F59E0B");
        hitGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
        ctx.shadowColor = "#F59E0B";
        ctx.shadowBlur = 14;
      } else if (
        lastHitFeedback === "miss" &&
        now - lastProcessedFeedbackTimeRef.current < 250
      ) {
        hitGrad.addColorStop(0, "rgba(239, 68, 68, 0)");
        hitGrad.addColorStop(0.5, "#EF4444");
        hitGrad.addColorStop(1, "rgba(239, 68, 68, 0)");
        ctx.shadowColor = "#EF4444";
        ctx.shadowBlur = 14;
      } else if (isWaitModeActive) {
        hitGrad.addColorStop(0, "rgba(56, 189, 248, 0)");
        hitGrad.addColorStop(0.5, "#38BDF8");
        hitGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
        ctx.shadowColor = "#38BDF8";
        ctx.shadowBlur = 12;
      } else {
        hitGrad.addColorStop(0, "rgba(148, 163, 184, 0.1)");
        hitGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.85)");
        hitGrad.addColorStop(1, "rgba(148, 163, 184, 0.1)");
      }

      ctx.beginPath();
      ctx.moveTo(hitZoneX, trackPaddingTop - 20);
      ctx.lineTo(hitZoneX, trackPaddingTop + trackHeight + 20);
      ctx.lineWidth = 4;
      ctx.strokeStyle = hitGrad;
      ctx.stroke();

      // Top and bottom hit cursor diamonds
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.moveTo(hitZoneX, trackPaddingTop - 20);
      ctx.lineTo(hitZoneX - 6, trackPaddingTop - 28);
      ctx.lineTo(hitZoneX, trackPaddingTop - 36);
      ctx.lineTo(hitZoneX + 6, trackPaddingTop - 28);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // 5. Update and render particle explosions
      particles.updateAndDraw(ctx);

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [
    song,
    getCurrentTime,
    speed,
    isPaused,
    isWaitModeActive,
    activeWaitEvent,
    lastHitFeedback,
  ]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[240px] sm:h-[300px] bg-slate-900 border-y border-slate-800 overflow-hidden shadow-inner"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
