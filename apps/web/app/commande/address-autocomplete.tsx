"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface AddressSuggestion {
  label: string;
  line1: string;
  postalCode: string;
  city: string;
}

interface Feature {
  properties: { label: string; name: string; postcode: string; city: string };
}

/** API Adresse de l'IGN (Géoplateforme) : publique, sans clé, données non sensibles. */
export const ADDRESS_API = "https://data.geopf.fr/geocodage/search";

export async function searchAddresses(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const url = `${ADDRESS_API}?${new URLSearchParams({ q: query, limit: "5", autocomplete: "1" })}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`API Adresse : HTTP ${res.status}`);
  const data = (await res.json()) as { features?: Feature[] };
  return (data.features ?? []).map(({ properties }) => ({
    label: properties.label,
    line1: properties.name,
    postalCode: properties.postcode,
    city: properties.city,
  }));
}

/**
 * Champ "Adresse" avec suggestions (combobox ARIA) : flèches pour parcourir,
 * Entrée pour choisir, Échap pour fermer. Si l'API ne répond pas, la saisie
 * reste libre : rien ne bloque la commande.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  inputClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  inputClassName: string;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const skipNext = useRef(false);
  const listId = useId();

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (value.trim().length < 3) return; // la liste affichée est vidée par "tooShort" ci-dessous
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchAddresses(value, controller.signal)
        .then((found) => {
          setSuggestions(found);
          setActive(-1);
          setOpen(found.length > 0);
        })
        .catch(() => setSuggestions([]));
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  // Moins de 3 caractères : aucune suggestion affichée (valeur déduite, pas d'état à synchroniser).
  const tooShort = value.trim().length < 3;
  const shown = tooShort ? [] : suggestions;
  const isOpen = open && shown.length > 0;

  function choose(suggestion: AddressSuggestion) {
    skipNext.current = true;
    onSelect(suggestion);
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div className="relative">
      <input
        id="line1"
        name="line1"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="address-line1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (!isOpen) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => (index + 1) % shown.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => (index <= 0 ? shown.length - 1 : index - 1));
          } else if (event.key === "Enter" && active >= 0) {
            event.preventDefault();
            choose(shown[active]!);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className={inputClassName}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Adresses suggérées"
        hidden={!isOpen}
        className="absolute z-10 mt-1 w-full border border-asphalte/30 bg-white shadow"
      >
        {shown.map((suggestion, index) => (
          <li
            key={suggestion.label}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            onMouseDown={(event) => {
              event.preventDefault();
              choose(suggestion);
            }}
            className={`cursor-pointer px-3 py-2 ${index === active ? "bg-asphalte text-craie" : "hover:bg-craie"}`}
          >
            {suggestion.label}
          </li>
        ))}
      </ul>
      <p aria-live="polite" className="sr-only">
        {open ? `${shown.length} adresse${shown.length > 1 ? "s" : ""} suggérée${shown.length > 1 ? "s" : ""}` : ""}
      </p>
    </div>
  );
}
