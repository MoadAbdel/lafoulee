import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch } from "@/test-utils/fetch-mock";
import { PrivacyRequestForm } from "./privacy-request-form";

const body = (call: { init?: RequestInit } | undefined) => JSON.parse(String(call?.init?.body)) as unknown;

describe("PrivacyRequestForm (EF11)", () => {
  it("adresse invalide : message d'erreur et aucun appel", async () => {
    const { calls } = mockFetch({});
    const user = userEvent.setup();
    render(<PrivacyRequestForm />);
    await user.type(screen.getByLabelText("Adresse email utilisée"), "pas-un-email");
    await user.click(screen.getByRole("button", { name: "Envoyer la demande" }));
    expect(screen.getByRole("alert")).toHaveTextContent("adresse email valide");
    expect(calls).toHaveLength(0);
  });

  it("demande d'accès par défaut, puis message neutre de confirmation", async () => {
    const { calls } = mockFetch({ "/privacy/requests": { status: 202 } });
    const user = userEvent.setup();
    render(<PrivacyRequestForm />);
    await user.type(screen.getByLabelText("Adresse email utilisée"), "lea@exemple.fr");
    await user.click(screen.getByRole("button", { name: "Envoyer la demande" }));
    expect(body(calls[0])).toEqual({ email: "lea@exemple.fr", type: "ACCESS" });
    expect(await screen.findByRole("status")).toHaveTextContent("Si cette adresse est connue");
  });

  it("demande d'effacement quand l'option est choisie", async () => {
    const { calls } = mockFetch({ "/privacy/requests": { status: 202 } });
    const user = userEvent.setup();
    render(<PrivacyRequestForm />);
    await user.type(screen.getByLabelText("Adresse email utilisée"), "lea@exemple.fr");
    await user.click(screen.getByLabelText("Effacer mes données"));
    await user.click(screen.getByRole("button", { name: "Envoyer la demande" }));
    expect(body(calls[0])).toEqual({ email: "lea@exemple.fr", type: "DELETION" });
  });

  it("erreur de l'API : affichée, le formulaire reste disponible", async () => {
    mockFetch({ "/privacy/requests": { status: 429 } });
    const user = userEvent.setup();
    render(<PrivacyRequestForm />);
    await user.type(screen.getByLabelText("Adresse email utilisée"), "lea@exemple.fr");
    await user.click(screen.getByRole("button", { name: "Envoyer la demande" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Trop de tentatives");
    expect(screen.getByRole("button", { name: "Envoyer la demande" })).toBeEnabled();
  });
});
