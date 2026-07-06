import { describe, expect, it } from "vitest";
import { formatDuration, getLyricIndex } from "./utils";

describe("radio helpers", () => {
  it("formats track duration", () => {
    expect(formatDuration(272)).toBe("04:32");
    expect(formatDuration(Number.NaN)).toBe("00:00");
  });

  it("maps live progress to a lyric row", () => {
    expect(getLyricIndex(0, 6)).toBe(0);
    expect(getLyricIndex(51, 6)).toBe(3);
    expect(getLyricIndex(100, 6)).toBe(5);
  });
});
