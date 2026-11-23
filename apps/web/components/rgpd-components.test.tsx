import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch } from "@/test-utils/fetch-mock";
import { readConsent } from "@/lib/consent";
import { ConsentBanner, ManageConsentButton } from "./consent-banner";
import { ConsentGate } from "./consent-gate";
import { LinkConfirmation } from "./link-confirmation";
import { NewsletterForm } from "./newsletter-form";

beforeEach(() => window.localStorage.clear());

describe("Bandeau de consentement (C11, TF10)", () => {
  it("s'affiche au premier passage ; refuser et accepter sont au même niveau ; rien n'est pré-coché", async () => {
    mockFetch({ "/api/v1/consents": { status: 204 } });
    render(<ConsentBanner />);
    const refuse = await screen.findByRole("button", { name: "Tout refuser" });
    const accept = screen.getByRole("button", { name: "Tout accepter" });
    expect(refuse.className).toBe(accept.className);
    await userEvent.setup().click(screen.getByRole("button", { name: "Personnaliser" }));
    expect(screen.getByRole("checkbox", { name: /Google Maps/ })).not.toBeChecked();
  });

  it("refuser : choix gardé, preuve envoyée au serveur, bandeau fermé", async () => {
    const { calls } = mockFetch({ "/api/v1/consents": { status: 204 } });
    render(<ConsentBanner />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Tout refuser" }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(readConsent()?.choices).toEqual({ contenusTiers: false });
    const body = JSON.parse(String(calls[0]!.init?.body)) as { consentId: string; choices: unknown };
    expect(body.choices).toEqual({ contenusTiers: false });
    expect(body.consentId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("le choix est redemandé après 6 mois ; le lien du pied de page rouvre le bandeau", async () => {
    window.localStorage.setItem(
      "lf_consentement",
      JSON.stringify({
        id: crypto.randomUUID(),
        version: "2026-11",
        date: new Date(Date.now() - 200 * 86_400_000).toISOString(),
        choices: { contenusTiers: true },
      }),
    );
    expect(readConsent()).toBeNull();
    mockFetch({ "/api/v1/consents": { status: 204 } });
    render(
      <>
        <ConsentBanner />
        <ManageConsentButton />
      </>,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Tout accepter" }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gérer les cookies" }));
    expect(await screen.findByRole("region", { name: "Vos choix sur les cookies" })).toBeInTheDocument();
  });
});

describe("ConsentGate", () => {
  it("contenu tiers bloqué sans accord, affiché dès l'accord", async () => {
    mockFetch({ "/api/v1/consents": { status: 204 } });
    render(
      <>
        <ConsentBanner />
        <ConsentGate fallback={<p>Carte bloquée</p>}>
          <p>Carte Google</p>
        </ConsentGate>
      </>,
    );
    expect(screen.getByText("Carte bloquée")).toBeInTheDocument();
    expect(screen.queryByText("Carte Google")).not.toBeInTheDocument();
    await userEvent.setup().click(await screen.findByRole("button", { name: "Tout accepter" }));
    expect(screen.getByText("Carte Google")).toBeInTheDocument();
  });
});

describe("NewsletterForm (EF10)", () => {
  it("email invalide refusé sans appel ; email valide : message de confirmation", async () => {
    const { calls } = mockFetch({ "/api/v1/newsletter": { status: 202, body: { status: "CONFIRMATION_SENT" } } });
    const user = userEvent.setup();
    render(<NewsletterForm />);
    const input = screen.getByLabelText(/Newsletter/);
    await user.type(input, "pas-un-email");
    await user.click(screen.getByRole("button", { name: "S'inscrire" }));
    expect(screen.getByRole("alert")).toHaveTextContent("invalide");
    expect(calls).toHaveLength(0);
    await user.clear(input);
    await user.type(input, "lea@exemple.fr");
    await user.click(screen.getByRole("button", { name: "S'inscrire" }));
    expect(await screen.findByRole("status")).toHaveTextContent("lien de confirmation");
  });
});

describe("LinkConfirmation", () => {
  const props = {
    endpoint: "/newsletter/confirm",
    fields: [{ name: "token", pattern: "[A-Za-z0-9_-]{43}" }],
    intro: "Confirmez.",
    buttonLabel: "Confirmer",
    success: "C'est confirmé.",
  };

  it("rien n'est envoyé avant le clic ; lien valide : succès", async () => {
    window.history.replaceState(null, "", `/newsletter/confirmer?token=${"a".repeat(43)}`);
    const { calls } = mockFetch({ "/api/v1/newsletter/confirm": { body: { status: "CONFIRMED" } } });
    render(<LinkConfirmation {...props} />);
    expect(calls).toHaveLength(0);
    await userEvent.setup().click(screen.getByRole("button", { name: "Confirmer" }));
    expect(await screen.findByRole("status")).toHaveTextContent("C'est confirmé.");
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ token: "a".repeat(43) });
  });

  it("lien incomplet : message, aucun appel", async () => {
    window.history.replaceState(null, "", "/newsletter/confirmer?token=court");
    const { calls } = mockFetch({});
    render(<LinkConfirmation {...props} />);
    await act(async () => {
      await userEvent.setup().click(screen.getByRole("button", { name: "Confirmer" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("incomplet");
    expect(calls).toHaveLength(0);
  });
});
