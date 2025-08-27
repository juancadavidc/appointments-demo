/**
 * @jest-environment jsdom
 */

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    rpc: jest.fn(),
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        })),
        order: jest.fn(() => ({
          eq: jest.fn()
        })),
        single: jest.fn()
      }))
    }))
  }))
}));

import { businessContext } from './business-context';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('Unified Business Context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentBusinessId', () => {
    it('should return null when no business ID is stored', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const result = businessContext.getCurrentBusinessId();
      
      expect(result).toBeNull();
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('current_business_id');
    });

    it('should return valid business ID when stored', () => {
      const validBusinessId = '12345678-1234-1234-1234-123456789abc';
      mockLocalStorage.getItem.mockReturnValue(validBusinessId);
      
      const result = businessContext.getCurrentBusinessId();
      
      expect(result).toBe(validBusinessId);
    });

    it('should clear invalid business ID and return null', () => {
      const invalidBusinessId = 'invalid-uuid';
      mockLocalStorage.getItem.mockReturnValue(invalidBusinessId);
      
      const result = businessContext.getCurrentBusinessId();
      
      expect(result).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('current_business_id');
    });

    it('should return null on server side (no window)', () => {
      // Temporarily remove window
      const originalWindow = global.window;
      // @ts-expect-error - intentionally setting to undefined for test
      global.window = undefined;
      
      const result = businessContext.getCurrentBusinessId();
      
      expect(result).toBeNull();
      
      // Restore window
      global.window = originalWindow;
    });
  });

  describe('hasBusinessContext', () => {
    it('should return true when business ID exists', () => {
      const validBusinessId = '12345678-1234-1234-1234-123456789abc';
      mockLocalStorage.getItem.mockReturnValue(validBusinessId);
      
      const result = businessContext.hasBusinessContext();
      
      expect(result).toBe(true);
    });

    it('should return false when no business ID exists', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const result = businessContext.hasBusinessContext();
      
      expect(result).toBe(false);
    });
  });

  describe('getBusinessContextInfo', () => {
    it('should return complete info when business ID exists', () => {
      const validBusinessId = '12345678-1234-1234-1234-123456789abc';
      mockLocalStorage.getItem.mockReturnValue(validBusinessId);
      
      const result = businessContext.getBusinessContextInfo();
      
      expect(result).toEqual({
        businessId: validBusinessId,
        isSet: true,
        isValid: true,
        source: 'localStorage'
      });
    });

    it('should return complete info when no business ID exists', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const result = businessContext.getBusinessContextInfo();
      
      expect(result).toEqual({
        businessId: null,
        isSet: false,
        isValid: false,
        source: 'none'
      });
    });
  });

  describe('getCurrentBusinessIdAsync', () => {
    it('should return cached business ID when valid', async () => {
      const validBusinessId = '12345678-1234-1234-1234-123456789abc';
      mockLocalStorage.getItem.mockReturnValue(validBusinessId);
      
      const result = await businessContext.getCurrentBusinessIdAsync();
      
      expect(result).toBe(validBusinessId);
    });

    it('should return null when autoSelect is false and no cached ID', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const result = await businessContext.getCurrentBusinessIdAsync({ autoSelect: false });
      
      expect(result).toBeNull();
    });
  });
});