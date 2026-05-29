import { beforeEach, describe, expect, it, mock } from "bun:test";
import { AgentProjectsService } from "./agent-projects.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { AuditService } from "./services/audit.service";
import type { CurrentApiKeyContext } from "./decorators/current-api-key.decorator";

const apiKey = {
  id: "api_key_1",
  organizationId: "org_1",
  keyPrefix: "pxl_live_test",
  scopes: ["projects:write"],
} as unknown as CurrentApiKeyContext;

const audit = {
  writeAudit: mock(async ({ entityId }: { entityId: string }) => ({ id: `audit_${entityId}` })),
} as unknown as AuditService;

const prisma = {
  projectStatus: {
    findFirst: mock(async () => ({ id: "status_complete", slug: "complete", organizationId: "org_1" })),
  },
  member: {
    findFirst: mock(async () => null),
  },
  project: {
    findFirst: mock(async () => null),
    create: mock(async ({ data }: { data: Record<string, unknown> }) => ({ id: "project_1", clients: [], ...data })),
    update: mock(async ({ data }: { data: Record<string, unknown> }) => ({ id: "project_1", clients: [], ...data })),
  },
  projectClient: {
    deleteMany: mock(async () => ({ count: 0 })),
  },
  $transaction: mock(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
};

describe("AgentProjectsService", () => {
  let service: AgentProjectsService;

  beforeEach(() => {
    service = new AgentProjectsService(prisma as unknown as PrismaService, audit);
    prisma.projectStatus.findFirst.mockClear();
    prisma.member.findFirst.mockClear();
    prisma.project.findFirst.mockClear();
    prisma.project.create.mockClear();
    prisma.project.update.mockClear();
    prisma.projectClient.deleteMany.mockClear();
    prisma.$transaction.mockClear();
    (audit.writeAudit as ReturnType<typeof mock>).mockClear();
    prisma.projectStatus.findFirst.mockReturnValue(Promise.resolve({ id: "status_complete", slug: "complete", organizationId: "org_1" }));
  });

  it("stamps completedAt when creating a project with status complete", async () => {
    const result = await service.create({ name: "CSP Backfill", status: "complete" }, apiKey, "request_1");

    expect(result.created).toBe(true);
    const createArgs = prisma.project.create.mock.calls[0]?.[0];
    expect(createArgs.data.status).toBe("complete");
    expect(createArgs.data.completedAt).toBeInstanceOf(Date);
  });

  it("stamps completedAt when updating a project to status complete", async () => {
    prisma.project.findFirst.mockReturnValueOnce(Promise.resolve({
      id: "project_1",
      name: "CSP Backfill",
      organizationId: "org_1",
      status: "in_progress",
      completedAt: null,
      archivedAt: null,
      clients: [],
    }));

    const result = await service.update("project_1", { status: "complete" }, apiKey, "request_2");

    expect(result.created).toBe(false);
    const updateArgs = prisma.project.update.mock.calls[0]?.[0];
    expect(updateArgs.data.status).toBe("complete");
    expect(updateArgs.data.completedAt).toBeInstanceOf(Date);
  });
});
