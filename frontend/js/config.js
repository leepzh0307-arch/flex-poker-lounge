const config = {
  serverUrl: (function() {
    const host = (typeof window !== 'undefined' && window.location.host) || '';
    if (host.includes('flex-poker-lounge')) {
      return 'https://api.' + host;
    }
    return 'https://flex-poker-backend.onrender.com';
  })(),

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