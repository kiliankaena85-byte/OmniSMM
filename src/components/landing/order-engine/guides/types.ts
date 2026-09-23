import { ReactNode } from "react";

export type Platform = "instagram" | "telegram" | "vk";
export type ContentType = "profile" | "post" | "story" | "comment" | "photo";
export type DeviceType = "mobile" | "desktop";

export interface StepDef {
  title: string;
  desc: string;
  svg: ReactNode;
}
