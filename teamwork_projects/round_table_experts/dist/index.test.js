"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("./index");
(0, vitest_1.test)("hello matches world", () => {
    (0, vitest_1.expect)(index_1.hello).toBe("world");
});
