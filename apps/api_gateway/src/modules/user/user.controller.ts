import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { UserService } from "./user.service";
import { RegisterDto, LoginDto } from "./dto";

@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.userService.register(registerDto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.userService.login(loginDto);
  }

  @Get("health")
  async getHealth() {
    return this.userService.getHealth();
  }
}
