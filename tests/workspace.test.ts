import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const rootPackage = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
  license: string;
  packageManager: string;
  engines: { node: string };
  bin: Record<string, string>;
};

describe("workspace tooling", () => {
  it("uses the accepted runtime, package manager, license, and CLI binary", () => {
    expect(rootPackage.license).toBe("Apache-2.0");
    expect(rootPackage.packageManager).toBe("pnpm@11.7.0");
    expect(rootPackage.engines.node).toBe(">=24.0.0");
    expect(rootPackage.bin.scg).toBe("./dist/cli/index.js");
  });
});
