import React from "react";
import { Platform, ContentType, DeviceType, StepDef } from "./types";
import { getInstagramSteps } from "./getInstagramSteps";
import { getTelegramSteps } from "./getTelegramSteps";
import { getVkSteps } from "./getVkSteps";

interface GuideStepsProps {
  platform: Platform;
  contentType: ContentType;
  device: DeviceType;
}

export function GuideSteps({ platform, contentType, device }: GuideStepsProps) {
  let steps: StepDef[] = [];
  if (platform === "instagram") {
    steps = getInstagramSteps(contentType, device);
  } else if (platform === "telegram") {
    steps = getTelegramSteps(contentType, device);
  } else if (platform === "vk") {
    steps = getVkSteps(contentType, device);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
      {steps.map((s, idx) => (
        <div key={idx} className="flex flex-col gap-3 group">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-black">
              {idx + 1}
            </span>
            <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
              {s.title}
            </h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed pl-8">
            {s.desc}
          </p>
          <div className="aspect-[4/3] w-full rounded-2xl border border-border/60 bg-muted/30 dark:bg-muted/10 p-4 flex items-center justify-center overflow-hidden transition-all duration-200 group-hover:border-primary/30 group-hover:shadow-[0_8px_30px_rgb(var(--primary-rgb)/0.03)]">
            {s.svg}
          </div>
        </div>
      ))}
    </div>
  );
}
