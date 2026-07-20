import { describe, expect, it } from "vitest";
import { selectEnabledReportFormats } from "../../scripts/openfeature-consumer.mjs";

describe("OpenFeature report consumer", () => {
  it("maps enabled local flags to deterministic SCG report formats", () => {
    expect(
      selectEnabledReportFormats({
        "scg.report.json.enabled": true,
        "scg.report.dot.enabled": false,
        "scg.report.html.enabled": true
      })
    ).toEqual(["json", "html"]);
  });

  it("rejects a flag snapshot that disables every report format", () => {
    expect(() =>
      selectEnabledReportFormats({
        "scg.report.json.enabled": false,
        "scg.report.dot.enabled": false,
        "scg.report.html.enabled": false
      })
    ).toThrow("at least one report format must be enabled");
  });
});
