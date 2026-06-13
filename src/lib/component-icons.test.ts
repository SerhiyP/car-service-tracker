import { describe, expect, it } from "vitest";
import { CircleStop, Filter, Wrench } from "lucide-react";
import en from "@/messages/en.json";
import uk from "@/messages/uk.json";
import { COMPONENT_ICON_KEYS } from "@/lib/types";
import { inferIconKey, resolveIcon } from "./component-icons";

describe("inferIconKey", () => {
  it("infers from English keywords", () => {
    expect(inferIconKey("Engine oil & oil filter")).toBe("oil");
    expect(inferIconKey("Air filter")).toBe("filter");
    expect(inferIconKey("Spark plugs")).toBe("spark");
    expect(inferIconKey("Brake fluid")).toBe("brake");
    expect(inferIconKey("Battery")).toBe("battery");
  });

  it("infers from Ukrainian keywords", () => {
    expect(inferIconKey("Моторна олива та масляний фільтр")).toBe("oil");
    expect(inferIconKey("Гальмівні колодки (передні)")).toBe("brake");
    expect(inferIconKey("Акумулятор")).toBe("battery");
    expect(inferIconKey("Ремінь ГРМ")).toBe("belt");
  });

  it("returns null when nothing matches", () => {
    expect(inferIconKey("Headlight polish")).toBeNull();
  });
});

describe("resolveIcon", () => {
  it("uses the stored key over inference", () => {
    expect(resolveIcon({ name: "Engine oil", storedKey: "brake" })).toBe(CircleStop);
  });

  it("falls back to inference when no stored key", () => {
    expect(resolveIcon({ name: "Air filter" })).toBe(Filter);
  });

  it("falls back to the wrench icon when nothing matches", () => {
    expect(resolveIcon({ name: "Custom service" })).toBe(Wrench);
  });
});

describe("componentIcons i18n parity", () => {
  it("en and uk name every icon key (and nothing else)", () => {
    for (const catalog of [en, uk]) {
      const names = (catalog as unknown as { componentIcons: Record<string, string> }).componentIcons;
      expect(Object.keys(names).sort()).toEqual([...COMPONENT_ICON_KEYS].sort());
      for (const key of COMPONENT_ICON_KEYS) {
        expect(names[key].length).toBeGreaterThan(0);
      }
    }
  });
});
