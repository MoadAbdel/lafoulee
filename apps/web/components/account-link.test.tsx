import { act, render, screen } from "@testing-library/react";
import { mockFetch } from "@/test-utils/fetch-mock";
import { notifyAuthChanged } from "@/lib/client-api";
import { AccountLink } from "./account-link";

describe("AccountLink", () => {
  it("visiteur : Connexion ; après connexion : Mon compte", async () => {
    mockFetch({ "/api/v1/auth/me": { status: 401, body: { message: "Non connecté" } } });
    render(<AccountLink />);
    expect(await screen.findByRole("link", { name: "Connexion" })).toHaveAttribute("href", "/connexion");

    mockFetch({ "/api/v1/auth/me": { body: { id: "u1", email: "lea@exemple.fr", role: "CUSTOMER" } } });
    act(() => notifyAuthChanged());
    expect(await screen.findByRole("link", { name: "Mon compte" })).toHaveAttribute("href", "/compte");
  });

  it("administrateur : lien vers le back-office", async () => {
    mockFetch({ "/api/v1/auth/me": { body: { id: "a1", email: "admin@exemple.fr", role: "ADMIN" } } });
    render(<AccountLink />);
    expect(await screen.findByRole("link", { name: "Back-office" })).toHaveAttribute("href", "/admin");
  });
});
