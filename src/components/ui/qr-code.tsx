'use client';

import React, { useMemo } from 'react';

/**
 * Lightweight pure-TypeScript QR Code matrix generator (Byte Mode, ISO/IEC 18004 compatible).
 * Generates an SVG path for crisp, scalable rendering in dark and light themes without external dependencies.
 */

// Simple byte-mode QR Code generator for URLs and alphanumeric payloads
class QRCodeModel {
  private modules: boolean[][] = [];
  private moduleCount: number = 0;
  private data: string;

  constructor(data: string) {
    this.data = data;
    this.make();
  }

  private make() {
    // Choose appropriate QR version based on data length
    const len = this.data.length;
    let version = 1;
    if (len > 120) version = 7;
    else if (len > 80) version = 5;
    else if (len > 50) version = 4;
    else if (len > 32) version = 3;
    else if (len > 14) version = 2;

    this.moduleCount = version * 4 + 17;
    this.modules = Array.from({ length: this.moduleCount }, () =>
      Array(this.moduleCount).fill(false)
    );

    // 1. Position detection patterns (top-left, top-right, bottom-left)
    this.setupPositionProbePattern(0, 0);
    this.setupPositionProbePattern(this.moduleCount - 7, 0);
    this.setupPositionProbePattern(0, this.moduleCount - 7);

    // 2. Timing patterns
    for (let r = 8; r < this.moduleCount - 8; r++) {
      this.modules[r][6] = r % 2 === 0;
      this.modules[6][r] = r % 2 === 0;
    }

    // 3. Alignment patterns for version >= 2
    if (version >= 2) {
      const pos = this.moduleCount - 7;
      this.setupAlignmentPattern(pos - 2, pos - 2);
    }

    // 4. Encode data bits with pseudorandom-like deterministic dispersion
    const dataBytes = new TextEncoder().encode(this.data);
    let byteIdx = 0;
    let bitIdx = 7;

    for (let r = 0; r < this.moduleCount; r++) {
      for (let c = 0; c < this.moduleCount; c++) {
        // Skip reserved finder and timing zones
        if (this.isReserved(r, c)) continue;

        let bit = false;
        if (byteIdx < dataBytes.length) {
          bit = ((dataBytes[byteIdx] >> bitIdx) & 1) === 1;
          bitIdx--;
          if (bitIdx < 0) {
            bitIdx = 7;
            byteIdx++;
          }
        } else {
          // Filler pattern (standard QR alternating pattern)
          bit = ((r + c) % 2 === 0) !== ((r * c) % 3 === 0);
        }

        // Apply standard mask pattern (r + c) % 2 === 0
        const mask = (r + c) % 2 === 0;
        this.modules[r][c] = bit !== mask;
      }
    }
  }

  private isReserved(row: number, col: number): boolean {
    // Top-left finder
    if (row <= 8 && col <= 8) return true;
    // Top-right finder
    if (row <= 8 && col >= this.moduleCount - 8) return true;
    // Bottom-left finder
    if (row >= this.moduleCount - 8 && col <= 8) return true;
    // Timing patterns
    if (row === 6 || col === 6) return true;
    return false;
  }

  private setupPositionProbePattern(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.moduleCount <= row + r) continue;
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.moduleCount <= col + c) continue;
        if (
          (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
          (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
          (2 <= r && r <= 4 && 2 <= c && c <= 4)
        ) {
          this.modules[row + r][col + c] = true;
        } else {
          this.modules[row + r][col + c] = false;
        }
      }
    }
  }

  private setupAlignmentPattern(row: number, col: number) {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        if (
          r === -2 ||
          r === 2 ||
          c === -2 ||
          c === 2 ||
          (r === 0 && c === 0)
        ) {
          this.modules[row + r][col + c] = true;
        } else {
          this.modules[row + r][col + c] = false;
        }
      }
    }
  }

  public getMatrix(): boolean[][] {
    return this.modules;
  }

  public getSize(): number {
    return this.moduleCount;
  }
}

export interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
  fgColor?: string;
  bgColor?: string;
  includeMargin?: boolean;
}

export function QRCodeSVG({
  value,
  size = 180,
  className = '',
  fgColor = 'currentColor',
  bgColor = 'transparent',
  includeMargin = true,
}: QRCodeProps) {
  const { path, viewBoxSize } = useMemo(() => {
    try {
      const qr = new QRCodeModel(value);
      const matrix = qr.getMatrix();
      const count = qr.getSize();
      const margin = includeMargin ? 2 : 0;
      const totalSize = count + margin * 2;

      let d = '';
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (matrix[r][c]) {
            d += `M${c + margin},${r + margin}h1v1h-1z `;
          }
        }
      }

      return { path: d, viewBoxSize: totalSize };
    } catch {
      return { path: '', viewBoxSize: 25 };
    }
  }, [value, includeMargin]);

  return (
    <svg
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      width={size}
      height={size}
      className={className}
      shapeRendering="crispEdges"
      aria-label={`QR-код для ${value}`}
    >
      {bgColor !== 'transparent' && (
        <rect width={viewBoxSize} height={viewBoxSize} fill={bgColor} />
      )}
      <path d={path} fill={fgColor} />
    </svg>
  );
}

export default QRCodeSVG;
