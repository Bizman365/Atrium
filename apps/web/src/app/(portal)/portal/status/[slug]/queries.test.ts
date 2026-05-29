import { describe, expect, test } from "bun:test";
import { resolveStatusPageAccessWithDeps } from "./queries";

function nav() {
  return {
    redirect: (path: string): never => {
      throw Object.assign(new Error("redirect"), { kind: "redirect", path });
    },
    notFound: (): never => {
      throw Object.assign(new Error("not-found"), { kind: "not-found" });
    },
    forbidden: (): never => {
      throw Object.assign(new Error("forbidden"), { kind: "forbidden" });
    },
  };
}

function basePrisma(projectFindFirst: () => Promise<unknown>) {
  return {
    member: { findMany: async () => [{ organizationId: "org-1" }] },
    organization: { findUnique: async () => ({ id: "org-1", name: "CSP", slug: "csp" }) },
    project: { findFirst: projectFindFirst },
  };
}

describe("client portal status access", () => {
  test("redirects unauthenticated requests to client sign-in", async () => {
    const deps = {
      getSession: async () => null,
      prisma: basePrisma(async () => null),
      navigation: nav(),
    };

    await expect(resolveStatusPageAccessWithDeps("csp-it-onboarding-may-2026", deps)).rejects.toMatchObject({
      kind: "redirect",
      path: "/portal/sign-in?callbackUrl=%2Fportal%2Fstatus%2Fcsp-it-onboarding-may-2026",
    });
  });

  test("returns 404 if slug does not exist", async () => {
    const deps = {
      getSession: async () => ({ user: { id: "user-1" } }),
      prisma: basePrisma(async () => null),
      navigation: nav(),
    };

    await expect(resolveStatusPageAccessWithDeps("missing", deps)).rejects.toMatchObject({ kind: "not-found" });
  });

  test("returns 403 if user is not a member of the project organization", async () => {
    let calls = 0;
    const deps = {
      getSession: async () => ({ user: { id: "user-1" } }),
      prisma: {
        member: { findMany: async () => [] },
        organization: { findUnique: async () => ({ id: "org-1", name: "CSP", slug: "csp" }) },
        project: {
          findFirst: async () => {
            calls += 1;
            return calls === 1 ? { id: "project-1" } : null;
          },
        },
      },
      navigation: nav(),
    };

    await expect(resolveStatusPageAccessWithDeps("existing", deps)).rejects.toMatchObject({ kind: "forbidden" });
  });
});
