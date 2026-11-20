import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { IsString, MaxLength, Matches } from 'class-validator';
import { CurrentUser, Roles } from '../auth/decorators';
import { Role, type AuthUser } from '../auth/roles';
import { ReasonsService } from './reasons.service';
export class ReasonDto {
  @IsString()
  @MaxLength(200)
  @Matches(/\S/)
  text!: string;
}
@Controller('reasons')
export class ReasonsController {
  constructor(private readonly reasons: ReasonsService) {}
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.reasons.list(user);
  }
}
@Controller('admin/reasons')
@Roles(Role.Admin)
export class AdminReasonsController {
  constructor(private readonly reasons: ReasonsService) {}
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.reasons.list(user, true);
  }
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: ReasonDto) {
    return this.reasons.create(user, body.text);
  }
  @Patch(':id')
  edit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReasonDto,
  ) {
    return this.reasons.edit(user, id, body.text);
  }
  @Delete(':id')
  deactivate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reasons.deactivate(user, id);
  }
}
