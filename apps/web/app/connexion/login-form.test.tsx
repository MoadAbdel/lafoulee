import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { LoginForm } from "./login-form";

function respond(...responses: [number, unknown][]) {
  const spy = vi.spyOn(globalThis, "fetch");
  for (const [status, body] of responses) {
    spy.mockResolvedValueOnce(new Response(status === 204 ? null : JSON.stringify(body), { status }));
  }
  return spy;
}

async function fillPassword(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Email"), "admin@exemple.fr");
  await user.type(screen.getByLabelText("Mot de passe"), "Foulee-2026-lyon");
  await user.click(screen.getByRole("button", { name: "Se connecter" }));
}

describe("LoginForm", () => {
  it("TF12 administrateur : une seconde étape demande le code TOTP", async () => {
    const spy = respond([200, { status: "TOTP_REQUIRED", challenge: "defi" }], [200, { status: "OK", user: {} }]);
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillPassword(user);
    const code = await screen.findByLabelText(/Code de votre application/);
    expect(code).toHaveAttribute("autocomplete", "one-time-code");
    await user.type(code, "123 456");
    await user.click(screen.getByRole("button", { name: "Valider" }));
    const [, init] = spy.mock.calls[1]!;
    expect(JSON.parse(String(init?.body))).toEqual({ challenge: "defi", code: "123456" });
  });

  it("code faux : message d'erreur, on reste sur l'étape du code", async () => {
    respond([200, { status: "TOTP_REQUIRED", challenge: "defi" }], [401, { message: "Code incorrect." }]);
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillPassword(user);
    await user.type(await screen.findByLabelText(/Code de votre application/), "000000");
    await user.click(screen.getByRole("button", { name: "Valider" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Code incorrect.");
    expect(screen.getByLabelText(/Code de votre application/)).toBeInTheDocument();
  });

  it("email non vérifié : propose de renvoyer le lien", async () => {
    const spy = respond(
      [403, { code: "EMAIL_NOT_VERIFIED", message: "Confirmez d'abord votre adresse email." }],
      [202, { status: "VERIFICATION_SENT" }],
    );
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillPassword(user);
    await user.click(await screen.findByRole("button", { name: /Renvoyer/ }));
    expect(await screen.findByText(/nouveau lien/)).toBeInTheDocument();
    expect(String(spy.mock.calls[1]![0])).toContain("/auth/resend-verification");
  });

  it("réseau coupé : message explicite", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillPassword(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Connexion impossible");
  });
});
