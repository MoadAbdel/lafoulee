import { redisPrefix } from "./redis-key.js";

describe("redisPrefix (isolation des environnements dans Redis)", () => {
  it("production, Preview (par branche), test et développement ont des préfixes distincts", () => {
    expect(redisPrefix({ VERCEL_ENV: "production" })).toBe("prod");
    expect(redisPrefix({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feat/commande" })).toBe(
      "preview:feat-commande",
    );
    expect(redisPrefix({ NODE_ENV: "test" })).toBe("test");
    expect(redisPrefix({})).toBe("dev");
  });
});
