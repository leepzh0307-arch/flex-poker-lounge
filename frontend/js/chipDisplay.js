var ChipDisplay = (function () {
  var SERIES = {
    1: {
      '0-20': 'images/chips/chip_series1_0%-20%.svg',
      '20-40': 'images/chips/chip_series1_20%-40%.svg',
      '40-70': 'images/chips/chip_series1_40%-70%.svg',
      '70-100': 'images/chips/chip_series1_70%-100%.svg',
    },
    2: {
      '0-20': 'images/chips/chip_series2_0%-20%.svg',
      '20-40': 'images/chips/chip_series2_20%-40%.svg',
      '40-70': 'images/chips/chip_series2_40%-70%.svg',
      '70-100': 'images/chips/chip_series2_70%-100%.svg',
    },
  };

  var currentSeries = 1;

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
  };
})();
