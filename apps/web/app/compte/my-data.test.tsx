import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch } from "@/test-utils/fetch-mock";
import { MyData } from "./my-data";

beforeAll(() => {
  // jsdom ne gère pas encore <dialog> : on simule l'ouverture et la fermeture.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

describe("MyData (EF11)", () => {
  it("propose le téléchargement des données au format JSON", () => {
    render(<MyData />);
    const link = screen.getByRole("link", { name: "Télécharger mes données" });
    expect(link).toHaveAttribute("href", "/api/v1/me/data");
    expect(link).toHaveAttribute("download");
  });

  it("ouvre la confirmation puis la ferme avec Annuler", async () => {
    const user = userEvent.setup();
    const { container } = render(<MyData />);
    const dialog = container.querySelector("dialog")!;
    expect(dialog).not.toHaveAttribute("open");
    await user.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
    expect(dialog).toHaveAttribute("open");
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(dialog).not.toHaveAttribute("open");
  });

  it("suppression : envoie le mot de passe puis recharge vers l'accueil", async () => {
    const { calls } = mockFetch({ "/me/delete": { status: 204 } });
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    const user = userEvent.setup();
    render(<MyData />);
    await user.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
    await user.type(screen.getByLabelText("Mot de passe"), "Mon-mot-2026");
    await user.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/?compte=supprime"));
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ password: "Mon-mot-2026" });
    vi.unstubAllGlobals();
  });

  it("suppression refusée : affiche l'erreur et ne recharge pas", async () => {
    mockFetch({ "/me/delete": { status: 401, body: { message: "Mot de passe incorrect." } } });
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    const user = userEvent.setup();
    render(<MyData />);
    await user.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
    await user.type(screen.getByLabelText("Mot de passe"), "faux");
    await user.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mot de passe incorrect.");
    expect(assign).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
