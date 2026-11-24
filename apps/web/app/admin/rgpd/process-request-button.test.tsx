import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch } from "@/test-utils/fetch-mock";
import { ProcessRequestButton } from "./process-request-button";

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => router.refresh.mockClear());

describe("ProcessRequestButton (admin RGPD)", () => {
  it("demande d'accès : traite sans confirmation puis rafraîchit la liste", async () => {
    const { calls } = mockFetch({ "/admin/gdpr-requests/r1/process": { status: 204 } });
    const confirm = vi.spyOn(window, "confirm");
    const user = userEvent.setup();
    render(<ProcessRequestButton id="r1" type="ACCESS" />);
    await user.click(screen.getByRole("button", { name: "Envoyer la copie" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(calls[0].init?.method).toBe("POST");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("effacement : rien ne part si l'administrateur refuse la confirmation", async () => {
    const { calls } = mockFetch({});
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<ProcessRequestButton id="r2" type="DELETION" />);
    await user.click(screen.getByRole("button", { name: "Effacer les données" }));
    expect(calls).toHaveLength(0);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("effacement confirmé : appelle l'API", async () => {
    const { calls } = mockFetch({ "/admin/gdpr-requests/r2/process": { status: 204 } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<ProcessRequestButton id="r2" type="DELETION" />);
    await user.click(screen.getByRole("button", { name: "Effacer les données" }));
    expect(calls).toHaveLength(1);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("échec : affiche le message de l'API, sans rafraîchir", async () => {
    mockFetch({ "/process": { status: 409, body: { message: "Déjà traitée." } } });
    const user = userEvent.setup();
    render(<ProcessRequestButton id="r1" type="ACCESS" />);
    await user.click(screen.getByRole("button", { name: "Envoyer la copie" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Déjà traitée.");
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
