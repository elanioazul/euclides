import { Test, TestingModule } from '@nestjs/testing';
import { RoutingController } from './routing.controller.js';
import { RoutingService } from './routing.service.js';

describe('RoutingController', () => {
  let controller: RoutingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoutingController],
      providers: [{ provide: RoutingService, useValue: {} }],
    }).compile();

    controller = module.get<RoutingController>(RoutingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
