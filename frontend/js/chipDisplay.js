var ChipDisplay = (function () {
  var SERIES = {
    1: {
      '0-20': 'images/chips/chip_series1_0%25-20%25.svg',
      '20-40': 'images/chips/chip_series1_20%25-40%25.svg',
      '40-70': 'images/chips/chip_series1_40%25-70%25.svg',
      '70-100': 'images/chips/chip_series1_70%25-100%25.svg',
    },
    2: {
      '0-20': 'images/chips/chip_series2_0%25-20%25.svg',
      '20-40': 'images/chips/chip_series2_20%25-40%25.svg',
      '40-70': 'images/chips/chip_series2_40%25-70%25.svg',
      '70-100': 'images/chips/chip_series2_70%25-100%25.svg',
    },
  };

  var currentSeries = 1;

  var preloadedCache = {};

  function preloadAll() {
    Object.keys(SERIES).forEach(function (seriesId) {
      var tiers = SERIES[seriesId];
      Object.keys(tiers).forEach(function (tier) {
        var src = tiers[tier];
        if (!preloadedCache[src]) {
          var img = new Image();
          img.src = src;
          preloadedCache[src] = img;
        }
      });
    });
  }

  function getAllImagePaths() {
    var paths = [];
    Object.keys(SERIES).forEach(function (seriesId) {
      var tiers = SERIES[seriesId];
      Object.keys(tiers).forEach(function (tier) {
        paths.push(tiers[tier]);
      });
    });
    return paths;
  }

  function setSeries(series) {
    if (SERIES[series]) currentSeries = series;
  }

  function getSeries() {
    return currentSeries;
  }

  function getChipImage(betAmount, initialChips) {
    if (!initialChips || initialChips <= 0) return SERIES[currentSeries]['0-20'];
    var pct = (betAmount / initialChips) * 100;
    var tier;
    if (pct <= 20) tier = '0-20';
    else if (pct <= 40) tier = '20-40';
    else if (pct <= 70) tier = '40-70';
    else tier = '70-100';
    return SERIES[currentSeries][tier];
  }

  function createChipElement(betAmount, initialChips) {
    var container = document.createElement('div');
    container.className = 'chip-display';

    var img = document.createElement('img');
    img.src = getChipImage(betAmount, initialChips);
    img.className = 'chip-img';
    img.draggable = false;

    var label = document.createElement('span');
    label.className = 'chip-amount';
    label.textContent = betAmount;

    container.appendChild(img);
    container.appendChild(label);
    return container;
  }

  function updateChipElement(container, betAmount, initialChips) {
    if (!container) return;
    var img = container.querySelector('.chip-img');
    var label = container.querySelector('.chip-amount');
    if (img) img.src = getChipImage(betAmount, initialChips);
    if (label) label.textContent = betAmount;
  }

  return {
    setSeries: setSeries,
    getSeries: getSeries,
    getChipImage: getChipImage,
    createChipElement: createChipElement,
    updateChipElement: updateChipElement,
    preloadAll: preloadAll,
    getAllImagePaths: getAllImagePaths,
  };
})();
