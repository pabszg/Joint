let storedProperties = {};

beforeEach(() => {
  storedProperties = {};
  PropertiesService.getScriptProperties = jest.fn().mockReturnValue({
    getProperty: jest.fn((key) => storedProperties[key] || null),
    setProperty: jest.fn((key, value) => { storedProperties[key] = value; }),
    deleteProperty: jest.fn((key) => { delete storedProperties[key]; })
  });
});

const { getState, setState, clearState } = require('../src/StateService');

test('setState stores state retrievable by getState', () => {
  const state = { action: 'awaiting_confirmation', expense: { merchant: 'Zara' } };
  setState(123, state);
  const retrieved = getState(123);
  expect(retrieved.action).toBe('awaiting_confirmation');
  expect(retrieved.expense.merchant).toBe('Zara');
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

test('state is isolated between different chatIds', () => {
  setState(111, { action: 'awaiting_confirmation' });
  expect(getState(222)).toBeNull();
});
