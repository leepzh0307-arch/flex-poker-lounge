// 扑克牌生成和洗牌工具

// 生成一副完整的扑克牌
function generateDeck() {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];
  
  for (const suit of suits) {
    for (const value of values) {
      deck.push({
        suit: suit,
        value: value,
      });
    }
  }
  
  return deck;
}

// 洗牌算法
function shuffleDeck(deck) {
  const shuffled = [...deck];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

// 生成房间号
function generateRoomId() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let roomId = '';
  
  for (let i = 0; i < 6; i++) {
    roomId += chars[Math.floor(Math.random() * chars.length)];
  }
  
  return roomId;
}

// 导出函数
module.exports = {
  generateDeck,
  shuffleDeck,
  generateRoomId,
};