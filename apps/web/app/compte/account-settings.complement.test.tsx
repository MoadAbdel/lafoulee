import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AccountProfileDto } from "@lafoulee/shared";
import { AUTH_EVENT } from "@/lib/client-api";
import { mockFetch } from "@/test-utils/fetch-mock";
import { AccountSettings } from "./account-settings";

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const profile: AccountProfileDto = {
  email: "lea@exemple.fr",
  firstName: "Léa",
  role: "CUSTOMER",
  twoFactorEnabled: false,
  createdAt: "2026-11-01T10:00:00.000Z",
};
const body = (call: { init?: RequestInit } | undefined) => JSON.parse(String(call?.init?.body)) as unknown;

beforeEach(() => router.refresh.mockClear());

describe("AccountSettings : informations", () => {
  it("enregistre le prénom, prévient l'en-tête et rafraîchit", async () => {
    const { calls } = mockFetch({ "/me/profile": { status: 200, body: profile } });
    const onAuth = vi.fn();
    window.addEventListener(AUTH_EVENT, onAuth);
    const user = userEvent.setup();
    render(<AccountSettings profile={profile} />);
    const input = screen.getByLabelText("Prénom (facultatif)");
    await user.clear(input);
    await user.type(input, "Léa-Rose");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(calls[0].init?.method).toBe("PATCH");
    expect(body(calls[0])).toEqual({ firstName: "Léa-Rose" });
    expect(await screen.findByText("Informations enregistrées.")).toBeInTheDocument();
    expect(onAuth).toHaveBeenCalledTimes(1);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_EVENT, onAuth);
  });

  it("prénom vidé : envoyé comme null", async () => {
    const { calls } = mockFetch({ "/me/profile": { status: 200, body: profile } });
    const user = userEvent.setup();
    render(<AccountSettings profile={profile} />);
    await user.clear(screen.getByLabelText("Prénom (facultatif)"));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(body(calls[0])).toEqual({ firstName: null });
  });

  it("erreur de l'API : message affiché, pas de rafraîchissement", async () => {
    mockFetch({ "/me/profile": { status: 500, body: { message: "Erreur serveur." } } });
    const user = userEvent.setup();
    render(<AccountSettings profile={profile} />);
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Erreur serveur.");
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("AccountSettings : email", () => {
  it("adresse invalide : erreur sans appel", async () => {
    const { calls } = mockFetch({});
    const user = userEvent.setup();
    render(<AccountSettings profile={profile} />);
    await user.type(screen.getByLabelText("Nouvelle adresse"), "pas-un-email");
    await user.click(screen.getByRole("button", { name: "Changer d'adresse" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("mot de passe refusé : erreur affichée et formulaire conservé", async () => {
    mockFetch({ "/me/email": { status: 401, body: { message: "Mot de passe incorrect." } } });
    const user = userEvent.setup();
    render(<AccountSettings profile={profile} />);
    await user.type(screen.getByLabelText("Nouvelle adresse"), "autre@exemple.fr");
    await user.type(screen.getByLabelText("Mot de passe actuel", { selector: "#emailPassword" }), "Ancien-mot-2026");
    await user.click(screen.getByRole("button", { name: "Changer d'adresse" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mot de passe incorrect.");
    expect(screen.getByRole("button", { name: "Changer d'adresse" })).toBeEnabled();
  });
});

describe("AccountSettings : mot de passe", () => {
  it("mot de passe trop faible : erreur de validation sans appel", async () => {
    const { calls } = mockFetch({});
    const user = userEvent.setup();
    render(<AccountSettings profile={profile} />);
    await user.type(screen.getByLabelText("Mot de passe actuel", { selector: "#currentPassword" }), "Ancien-mot-2026");
    await user.type(screen.getByLabelText("Nouveau mot de passe"), "court");
    await user.type(screen.getByLabelText("Confirmer le nouveau mot de passe"), "court");
    await user.click(screen.getByRole("button", { name: "Changer le mot de passe" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("refus de l'API : erreur affichée, aucun message de succès", async () => {
    mockFetch({ "/me/password": { status: 401, body: { message: "Mot de passe actuel incorrect." } } });
    const user = userEvent.setup();
    render(<AccountSettings profile={profile} />);
    await user.type(screen.getByLabelText("Mot de passe actuel", { selector: "#currentPassword" }), "Faux-mot-2026");
    await user.type(screen.getByLabelText("Nouveau mot de passe"), "Nouveau-mot-2026");
    await user.type(screen.getByLabelText("Confirmer le nouveau mot de passe"), "Nouveau-mot-2026");
    await user.click(screen.getByRole("button", { name: "Changer le mot de passe" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mot de passe actuel incorrect.");
    expect(screen.queryByText(/autres appareils ont été déconnectés/)).not.toBeInTheDocument();
  });
});

describe("AccountSettings : double authentification", () => {
  it("démarrage sans mot de passe : erreur sans appel", async () => {
    const { calls } = mockFetch({});
    const user = userEvent.setup();
    render(<AccountSettings profile={profile} />);
    await user.click(screen.getByRole("button", { name: "Activer la double authentification" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("démarrage refusé par l'API : erreur affichée", async () => {
    mockFetch({ "/me/2fa/setup": { status: 401, body: { message: "Mot de passe incorrect." } } });
    const user = userEvent.setup();
    render(<AccountSettings profile={profile} />);
    await user.type(screen.getByLabelText("Mot de passe actuel", { selector: "#tfPassword" }), "Faux-mot-2026");
    await user.click(screen.getByRole("button", { name: "Activer la double authentification" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mot de passe incorrect.");
  });

  async function reachCodeStep(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("Mot de passe actuel", { selector: "#tfPassword" }), "Ancien-mot-2026");
    await user.click(screen.getByRole("button", { name: "Activer la double authentification" }));
    await screen.findByRole("img", { name: /QR code/ });
  }

  it("code invalide : erreur sans appel ; code refusé par l'API : erreur affichée", async () => {
    const { calls } = mockFetch({
      "/me/2fa/setup": { body: { qrSvg: "<svg></svg>", secret: "JBSWY3DPEHPK3PXP" } },
      "/me/2fa/enable": { status: 400, body: { message: "Code incorrect." } },
    });
    const user = userEvent.setup();
    render(<AccountSettings profile={profile} />);
    await reachCodeStep(user);
    await user.type(screen.getByLabelText(/Code à 6 chiffres/), "12");
    await user.click(screen.getByRole("button", { name: "Activer" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(calls).toHaveLength(1);

    await user.clear(screen.getByLabelText(/Code à 6 chiffres/));
    await user.type(screen.getByLabelText(/Code à 6 chiffres/), "123456");
    await user.click(screen.getByRole("button", { name: "Activer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Code incorrect.");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("activation réussie : rafraîchit la page", async () => {
    mockFetch({
      "/me/2fa/setup": { body: { qrSvg: "<svg></svg>", secret: "JBSWY3DPEHPK3PXP" } },
      "/me/2fa/enable": { body: { ...profile, twoFactorEnabled: true } },
    });
    const user = userEvent.setup();
    render(<AccountSettings profile={profile} />);
    await reachCodeStep(user);
    await user.type(screen.getByLabelText(/Code à 6 chiffres/), "123456");
    await user.click(screen.getByRole("button", { name: "Activer" }));
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });

  it("désactivation : envoie mot de passe et code, puis rafraîchit", async () => {
    const { calls } = mockFetch({ "/me/2fa/disable": { status: 204 } });
    const user = userEvent.setup();
    render(<AccountSettings profile={{ ...profile, twoFactorEnabled: true }} />);
    expect(screen.getByText("Active.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Mot de passe actuel", { selector: "#tfPassword" }), "Ancien-mot-2026");
    await user.type(screen.getByLabelText(/Code à 6 chiffres/), "123 456");
    await user.click(screen.getByRole("button", { name: "Désactiver la double authentification" }));
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(body(calls[0])).toEqual({ currentPassword: "Ancien-mot-2026", code: "123456" });
  });

  it("désactivation sans code : erreur sans appel ; refus de l'API : erreur affichée", async () => {
    const { calls } = mockFetch({ "/me/2fa/disable": { status: 400, body: { message: "Code incorrect." } } });
    const user = userEvent.setup();
    render(<AccountSettings profile={{ ...profile, twoFactorEnabled: true }} />);
    await user.click(screen.getByRole("button", { name: "Désactiver la double authentification" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(calls).toHaveLength(0);

    await user.type(screen.getByLabelText("Mot de passe actuel", { selector: "#tfPassword" }), "Ancien-mot-2026");
    await user.type(screen.getByLabelText(/Code à 6 chiffres/), "654321");
    await user.click(screen.getByRole("button", { name: "Désactiver la double authentification" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Code incorrect.");
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
