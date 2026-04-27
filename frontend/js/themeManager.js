var ThemeManager = (function () {
  var CARD_BACKS = [
    { id: 2, name: '风格2', back: 'images/Cards/card_back2.svg', pile: 'images/Cards/card_pile2.svg' },
    { id: 3, name: '风格3', back: 'images/Cards/card_back3.svg', pile: 'images/Cards/card_pile3.svg' },
    { id: 4, name: '风格4', back: 'images/Cards/card_back4.svg', pile: 'images/Cards/card_pile4.svg' },
    { id: 5, name: '风格5', back: 'images/Cards/card_back5.svg', pile: 'images/Cards/card_pile5.svg' },
    { id: 6, name: '风格6', back: 'images/Cards/card_back6.svg', pile: 'images/Cards/card_pile6.svg' },
    { id: 7, name: '风格7', back: 'images/Cards/card_back7.svg', pile: 'images/Cards/card_pile7.svg' },
    { id: 8, name: '风格8', back: 'images/Cards/card_back8.svg', pile: 'images/Cards/card_pile8.svg' },
    { id: 9, name: '风格9', back: 'images/Cards/card_back9.svg', pile: 'images/Cards/card_pile9.svg' },
  ];

  var TABLE_THEMES = [
    { id: 1, name: '经典绿' },
    { id: 2, name: '深海蓝' },
  ];

  var CHIP_SERIES = [
    { id: 1, name: '筹码系列1' },
    { id: 2, name: '筹码系列2' },
  ];

  var state = {
    tableTheme: 1,
    cardBackId: 2,
    chipSeries: 1,
  };

  function loadState() {
    try {
      var saved = localStorage.getItem('pokerThemeState');
      if (saved) {
        var parsed = JSON.parse(saved);
        if (parsed.tableTheme) state.tableTheme = parsed.tableTheme;
        if (parsed.cardBackId) state.cardBackId = parsed.cardBackId;
        if (parsed.chipSeries) state.chipSeries = parsed.chipSeries;
      }
    } catch (e) {}
  }

  function saveState() {
    try {
      localStorage.setItem('pokerThemeState', JSON.stringify(state));
    } catch (e) {}
  }

  function setTableTheme(id) {
    state.tableTheme = id;
    saveState();
  }

  function setCardBack(id) {
    state.cardBackId = id;
    saveState();
  }

  function setChipSeries(id) {
    state.chipSeries = id;
    if (typeof ChipDisplay !== 'undefined') {
      ChipDisplay.setSeries(id);
    }
    saveState();
  }

  function getCardBackSrc() {
    var item = CARD_BACKS.find(function (b) { return b.id === state.cardBackId; });
    return item ? item.back : CARD_BACKS[0].back;
  }

  function getCardPileSrc() {
    var item = CARD_BACKS.find(function (b) { return b.id === state.cardBackId; });
    return item ? item.pile : CARD_BACKS[0].pile;
  }

  function getTableTheme() {
    return state.tableTheme;
  }

  function getCardBackId() {
    return state.cardBackId;
  }

  function getChipSeriesId() {
    return state.chipSeries;
  }

  function getCardBacks() {
    return CARD_BACKS;
  }

  function getTableThemes() {
    return TABLE_THEMES;
  }

  function getChipSeriesList() {
    return CHIP_SERIES;
  }

  function applyCardBackTheme() {
    var backCards = document.querySelectorAll('.poker-card.back');
    var backSrc = getCardBackSrc();
    backCards.forEach(function (card) {
      var img = card.querySelector('.card-face-img');
      if (img && img.alt === 'card back') {
        img.src = backSrc;
      }
    });

    var pileSrc = getCardPileSrc();
    var pileImgs = document.querySelectorAll('.card-pile-img');
    pileImgs.forEach(function (img) {
      img.src = pileSrc;
    });
  }

  function applyChipSeries() {
    if (typeof ChipDisplay !== 'undefined') {
      ChipDisplay.setSeries(state.chipSeries);
    }
  }

  function applyAll() {
    applyCardBackTheme();
    applyChipSeries();
  }

  loadState();

  return {
    setTableTheme: setTableTheme,
    setCardBack: setCardBack,
    setChipSeries: setChipSeries,
    getCardBackSrc: getCardBackSrc,
    getCardPileSrc: getCardPileSrc,
    getTableTheme: getTableTheme,
    getCardBackId: getCardBackId,
    getChipSeriesId: getChipSeriesId,
    getCardBacks: getCardBacks,
    getTableThemes: getTableThemes,
    getChipSeriesList: getChipSeriesList,
    applyCardBackTheme: applyCardBackTheme,
    applyChipSeries: applyChipSeries,
    applyAll: applyAll,
  };
})();
