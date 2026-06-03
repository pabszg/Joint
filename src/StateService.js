var STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getState(chatId) {
  var props = PropertiesService.getUserProperties();
  var raw = props.getProperty('state_' + chatId);
  if (!raw) return null;
  var stored = JSON.parse(raw);
  if (Date.now() > stored.expiresAt) {
    props.deleteProperty('state_' + chatId);
    return null;
  }
  return stored.data;
}

function setState(chatId, data) {
  var props = PropertiesService.getUserProperties();
  var stored = {
    data: data,
    expiresAt: Date.now() + STATE_TTL_MS
  };
  props.setProperty('state_' + chatId, JSON.stringify(stored));
}

function clearState(chatId) {
  PropertiesService.getUserProperties().deleteProperty('state_' + chatId);
}

if (typeof module !== 'undefined') {
  module.exports = { getState, setState, clearState };
}
