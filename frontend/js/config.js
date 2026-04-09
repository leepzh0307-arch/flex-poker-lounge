const config = {
  serverUrl: (typeof window !== 'undefined' && window.location.origin)
    ? window.location.origin
    : 'http://localhost:3000',

  agora: {
    appId: 'a1b2c3d4e5f6g7h8i9j0',
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