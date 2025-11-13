import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { SendEmailDto, SendPushDto } from "./dto";

@Controller("notifications")
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post("email")
  @HttpCode(HttpStatus.ACCEPTED)
  async sendEmail(@Body() sendEmailDto: SendEmailDto) {
    return this.notificationService.sendEmail(sendEmailDto);
  }

  @Post("push")
  @HttpCode(HttpStatus.ACCEPTED)
  async sendPush(@Body() sendPushDto: SendPushDto) {
    return this.notificationService.sendPush(sendPushDto);
  }

  @Get(":id/status")
  async getStatus(@Param("id") id: string) {
    return this.notificationService.getStatus(id);
  }
}
