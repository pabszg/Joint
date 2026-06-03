let storedProperties = {};

beforeEach(() => {
  storedProperties = {};
  PropertiesService.getUserProperties.mockReturnValue({
    getProperty: jest.fn((key) => storedProperties[key] || null),
    setProperty: jest.fn((key, value) => { storedProperties[key] = value; }),
    deleteProperty: jest.fn((key) => { delete storedProperties[key]; })
  });
});

const { getState, setState, clearState } = require('../src/StateService');

test('setState stores serialized state', () => {
  const state = { action: 'awaiting_confirmation', expense: { merchant: 'Zara' } };
  setState(123, state);
  const stored = JSON.parse(storedProperties['state_123']);
  expect(stored.data.action).toBe('awaiting_confirmation');
  expect(stored.data.expense.merchant).toBe('Zara');
});

test('getState returns null when no state stored', () => {
  expect(getState(123)).toBeNull();
});

test('getState returns stored state data', () => {
  const state = { action: 'awaiting_edit_field' };
  setState(123, state);
  expect(getState(123)).toMatchObject(state);
});

test('getState returns null when state is expired', () => {
  const expired = JSON.stringify({ data: { action: 'old' }, expiresAt: Date.now() - 1000 });
  storedProperties['state_123'] = expired;
  expect(getState(123)).toBeNull();
});

test('clearState removes the stored property', () => {
  setState(123, { action: 'awaiting_confirmation' });
  clearState(123);
  expect(storedProperties['state_123']).toBeUndefined();
});
