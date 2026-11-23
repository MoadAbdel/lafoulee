import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { VerifyEmail } from "./verify-email";

const TOKEN = "a".repeat(43);

describe("VerifyEmail", () => {
  it("rien n'est validé à l'ouverture de la page (pas d'appel avant le clic)", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    window.history.replaceState(null, "", `/verifier-email?token=${TOKEN}`);
    render(<VerifyEmail />);
    expect(spy).not.toHaveBeenCalled();
  });

  it("confirme l'adresse au clic et propose la connexion", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "VERIFIED" })));
    window.history.replaceState(null, "", `/verifier-email?token=${TOKEN}`);
    const user = userEvent.setup();
    render(<VerifyEmail />);
    await user.click(screen.getByRole("button", { name: "Confirmer mon adresse" }));
    expect(await screen.findByRole("status")).toHaveTextContent("confirmée");
    expect(JSON.parse(String(spy.mock.calls[0]![1]?.body))).toEqual({ token: TOKEN });
  });

  it("lien incomplet : message sans appel réseau", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    window.history.replaceState(null, "", "/verifier-email?token=abc");
    const user = userEvent.setup();
    render(<VerifyEmail />);
    await user.click(screen.getByRole("button", { name: "Confirmer mon adresse" }));
    expect(screen.getByRole("alert")).toHaveTextContent("incomplet");
    expect(spy).not.toHaveBeenCalled();
  });

  it("lien expiré : message de l'API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Ce lien est invalide ou a expiré." }), { status: 403 }),
    );
    window.history.replaceState(null, "", `/verifier-email?token=${TOKEN}`);
    const user = userEvent.setup();
    render(<VerifyEmail />);
    await user.click(screen.getByRole("button", { name: "Confirmer mon adresse" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("expiré");
  });
});
