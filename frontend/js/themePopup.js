var ThemePopup = (function () {
  function show(onChange) {
    var existing = document.querySelector('.theme-popup-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'theme-popup-overlay';

    var popup = document.createElement('div');
    popup.className = 'theme-popup';
    popup.innerHTML = '<h3>主题设置</h3>';

    var tableSection = buildTableSection(onChange);
    var cardBackSection = buildCardBackSection(onChange);
    var chipSection = buildChipSection(onChange);

    popup.appendChild(tableSection);
    popup.appendChild(cardBackSection);
    popup.appendChild(chipSection);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'theme-popup-close';
    closeBtn.textContent = '关闭';
    closeBtn.addEventListener('click', function () {
      overlay.remove();
    });
    popup.appendChild(closeBtn);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
  }

  function buildTableSection(onChange) {
    var section = document.createElement('div');
    section.className = 'theme-section';

    var title = document.createElement('div');
    title.className = 'theme-section-title';
    title.textContent = '牌桌主题';
    section.appendChild(title);

    var options = document.createElement('div');
    options.className = 'theme-options';

    var themes = ThemeManager.getTableThemes();
    var currentTable = ThemeManager.getTableTheme();

    themes.forEach(function (t) {
      var btn = document.createElement('div');
      btn.className = 'theme-option-btn table-swatch ' + (t.id === 1 ? 'swatch-green' : 'swatch-blue');
      if (t.id === currentTable) btn.classList.add('active');

      var label = document.createElement('span');
      label.className = 'option-label';
      label.textContent = t.name;
      btn.appendChild(label);

      btn.addEventListener('click', function () {
        ThemeManager.setTableTheme(t.id);
        options.querySelectorAll('.theme-option-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        if (onChange) onChange('table', t.id);
      });

      options.appendChild(btn);
    });

    section.appendChild(options);
    return section;
  }

  function buildCardBackSection(onChange) {
    var section = document.createElement('div');
    section.className = 'theme-section';

    var title = document.createElement('div');
    title.className = 'theme-section-title';
    title.textContent = '牌背样式';
    section.appendChild(title);

    var options = document.createElement('div');
    options.className = 'theme-options';

    var backs = ThemeManager.getCardBacks();
    var currentBack = ThemeManager.getCardBackId();

    backs.forEach(function (b) {
      var btn = document.createElement('div');
      btn.className = 'theme-option-btn';
      if (b.id === currentBack) btn.classList.add('active');

      var img = document.createElement('img');
      img.src = b.back;
      img.alt = b.name;
      img.draggable = false;
      btn.appendChild(img);

      var label = document.createElement('span');
      label.className = 'option-label';
      label.textContent = b.name;
      btn.appendChild(label);

      btn.addEventListener('click', function () {
        ThemeManager.setCardBack(b.id);
        options.querySelectorAll('.theme-option-btn').forEach(function (ob) { ob.classList.remove('active'); });
        btn.classList.add('active');
        ThemeManager.applyCardBackTheme();
        if (onChange) onChange('cardBack', b.id);
      });

      options.appendChild(btn);
    });

    section.appendChild(options);
    return section;
  }

  function buildChipSection(onChange) {
    var section = document.createElement('div');
    section.className = 'theme-section';

    var title = document.createElement('div');
    title.className = 'theme-section-title';
    title.textContent = '筹码样式';
    section.appendChild(title);

    var options = document.createElement('div');
    options.className = 'theme-options';

    var chips = ThemeManager.getChipSeriesList();
    var currentChip = ThemeManager.getChipSeriesId();

    chips.forEach(function (c) {
      var btn = document.createElement('div');
      btn.className = 'theme-option-btn chip-swatch';
      if (c.id === currentChip) btn.classList.add('active');

      var img = document.createElement('img');
      img.src = 'images/chips/chip_series' + c.id + '_0%25-20%25.svg';
      img.alt = c.name;
      img.draggable = false;
      btn.appendChild(img);

      var label = document.createElement('span');
      label.className = 'option-label';
      label.textContent = c.name;
      btn.appendChild(label);

      btn.addEventListener('click', function () {
        ThemeManager.setChipSeries(c.id);
        options.querySelectorAll('.theme-option-btn').forEach(function (ob) { ob.classList.remove('active'); });
        btn.classList.add('active');
        if (onChange) onChange('chip', c.id);
      });

      options.appendChild(btn);
    });

    section.appendChild(options);
    return section;
  }

  return {
    show: show,
  };
})();
