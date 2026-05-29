import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../packages/database/src";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("authenticated org member can view project status with tasks and deliverables", async ({ page, request }) => {
  const sessionRes = await request.get("http://localhost:3001/api/auth/get-session");
  expect(sessionRes.ok()).toBeTruthy();
  const session = await sessionRes.json();
  const userId = session.user.id as string;

  const member = await prisma.member.findFirstOrThrow({
    where: { userId },
    include: { organization: true },
  });

  const stamp = Date.now();
  const project = await prisma.project.create({
    data: {
      name: `CSP Status E2E ${stamp}`,
      description: "Client-visible status page fixture.",
      status: "complete",
      slug: `csp-status-e2e-${stamp}`,
      source: "e2e",
      organizationId: member.organizationId,
      completedAt: new Date(),
      tasks: {
        create: [
          {
            title: "Confirm authenticated project access",
            description: "This row should be visible in the editorial client view.",
            status: "done",
            order: 1,
            clientVisible: true,
            organizationId: member.organizationId,
            completedAt: new Date(),
            deliverables: {
              create: [
                {
                  title: "Client-facing evidence link",
                  type: "link",
                  url: "https://pexlo.com",
                  clientVisible: true,
                  organizationId: member.organizationId,
                  createdById: userId,
                },
              ],
            },
          },
        ],
      },
    },
  });

  await page.goto(`/portal/status/${project.slug}`);

  await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
  await expect(page.getByText(member.organization.name)).toBeVisible();
  await expect(page.getByText("Confirm authenticated project access")).toBeVisible();
  await expect(page.getByText("Client-facing evidence link")).toBeVisible();
});
