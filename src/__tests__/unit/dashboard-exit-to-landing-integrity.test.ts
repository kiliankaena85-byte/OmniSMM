import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Целостность навигации и выхода на главный экран из личного кабинета (SIL-2026)", () => {
  const sidebarNavPath = path.resolve(process.cwd(), "src/app/dashboard/sidebar-nav.tsx");
  const classicShellPath = path.resolve(process.cwd(), "src/components/dashboard/classic/ClassicDashboardShell.tsx");
  const fluxShellPath = path.resolve(process.cwd(), "src/components/dashboard/flux/FluxDashboardShell.tsx");
  const commandMenuPath = path.resolve(process.cwd(), "src/components/dashboard/UserCommandMenu.tsx");

  it("файлы навигации и оболочек личного кабинета должны физически существовать", () => {
    expect(fs.existsSync(sidebarNavPath)).toBe(true);
    expect(fs.existsSync(classicShellPath)).toBe(true);
    expect(fs.existsSync(fluxShellPath)).toBe(true);
    expect(fs.existsSync(commandMenuPath)).toBe(true);
  });

  it("Classic SidebarNav обязан содержать явный визуальный элемент/кнопку перехода на главный сайт (href=\"/\")", () => {
    const content = fs.readFileSync(sidebarNavPath, "utf-8");
    expect(content).toContain("href=\"/\"");
    expect(content).toMatch(/На сайт|На главную витрину|Перейти на сайт/);
  });

  it("FluxDashboardShell обязан иметь ссылку на главный экран (href=\"/\") в логотипе или шапке", () => {
    const content = fs.readFileSync(fluxShellPath, "utf-8");
    expect(content).toContain("href=\"/\"");
    expect(content).toMatch(/На сайт|Перейти на сайт|На главную/);
  });

  it("ClassicDashboardShell в мобильной шапке обязан содержать понятный переход на главный сайт (href=\"/\")", () => {
    const content = fs.readFileSync(classicShellPath, "utf-8");
    expect(content).toContain("href=\"/\"");
    expect(content).toMatch(/На сайт|Перейти на сайт|На главную/);
  });

  it("UserCommandMenu обязан содержать команду быстрого перехода на публичный сайт/витрину (href=\"/\")", () => {
    const content = fs.readFileSync(commandMenuPath, "utf-8");
    expect(content).toContain("handleSelect('/')");
    expect(content).toMatch(/На сайт|главный сайт|Витрина услуг/);
  });
});
