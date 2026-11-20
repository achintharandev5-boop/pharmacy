import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators';
import { Role } from '../auth/roles';
import { AuditService } from './audit.service';
import { ListAuditLogQueryDto } from './dto/list-audit-log.dto';

/**
 * Audit log viewer. Administrators only, enforced here for every route. Read-only: there is no
 * route that creates, changes or deletes an audit event.
 */
@Controller('admin/audit-log')
@Roles(Role.Admin)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() query: ListAuditLogQueryDto) {
    return this.audit.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.audit.get(id);
  }
}
