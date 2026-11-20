import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RoutingController } from './routing.controller.js';
import { RoutingService } from './routing.service.js';

describe('RoutingController', () => {
  let controller: RoutingController;
  const routingService = { findAll: vi.fn(), findOne: vi.fn(), update: vi.fn(), remove: vi.fn(), removeAll: vi.fn() };

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

  it('update passes the id and payload to the service', async () => {
    const summary = { id: 3, name: 'Renamed', description: null, type: 'random', createdAt: new Date() };
    routingService.update.mockResolvedValue(summary);
    await expect(controller.update(3, { name: 'Renamed' })).resolves.toBe(summary);
    expect(routingService.update).toHaveBeenCalledWith(3, { name: 'Renamed' });
  });

  it('remove passes the id to the service', async () => {
    routingService.remove.mockResolvedValue(undefined);
    await expect(controller.remove(3)).resolves.toBeUndefined();
    expect(routingService.remove).toHaveBeenCalledWith(3);
  });

  it('removeAll deletes every route when confirm is true', async () => {
    routingService.removeAll.mockResolvedValue(undefined);
    await expect(controller.removeAll(true)).resolves.toBeUndefined();
    expect(routingService.removeAll).toHaveBeenCalledTimes(1);
  });

  it('removeAll refuses with 400 when confirm is false', () => {
    routingService.removeAll.mockClear();
    expect(() => controller.removeAll(false)).toThrow(BadRequestException);
    expect(routingService.removeAll).not.toHaveBeenCalled();
  });
});
