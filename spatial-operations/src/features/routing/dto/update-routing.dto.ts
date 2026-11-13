import { PartialType } from '@nestjs/swagger';
import { CreateRoutingDto } from './create-routing.dto.js';

export class UpdateRoutingDto extends PartialType(CreateRoutingDto) {}
