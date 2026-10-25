import { describe, expect, it } from "vitest";
import { classify, cleanMake, fileExclusion, fileNamesModel, parseName, photoProblem, regionOf } from "./rules";

describe("parseName", () => {
  it("keeps the whole make when a nickname is part of it", () => {
    expect(parseName("Aston Martin Victor", ["Aston Martin"], null)).toEqual({ make: "Aston Martin", model: "Victor" });
    expect(parseName("Alfa Romeo 164", ["Alfa Romeo"], null)).toEqual({ make: "Alfa Romeo", model: "164" });
    expect(parseName("Rolls-Royce Phantom", ["Rolls-Royce"], null)).toEqual({ make: "Rolls-Royce", model: "Phantom" });
  });

  it("splits make, model and generation", () => {
    expect(parseName("Toyota Supra (A80)", ["Toyota"], "Toyota Supra")).toEqual({ make: "Toyota", model: "Supra", generation: "A80" });
    expect(parseName("Porsche 993", ["Porsche"], "Porsche 911")).toEqual({ make: "Porsche", model: "911", generation: "993" });
    expect(parseName("Mercedes-Benz W198", ["Mercedes-Benz"], "Mercedes-Benz 300 SL")).toEqual({
      make: "Mercedes-Benz",
      model: "300 SL",
      generation: "W198",
    });
    expect(parseName("Volkswagen Golf Mk4", ["Volkswagen"], null)).toEqual({ make: "Volkswagen", model: "Golf", generation: "Mk4" });
    expect(parseName("Citroën 2CV", ["Citroën"], null)).toEqual({ make: "Citroën", model: "2CV" });
  });

  it("treats members of a product line as models of their own", () => {
    expect(parseName("Mercedes-Benz EQV", ["Mercedes-Benz"], "Mercedes-Benz EQ")).toEqual({ make: "Mercedes-Benz", model: "EQV" });
    expect(parseName("Toyota bZ3X", ["Toyota"], "Toyota bZ series")).toEqual({ make: "Toyota", model: "bZ3X" });
  });

  it("uses cleaned brand names and tries every candidate make", () => {
    expect(cleanMake("DS Automobiles")).toBe("DS");
    expect(cleanMake("Nissan Motor Company")).toBe("Nissan");
    expect(parseName("DS 5", ["DS", "Citroën"], null)).toEqual({ make: "DS", model: "5" });
    expect(parseName("Peugeot 205", ["Stellantis", "Peugeot"], null)).toEqual({ make: "Peugeot", model: "205" });
  });

  it("returns null when the label can't be tied to the brand", () => {
    expect(parseName("Range Rover Sport", ["Land Rover"], null)).toBeNull();
    expect(parseName("Toyota", ["Toyota"], null)).toBeNull();
  });
});

describe("photo checks", () => {
  it("rejects detail shots and non-car pictures by file name", () => {
    expect(fileExclusion("File:BMW E46 interior.jpg")).toBe("interior");
    expect(fileExclusion("File:Porsche 993 Motorraum.JPG")).toBe("motorraum");
    expect(fileExclusion("File:Ferrari F40 scale model.jpg")).toBe("scale");
    expect(fileExclusion("File:1994 Toyota Supra Sport Roof in Red, front left.jpg")).toBeNull();
  });

  it("only trusts file names that name the model", () => {
    const supra = { make: "Toyota", model: "Supra", generation: "A80" };
    expect(fileNamesModel("File:1994 Toyota Supra Sport Roof in Red, front left.jpg", supra)).toBe(true);
    expect(fileNamesModel("File:TOYOTA SUPRA (A80) HONG KONG (2).jpg", supra)).toBe(true);
    expect(fileNamesModel("File:Porsche, Techno-Classica 2018, Essen (IMG 9729).jpg", { make: "Porsche", model: "911", generation: "993" })).toBe(
      false,
    );
    expect(fileNamesModel("File:Golf4 GTI.jpg", { make: "Volkswagen", model: "Golf", generation: "Mk4" })).toBe(true);
  });

  it("checks licence, format, size and framing", () => {
    const ok = { width: 3000, height: 2000, mime: "image/jpeg", licenseAllowed: true, license: "CC BY-SA 4.0" };
    expect(photoProblem(ok)).toBeNull();
    expect(photoProblem({ ...ok, licenseAllowed: false, license: "Fair use" })).toMatch(/license/);
    expect(photoProblem({ ...ok, width: 800, height: 500 })).toMatch(/too small/);
    expect(photoProblem({ ...ok, width: 2000, height: 3000 })).toMatch(/framing/);
    expect(photoProblem({ ...ok, mime: "image/svg+xml" })).toMatch(/format/);
  });
});

describe("classification", () => {
  it("maps Wikidata classes to body types and tags, and excludes non-cars", () => {
    expect(classify(["car model", "sport utility vehicle", "electric car"])).toEqual({ bodyType: "suv", tags: ["electric"] });
    expect(classify(["car model", "hot hatch"]).tags.sort()).toEqual(["hot-hatch", "sports"]);
    expect(classify(["car model", "concept car"]).tags.sort()).toEqual(["concept", "rare"]);
    expect(classify(["car model", "truck"]).excludedBy).toBe("truck");
    expect(classify(["car model", "Formula One car"]).excludedBy).toBe("Formula One car");
  });

  it("maps countries to regions", () => {
    expect(["FR", "JP", "US", "KR", "CN", "AU"].map(regionOf)).toEqual(["europe", "japan", "usa", "korea", "china", "other"]);
  });
});
