import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { UserModule } from "./modules/user/user.module";
import { TemplateModule } from "./modules/template/template.module";
import { NotificationModule } from "./modules/notification/notification.module";

@Module({
  imports: [UserModule, TemplateModule, NotificationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
