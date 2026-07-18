"use client";

import { useEffect, useRef } from "react";

function hashGrid(value, size) {
  const grid = Array.from({ length: size }, () => Array(size).fill(false));
  let h = 2166136261;
  const bytes = new TextEncoder().encode(value);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      h ^= bytes[(x * 13 + y * 7) % bytes.length] ?? 0;
      h = Math.imul(h, 16777619) >>> 0;
      grid[y][x] = ((h >>> ((x + y) % 24)) & 1) === 1;
    }
  }
  const mark = (ox, oy) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const outer = x === 0 || x === 6 || y === 0 || y === 6;
        const inner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        grid[oy + y][ox + x] = outer || inner;
      }
    }
    for (let y = 1; y < 6; y++) {
      for (let x = 1; x < 6; x++) {
        if (!(x >= 2 && x <= 4 && y >= 2 && y <= 4)) grid[oy + y][ox + x] = false;
      }
    }
  };
  mark(0, 0);
  mark(size - 7, 0);
  mark(0, size - 7);
  return grid;
}

export function QRCodeCanvas({ value, size = 100 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const modules = 29;
    const px = Math.floor(size / modules);
    canvas.width = px * modules;
    canvas.height = px * modules;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const grid = hashGrid(value, modules);
    ctx.fillStyle = "black";
    for (let y = 0; y < modules; y++) {
      for (let x = 0; x < modules; x++) {
        if (grid[y][x]) ctx.fillRect(x * px, y * px, px, px);
      }
    }
  }, [value, size]);
  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size }} />;
}
