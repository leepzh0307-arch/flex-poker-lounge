const config = {
  serverUrl: 'https://flex-poker-backend.onrender.com',

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