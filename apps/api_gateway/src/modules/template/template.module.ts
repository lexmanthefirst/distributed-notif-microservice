import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { TemplateController } from "./template.controller";
import { TemplateService } from "./template.service";

@Module({
  imports: [HttpModule],
  controllers: [TemplateController],
  providers: [TemplateService],
})
export class TemplateModule {}
