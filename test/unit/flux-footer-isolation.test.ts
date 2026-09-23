import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MegaFooter } from "@/components/landing/MegaFooter";

describe("SMMflux vs SMMplan Footer Style & Brand Isolation", () => {
  it("renders authentic Prism Cyberpunk style for flux tenant", () => {
    const html = renderToString(React.createElement(MegaFooter, { tenantId: "flux" }));
    
    // Should have Cyberpunk background & neon tokens
    expect(html).toContain("FLUX Creative Lab");
    expect(html).toContain("Media Hub");
    expect(html).toContain("bg-[#0a0d18]");
    expect(html).toContain("from-purple-600");
    expect(html).toContain("support@smmflux.ru");

    // Must NOT contain SMMplan B2B specific labels
    expect(html).not.toContain("for B2B Growth");
  });

  it("renders B2B Blueprint style for smmplan tenant", () => {
    const html = renderToString(React.createElement(MegaFooter, { tenantId: "smmplan" }));
    
    // Should have B2B Blueprint elements
    expect(html).toContain("for B2B Growth");
    expect(html).toContain("SMMplan");
    expect(html).toContain("support@smmplan.pro");

    // Must NOT contain flux specific branding
    expect(html).not.toContain("FLUX Creative Lab");
    expect(html).not.toContain("Media Hub");
  });
});
