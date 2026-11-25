import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { RegisterForm } from "./register-form";

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

describe("RegisterForm (EF08)", () => {
  it("TF09 mot de passe faible : erreurs affichées sans appel réseau, focus sur la zone d'erreur", async () => {
    const fetchSpy = mockFetch(202, {});
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Email"), "lea@exemple.fr");
    await user.type(screen.getByLabelText("Mot de passe"), "court");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("12 caractères minimum");
    expect(alert).toHaveFocus();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("le champ mot de passe est relié à son aide", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Mot de passe")).toHaveAccessibleDescription(/12 caractères minimum/);
  });

  it("inscription valide : message de confirmation neutre", async () => {
    const fetchSpy = mockFetch(202, { status: "VERIFICATION_SENT" });
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Email"), "Lea@Exemple.fr");
    await user.type(screen.getByLabelText("Mot de passe"), "Foulee-2026-lyon");
    await user.click(screen.getByRole("checkbox", { name: /conditions générales d'utilisation/ }));
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect(await screen.findByRole("status")).toHaveTextContent("lea@exemple.fr");
    const [, init] = fetchSpy.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "lea@exemple.fr",
      password: "Foulee-2026-lyon",
      acceptTerms: true,
    });
  });

  it("erreur de l'API affichée (limitation de débit)", async () => {
    mockFetch(429, { statusCode: 429, message: "Trop de tentatives." });
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Email"), "lea@exemple.fr");
    await user.type(screen.getByLabelText("Mot de passe"), "Foulee-2026-lyon");
    await user.click(screen.getByRole("checkbox", { name: /conditions générales d'utilisation/ }));
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Patientez une minute");
  });

  it("CGU non acceptées : message, aucun appel réseau", async () => {
    const fetchSpy = mockFetch(202, {});
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Email"), "lea@exemple.fr");
    await user.type(screen.getByLabelText("Mot de passe"), "Foulee-2026-lyon");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect(screen.getByRole("alert")).toHaveTextContent("conditions générales d'utilisation");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
