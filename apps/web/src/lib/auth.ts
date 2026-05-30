import { withAuth } from "@workos-inc/authkit-nextjs";
import { prisma } from "./prisma";

export async function getSession() {
  try {
    const auth = await withAuth();
    if (!auth.user) return null;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { workosUserId: auth.user.id },
          { email: auth.user.email },
        ],
      },
    });

    if (!user) return null;

    const membership =
      (auth.organizationId
        ? await prisma.member.findFirst({
            where: { userId: user.id, organizationId: auth.organizationId },
            include: { organization: true },
          })
        : null) ??
      (await prisma.member.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { organization: true },
      }));

    return {
      user,
      session: {
        id: auth.sessionId,
        userId: user.id,
        activeOrganizationId: membership?.organizationId ?? auth.organizationId ?? null,
      },
      organization: membership?.organization ?? null,
      member: membership ?? null,
    };
  } catch {
    return null;
  }
}
