import { withStrictSsl } from "./prisma.service.js";

describe("withStrictSsl", () => {
  it("passe sslmode=require en verify-full", () => {
    expect(withStrictSsl("postgresql://u:p@h/db?sslmode=require&channel_binding=require")).toBe(
      "postgresql://u:p@h/db?sslmode=verify-full&channel_binding=require",
    );
  });

  it("ne touche pas une URL locale sans sslmode", () => {
    expect(withStrictSsl("postgresql://u:p@localhost:5433/db")).toBe("postgresql://u:p@localhost:5433/db");
  });
});
