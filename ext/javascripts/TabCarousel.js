/**
 * TabCarousel - a Chrome extension to cycle through tabs.
 * Copyright (C) 2011-2012 Benjamin Oakes
 * 
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */
var TabCarousel = (function () {
  /** Module @namespace */
  var ns = {};

  /** @constant */
  ns.defaults = {
    /** Interval between tabs, in ms. */
    flipWait_ms: 15 * 1000,
    /** Interval between reloading a tab, in ms.  Let's not kill other people's servers with automated requests. */
    reloadWait_ms: 5 * 60 * 1000
  };

  /** English-language tutorial text for first run. */
  ns.tutorialText = [
    'First-Use Tutorial',
    '',
    'TabCarousel is simple:  open tabs you want to monitor throughout the day, then click the toolbar icon.  To stop, click the icon again.',
    '',
    'By default, TabCarousel will flip through your tabs every ' + String(ns.defaults.flipWait_ms / 1000) + ' s, reloading them every ' + String(ns.defaults.reloadWait_ms / 1000 / 60) + " min.  It's great on a unused display or TV.  Put Chrome in full-screen mode (F11, or cmd-shift-f on the Mac) and let it go.",
    '',
    'If you want to change how often TabCarousel flips through your tabs, right click on the toolbar icon and choose "Options".'
  ].join('\n');

  /**
   * Keep track of the last time a tab was refreshed so we can wait at least 5 minutes betweent refreshes.
   */
  ns.lastReloads_ms = {};

  /**
   * Reload the given tab, if it has been more than ns.reloadWait_ms ago since it's last been reloaded.
   * @function
   */
  ns.reload = function (tabId) {
    var now_ms = Date.now(),
      lastReload_ms = ns.lastReloads_ms[tabId];
    
    if (!lastReload_ms || (now_ms - lastReload_ms >= ns.defaults.reloadWait_ms)) {
      // If a tab fails reloading, the host shows up as chrome://chromewebdata/
      // Protocol chrome:// URLs can't be reloaded through script injection, but you can simulate a reload using tabs.update.
      chrome.tabs.get(tabId, function (t) { chrome.tabs.update(tabId, {url: t.url}) });
      ns.lastReloads_ms[tabId] = now_ms;
    }
  };

  /**
   * Select the given tab count, mod the number of tabs currently open.
   * @function
   * @seealso http://code.google.com/chrome/extensions/tabs.html
   * @seealso http://code.google.com/chrome/extensions/content_scripts.html#pi
   */
  ns.select = function (windowId, count) {
    chrome.tabs.getAllInWindow(windowId, function (tabs) {
      var tab = tabs[count % tabs.length],
        nextTab = tabs[(count + 1) % tabs.length];
      chrome.tabs.update(tab.id, {selected: true});
      ns.reload(nextTab.id);
    });
  };

  /**
   * Put the carousel into motion.
   * @function
   */
  ns.start = function (ms) {
    var continuation,
      count = 0,
      windowId; // window in which Carousel was started

    if (!ms) { ms = ns.flipWait_ms(); }
    chrome.windows.getCurrent(function (w) { windowId = w.id; });

    chrome.browserAction.setIcon({path: 'images/icon_32_exp_1.75_stop_emblem.png'});
    chrome.browserAction.setTitle({title: 'Stop Carousel'});

    continuation = function () {
      ns.select(windowId, count);
      count += 1;
      ns.lastTimeout = setTimeout(continuation, ms);
    };

    continuation();
  };

  /**
   * Is the carousel in motion?
   * @function
   */
  ns.running = function () {
    return !!ns.lastTimeout;
  };

  /**
   * Stop the carousel.
   * @function
   */
  ns.stop = function () {
    clearTimeout(ns.lastTimeout);
    ns.lastTimeout = undefined;
    chrome.browserAction.setIcon({path: 'images/icon_32.png'});
    chrome.browserAction.setTitle({title: 'Start Carousel'});
  };

  /**
   * Accessor for first run timestamp.
   * @function
   */
  ns.firstRun = function (value) {
    if (value) {
      localStorage['firstRun'] = value;
    } else {
      return !localStorage['firstRun'];
    }
  };

  /**
   * Accessor for user set flip wait timing or the default.
   * @function
   */
  ns.flipWait_ms = function (ms) {
    if (ms) {
      localStorage['flipWait_ms'] = ms;
    } else {
      return localStorage['flipWait_ms'] || ns.defaults.flipWait_ms;
    }
  };

  /**
   * Accessor for user set automatic start preference.
   * @function
   */
  ns.automaticStart = function (value) {
    if (1 === arguments.length) {
      localStorage['automaticStart'] = !!value;
    } else {
      if (localStorage['automaticStart']) {
        return JSON.parse(localStorage['automaticStart']);
      }
    }
  };

  /**
   * Display the first-run tutorial.
   * @function
   */
  ns.tutorial = function () {
    alert(ns.tutorialText);
    ns.firstRun(Date.now());
  };

  /**
   * Chrome browser action (toolbar button) click handler.
   * @function
   */
  ns.click = function () {
    var entry, ms, parsed;

    if (ns.firstRun()) { ns.tutorial(); }

    if (!ns.running()) {
      ns.start();
    } else {
      ns.stop();
    }
  };

  /**
   * Background page onLoad handler.
   * @function
   */
  ns.load = function () {
    chrome.browserAction.onClicked.addListener(ns.click);
    chrome.browserAction.setTitle({title: 'Start Carousel'});

    if (ns.automaticStart()) { ns.start(); }
  };

  /**
   * @constructor
   */
  ns.OptionsController = function (form) {
    this.form = form;
    this.form.flipWait_ms.value = ns.flipWait_ms();
    this.form.automaticStart.checked = ns.automaticStart();
    this.form.onsubmit = this.onsubmit;
  };

  ns.OptionsController.prototype = {
    /**
     * Save callback for Options form.  Keep in mind "this" is the form, not the controller.
     * @function
     */
    onsubmit: function () {
      var $this = $(this)

      $this.find('.alert').hide();

      ns.flipWait_ms(this.flipWait_ms.value);
      ns.automaticStart(this.automaticStart.checked);

      $this.find('.alert-success').show();

      return false;
    }
  };

  return ns;
}());

TabCarousel.components = (function () {
  // Hide the parent element.  Useful for "close" buttons.
  //
  // Unlike the built-in behavior for Bootstrap close buttons, this does **not** delete the content; it just hides it.
  function hideParent() {
    $(this).parent().hide();
  }

  return {
    init: function () {
      $('.close.hide-parent').click(hideParent);
    }
  };
}());