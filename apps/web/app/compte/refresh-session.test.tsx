import { render, screen, waitFor } from "@testing-library/react";
import { AUTH_EVENT } from "@/lib/client-api";
import { mockFetch } from "@/test-utils/fetch-mock";
import { RefreshSession } from "./refresh-session";

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => {
  router.refresh.mockClear();
  router.replace.mockClear();
});

describe("RefreshSession", () => {
  it("renouvelle la session, prévient l'en-tête et rafraîchit la page", async () => {
    const { calls } = mockFetch({ "/auth/refresh": { status: 204 } });
    const onAuth = vi.fn();
    window.addEventListener(AUTH_EVENT, onAuth);
    render(<RefreshSession />);
    expect(screen.getByRole("status")).toHaveTextContent("Reconnexion en cours");
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(calls[0].url).toBe("/api/v1/auth/refresh");
    expect(onAuth).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
    window.removeEventListener(AUTH_EVENT, onAuth);
  });

  it("renvoie vers la connexion si le rafraîchissement échoue", async () => {
    mockFetch({ "/auth/refresh": { status: 401, body: { message: "expiré" } } });
    render(<RefreshSession />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/connexion"));
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
