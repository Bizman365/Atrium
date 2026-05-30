import {
  Body,
  Controller,
  Post,
  BadRequestException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { randomUUID } from "node:crypto";
import { render } from "@react-email/render";
import { WelcomeEmail } from "@atrium/email";
import { Public } from "../common";
import { AuthService } from "../auth/auth.service";
import { BillingService } from "../billing/billing.service";
import { MailService } from "../mail/mail.service";
import { SignupDto } from "./signup.dto";
import { PrismaService } from "../prisma/prisma.service";

@Controller("onboarding")
@Public()
export class OnboardingController {
  constructor(
    private authService: AuthService,
    private billingService: BillingService,
    private config: ConfigService,
    private mail: MailService,
    private prisma: PrismaService,
    @InjectPinoLogger(OnboardingController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post("signup")
  @Throttle({ default: { ttl: 60000, limit: parseInt(process.env.SIGNUP_THROTTLE_LIMIT || "5", 10) } })
  async signup(
    @Body() body: SignupDto,
  ) {
    let workosUser;
    try {
      const [firstName, ...lastNameParts] = body.name.trim().split(/\s+/);
      workosUser = await this.authService.workos.userManagement.createUser({
        email: body.email,
        password: body.password,
        firstName: firstName || undefined,
        lastName: lastNameParts.length > 0 ? lastNameParts.join(" ") : undefined,
        emailVerified: false,
      });
    } catch (err) {
      this.logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        "WorkOS signup failed",
      );
      throw new BadRequestException("Signup failed");
    }

    const baseSlug = body.orgName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    // Append random suffix to avoid slug collisions from orgs with the same name
    const suffix = Math.random().toString(36).substring(2, 8);
    const slug = `${baseSlug}-${suffix}`;

    const { organization } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: randomUUID(),
          workosUserId: workosUser.id,
          name: body.name,
          email: body.email,
          emailVerified: false,
        },
      });

      const organization = await tx.organization.create({
        data: {
          id: randomUUID(),
          name: body.orgName,
          slug,
        },
      });

      await tx.member.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          organizationId: organization.id,
          role: "owner",
        },
      });

      return { organization };
    });

    await this.authService.seedOrganizationDefaults(organization.id);

    // Send welcome email (fire and forget)
    const webUrl = this.config.get("WEB_URL", "http://localhost:3000");
    render(
      WelcomeEmail({
        name: body.name,
        organizationName: body.orgName,
        portalUrl: `${webUrl}/dashboard`,
      }),
    )
      .then((html) =>
        this.mail.send(
          body.email,
          `Welcome to ${body.orgName}`,
          html,
        ),
      )
      .catch((err) => {
        this.logger.warn(
          { err },
          "Failed to send welcome email",
        );
      });

    // Create checkout session for paid plans
    const billingEnabled = this.config.get("BILLING_ENABLED", "false");
    if (billingEnabled === "true" && body.planSlug && body.planSlug !== "free") {
      try {
        const successUrl = `${webUrl}/setup?checkout=success`;
        const cancelUrl = `${webUrl}/setup?checkout=cancelled`;
        const result = await this.billingService.createCheckoutSession(
          organization.id,
          body.planSlug,
          successUrl,
          cancelUrl,
        );
        return { success: true, checkoutUrl: result.url };
      } catch (err) {
        this.logger.warn(
          { err, planSlug: body.planSlug, orgId: organization.id },
          "Failed to create checkout session during signup, falling back to free plan",
        );
      }
    }

    return { success: true };
  }
}
