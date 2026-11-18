import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRoutingDto } from './dto/create-routing.dto.js';
import { UpdateRoutingDto } from './dto/update-routing.dto.js';
import { Route } from './entities/routing.entity.js';
import { SPATIALDB_CONNECTION } from '../../core/infrastructure/postgis/consts/database_constants.js';
import { InjectPostgis } from '../../core/infrastructure/postgis/postgis.decorator.js';
import { PostgisService } from '../../core/infrastructure/postgis/postgis.service.js';

@Injectable()
export class RoutingService {
  // Both share the spatialdb connection pool: repository for CRUD, postgis for raw PostGIS SQL
  constructor(
    @InjectRepository(Route, SPATIALDB_CONNECTION) private readonly routeRepository: Repository<Route>,
    @InjectPostgis(SPATIALDB_CONNECTION) private readonly postgis: PostgisService,
  ) {}

  create(createRoutingDto: CreateRoutingDto) {
    return 'This action adds a new routing';
  }

  findAll() {
    return `This action returns all routing`;
  }

  findOne(id: number) {
    return `This action returns a #${id} routing`;
  }

  update(id: number, updateRoutingDto: UpdateRoutingDto) {
    return `This action updates a #${id} routing`;
  }

  remove(id: number) {
    return `This action removes a #${id} routing`;
  }
}
