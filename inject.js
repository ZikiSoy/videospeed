var regStrip = /^[\r\t\f\v ]+|[\r\t\f\v ]+$/gm;

function debugConsole(message, details) {
  if (typeof tc === "undefined" || !tc.settings.debugLogging) {
    return;
  }

  var prefix = "[VideoSpeed Debug] ";
  if (details !== undefined) {
    console.error(prefix + message, details);
  } else {
    console.error(prefix + message);
  }
}

var tc = {
  settings: {
    lastSpeed: 1.0, 
    enabled: true, 
    speeds: {}, 

    displayKeyCode: 86, 
    rememberSpeed: false, 
    forceLastSavedSpeed: false, 
    audioBoolean: false, 
    startHidden: false, 
    debugLogging: false,
    controllerOpacity: 0.3, 
    keyBindings: [],
    blacklist: `\
      www.instagram.com
      twitter.com
      vine.co
      imgur.com
      teams.microsoft.com
    `.replace(regStrip, ""),
    defaultLogLevel: 4,
    logLevel: 3
  },

  mediaElements: []
};

/* Log levels 
  1  none
  2  error
  3  warning
  4  info
  5  debug
  6  debug high verbosity
*/
function log(message, level) {
  verbosity = tc.settings.logLevel;
  if (typeof level === "undefined") {
    level = tc.settings.defaultLogLevel;
  }
  if (verbosity >= level) {
    if (level === 2) {
      console.log("[VideoSpeed] ERROR:" + message);
    } else if (level === 3) {
      console.log("[VideoSpeed] WARNING:" + message);
    } else if (level === 4) {
      console.log("[VideoSpeed] INFO:" + message);
    } else if (level === 5) {
      console.log("[VideoSpeed] DEBUG:" + message);
    } else if (level === 6) {
      console.log("[VideoSpeed] DEBUG (VERBOSE):" + message);
      console.trace();
    }
  }
}

function getFrameContext() {
  try {
    return window === window.top ? "top" : "iframe";
  } catch (e) {
    return "iframe-cross-origin";
  }
}

function describeMediaElement(v) {
  return [
    v.nodeName,
    "src=" + (v.currentSrc || v.src || "none"),
    "readyState=" + v.readyState,
    "size=" + v.videoWidth + "x" + v.videoHeight,
    "client=" + v.clientWidth + "x" + v.clientHeight,
    "classes=" + (v.className || "none")
  ].join(", ");
}

function getRatioDebugState(v) {
  var computed = window.getComputedStyle(v);
  return [
    "inlineTransform=" + (v.style.transform || "empty"),
    "inlineScale=" + (v.style.scale || "empty"),
    "inlineObjectFit=" + (v.style.objectFit || "empty"),
    "inlineAspectRatio=" + (v.style.aspectRatio || "empty"),
    "computedTransform=" + computed.transform,
    "computedObjectFit=" + computed.objectFit,
    "computedAspectRatio=" + computed.aspectRatio,
    "client=" + v.clientWidth + "x" + v.clientHeight,
    "natural=" + v.videoWidth + "x" + v.videoHeight
  ].join(", ");
}

chrome.storage.sync.get(tc.settings, function (storage) {
  tc.settings.keyBindings = storage.keyBindings; 
  if (storage.keyBindings.length == 0) {
    
    tc.settings.keyBindings.push({
      action: "slower",
      key: Number(storage.slowerKeyCode) || 83,
      value: Number(storage.speedStep) || 0.1,
      force: false,
      predefined: true
    }); 
    tc.settings.keyBindings.push({
      action: "faster",
      key: Number(storage.fasterKeyCode) || 68,
      value: Number(storage.speedStep) || 0.1,
      force: false,
      predefined: true
    }); 
    tc.settings.keyBindings.push({
      action: "rewind",
      key: Number(storage.rewindKeyCode) || 90,
      value: Number(storage.rewindTime) || 10,
      force: false,
      predefined: true
    }); 
    tc.settings.keyBindings.push({
      action: "advance",
      key: Number(storage.advanceKeyCode) || 88,
      value: Number(storage.advanceTime) || 10,
      force: false,
      predefined: true
    }); 
    tc.settings.keyBindings.push({
      action: "reset",
      key: Number(storage.resetKeyCode) || 82,
      value: 1.0,
      force: false,
      predefined: true
    }); 
    tc.settings.keyBindings.push({
      action: "fast",
      key: Number(storage.fastKeyCode) || 71,
      value: Number(storage.fastSpeed) || 1.8,
      force: false,
      predefined: true
    }); 
    tc.settings.keyBindings.push({
      action: "resetRatio",
      key: 65,
      value: 0,
      force: false,
      predefined: true
    });
    tc.settings.version = "0.5.3";

    chrome.storage.sync.set({
      keyBindings: tc.settings.keyBindings,
      version: tc.settings.version,
      displayKeyCode: tc.settings.displayKeyCode,
      rememberSpeed: tc.settings.rememberSpeed,
      forceLastSavedSpeed: tc.settings.forceLastSavedSpeed,
      audioBoolean: tc.settings.audioBoolean,
      startHidden: tc.settings.startHidden,
      debugLogging: tc.settings.debugLogging,
      enabled: tc.settings.enabled,
      controllerOpacity: tc.settings.controllerOpacity,
      blacklist: tc.settings.blacklist.replace(regStrip, "")
    });
  }
  tc.settings.lastSpeed = Number(storage.lastSpeed);
  tc.settings.displayKeyCode = Number(storage.displayKeyCode);
  tc.settings.rememberSpeed = Boolean(storage.rememberSpeed);
  tc.settings.forceLastSavedSpeed = Boolean(storage.forceLastSavedSpeed);
  tc.settings.audioBoolean = Boolean(storage.audioBoolean);
  tc.settings.enabled = Boolean(storage.enabled);
  tc.settings.startHidden = Boolean(storage.startHidden);
  tc.settings.debugLogging = Boolean(storage.debugLogging);
  tc.settings.logLevel = tc.settings.debugLogging ? 5 : 3;
  tc.settings.controllerOpacity = Number(storage.controllerOpacity);
  tc.settings.blacklist = String(storage.blacklist);

  debugConsole("content script active", {
    href: location.href,
    readyState: document.readyState
  });
  debugConsole("storage loaded", {
    href: location.href,
    keyBindings: storage.keyBindings,
    enabled: storage.enabled
  });

  if (
    tc.settings.keyBindings.filter((x) => x.action == "display").length == 0
  ) {
    tc.settings.keyBindings.push({
      action: "display",
      key: Number(storage.displayKeyCode) || 86,
      value: 0,
      force: false,
      predefined: true
    }); 
  }

  if (
    tc.settings.keyBindings.filter((x) => x.action == "resetRatio").length == 0
  ) {
    tc.settings.keyBindings.push({
      action: "resetRatio",
      key: 65,
      value: 0,
      force: false,
      predefined: true
    });
  }

  log(
    "Loaded settings on " + location.hostname + " in " + getFrameContext() +
      ": enabled=" + tc.settings.enabled +
      ", bindings=" + JSON.stringify(tc.settings.keyBindings),
    5
  );

  initializeWhenReady(document);
});

function getKeyBindings(action, what = "value") {
  try {
    return tc.settings.keyBindings.find((item) => item.action === action)[what];
  } catch (e) {
    return false;
  }
}

function setKeyBindings(action, value) {
  tc.settings.keyBindings.find((item) => item.action === action)[
    "value"
  ] = value;
}

function defineVideoController() {
  tc.videoController = function (target, parent) {
    if (target.vsc) {
      return target.vsc;
    }

    tc.mediaElements.push(target);

    this.video = target;
    this.parent = target.parentElement || parent;
    storedSpeed = tc.settings.speeds[target.currentSrc];
    if (!tc.settings.rememberSpeed) {
      if (!storedSpeed) {
        log(
          "Overwriting stored speed to 1.0 due to rememberSpeed being disabled",
          5
        );
        storedSpeed = 1.0;
      }
      setKeyBindings("reset", getKeyBindings("fast")); 
    } else {
      log("Recalling stored speed due to rememberSpeed being enabled", 5);
      storedSpeed = tc.settings.lastSpeed;
    }

    log("Explicitly setting playbackRate to: " + storedSpeed, 5);
    target.playbackRate = storedSpeed;

    this.div = this.initializeControls();

    var mediaEventAction = function (event) {
      storedSpeed = tc.settings.speeds[event.target.currentSrc];
      if (!tc.settings.rememberSpeed) {
        if (!storedSpeed) {
          log("Overwriting stored speed to 1.0", 4);
          storedSpeed = 1.0;
        }
        
        log("Setting reset keybinding to fast", 5);
        setKeyBindings("reset", getKeyBindings("fast")); 
      } else {
        log(
          "Storing lastSpeed into tc.settings.speeds",
          5
        );
        storedSpeed = tc.settings.lastSpeed;
      }
      
      log("Explicitly setting playbackRate to: " + storedSpeed, 4);
      setSpeed(event.target, storedSpeed);
    };

    target.addEventListener(
      "play",
      (this.handlePlay = mediaEventAction.bind(this))
    );

    target.addEventListener(
      "seeked",
      (this.handleSeek = mediaEventAction.bind(this))
    );

    var observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          (mutation.attributeName === "src" ||
            mutation.attributeName === "currentSrc")
        ) {
          log("mutation of A/V element", 5);
          var controller = this.div;
          if (!mutation.target.src && !mutation.target.currentSrc) {
            controller.classList.add("vsc-nosource");
          } else {
            controller.classList.remove("vsc-nosource");
          }
        }
      });
    });
    observer.observe(target, {
      attributeFilter: ["src", "currentSrc"]
    });
  };

  tc.videoController.prototype.remove = function () {
    this.div.remove();
    this.video.removeEventListener("play", this.handlePlay);
    this.video.removeEventListener("seek", this.handleSeek);
    delete this.video.vsc;
    let idx = tc.mediaElements.indexOf(this.video);
    if (idx != -1) {
      tc.mediaElements.splice(idx, 1);
    }
  };

  tc.videoController.prototype.initializeControls = function () {
    log("initializeControls Begin", 5);
    const document = this.video.ownerDocument;
    const speed = this.video.playbackRate.toFixed(2);
    var top = Math.max(this.video.offsetTop, 0) + "px",
      left = Math.max(this.video.offsetLeft, 0) + "px";

    log("Speed variable set to: " + speed, 5);

    var wrapper = document.createElement("div");
    wrapper.classList.add("vsc-controller");

    if (!this.video.src && !this.video.currentSrc) {
      wrapper.classList.add("vsc-nosource");
    }

    if (tc.settings.startHidden) {
      wrapper.classList.add("vsc-hidden");
    }

    var shadow = wrapper.attachShadow({ mode: "open" });
    var shadowTemplate = `
        <style>
          @import "${chrome.runtime.getURL("shadow.css")}";
        </style>

        <div id="controller" style="top:${top}; left:${left}; opacity:${
      tc.settings.controllerOpacity
    }">
          <span data-action="drag" class="draggable">${speed}</span>
          <span id="controls">
            <button data-action="rewind" class="rw">«</button>
            <button data-action="slower">&minus;</button>
            <button data-action="faster">&plus;</button>
            <button data-action="advance" class="rw">»</button>
            <button data-action="display" class="hideButton">&times;</button>
          </span>
        </div>
      `;
    shadow.innerHTML = shadowTemplate;
    shadow.querySelector(".draggable").addEventListener(
      "mousedown",
      (e) => {
        runAction(e.target.dataset["action"], false, e);
        e.stopPropagation();
      },
      true
    );

    shadow.querySelectorAll("button").forEach(function (button) {
      button.addEventListener(
        "click",
        (e) => {
          runAction(
            e.target.dataset["action"],
            getKeyBindings(e.target.dataset["action"]),
            e
          );
          e.stopPropagation();
        },
        true
      );
    });

    shadow
      .querySelector("#controller")
      .addEventListener("click", (e) => e.stopPropagation(), false);
    shadow
      .querySelector("#controller")
      .addEventListener("mousedown", (e) => e.stopPropagation(), false);

    this.speedIndicator = shadow.querySelector("span");
    var fragment = document.createDocumentFragment();
    fragment.appendChild(wrapper);

    switch (true) {
      case location.hostname == "www.amazon.com":
      case location.hostname == "www.reddit.com":
      case /hbogo\./.test(location.hostname):
        this.parent.parentElement.insertBefore(fragment, this.parent);
        break;
      case location.hostname == "www.facebook.com":
        let p = this.parent.parentElement.parentElement.parentElement
          .parentElement.parentElement.parentElement.parentElement;
        p.insertBefore(fragment, p.firstChild);
        break;
      case location.hostname == "tv.apple.com":
        this.parent.getRootNode().querySelector(".scrim").prepend(fragment);
      default:
        this.parent.insertBefore(fragment, this.parent.firstChild);
    }
    return wrapper;
  };
}

function escapeStringRegExp(str) {
  matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;
  return str.replace(matchOperatorsRe, "\\$&");
}

function isBlacklisted() {
  blacklisted = false;
  tc.settings.blacklist.split("\n").forEach((match) => {
    match = match.replace(regStrip, "");
    if (match.length == 0) {
      return;
    }

    if (match.startsWith("/")) {
      try {
        var regexp = new RegExp(match);
      } catch (err) {
        return;
      }
    } else {
      var regexp = new RegExp(escapeStringRegExp(match));
    }

    if (regexp.test(location.href)) {
      blacklisted = true;
      return;
    }
  });
  return blacklisted;
}

var coolDown = false;
function refreshCoolDown() {
  log("Begin refreshCoolDown", 5);
  if (coolDown) {
    clearTimeout(coolDown);
  }
  coolDown = setTimeout(function () {
    coolDown = false;
  }, 1000);
  log("End refreshCoolDown", 5);
}

function setupListener() {
  function updateSpeedFromEvent(video) {
    if (!video.vsc)
      return;
    var speedIndicator = video.vsc.speedIndicator;
    var src = video.currentSrc;
    var speed = Number(video.playbackRate.toFixed(2));

    log("Playback rate changed to " + speed, 4);

    log("Updating controller with new speed", 5);
    speedIndicator.textContent = speed.toFixed(2);
    tc.settings.speeds[src] = speed;
    log("Storing lastSpeed in settings", 5);
    tc.settings.lastSpeed = speed;
    log("Syncing chrome settings", 5);
    chrome.storage.sync.set({ lastSpeed: speed }, function () {
      log("Speed setting saved: " + speed, 5);
    });
    runAction("blink", null, null);
  }

  document.addEventListener(
    "ratechange",
    function (event) {
      if (coolDown) {
        log("Speed event propagation blocked", 4);
        event.stopImmediatePropagation();
      }
      var video = event.target;

      if (tc.settings.forceLastSavedSpeed) {
        if (event.detail && event.detail.origin === "videoSpeed") {
          video.playbackRate = event.detail.speed;
          updateSpeedFromEvent(video);
        } else {
          video.playbackRate = tc.settings.lastSpeed;
        }
        event.stopImmediatePropagation();
      } else {
        updateSpeedFromEvent(video);
      }
    },
    true
  );
}

function initializeWhenReady(document) {
  log("Begin initializeWhenReady", 5);
  if (isBlacklisted()) {
    return;
  }
  window.addEventListener('load', () => {
    initializeNow(window.document);
  });
  if (document) {
    if (document.readyState === "complete") {
      initializeNow(document);
    } else {
      document.onreadystatechange = () => {
        if (document.readyState === "complete") {
          initializeNow(document);
        }
      };
    }
  }
  log("End initializeWhenReady", 5);
}
function inIframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}
function getShadow(parent) {
  let result = [];
  function getChild(parent) {
    if (parent.firstElementChild) {
      var child = parent.firstElementChild;
      do {
        result.push(child);
        getChild(child);
        if (child.shadowRoot) {
          result.push(getShadow(child.shadowRoot));
        }
        child = child.nextElementSibling;
      } while (child);
    }
  }
  getChild(parent);
  return result.flat(Infinity);
}

function initializeNow(document) {
  log("Begin initializeNow", 5);
  if (!tc.settings.enabled) return;
  if (!document.body || document.body.classList.contains("vsc-initialized")) {
    return;
  }
  try {
    setupListener();
  } catch {
    
  }

  if (!window.vscMessageListenerAdded) {
    window.addEventListener("message", function(event) {
      if (event.data && event.data.vscCommand) {
        log(
          "Received frame command action=" + event.data.action +
            ", value=" + event.data.value +
            ", mediaElements=" + tc.mediaElements.length +
            ", frame=" + getFrameContext(),
          5
        );
        
        if (tc.mediaElements.length) {
          runAction(event.data.action, event.data.value);
        } else {
          log("Frame command ignored because no media elements are registered", 5);
        }
        
        document.querySelectorAll("iframe").forEach(iframe => {
          if (iframe.contentWindow !== event.source) {
            try { iframe.contentWindow.postMessage(event.data, "*"); } catch (e) {}
          }
        });
      }
    });
    window.vscMessageListenerAdded = true;
  }

  document.body.classList.add("vsc-initialized");
  log("initializeNow: initialization added to document body", 5);

  if (document === window.document) {
    defineVideoController();
  } else {
    var link = document.createElement("link");
    link.href = chrome.runtime.getURL("inject.css");
    link.type = "text/css";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  
  var windowTargets = [window];
  try {
    if (inIframe()) windowTargets.push(window.top);
  } catch (e) {}

  windowTargets.forEach(function (win) {
    try {
      win.addEventListener(
        "keydown",
        function (event) {
          var keyCode = event.keyCode;
          log(
            "Processing keydown event: keyCode=" + keyCode +
              ", target=" + event.target.nodeName +
              ", frame=" + getFrameContext() +
              ", mediaElements=" + tc.mediaElements.length,
            5
          );

          if (
            !event.getModifierState ||
            event.getModifierState("Alt") ||
            event.getModifierState("Control") ||
            event.getModifierState("Fn") ||
            event.getModifierState("Meta") ||
            event.getModifierState("Hyper") ||
            event.getModifierState("OS")
          ) {
            log("Keydown event ignored due to active modifier: " + keyCode, 5);
            return;
          }

          // Ignore keydown event if typing in a text field
          var isTextEntry = event.target.isContentEditable || event.target.nodeName === "TEXTAREA";
          
          if (event.target.nodeName === "INPUT") {
            // Only ignore text-based inputs, allow range sliders, buttons, etc.
            var textTypes = ["text", "password", "email", "search", "tel", "url", "number"];
            if (textTypes.includes(event.target.type.toLowerCase())) {
              isTextEntry = true;
            }
          }

          if (isTextEntry) {
            log("Keydown event ignored because target is text entry: " + event.target.nodeName, 5);
            return false;
          }

          var item = tc.settings.keyBindings.find((item) => item.key === keyCode);
          if (item) {
            log(
              "Matched key binding: action=" + item.action +
                ", value=" + item.value +
                ", force=" + item.force +
                ", key=" + item.key,
              5
            );
            
            if (tc.mediaElements.length) {
              runAction(item.action, item.value);
            } else {
              log("Matched key binding but no media elements are registered", 4);
            }

            let payload = { vscCommand: true, action: item.action, value: item.value };
            
            try {
              if (window !== window.top) window.top.postMessage(payload, "*");
            } catch (e) {}

            document.querySelectorAll("iframe").forEach(iframe => {
              try { iframe.contentWindow.postMessage(payload, "*"); } catch (e) {}
            });

            if (item.force === "true") {
              log("Preventing default website key binding for action=" + item.action, 5);
              event.preventDefault();
              event.stopPropagation();
            }
          } else {
            log("No VideoSpeed key binding matched keyCode=" + keyCode, 6);
          }

          return false;
        },
        true
      );
    } catch (err) {
      log("Security block prevented binding to parent window", 5);
    }
  });

  function checkForVideo(node, parent, added) {
    if (!added && document.body.contains(node)) {
      return;
    }
    if (
      node.nodeName === "VIDEO" ||
      (node.nodeName === "AUDIO" && tc.settings.audioBoolean)
    ) {
      if (added) {
        log("Registering media element: " + describeMediaElement(node), 5);
        node.vsc = new tc.videoController(node, parent);
      } else {
        if (node.vsc) {
          log("Removing media element: " + describeMediaElement(node), 5);
          node.vsc.remove();
        }
      }
    } else if (node.children != undefined) {
      for (var i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        checkForVideo(child, child.parentNode || parent, added);
      }
    }
  }

  var observer = new MutationObserver(function (mutations) {
    requestIdleCallback(
      (_) => {
        mutations.forEach(function (mutation) {
          switch (mutation.type) {
            case "childList":
              mutation.addedNodes.forEach(function (node) {
                if (typeof node === "function") return;
                checkForVideo(node, node.parentNode || mutation.target, true);
              });
              mutation.removedNodes.forEach(function (node) {
                if (typeof node === "function") return;
                checkForVideo(node, node.parentNode || mutation.target, false);
              });
              break;
            case "attributes":
              if (
                mutation.target.attributes["aria-hidden"] &&
                mutation.target.attributes["aria-hidden"].value == "false"
              ) {
                var flattenedNodes = getShadow(document.body);
                var node = flattenedNodes.filter(
                  (x) => x.tagName == "VIDEO"
                )[0];
                if (node) {
                  if (node.vsc)
                    node.vsc.remove();
                  checkForVideo(node, node.parentNode || mutation.target, true);
                }
              }
              break;
          }
        });
      },
      { timeout: 1000 }
    );
  });
  observer.observe(document, {
    attributeFilter: ["aria-hidden"],
    childList: true,
    subtree: true
  });

  if (tc.settings.audioBoolean) {
    var mediaTags = document.querySelectorAll("video,audio");
  } else {
    var mediaTags = document.querySelectorAll("video");
  }

  log(
    "Initial media scan found " + mediaTags.length +
      " element(s) on " + location.hostname +
      " in " + getFrameContext(),
    5
  );

  mediaTags.forEach(function (video) {
    log("Registering initial media element: " + describeMediaElement(video), 5);
    video.vsc = new tc.videoController(video);
  });

  var frameTags = document.getElementsByTagName("iframe");
  Array.prototype.forEach.call(frameTags, function (frame) {
    try {
      var childDocument = frame.contentDocument;
    } catch (e) {
      return;
    }
    initializeWhenReady(childDocument);
  });
  log("End initializeNow", 5);
}

function setSpeed(video, speed) {
  log("setSpeed started: " + speed, 5);
  var speedvalue = speed.toFixed(2);
  if (tc.settings.forceLastSavedSpeed) {
    video.dispatchEvent(
      new CustomEvent("ratechange", {
        detail: { origin: "videoSpeed", speed: speedvalue }
      })
    );
  } else {
    video.playbackRate = Number(speedvalue);
  }
  var speedIndicator = video.vsc.speedIndicator;
  speedIndicator.textContent = speedvalue;
  tc.settings.lastSpeed = speed;
  refreshCoolDown();
  log("setSpeed finished: " + speed, 5);
}

function runAction(action, value, e) {
  var mediaTags = tc.mediaElements;
  log(
    "runAction begin: action=" + action +
      ", value=" + value +
      ", mediaElements=" + mediaTags.length +
      ", frame=" + getFrameContext(),
    5
  );

  if (e) {
    var targetController = e.target.getRootNode().host;
    log("runAction scoped to clicked controller", 5);
  }

  mediaTags.forEach(function (v) {
    log("Evaluating media element for action=" + action + ": " + describeMediaElement(v), 5);
    var controller = v.vsc.div;

    if (e && !(targetController == controller)) {
      log("Skipping media element because it is not the clicked controller target", 5);
      return;
    }

    showController(controller);

    if (!v.classList.contains("vsc-cancelled")) {
      if (action === "rewind") {
        log("Rewind", 5);
        v.currentTime -= value;
      } else if (action === "advance") {
        log("Fast forward", 5);
        v.currentTime += value;
      } else if (action === "faster") {
        log("Increase speed", 5);
        
        var s = Math.min(
          (v.playbackRate < 0.1 ? 0.0 : v.playbackRate) + value,
          16
        );
        setSpeed(v, s);
      } else if (action === "slower") {
        log("Decrease speed", 5);
        
        var s = Math.max(v.playbackRate - value, 0.07);
        setSpeed(v, s);
      } else if (action === "reset") {
        log("Reset speed", 5);
        resetSpeed(v, 1.0);
      } else if (action === "display") {
        log("Showing controller", 5);
        controller.classList.add("vsc-manual");
        controller.classList.toggle("vsc-hidden");
      } else if (action === "blink") {
        log("Showing controller momentarily", 5);
        
        if (
          controller.classList.contains("vsc-hidden") ||
          controller.blinkTimeOut !== undefined
        ) {
          clearTimeout(controller.blinkTimeOut);
          controller.classList.remove("vsc-hidden");
          controller.blinkTimeOut = setTimeout(
            () => {
              controller.classList.add("vsc-hidden");
              controller.blinkTimeOut = undefined;
            },
            value ? value : 1000
          );
        }
      } else if (action === "drag") {
        handleDrag(v, e);
      } else if (action === "fast") {
        resetSpeed(v, value);
      } else if (action === "resetRatio") {
        resetVideoRatio(v);
      } else if (action === "pause") {
        pause(v);
      } else if (action === "muted") {
        muted(v);
      } else if (action === "mark") {
        setMark(v);
      } else if (action === "jump") {
        jumpToMark(v);
      }
    } else {
      log("Skipping media element because it has vsc-cancelled class", 5);
    }
  });
  log("runAction end: action=" + action, 5);
}

function pause(v) {
  if (v.paused) {
    log("Resuming video", 5);
    v.play();
  } else {
    log("Pausing video", 5);
    v.pause();
  }
}

function resetSpeed(v, target) {
  if (v.playbackRate === target) {
    if (v.playbackRate === getKeyBindings("reset")) {
      if (target !== 1.0) {
        log("Resetting playback speed to 1.0", 4);
        setSpeed(v, 1.0);
      } else {
        log('Toggling playback speed to fast', 4);
        setSpeed(v, getKeyBindings("fast"));
      }
    } else {
      log('Toggling playback speed to reset', 4);
      setSpeed(v, getKeyBindings("reset"));
    }
  } else {
    log('Toggling playback speed to reset', 4);
    setKeyBindings("reset", v.playbackRate);
    setSpeed(v, target);
  }
}

function resetVideoRatio(v) {
  log("Reset video ratio begin: " + getRatioDebugState(v), 4);
  if (!v.videoWidth || !v.videoHeight) {
    log(
      "Cannot apply intrinsic aspect ratio yet because video metadata is missing",
      5
    );
  }

  v.style.transform = "none";
  v.style.scale = "1";
  v.style.objectFit = "contain";

  if (v.videoWidth && v.videoHeight) {
    v.style.aspectRatio = v.videoWidth + " / " + v.videoHeight;
  }
  log("Reset video ratio end: " + getRatioDebugState(v), 4);
}

function muted(v) {
  v.muted = v.muted !== true;
}

function setMark(v) {
  log("Adding marker", 5);
  v.vsc.mark = v.currentTime;
}

function jumpToMark(v) {
  log("Recalling marker", 5);
  if (v.vsc.mark && typeof v.vsc.mark === "number") {
    v.currentTime = v.vsc.mark;
  }
}

function handleDrag(video, e) {
  const controller = video.vsc.div;
  const shadowController = controller.shadowRoot.querySelector("#controller");

  var parentElement = controller.parentElement;
  while (
    parentElement.parentNode &&
    parentElement.parentNode.offsetHeight === parentElement.offsetHeight &&
    parentElement.parentNode.offsetWidth === parentElement.offsetWidth
  ) {
    parentElement = parentElement.parentNode;
  }

  video.classList.add("vcs-dragging");
  shadowController.classList.add("dragging");

  const initialMouseXY = [e.clientX, e.clientY];
  const initialControllerXY = [
    parseInt(shadowController.style.left),
    parseInt(shadowController.style.top)
  ];

  const startDragging = (e) => {
    let style = shadowController.style;
    let dx = e.clientX - initialMouseXY[0];
    let dy = e.clientY - initialMouseXY[1];
    style.left = initialControllerXY[0] + dx + "px";
    style.top = initialControllerXY[1] + dy + "px";
  };

  const stopDragging = () => {
    parentElement.removeEventListener("mousemove", startDragging);
    parentElement.removeEventListener("mouseup", stopDragging);
    parentElement.removeEventListener("mouseleave", stopDragging);

    shadowController.classList.remove("dragging");
    video.classList.remove("vcs-dragging");
  };

  parentElement.addEventListener("mouseup", stopDragging);
  parentElement.addEventListener("mouseleave", stopDragging);
  parentElement.addEventListener("mousemove", startDragging);
}

var timer = null;
function showController(controller) {
  log("Showing controller", 4);
  controller.classList.add("vcs-show");

  if (timer) clearTimeout(timer);

  timer = setTimeout(function () {
    controller.classList.remove("vcs-show");
    timer = false;
    log("Hiding controller", 5);
  }, 2000);
}
