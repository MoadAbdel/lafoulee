import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AUTH_EVENT } from "@/lib/client-api";
import { mockFetch } from "@/test-utils/fetch-mock";
import { LogoutButton } from "./logout-button";

describe("LogoutButton", () => {
  it("déconnecte, prévient l'en-tête et recharge la page d'accueil", async () => {
    const { calls } = mockFetch({ "/auth/logout": { status: 204 } });
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    const onAuth = vi.fn();
    window.addEventListener(AUTH_EVENT, onAuth);
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));

    expect(calls[0].url).toBe("/api/v1/auth/logout");
    expect(calls[0].init?.method).toBe("POST");
    expect(onAuth).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/");
    expect(screen.getByRole("button", { name: "Déconnexion..." })).toBeDisabled();
    window.removeEventListener(AUTH_EVENT, onAuth);
    vi.unstubAllGlobals();
  });
});
