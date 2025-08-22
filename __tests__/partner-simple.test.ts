// Mock the Redis module first
jest.mock('../lib/redis', () => ({
  kv: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    lrange: jest.fn(),
    lpush: jest.fn(),
    lrem: jest.fn(),
    ltrim: jest.fn(),
    incrby: jest.fn(),
    pipeline: jest.fn(() => ({
      get: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      lrem: jest.fn().mockReturnThis(),
      lpush: jest.fn().mockReturnThis(),
      ltrim: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    })),
  },
}));

// Mock external API calls
jest.mock('../lib/vercel/marketplace-api', () => ({
  getInvoice: jest.fn(),
  importResource: jest.fn(),
}));

import {
  listInstallations,
  getInstallation,
  getResource,
} from '../lib/partner';
import { kv } from '../lib/redis';

const mockKv = kv as jest.Mocked<typeof kv>;

describe('Partner Integration - Key Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Installation Management', () => {
    it('should list installations', async () => {
      const installationIds = ['install1', 'install2', 'install3'];
      mockKv.lrange.mockResolvedValue(installationIds);

      const result = await listInstallations();

      expect(mockKv.lrange).toHaveBeenCalledWith('installations', 0, -1);
      expect(result).toEqual(installationIds);
    });

    it('should get installation details', async () => {
      const installation = {
        type: 'marketplace',
        installationId: 'test-installation',
        userId: 'test-user',
        teamId: 'test-team',
        billingPlanId: 'default',
      };
      mockKv.get.mockResolvedValue(installation);

      const result = await getInstallation('test-installation');

      expect(mockKv.get).toHaveBeenCalledWith('test-installation');
      expect(result).toEqual(installation);
    });

    it('should throw error for missing installation', async () => {
      mockKv.get.mockResolvedValue(null);

      await expect(getInstallation('missing-installation'))
        .rejects.toThrow("Installation 'missing-installation' not found");
    });
  });

  describe('Resource Management', () => {
    it('should get a resource', async () => {
      const serializedResource = {
        id: 'resource-123',
        name: 'Test Resource',
        status: 'ready',
        productId: 'test-product',
        metadata: {},
        billingPlan: 'default',
      };
      mockKv.get.mockResolvedValue(serializedResource);

      const result = await getResource('test-installation', 'resource-123');

      expect(mockKv.get).toHaveBeenCalledWith('test-installation:resource:resource-123');
      expect(result).toMatchObject({
        id: 'resource-123',
        name: 'Test Resource',
        status: 'ready',
        billingPlan: expect.objectContaining({ id: 'default' }),
      });
    });

    it('should return null for missing resource', async () => {
      mockKv.get.mockResolvedValue(null);

      const result = await getResource('test-installation', 'missing-resource');

      expect(result).toBeNull();
    });
  });
});