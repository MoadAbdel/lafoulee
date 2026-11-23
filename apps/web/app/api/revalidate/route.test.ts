import { revalidateTag } from "next/cache";
import { POST } from "./route";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const call = (authorization?: string) =>
  POST(
    new Request("https://lafoulee.vercel.app/api/revalidate", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    }),
  );

describe("POST /api/revalidate (invalidation du cache du catalogue)", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "secret-interne-de-test";
    vi.mocked(revalidateTag).mockClear();
  });

  it("refuse sans secret ou avec un mauvais secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer mauvais")).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("invalide l'étiquette catalog avec le bon secret", async () => {
    expect((await call("Bearer secret-interne-de-test")).status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("catalog", { expire: 0 });
  });

  it("refuse tout si le secret n'est pas configuré", async () => {
    delete process.env.CRON_SECRET;
    expect((await call("Bearer ")).status).toBe(401);
  });
});
