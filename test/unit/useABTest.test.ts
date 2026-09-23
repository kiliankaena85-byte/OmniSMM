/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";
import { useABTest } from "@/hooks/useABTest";

describe("useABTest hook", () => {
  const originalEnv = process.env.NEXT_PUBLIC_FORCE_AB_VARIANT;
  let store: Record<string, string> = {};

  const mockLocalStorage = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    })
  };

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", mockLocalStorage);
    vi.stubGlobal("location", {
      search: ""
    });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_FORCE_AB_VARIANT = originalEnv;
    vi.unstubAllGlobals();
  });

  it("should return null on initial render (hydration safety)", () => {
    const values: (any)[] = [];
    renderHook(() => {
      const val = useABTest();
      values.push(val);
      return val;
    });
    expect(values[0]).toBeNull();
  });

  it("should resolve to a valid variant after mounting", () => {
    const { result } = renderHook(() => useABTest());
    expect(["A", "B", "C"]).toContain(result.current);
  });

  it("should prioritize NEXT_PUBLIC_FORCE_AB_VARIANT environment override", () => {
    process.env.NEXT_PUBLIC_FORCE_AB_VARIANT = "B";

    const { result } = renderHook(() => useABTest());
    expect(result.current).toBe("B");
  });

  it("should respect URL query parameter and save to localStorage", () => {
    vi.stubGlobal("location", {
      search: "?ab_variant=C"
    });

    const { result } = renderHook(() => useABTest());
    expect(result.current).toBe("C");
    expect(localStorage.getItem("smmplan_ab_variant")).toBe("C");
  });

  it("should ignore invalid URL query parameters", () => {
    vi.stubGlobal("location", {
      search: "?ab_variant=Z"
    });

    const { result } = renderHook(() => useABTest());
    expect(["A", "B", "C"]).toContain(result.current);
    expect(localStorage.getItem("smmplan_ab_variant")).not.toBe("Z");
  });

  it("should retrieve variant from localStorage if saved", () => {
    localStorage.setItem("smmplan_ab_variant", "B");

    const { result } = renderHook(() => useABTest());
    expect(result.current).toBe("B");
  });

  it("should store a randomly generated variant in localStorage on cold start", () => {
    expect(localStorage.getItem("smmplan_ab_variant")).toBeNull();

    const { result } = renderHook(() => useABTest());
    const resolved = result.current;
    expect(["A", "B", "C"]).toContain(resolved);
    expect(localStorage.getItem("smmplan_ab_variant")).toBe(resolved);
  });
});
