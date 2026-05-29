import { forbidden, notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SessionLike = { user?: { id?: string } } | null;
type NavigationFns = {
  redirect: (path: string) => never;
  notFound: () => never;
  forbidden: () => never;
};
type StatusPrisma = {
  member: {
    findMany: (args: Record<string, unknown>) => Promise<Array<{ organizationId: string }>>;
  };
  organization: {
    findUnique: (args: Record<string, unknown>) => Promise<{ id: string; name: string; slug: string | null } | null>;
  };
  project: {
    findFirst: (args: Record<string, unknown>) => Promise<unknown>;
  };
};

export type StatusPageProject = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  organizationId: string;
  organization: { id: string; name: string; slug: string | null };
  clients: Array<{ id: string; user: { id: string; name: string; email: string } }>;
  updates: Array<{
    id: string;
    title: string | null;
    content: string;
    createdAt: Date;
  }>;
  comments: StatusComment[];
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    completedAt: Date | null;
    comments: StatusComment[];
    deliverables: Array<{
      id: string;
      title: string;
      type: string;
      url: string | null;
      file: { filename: string; url: string | null } | null;
    }>;
  }>;
};

export type StatusComment = {
  id: string;
  content: string;
  authorId: string;
  createdAt: Date;
};

type RawStatusProject = Omit<StatusPageProject, "organization">;

function statusSignInPath(slug: string): string {
  return `/portal/sign-in?callbackUrl=${encodeURIComponent(`/portal/status/${slug}`)}`;
}

async function findMemberVisibleProject(db: StatusPrisma, slug: string, userId: string) {
  const memberships = await db.member.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  const organizationIds = memberships.map((member) => member.organizationId);
  if (organizationIds.length === 0) return null;

  const project = (await db.project.findFirst({
    where: {
      slug,
      organizationId: { in: organizationIds },
    },
    include: {
      clients: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      updates: {
        where: { clientVisible: true },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, content: true, createdAt: true },
      },
      comments: {
        where: { clientVisible: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, content: true, authorId: true, createdAt: true },
      },
      tasks: {
        where: { clientVisible: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: {
          comments: {
            where: { clientVisible: true },
            orderBy: { createdAt: "asc" },
            select: { id: true, content: true, authorId: true, createdAt: true },
          },
          deliverables: {
            where: { clientVisible: true },
            orderBy: { createdAt: "asc" },
            include: {
              file: { select: { filename: true, url: true } },
            },
          },
        },
      },
    },
  })) as RawStatusProject | null;

  if (!project) return null;

  const organization = await db.organization.findUnique({
    where: { id: project.organizationId },
    select: { id: true, name: true, slug: true },
  });

  if (!organization) return null;

  return { ...project, organization } satisfies StatusPageProject;
}

export async function resolveStatusPageAccessWithDeps(
  slug: string,
  deps: {
    getSession: () => Promise<SessionLike>;
    prisma: StatusPrisma;
    navigation: NavigationFns;
  },
) {
  const session = await deps.getSession();
  const userId = session?.user?.id;

  if (!userId) {
    deps.navigation.redirect(statusSignInPath(slug));
  }

  const projectExists = await deps.prisma.project.findFirst({
    where: { slug },
    select: { id: true },
  });

  if (!projectExists) {
    deps.navigation.notFound();
  }

  const project = await findMemberVisibleProject(deps.prisma, slug, userId);

  if (!project) {
    deps.navigation.forbidden();
  }

  return { session, project };
}

export async function resolveStatusPageAccess(slug: string) {
  return resolveStatusPageAccessWithDeps(slug, {
    getSession,
    prisma: prisma as unknown as StatusPrisma,
    navigation: { redirect, notFound, forbidden },
  });
}

export async function loadStatusPageProject(slug: string): Promise<StatusPageProject> {
  const { project } = await resolveStatusPageAccess(slug);
  return project;
}

export function getProjectStats(project: Pick<StatusPageProject, "tasks">) {
  const tasksTotal = project.tasks.length;
  const completedTasks = project.tasks.filter((task) => task.completedAt || task.status === "done").length;
  const completionPercent = tasksTotal === 0 ? 0 : Math.round((completedTasks / tasksTotal) * 100);
  const deliverablesCount = project.tasks.reduce((sum, task) => sum + task.deliverables.length, 0);

  return {
    tasksTotal,
    completedTasks,
    completionPercent,
    deliverablesCount,
  };
}
