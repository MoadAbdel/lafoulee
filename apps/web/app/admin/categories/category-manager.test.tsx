import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminCategoryDto } from "@lafoulee/shared";
import { mockFetch } from "@/test-utils/fetch-mock";
import { CategoryManager } from "./category-manager";

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const categories: AdminCategoryDto[] = [
  { id: "c1", slug: "route", name: "Route", description: "Chaussures de route", position: 0, productCount: 3 },
  { id: "c2", slug: "trail", name: "Trail", description: "Sentiers", position: 1, productCount: 0 },
];
const body = (call: { init?: RequestInit } | undefined) => JSON.parse(String(call?.init?.body)) as unknown;

beforeEach(() => router.refresh.mockClear());

describe("CategoryManager (EA03)", () => {
  it("affiche le nombre de produits (pluriel) et bloque la suppression d'une catégorie utilisée", () => {
    mockFetch({});
    render(<CategoryManager categories={categories} />);
    expect(screen.getByText(/categorie=route : 3 produits/)).toBeInTheDocument();
    expect(screen.getByText(/categorie=trail : 0 produit$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Supprimer la catégorie Route" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Supprimer la catégorie Trail" })).toBeEnabled();
  });

  it("création : nom trop court refusé sans appel", async () => {
    const { calls } = mockFetch({});
    const user = userEvent.setup();
    render(<CategoryManager categories={categories} />);
    await user.click(screen.getByRole("button", { name: "Créer la catégorie" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("création : envoie les champs, vide le formulaire et rafraîchit", async () => {
    const { calls } = mockFetch({
      "/admin/categories": { status: 201, body: { ...categories[0], id: "c3", name: "Ville" } },
    });
    const user = userEvent.setup();
    render(<CategoryManager categories={categories} />);
    await user.type(document.getElementById("new-category-name")!, "Ville");
    await user.type(document.getElementById("new-category-description")!, "Usage urbain");
    await user.click(screen.getByRole("button", { name: "Créer la catégorie" }));
    expect(calls[0].init?.method).toBe("POST");
    expect(body(calls[0])).toMatchObject({ name: "Ville", description: "Usage urbain", position: 2 });
    expect(await screen.findByRole("status")).toHaveTextContent('Catégorie "Ville" créée.');
    expect(document.getElementById("new-category-name")).toHaveValue("");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("création refusée par l'API : message affiché, pas de rafraîchissement", async () => {
    mockFetch({ "/admin/categories": { status: 409, body: { message: "Cette catégorie existe déjà." } } });
    const user = userEvent.setup();
    render(<CategoryManager categories={categories} />);
    await user.type(document.getElementById("new-category-name")!, "Route");
    await user.type(document.getElementById("new-category-description")!, "Doublon");
    await user.click(screen.getByRole("button", { name: "Créer la catégorie" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("existe déjà");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("modification : n'envoie que les champs changés", async () => {
    const { calls } = mockFetch({ "/admin/categories/c2": { status: 200, body: {} } });
    const user = userEvent.setup();
    render(<CategoryManager categories={categories} />);
    const name = document.getElementById("name-c2")!;
    await user.clear(name);
    await user.type(name, "Trail running");
    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[1]);
    expect(calls[0].url).toBe("/api/v1/admin/categories/c2");
    expect(calls[0].init?.method).toBe("PATCH");
    expect(body(calls[0])).toEqual({ name: "Trail running" });
    expect(await screen.findByRole("status")).toHaveTextContent('Catégorie "Trail running" enregistrée.');
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("modification : rien de changé donne une erreur sans appel", async () => {
    const { calls } = mockFetch({});
    const user = userEvent.setup();
    render(<CategoryManager categories={categories} />);
    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("Aucune modification.");
    expect(calls).toHaveLength(0);
  });

  it("modification refusée par l'API : erreur affichée", async () => {
    mockFetch({ "/admin/categories/c2": { status: 500, body: { message: "Erreur serveur." } } });
    const user = userEvent.setup();
    render(<CategoryManager categories={categories} />);
    await user.type(document.getElementById("description-c2")!, " bis");
    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[1]);
    expect(await screen.findByRole("alert")).toHaveTextContent("Erreur serveur.");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("suppression : appelle DELETE puis rafraîchit", async () => {
    const { calls } = mockFetch({ "/admin/categories/c2": { status: 204 } });
    const user = userEvent.setup();
    render(<CategoryManager categories={categories} />);
    await user.click(screen.getByRole("button", { name: "Supprimer la catégorie Trail" }));
    expect(calls[0].init?.method).toBe("DELETE");
    expect(await screen.findByRole("status")).toHaveTextContent('Catégorie "Trail" supprimée.');
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("suppression refusée : erreur affichée", async () => {
    mockFetch({ "/admin/categories/c2": { status: 409, body: { message: "Catégorie non vide." } } });
    const user = userEvent.setup();
    render(<CategoryManager categories={categories} />);
    await user.click(screen.getByRole("button", { name: "Supprimer la catégorie Trail" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Catégorie non vide.");
  });
});
