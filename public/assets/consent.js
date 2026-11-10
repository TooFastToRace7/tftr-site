/* Cookie choice banner and Google Analytics 4 loader for toofasttorace.com.
   Google Analytics is loaded only after the visitor clicks Accept.
   The choice is remembered in this browser under the key "tftr_consent".
   Any link or button with the attribute data-cookie-settings reopens the banner. */
(function () {
  var GA_ID = 'G-HXERKP0VH9';
  var KEY = 'tftr_consent';
  var loaded = false;
  var banner = null;

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(value) { try { localStorage.setItem(KEY, value); } catch (e) {} }

  function loadAnalytics() {
    window['ga-disable-' + GA_ID] = false;
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted'
    });
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }

  function stopAnalytics() {
    window['ga-disable-' + GA_ID] = true;
    var parts = location.hostname.split('.');
    var domains = [''];
    for (var i = 0; i < parts.length - 1; i++) {
      domains.push('; domain=.' + parts.slice(i).join('.'));
    }
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (name.indexOf('_ga') !== 0) return;
      domains.forEach(function (d) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d;
      });
    });
  }

  function hideBanner() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    banner = null;
  }

  function choose(value) {
    write(value);
    hideBanner();
    if (value === 'granted') loadAnalytics(); else stopAnalytics();
  }

  function showBanner() {
    if (banner) return;
    if (!document.getElementById('tftr-cc-style')) {
      var style = document.createElement('style');
      style.id = 'tftr-cc-style';
      style.textContent =
        '.tftr-cc{position:fixed;left:0;right:0;bottom:0;z-index:1000;background:#111;border-top:2px solid #5CB85C;color:#fff;font:400 15px/1.45 "Barlow",system-ui,sans-serif}' +
        '.tftr-cc-in{max-width:1400px;margin:0 auto;padding:14px clamp(16px,3.4vw,48px);display:flex;flex-wrap:wrap;align-items:center;gap:12px 24px}' +
        '.tftr-cc p{margin:0;flex:1 1 320px;color:#fff}' +
        '.tftr-cc a{color:#7DCC7D;text-decoration:underline}' +
        '.tftr-cc-btns{display:flex;gap:10px;flex:none}' +
        '.tftr-cc button{font:600 14px/1 "Barlow Condensed","Arial Narrow",sans-serif;letter-spacing:.08em;text-transform:uppercase;padding:12px 22px;min-width:110px;border:2px solid #5CB85C;border-radius:0;background:#5CB85C;color:#0a0a0a;cursor:pointer}' +
        '.tftr-cc button:hover,.tftr-cc button:focus-visible{background:#7DCC7D;border-color:#7DCC7D}';
      document.head.appendChild(style);
    }
    banner = document.createElement('div');
    banner.className = 'tftr-cc';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie choice');
    banner.innerHTML =
      '<div class="tftr-cc-in">' +
      '<p>We would like to use Google Analytics cookies to see how this site is used. Nothing is set unless you accept. <a href="/privacy/">Privacy and cookies</a></p>' +
      '<div class="tftr-cc-btns">' +
      '<button type="button" data-cc="denied">Decline</button>' +
      '<button type="button" data-cc="granted">Accept</button>' +
      '</div></div>';
    banner.addEventListener('click', function (e) {
      var value = e.target && e.target.getAttribute && e.target.getAttribute('data-cc');
      if (value) choose(value);
    });
    document.body.appendChild(banner);
  }

  function start() {
    var choice = read();
    if (choice === 'granted') loadAnalytics();
    else if (choice !== 'denied') showBanner();
    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-cookie-settings]') : null;
      if (!el) return;
      e.preventDefault();
      showBanner();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
