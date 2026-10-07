import { NotFoundException } from '@nestjs/common';
import { ModelsController } from './models.controller';
import { LearningService } from './learning.service';

describe('ModelsController', () => {
  let controller: ModelsController;
  let service: { activeModelParameters: jest.Mock };

  beforeEach(() => {
    service = {
      activeModelParameters: jest.fn(),
    };
    controller = new ModelsController(service as unknown as LearningService);
  });

  it('returns active parameters when an active model exists', async () => {
    const activeData = {
      version: 'bkt-em-20261007',
      source: 'postgres',
      method: 'Expectation-Maximisation',
      fittedAt: '2026-10-07T12:00:00.000Z',
      parameters: {
        'math5.fractions.add': { prior: 0.2, learn: 0.1, guess: 0.2, slip: 0.05 },
      },
      skills: {
        'math5.fractions.add': { prior: 0.2, learn: 0.1, guess: 0.2, slip: 0.05 },
      },
    };
    service.activeModelParameters.mockResolvedValue(activeData);

    const result = await controller.active();
    expect(result).toEqual(activeData);
    expect(service.activeModelParameters).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundException when no model is active', async () => {
    service.activeModelParameters.mockRejectedValue(new NotFoundException('No active model'));
    await expect(controller.active()).rejects.toThrow(NotFoundException);
  });
});
