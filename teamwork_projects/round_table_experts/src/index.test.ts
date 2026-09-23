import { expect, test } from "vitest";
import { hello } from "./index";

test("hello matches world", () => {
  expect(hello).toBe("world");
});
