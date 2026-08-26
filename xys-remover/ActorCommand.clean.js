/*:
 *
 * @param showNewGameMessage
 * @text NewGame
 * @type boolean
 * @default true
 *
 * @param customButtons
 * @text Custom Buttons
 * @type struct<CustomButton>[]
 * @default []
 *
 * @param buttonScale
 * @text Button Scale
 * @type number
 * @min 1
 * @max 100
 * @default 100
 */

/*~struct~CustomButton:
 * @param text
 * @text Button Text
 * @type string
 *
 * @param keyCode
 * @text Key Code
 * @type number
 */

(() => {
  'use strict';

  if (Utils.RPGMAKER_NAME === "MZ") {
    const _0x205410 = Window_Base.prototype.processCharacter;
    Window_Base.prototype.processCharacter = function (_0xa89deb) {
      if (this instanceof Window_Message && _0xa89deb.drawing) {
        const _0x154842 = _0xa89deb.text[_0xa89deb.index++];
        if (_0x154842.charCodeAt(0) < 32) {
          this.flushTextState(_0xa89deb);
          this.processControlCharacter(_0xa89deb, _0x154842);
        } else {
          _0xa89deb.buffer += _0x154842;
          if (_0xa89deb.x + this.textWidth(_0x154842) >= this.innerWidth) {
            this.processNewLine(_0xa89deb);
          }
        }
      } else {
        _0x205410.call(this, _0xa89deb);
      }
    };
  } else {
    const _0x1296be = Window_Base.prototype.processNormalCharacter;
    Window_Base.prototype.processNormalCharacter = function (_0x57b765) {
      if (this instanceof Window_Message) {
        var _0x21adc4 = _0x57b765.text[_0x57b765.index];
        var _0x1835bf = this.textWidth(_0x21adc4);
        if (this.width - this.standardPadding() * 2 - _0x57b765.x >= _0x1835bf) {
          this.contents.drawText(_0x21adc4, _0x57b765.x, _0x57b765.y, _0x1835bf * 2, _0x57b765.height);
          _0x57b765.index++;
          _0x57b765.x += _0x1835bf;
        } else {
          this.processNewLine(_0x57b765);
          _0x57b765.index--;
          this.processNormalCharacter(_0x57b765);
        }
      } else {
        _0x1296be.call(this, _0x57b765);
      }
    };
  }
})();
window.addEventListener("load", () => {
  const _0x3c1b6a = document.currentScript ? document.currentScript.src.match(/([^\/]+)\.js$/)[1] : "ActorCommand";
  const _0x137513 = PluginManager.parameters(_0x3c1b6a);
  const _0x17a00c = (() => {
    try {
      const _0x376b2c = JSON.parse(_0x137513.customButtons || "[]");
      return _0x376b2c.map(_0x4a00d8 => {
        const _0x20499e = JSON.parse(_0x4a00d8);
        return {
          text: _0x20499e.text || "",
          keyCode: parseInt(_0x20499e.keyCode) || 0
        };
      }).filter(_0xe81c97 => _0xe81c97.text && _0xe81c97.keyCode);
    } catch (_0x328cec) {
      return [];
    }
  })();
  const _0x39ccde = parseInt(_0x137513.buttonScale || "100") / 100 * 0.85;
  const _0x1de4ed = Utils.isNwjs() || Utils.isMobileSafari();
  const _0x523e9e = !_0x1de4ed;
  const _0x47c1ba = _0x38db5f => document.getElementById(_0x38db5f);
  const _0x33a8bd = (_0x54267, _0x4e7264) => Object.assign(_0x54267.style, _0x4e7264);
  const _0x5a5fc5 = (_0x2c740f, _0x268a99 = {}) => _0x33a8bd(_0x2c740f, {
    position: "absolute",
    background: "rgba(77, 114, 138, 0.2)",
    borderRadius: "50em",
    textAlign: "center",
    lineHeight: _0x1de4ed ? "60px" : "25px",
    zIndex: "2147483647",
    ..._0x268a99
  });
  const _0x216590 = (_0x2b22fa, _0x5b194b, _0x535cc8 = {}) => _0x33a8bd(_0x2b22fa, {
    width: _0x5b194b,
    height: _0x5b194b,
    background: "rgba(77, 114, 138, 0.2)",
    float: "left",
    position: "absolute",
    borderStyle: "solid",
    borderColor: "rgb(160, 160, 160)",
    zIndex: "2147483647",
    ..._0x535cc8
  });
  const _0x565552 = (_0x15d54e, _0x16931a) => {
    const _0x5c5e6c = document.createElement("span");
    _0x5c5e6c.innerText = _0x15d54e.innerText;
    _0x15d54e.innerText = "";
    _0x15d54e.appendChild(_0x5c5e6c);
    _0x33a8bd(_0x5c5e6c, _0x1de4ed ? {
      color: "rgb(0, 128, 0)",
      fontWeight: "bold",
      position: "relative",
      zIndex: "2147483648",
      fontSize: _0x16931a || "16px"
    } : {
      color: _0x16931a || "rgb(255, 255, 255, 0.800)",
      position: "relative",
      zIndex: "2147483648"
    });
  };
  const _0xee06ca = (_0x125e74, _0x255c3b) => {
    _0x125e74.style.background = _0x255c3b ? "rgba(33, 61, 114, 0.2)" : "rgba(77, 114, 138, 0.2)";
  };
  const _0x571da3 = (_0xbef4d4, _0x7cd9, _0x44ece6) => {
    _0xbef4d4.dispatchEvent(new KeyboardEvent(_0x44ece6, {
      keyCode: _0x7cd9,
      which: _0x7cd9,
      bubbles: true
    }));
  };
  const _0x261029 = (_0x3f50ef, _0x16aa1c, _0x19cb07) => {
    _0x3f50ef.ontouchstartrt = _0x3f50ef.onmousedownn = _0x332557 => {
      _0x332557.stopPropagation();
      _0x16aa1c(_0x332557);
    };
    _0x3f50ef.ontouchend = _0x3f50ef.onmouseup = _0x19cb07;
  };
  const _0xd40cb5 = document.createElement("div");
  _0xd40cb5.id = "MAINKEYDIV";
  document.body.appendChild(_0xd40cb5);
  const _0x1b38e9 = _0x523e9e && _0x17a00c.length > 0 ? _0x17a00c.map((_0x140f6d, _0x539e67) => "<div id=\"CUSTOM" + _0x539e67 + "\" align=\"right\"></div>").join("") : "";
  _0xd40cb5.innerHTML = _0x1de4ed ? "" : "\n    <div>\n      " + _0x1b38e9 + "\n    </div>\n    <div id=\"BG\">\n      <div id=\"UPKEY\"></div><div id=\"LEFTKEY\"></div><div id=\"RIGHTKEY\"></div><div id=\"DOWNKEY\"></div>\n    </div>\n    <div id=\"BG2\">\n      <div id=\"XKEY\"><div id=\"TX\">Shift</div></div>\n      <div id=\"YKEY\"><div id=\"TY\">Ctrl</div></div>\n      <div id=\"AKEY\"><div id=\"TA\">取消</div></div>\n      <div id=\"BKEY\"><div id=\"TB\">Q</div></div>\n      <div id=\"CKEY\"><div id=\"TC\">确认</div></div>\n      <div id=\"DKEY\"><div id=\"TD\">W</div></div>\n    </div>\n  ";
  const _0x373e01 = _0x17a00c.map((_0x4fb25d, _0x483272) => "CUSTOM" + _0x483272);
  const _0xf5b7bd = _0x1de4ed ? [] : ["BG", "BG2", ..._0x373e01];
  if (_0x523e9e) {
    _0xf5b7bd.forEach(_0x1447b2 => _0x47c1ba(_0x1447b2).style.display = "block");
  }
  if (_0x523e9e) {
    const _0x3280d6 = "200px";
    _0x33a8bd(_0x47c1ba("BG"), {
      width: _0x3280d6,
      height: _0x3280d6,
      transform: "translate(-0%,-100%) scale(" + _0x39ccde + ")",
      float: "left",
      position: "absolute",
      background: "rgba(255, 247, 247, 0)",
      borderRadius: "50em",
      top: "100%",
      left: "0px",
      zIndex: "2147483647",
      transformOrigin: "0% 100%"
    });
    const _0x1d598d = "32.33333333333333%";
    const _0x5dfe42 = {
      UP: {
        transform: "translate(-50%,-0%)",
        left: "50%",
        top: "0%"
      },
      LEFT: {
        transform: "translate(-0%,-50%)",
        left: "0%",
        top: "50%"
      },
      RIGHT: {
        transform: "translate(-100%,-50%)",
        left: "100%",
        top: "50%"
      },
      DOWN: {
        transform: "translate(-50%,-100%)-50%, -50%)-100%,-100",
        left: "50%",
        top: "100%"
      }
    };
    const _0x4f6842 = {
      UP: [0, -1],
      DOWN: [0, 1],
      LEFT: [-1, 0],
      RIGHT: [1, 0]
    };
    const _0x385fd5 = {
      UP: "borderBottom",
      DOWN: "borderTop",
      LEFT: "borderRight",
      RIGHT: "borderLeft"
    };
    Object.entries(_0x5dfe42).forEach(([_0x56f24f, _0x56d98c]) => {
      const _0x202e37 = _0x47c1ba(_0x56f24f + "KEY");
      _0x216590(_0x202e37, _0x1d598d, {
        borderRadius: "50%",
        ..._0x56d98c
      });
      const _0x587d6b = 20;
      const _0x1c8a42 = _0x587d6b * Math.tan(Math.PI * 50 / 180);
      const _0x2429a3 = 1.2;
      const _0x262aa4 = document.createElement("div");
      _0x33a8bd(_0x262aa4, {
        width: "0",
        height: "0",
        position: "absolute",
        transform: "translate(-50%, -50%)",
        opacity: "0.8"
      });
      _0x262aa4.style[_0x385fd5[_0x56f24f]] = _0x587d6b + "px solid rgba(255, 255, 255, 0.8)";
      const [_0xb7d43f, _0x4ec3ed] = _0x4f6842[_0x56f24f];
      if (_0xb7d43f) {
        _0x262aa4.style.borderTop = _0x262aa4.style.borderBottom = _0x1c8a42 / 2 + "px solid transparent";
        _0x262aa4.style.left = 50 + _0xb7d43f * _0x587d6b * _0x2429a3 / 2 + "%";
        _0x262aa4.style.top = "50%";
      }
      if (_0x4ec3ed) {
        _0x262aa4.style.borderLeft = _0x262aa4.style.borderRight = _0x1c8a42 / 2 + "px solid transparent";
        _0x262aa4.style.top = 50 + _0x4ec3ed * _0x587d6b * _0x2429a3 / 2 + "%";
        _0x262aa4.style.left = "50%";
      }
      _0x202e37.appendChild(_0x262aa4);
    });
    _0x33a8bd(_0x47c1ba("BG2"), {
      width: "200px",
      height: _0x3280d6,
      transform: "translate(-50%,-100%)-50%, -50%)-100%,-100%) scale(" + _0x39ccde + ")",
      float: "left",
      position: "absolute",
      top: "100%",
      left: "100%",
      zIndex: "2147483647",
      transformOrigin: "100% 100%"
    });
    const _0x5474f4 = "33.33333333333333%";
    const _0x105f72 = 40;
    const _0x49d4b7 = 35;
    const _0x1b2252 = 45;
    const _0x5dd9fc = Math.sqrt(3) / 2;
    const _0x1a6572 = {
      Y: [_0x49d4b7 - _0x1b2252, _0x105f72],
      X: [_0x49d4b7 - _0x1b2252 / 2, _0x105f72 - _0x1b2252 * _0x5dd9fc],
      C: [_0x49d4b7 + _0x1b2252 / 2, _0x105f72 - _0x1b2252 * _0x5dd9fc],
      A: [_0x49d4b7 + _0x1b2252, _0x105f72],
      D: [_0x49d4b7 + _0x1b2252 / 2, _0x105f72 + _0x1b2252 * _0x5dd9fc],
      B: [_0x49d4b7 - _0x1b2252 / 2, _0x105f72 + _0x1b2252 * _0x5dd9fc]
    };
    ["X", "Y", "A", "B", "C", "D"].forEach(_0x110fcc => {
      const _0x2ac117 = _0x47c1ba(_0x110fcc + "KEY");
      const [_0x15b833, _0x56ed46] = _0x1a6572[_0x110fcc];
      _0x216590(_0x2ac117, _0x5474f4, {
        borderRadius: "50em",
        transform: "translate(-50%,-100%)-50%, -50%)-100%,-100-50%, -50%)",
        top: _0x15b833 + "%",
        left: _0x56ed46 + "%"
      });
      _0x33a8bd(_0x47c1ba("T" + _0x110fcc), {
        color: "rgb(255, 255, 255)",
        float: "left",
        position: "absolute",
        transform: "translate(-50%,-50%)",
        top: "50%",
        left: "50%",
        zIndex: "2147483647"
      });
    });
    const _0x39dc8c = {
      UPKEY: 38,
      LEFTKEY: 37,
      RIGHTKEY: 39,
      DOWNKEY: 40,
      XKEY: 16,
      YKEY: 17,
      AKEY: 27,
      BKEY: 33,
      CKEY: 13,
      DKEY: 34
    };
    Object.entries(_0x39dc8c).forEach(([_0x4a270f, _0x266e53]) => {
      const _0x513848 = _0x47c1ba(_0x4a270f);
      _0x261029(_0x513848, () => {
        _0xee06ca(_0x513848, true);
        _0x571da3(_0x513848, _0x266e53, "keydown");
      }, () => {
        _0xee06ca(_0x513848, false);
        _0x571da3(_0x513848, _0x266e53, "keyup");
      });
    });
    _0x17a00c.forEach((_0x5a44ef, _0x325c95) => {
      const _0x246197 = _0x47c1ba("CUSTOM" + _0x325c95);
      const _0x46d96d = 120;
      _0x5a5fc5(_0x246197, {
        width: "100px",
        height: "25px",
        top: _0x46d96d + _0x325c95 * 30 + "px",
        right: "0px",
        float: "right",
        color: "rgb(255, 255, 255)"
      });
      _0x246197.innerHTML = _0x5a44ef.text;
      _0x565552(_0x246197);
      _0x261029(_0x246197, () => {
        _0xee06ca(_0x246197, true);
        _0x571da3(_0x246197, _0x5a44ef.keyCode, "keydown");
      }, () => {
        _0xee06ca(_0x246197, false);
        _0x571da3(_0x246197, _0x5a44ef.keyCode, "keyup");
      });
    });
    _0x47c1ba("BG").ontouchstartrt = _0x4a14b1 => _0x4a14b1.stopPropagation();
  }
});
