import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedRequest, AuthSession } from "../common";

export const DEFAULT_WORKOS_SESSION_COOKIE = "wos-session";
export const ACTIVE_ORG_COOKIE = "atrium-active-org";

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const authReq = req as Partial<
      Pick<AuthenticatedRequest, "user" | "session" | "organization" | "member">
    > &
      Request;

    try {
      const cookieName = this.authService.getWorkOSCookieName();
      const sessionData = req.cookies?.[cookieName] ?? req.cookies?.[DEFAULT_WORKOS_SESSION_COOKIE];
      if (!sessionData) return next();

      const sealedSession = this.authService.workos.userManagement.loadSealedSession({
        sessionData,
        cookiePassword: this.authService.getWorkOSCookiePassword(),
      });
      const workosSession = await sealedSession.authenticate();
      if (!workosSession.authenticated) return next();

      const user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { workosUserId: workosSession.user.id },
            { email: workosSession.user.email },
          ],
        },
      });

      // First WorkOS sign-in before local provisioning: leave req.user unset so
      // AuthGuard rejects. Phase 3 links/provisions Prisma users.
      if (!user) return next();

      authReq.user = user;
      authReq.session = {
        id: workosSession.sessionId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        token: workosSession.sessionId,
        createdAt: user.createdAt,
        updatedAt: new Date(),
        ipAddress: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
        userId: user.id,
        activeOrganizationId: null,
      } satisfies AuthSession;

      const memberships = await this.prisma.member.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: {
          organization: {
            include: { members: true },
          },
        },
      });

      if (memberships.length === 0) return next();

      const requestedOrgId = req.cookies?.[ACTIVE_ORG_COOKIE];
      const selectedMembership =
        memberships.find((membership) => membership.organizationId === requestedOrgId) ??
        memberships[0];

      authReq.member = selectedMembership;
      authReq.organization = selectedMembership.organization;
      authReq.session.activeOrganizationId = selectedMembership.organizationId;
    } catch {
      // Session resolution failed — continue without auth.
      // The AuthGuard will reject unauthenticated requests.
    }

    next();
  }
}
