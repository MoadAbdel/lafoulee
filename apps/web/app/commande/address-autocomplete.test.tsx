import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { mockFetch } from "@/test-utils/fetch-mock";
import { AddressAutocomplete, type AddressSuggestion } from "./address-autocomplete";

const features = [
  { properties: { label: "12 Rue Max Dormoy 69003 Lyon", name: "12 Rue Max Dormoy", postcode: "69003", city: "Lyon" } },
  {
    properties: { label: "12 Rue Max 69100 Villeurbanne", name: "12 Rue Max", postcode: "69100", city: "Villeurbanne" },
  },
];

function Harness({ onSelect }: { onSelect: (suggestion: AddressSuggestion) => void }) {
  const [value, setValue] = useState("");
  return (
    <>
      <label htmlFor="line1">Adresse</label>
      <AddressAutocomplete value={value} onChange={setValue} onSelect={onSelect} inputClassName="" />
    </>
  );
}

describe("AddressAutocomplete (EF05, API Adresse)", () => {
  it("TF06 suggestions après 3 caractères, choix au clavier", async () => {
    const { calls } = mockFetch({ "data.geopf.fr": { body: { features } } });
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSelect={onSelect} />);
    const input = screen.getByRole("combobox", { name: "Adresse" });
    await user.type(input, "12");
    expect(calls).toHaveLength(0); // moins de 3 caractères : aucun appel
    await user.type(input, " rue max");
    expect(await screen.findAllByRole("option")).toHaveLength(2);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(calls.every((call) => call.url.startsWith("https://data.geopf.fr/geocodage/search?"))).toBe(true);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledWith({
      label: features[0]!.properties.label,
      line1: "12 Rue Max Dormoy",
      postalCode: "69003",
      city: "Lyon",
    });
  });

  it("TF07 API Adresse en erreur : aucune suggestion, la saisie reste libre", async () => {
    mockFetch({ "data.geopf.fr": { status: 503 } });
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox", { name: "Adresse" });
    await user.type(input, "12 rue inconnue");
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(input).toHaveValue("12 rue inconnue");
  });

  it("Échap ferme la liste", async () => {
    mockFetch({ "data.geopf.fr": { body: { features } } });
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox", { name: "Adresse" });
    await user.type(input, "12 rue max");
    await screen.findAllByRole("option");
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });
});
