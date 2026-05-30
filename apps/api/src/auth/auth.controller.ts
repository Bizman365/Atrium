import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedRequest } from "../common";
import { ACTIVE_ORG_COOKIE, DEFAULT_WORKOS_SESSION_COOKIE } from "./session.middleware";
import { AuthService } from "./auth.service";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

@Controller("auth")
export class AuthController {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  @Get("signin")
  signIn(@Res() res: Response) {
    const url = this.authService.workos.userManagement.getAuthorizationUrl({
      provider: "authkit",
      clientId: this.config.getOrThrow<string>("WORKOS_CLIENT_ID"),
      redirectUri: this.config.getOrThrow<string>("WORKOS_REDIRECT_URI"),
    });

    return res.redirect(302, url);
  }

  @Get("callback")
  async callback(
    @Query("code") code: string | undefined,
    @Res() res: Response,
  ) {
    if (!code) {
      throw new UnauthorizedException("Missing WorkOS authorization code");
    }

    const authentication = await this.authService.workos.userManagement.authenticateWithCode({
      code,
      clientId: this.config.getOrThrow<string>("WORKOS_CLIENT_ID"),
      session: {
        sealSession: true,
        cookiePassword: this.authService.getWorkOSCookiePassword(),
      },
    });

    if (!authentication.sealedSession) {
      throw new UnauthorizedException("WorkOS did not return a sealed session");
    }

    res.cookie(this.authService.getWorkOSCookieName(), authentication.sealedSession, {
      ...COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.redirect(302, "/portal");
  }

  @Get("get-session")
  getSession(@Req() req: AuthenticatedRequest) {
    if (!req.user || !req.session) return null;
    return {
      user: req.user,
      session: req.session,
      organization: req.organization ?? null,
      member: req.member ?? null,
    };
  }

  @Post("signout")
  @HttpCode(HttpStatus.OK)
  signOut(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    return this.clearSessionAndRedirect(req, res);
  }

  // Compatibility alias for existing web surfaces until Phase 2c removes legacy client calls.
  @Post("sign-out")
  @HttpCode(HttpStatus.OK)
  signOutAlias(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    return this.clearSessionAndRedirect(req, res);
  }

  @Get("organization/list")
  async listOrganizations(@Req() req: AuthenticatedRequest) {
    if (!req.user) throw new UnauthorizedException("Authentication required");
    const memberships = await this.prisma.member.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: { organization: true },
    });
    return memberships.map((membership) => membership.organization);
  }

  @Post("organization/set-active")
  @HttpCode(HttpStatus.OK)
  async setActiveOrganization(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { organizationId?: string },
  ) {
    if (!req.user) throw new UnauthorizedException("Authentication required");
    if (!body.organizationId) throw new UnauthorizedException("Organization required");

    const membership = await this.prisma.member.findFirst({
      where: { userId: req.user.id, organizationId: body.organizationId },
      select: { id: true },
    });
    if (!membership) throw new UnauthorizedException("Organization access required");

    res.cookie(ACTIVE_ORG_COOKIE, body.organizationId, {
      ...COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return { success: true };
  }

  @Get("organization/get-active-member")
  getActiveMember(@Req() req: AuthenticatedRequest) {
    if (!req.user) throw new UnauthorizedException("Authentication required");
    if (!req.member) throw new UnauthorizedException("Organization context required");
    return req.member;
  }

  @Get("organization/get-full-organization")
  getFullOrganization(@Req() req: AuthenticatedRequest) {
    if (!req.user) throw new UnauthorizedException("Authentication required");
    if (!req.organization) throw new UnauthorizedException("Organization context required");
    return req.organization;
  }

  @Post("send-verification-email")
  @HttpCode(HttpStatus.OK)
  async sendVerificationEmail(@Req() req: AuthenticatedRequest) {
    if (!req.user) throw new UnauthorizedException("Authentication required");

    const workosUserId = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { workosUserId: true },
    });

    if (!workosUserId?.workosUserId) {
      return { success: false, reason: "workos_user_not_linked" };
    }

    await this.authService.workos.userManagement.sendVerificationEmail({
      userId: workosUserId.workosUserId,
    });
    return { success: true };
  }

  private clearSessionAndRedirect(req: AuthenticatedRequest, res: Response) {
    res.clearCookie(this.authService.getWorkOSCookieName(), COOKIE_OPTIONS);
    res.clearCookie(DEFAULT_WORKOS_SESSION_COOKIE, COOKIE_OPTIONS);
    res.clearCookie(ACTIVE_ORG_COOKIE, COOKIE_OPTIONS);

    const sessionId = req.session?.id;
    if (!sessionId) {
      return res.redirect(302, "/");
    }

    const logoutUrl = this.authService.workos.userManagement.getLogoutUrl({
      sessionId,
      returnTo: this.config.get<string>("WEB_URL", "http://localhost:3000"),
    });
    return res.redirect(302, logoutUrl);
  }
}
