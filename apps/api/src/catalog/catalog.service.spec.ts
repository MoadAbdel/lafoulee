import { toPrefixTsQuery } from "./catalog.service.js";

describe("toPrefixTsQuery (recherche)", () => {
  it("TB01a transforme chaque mot en préfixe relié par ET", () => {
    expect(toPrefixTsQuery("chaussure trai")).toBe("chaussure:* & trai:*");
  });

  it("garde les lettres accentuées et les chiffres", () => {
    expect(toPrefixTsQuery("légère 500")).toBe("légère:* & 500:*");
  });

  it("TB02a neutralise la syntaxe tsquery et SQL (opérateurs, quotes, parenthèses)", () => {
    expect(toPrefixTsQuery("trail' | !(drop) & ;--")).toBe("trail:* & drop:*");
  });

  it("renvoie null si aucun mot exploitable", () => {
    expect(toPrefixTsQuery("  !!! ")).toBeNull();
  });

  it("limite la requête à 8 mots", () => {
    const query = toPrefixTsQuery("a b c d e f g h i j");
    expect(query?.split(" & ")).toHaveLength(8);
  });
});
