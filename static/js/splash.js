document.addEventListener('DOMContentLoaded', function() {
  var splash  = document.getElementById('splashScreen');
  if (!splash) return;
  var bar     = document.getElementById('splashBar');
  var pct     = document.getElementById('splashPct');
  var msgEl   = document.getElementById('splashMsg');
  var msgKNEl = document.getElementById('splashMsgKN');
  var msgs    = ['Loading Karnataka foods...','Preparing AI engine...','Building nutrition data...','Ready!'];
  var msgsKN  = ['ಕರ್ನಾಟಕ ಆಹಾರ ಲೋಡ್ ಆಗುತ್ತಿದೆ...','AI ಎಂಜಿನ್ ತಯಾರಾಗುತ್ತಿದೆ...','ಪೋಷಣೆ ಡೇಟಾ ನಿರ್ಮಿಸಲಾಗುತ್ತಿದೆ...','ಸಿದ್ಧ!'];
  var progress = 0;

  function hideSplash() {
    splash.style.transition = 'opacity 0.6s ease';
    splash.style.opacity    = '0';
    setTimeout(function() {
      splash.style.display = 'none';
      if (typeof initHeroAnimations === 'function') {
        initHeroAnimations();
      }
    }, 600);
  }

  // Force hide after 3.5s no matter what
  setTimeout(hideSplash, 3500);

  var timer = setInterval(function() {
    progress += 15;
    if (progress > 100) progress = 100;
    if (bar)    bar.style.width      = progress + '%';
    if (pct)    pct.textContent      = Math.floor(progress) + '%';
    var idx = Math.min(Math.floor(progress / 25), msgs.length - 1);
    if (msgEl)   msgEl.textContent   = msgs[idx];
    if (msgKNEl) msgKNEl.textContent = msgsKN[idx];
    if (progress >= 100) {
      clearInterval(timer);
      setTimeout(hideSplash, 400);
    }
  }, 150);
});
