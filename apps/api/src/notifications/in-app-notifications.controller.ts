import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard, CurrentOrg, CurrentUser } from "../common";
import { InAppNotificationsService } from "./in-app-notifications.service";
import { ListNotificationsDto } from "./in-app-notifications.dto";

@Controller("notifications")
@UseGuards(AuthGuard)
export class InAppNotificationsController {
  constructor(private readonly inApp: InAppNotificationsService) {}

  @Get()
  list(
    @Query() dto: ListNotificationsDto,
    @CurrentUser("id") userId: string,
    @CurrentOrg("id") orgId: string,
  ) {
    return this.inApp.findByUser(
      userId,
      orgId,
      dto.page,
      dto.limit,
    );
  }

  @Get("unread-count")
  async unreadCount(
    @CurrentUser("id") userId: string,
    @CurrentOrg("id") orgId: string,
  ) {
    const count = await this.inApp.unreadCount(
      userId,
      orgId,
    );
    return { count };
  }

  @Patch("read-all")
  markAllRead(
    @CurrentUser("id") userId: string,
    @CurrentOrg("id") orgId: string,
  ) {
    return this.inApp.markAllRead(userId, orgId);
  }

  @Patch(":id/read")
  markRead(
    @Param("id") id: string,
    @CurrentUser("id") userId: string,
    @CurrentOrg("id") orgId: string,
  ) {
    return this.inApp.markRead(id, userId, orgId);
  }
}
