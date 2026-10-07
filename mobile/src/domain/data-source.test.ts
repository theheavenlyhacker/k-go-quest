import { describe, expect, it } from 'vitest';
import { dataSource } from './data-source';

describe('dataSource', () => {
  it('goes live when an API address is configured', () => {
    expect(dataSource(undefined, 'https://api.example.ph')).toBe('live');
  });
  it('keeps fixtures for tests and offline demos', () => {
    expect(dataSource(undefined, undefined)).toBe('fixture');
    expect(dataSource(undefined, '  ')).toBe('fixture');
  });
  it('lets the switch override the address, either way', () => {
    expect(dataSource('fixture', 'https://api.example.ph')).toBe('fixture');
    expect(dataSource('LIVE', undefined)).toBe('live');
  });
});
