var STATE_KEY_PREFIX = 'state_';
var STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function stateKey(chatId) {
  return STATE_KEY_PREFIX + chatId;
}

function getProperties() {
  return PropertiesService.getScriptProperties();
}

function getState(chatId) {
  var props = getProperties();
  var raw = props.getProperty(stateKey(chatId));
  if (!raw) return null;
  var stored;
  try {
    stored = JSON.parse(raw);
  } catch (e) {
    props.deleteProperty(stateKey(chatId));
    return null;
  }
  if (Date.now() > stored.expiresAt) {
    props.deleteProperty(stateKey(chatId));
    return null;
  }
  return stored.data;
}

function setState(chatId, data) {
  var props = getProperties();
  var stored = {
    data: data,
    expiresAt: Date.now() + STATE_TTL_MS
  };
  props.setProperty(stateKey(chatId), JSON.stringify(stored));
}

function clearState(chatId) {
  getProperties().deleteProperty(stateKey(chatId));
}

if (typeof module !== 'undefined') {
  module.exports = { getState, setState, clearState };
}
