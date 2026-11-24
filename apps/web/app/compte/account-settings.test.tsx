import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AccountProfileDto } from "@lafoulee/shared";
import { mockFetch } from "@/test-utils/fetch-mock";
import { ForgotPasswordForm } from "../mot-de-passe-oublie/forgot-password-form";
import { ResetPasswordForm } from "../mot-de-passe/nouveau/reset-password-form";
import { AccountSettings } from "./account-settings";

const profile: AccountProfileDto = {
  email: "lea@exemple.fr",
  firstName: "Léa",
  role: "CUSTOMER",
  twoFactorEnabled: false,
  createdAt: "2026-11-01T10:00:00.000Z",
};
const body = (call: { init?: RequestInit } | undefined) => JSON.parse(String(call?.init?.body)) as unknown;

describe("AccountSettings (EF09)", () => {
  it("2FA conseillée tant qu'elle est inactive", () => {
    mockFetch({});
    render(<AccountSettings profile={profile} />);
    expect(screen.getByText(/activez la double authentification ci-dessous/)).toBeInTheDocument();
    render(<AccountSettings profile={{ ...profile, twoFactorEnabled: true }} />);
    expect(screen.getAllByText(/activez la double authentification ci-dessous/)).toHaveLength(1);
  });

  it("mot de passe : confirmation différente refusée sans appel ; changement envoyé", async () => {
    const { calls } = mockFetch({ "/me/password": { status: 204 } });
    const user = userEvent.setup();
    render(<AccountSettings profile={profile} />);
    await user.type(screen.getByLabelText("Mot de passe actuel", { selector: "#currentPassword" }), "Ancien-mot-2026");
    await user.type(screen.getByLabelText("Nouveau mot de passe"), "Nouveau-mot-2026");
    await user.type(screen.getByLabelText("Confirmer le nouveau mot de passe"), "Autre-mot-2026");
    await user.click(screen.getByRole("button", { name: "Changer le mot de passe" }));
    expect(screen.getByRole("alert")).toHaveTextContent("pas identiques");
    expect(calls).toHaveLength(0);

    await user.clear(screen.getByLabelText("Confirmer le nouveau mot de passe"));
    await user.type(screen.getByLabelText("Confirmer le nouveau mot de passe"), "Nouveau-mot-2026");
    await user.click(screen.getByRole("button", { name: "Changer le mot de passe" }));
    expect(body(calls[0])).toEqual({ currentPassword: "Ancien-mot-2026", newPassword: "Nouveau-mot-2026" });
    expect(await screen.findByText(/autres appareils ont été déconnectés/)).toBeInTheDocument();
  });

  it("email : la nouvelle adresse n'est active qu'après le lien", async () => {
    const { calls } = mockFetch({ "/me/email": { status: 202, body: { status: "CONFIRMATION_SENT" } } });
    const user = userEvent.setup();
    render(<AccountSettings profile={profile} />);
    await user.type(screen.getByLabelText("Nouvelle adresse"), "lea.nouvelle@exemple.fr");
    await user.type(screen.getByLabelText("Mot de passe actuel", { selector: "#emailPassword" }), "Ancien-mot-2026");
    await user.click(screen.getByRole("button", { name: "Changer d'adresse" }));
    expect(body(calls[0])).toEqual({ newEmail: "lea.nouvelle@exemple.fr", currentPassword: "Ancien-mot-2026" });
    expect(await screen.findByText(/lien de confirmation a été envoyé à lea.nouvelle@exemple.fr/)).toBeInTheDocument();
  });

  it("2FA : mot de passe, puis QR code et clé, puis code à 6 chiffres", async () => {
    const { calls } = mockFetch({
      "/me/2fa/setup": { body: { qrSvg: "<svg></svg>", secret: "JBSWY3DPEHPK3PXP" } },
      "/me/2fa/enable": { body: { ...profile, twoFactorEnabled: true } },
    });
    const user = userEvent.setup();
    render(<AccountSettings profile={profile} />);
    await user.type(screen.getByLabelText("Mot de passe actuel", { selector: "#tfPassword" }), "Ancien-mot-2026");
    await user.click(screen.getByRole("button", { name: "Activer la double authentification" }));
    expect(await screen.findByRole("img", { name: /QR code/ })).toBeInTheDocument();
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Code à 6 chiffres/), "123 456");
    await user.click(screen.getByRole("button", { name: "Activer" }));
    expect(body(calls[1])).toEqual({ code: "123456" });
  });

  it("administrateur : la 2FA ne peut pas être désactivée", () => {
    mockFetch({});
    render(<AccountSettings profile={{ ...profile, role: "ADMIN", twoFactorEnabled: true }} />);
    expect(screen.getByText(/obligatoire pour un compte administrateur/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Désactiver/ })).not.toBeInTheDocument();
  });
});

describe("Mot de passe oublié", () => {
  it("message identique, que le compte existe ou non", async () => {
    mockFetch({ "/auth/password/forgot": { status: 202, body: { status: "EMAIL_SENT_IF_ACCOUNT" } } });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText("Email"), "lea@exemple.fr");
    await user.click(screen.getByRole("button", { name: "Recevoir le lien" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Si cette adresse correspond à un compte");
  });

  it("nouveau mot de passe : lien incomplet signalé ; mot de passe enregistré avec le jeton du lien", async () => {
    window.history.replaceState(null, "", "/mot-de-passe/nouveau?token=court");
    const { calls } = mockFetch({ "/auth/password/reset": { status: 204 } });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("Nouveau mot de passe"), "Nouveau-mot-2026");
    await user.type(screen.getByLabelText("Confirmer le mot de passe"), "Nouveau-mot-2026");
    await user.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
    expect(screen.getByRole("alert")).toHaveTextContent("lien est incomplet");
    expect(calls).toHaveLength(0);

    window.history.replaceState(null, "", `/mot-de-passe/nouveau?token=${"a".repeat(43)}`);
    await user.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
    expect(body(calls[0])).toEqual({ token: "a".repeat(43), newPassword: "Nouveau-mot-2026" });
    expect(await screen.findByRole("status")).toHaveTextContent("Votre mot de passe est changé");
  });
});
