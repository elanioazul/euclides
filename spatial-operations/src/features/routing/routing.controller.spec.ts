import { Test, TestingModule } from '@nestjs/testing';
import { RoutingController } from './routing.controller.js';
import { RoutingService } from './routing.service.js';

describe('RoutingController', () => {
  let controller: RoutingController;
  const routingService = { findAll: vi.fn(), findOne: vi.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoutingController],
      providers: [{ provide: RoutingService, useValue: routingService }],
    }).compile();

    controller = module.get<RoutingController>(RoutingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll returns the service summaries', async () => {
    const summaries = [{ id: 1, name: 'Walk', description: null, type: 'random', createdAt: new Date() }];
    routingService.findAll.mockResolvedValue(summaries);
    await expect(controller.findAll()).resolves.toBe(summaries);
  });

  it('findOne passes the parsed id to the service', async () => {
    const feature = { type: 'Feature', id: 3, geometry: { type: 'LineString', coordinates: [] }, properties: {} };
    routingService.findOne.mockResolvedValue(feature);
    await expect(controller.findOne(3)).resolves.toBe(feature);
    expect(routingService.findOne).toHaveBeenCalledWith(3);
  });
});
