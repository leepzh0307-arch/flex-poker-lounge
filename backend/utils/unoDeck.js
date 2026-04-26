const COLORS = ['red', 'blue', 'green', 'yellow'];
const NUMBER_VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const SPECIAL_VALUES = ['skip', 'reverse', 'draw2'];
const WILD_VALUES = ['wild', 'wild_draw4'];

function generateUnoDeck() {
  const deck = [];
  let id = 0;

  for (const color of COLORS) {
    deck.push({ id: id++, color, value: '0', type: 'number' });

    for (let i = 1; i <= 9; i++) {
      deck.push({ id: id++, color, value: String(i), type: 'number' });
      deck.push({ id: id++, color, value: String(i), type: 'number' });
    }

    for (const special of SPECIAL_VALUES) {
      deck.push({ id: id++, color, value: special, type: 'action' });
      deck.push({ id: id++, color, value: special, type: 'action' });
    }
  }

  for (let i = 0; i < 4; i++) {
    deck.push({ id: id++, color: 'wild', value: 'wild', type: 'wild' });
    deck.push({ id: id++, color: 'wild', value: 'wild_draw4', type: 'wild' });
  }

  return deck;
}

function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function canPlayCard(card, topCard, currentColor) {
  if (card.type === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.value === topCard.value && card.type !== 'wild') return true;
  return false;
}

function getCardPoints(card) {
  if (card.type === 'number') return parseInt(card.value);
  if (card.type === 'action') return 20;
  if (card.type === 'wild') return 50;
  return 0;
}

function getCardImageName(card) {
  if (card.type === 'wild') {
    if (card.value === 'wild_draw4') return 'wild_draw';
    return 'wild';
  }
  const valueMap = {
    'skip': 'interdit',
    'reverse': 'revers',
    'draw2': 'draw2',
  };
  const valueStr = valueMap[card.value] || card.value;
  return `${card.color}_${valueStr}`;
}

module.exports = {
  generateUnoDeck,
  shuffleDeck,
  canPlayCard,
  getCardPoints,
  getCardImageName,
  COLORS,
  NUMBER_VALUES,
  SPECIAL_VALUES,
  WILD_VALUES,
};
