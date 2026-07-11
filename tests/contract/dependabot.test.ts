import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type DependabotConfig = {
  version: number;
  updates: Array<{
    "package-ecosystem": string;
    directory: string;
    schedule: {
      interval: string;
      day: string;
      time: string;
      timezone: string;
    };
    "open-pull-requests-limit": number;
    "commit-message": {
      prefix: string;
    };
    groups: Record<
      string,
      {
        patterns?: string[];
        "dependency-type"?: string;
        "update-types"?: string[];
      }
    >;
  }>;
};

describe("Dependabot contract", () => {
  it("keeps npm and GitHub Actions updates bounded and grouped", () => {
    const config = parse(
      readFileSync(join(process.cwd(), ".github/dependabot.yml"), "utf8")
    ) as DependabotConfig;

    expect(config.version).toBe(2);
    expect(config.updates.map((update) => update["package-ecosystem"])).toEqual([
      "npm",
      "github-actions"
    ]);

    for (const update of config.updates) {
      expect(update.directory).toBe("/");
      expect(update.schedule).toEqual(
        expect.objectContaining({
          interval: "weekly",
          day: "monday",
          timezone: "Etc/UTC"
        })
      );
      expect(update["open-pull-requests-limit"]).toBe(3);
      expect(update["commit-message"]).toEqual({ prefix: "deps" });
    }

    const npm = config.updates[0];
    expect(npm.groups).toEqual({
      "production-dependencies": {
        "dependency-type": "production",
        "update-types": ["minor", "patch"]
      },
      "development-dependencies": {
        "dependency-type": "development",
        "update-types": ["minor", "patch"]
      }
    });
    expect(config.updates[1].groups).toEqual({
      "github-actions": {
        patterns: ["*"]
      }
    });
    expect(config.updates[0].schedule.time).not.toBe(config.updates[1].schedule.time);
  });
});
