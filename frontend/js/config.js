const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const config = {
  serverUrl: isLocalhost
    ? 'https://flex-poker-backend.onrender.com'
    : '',

  agora: {
    appId: '',
    channelPrefix: 'flex-poker-',
  },

  game: {
    startingChips: 1000,
    smallBlind: 10,
    bigBlind: 20,
  },

  ui: {
    animationDuration: 300,
  },
};

try { module.exports = config; } catch (e) {}