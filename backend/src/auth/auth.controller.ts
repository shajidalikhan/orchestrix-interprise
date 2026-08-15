import { Controller, Post, Body, Get, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup-tenant')
  async signupTenant(
    @Body('companyName') companyName: string,
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    if (!companyName || !email || !password) {
      throw new BadRequestException('All fields (companyName, email, password) are required');
    }
    return this.authService.signupTenant(companyName, email, password);
  }

  @Post('signup-user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async signupUser(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('role') role?: string,
  ) {
    if (!email || !password) {
      throw new BadRequestException('All fields (email, password) are required');
    }
    return this.authService.signupUser(email, password, role);
  }

  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }
    return this.authService.login(email, password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    return user;
  }
}
