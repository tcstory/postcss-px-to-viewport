// excluding regex trick: http://www.rexegg.com/regex-best-trick.html

// Not anything inside double quotes
// Not anything inside single quotes
// Not anything inside url()
// Any digit followed by px
// !singlequotes|!doublequotes|!url()|pixelunit
function getUnitRegexp(unit) {
  return new RegExp('"[^"]+"|\'[^\']+\'|url\\([^\\)]+\\)|(\\d*\\.?\\d+)' + unit, 'g');
}

function toFixed(number, precision) {
  const multiplier = Math.pow(10, precision + 1);
  const wholeNumber = Math.floor(number * multiplier);
  return Math.round(wholeNumber / 10) * 10 / multiplier;
}

function createPxReplace(opts, viewportUnit, viewportSize) {
  return function (m, $1) {
    if (!$1) {
      return m
    }

    const pixels = parseFloat($1);
    if (pixels <= opts.minPixelValue) {
      return m
    }

    const parsedVal = toFixed((pixels / viewportSize * 100), opts.unitPrecision);
    return parsedVal === 0 ? '0' : parsedVal + viewportUnit;
  };
}

const filterPropList = {
  exact: function (list) {
    return list.filter(function (m) {
      return m.match(/^[^*!]+$/);
    });
  },
  contain: function (list) {
    return list.filter(function (m) {
      return m.match(/^\*.+\*$/);
    }).map(function (m) {
      return m.substr(1, m.length - 2);
    });
  },
  endWith: function (list) {
    return list.filter(function (m) {
      return m.match(/^\*[^*]+$/);
    }).map(function (m) {
      return m.substr(1);
    });
  },
  startWith: function (list) {
    return list.filter(function (m) {
      return m.match(/^[^*!]+\*$/);
    }).map(function (m) {
      return m.substr(0, m.length - 1);
    });
  },
  notExact: function (list) {
    return list.filter(function (m) {
      return m.match(/^![^*].*$/);
    }).map(function (m) {
      return m.substr(1);
    });
  },
  notContain: function (list) {
    return list.filter(function (m) {
      return m.match(/^!\*.+\*$/);
    }).map(function (m) {
      return m.substr(2, m.length - 3);
    });
  },
  notEndWith: function (list) {
    return list.filter(function (m) {
      return m.match(/^!\*[^*]+$/);
    }).map(function (m) {
      return m.substr(2);
    });
  },
  notStartWith: function (list) {
    return list.filter(function (m) {
      return m.match(/^![^*]+\*$/);
    }).map(function (m) {
      return m.substr(1, m.length - 2);
    });
  }
};

function createPropListMatcher(propList) {
  const hasWild = propList.indexOf('*') > -1;
  const matchAll = (hasWild && propList.length === 1);
  const lists = {
    exact: filterPropList.exact(propList),
    contain: filterPropList.contain(propList),
    startWith: filterPropList.startWith(propList),
    endWith: filterPropList.endWith(propList),
    notExact: filterPropList.notExact(propList),
    notContain: filterPropList.notContain(propList),
    notStartWith: filterPropList.notStartWith(propList),
    notEndWith: filterPropList.notEndWith(propList)
  };
  return function (prop) {
    if (matchAll) return true;
    return (
      (
        hasWild ||
        lists.exact.indexOf(prop) > -1 ||
        lists.contain.some(function (m) {
          return prop.indexOf(m) > -1;
        }) ||
        lists.startWith.some(function (m) {
          return prop.indexOf(m) === 0;
        }) ||
        lists.endWith.some(function (m) {
          return prop.indexOf(m) === prop.length - m.length;
        })
      ) &&
      !(
        lists.notExact.indexOf(prop) > -1 ||
        lists.notContain.some(function (m) {
          return prop.indexOf(m) > -1;
        }) ||
        lists.notStartWith.some(function (m) {
          return prop.indexOf(m) === 0;
        }) ||
        lists.notEndWith.some(function (m) {
          return prop.indexOf(m) === prop.length - m.length;
        })
      )
    );
  };
}

function getUnit(prop, opts) {
  return prop.indexOf('font') === -1 ? opts.viewportUnit : opts.fontViewportUnit;
}

function checkRegExpOrArray(options, optionName) {
  const option = options[optionName];
  if (!option) {
    return
  }

  if (Object.prototype.toString.call(option) === '[object RegExp]') {
    return
  }

  if (Object.prototype.toString.call(option) === '[object Array]') {
    let bad = false;

    for (let i = 0; i < option.length; i++) {
      if (Object.prototype.toString.call(option[i]) !== '[object RegExp]') {
        bad = true;
        break;
      }
    }

    if (!bad) {
      return
    }
  }

  throw new Error('options.' + optionName + ' should be RegExp or Array of RegExp.');
}

function blacklistedSelector(blacklist, selector) {
  if (typeof selector !== 'string') {
    return false
  }

  return blacklist.some(function (regex) {
    if (typeof regex === 'string') {
      return selector.indexOf(regex) !== -1;
    }

    return selector.match(regex);
  });
}

function shouldSkipCurrentDesc(decl, {result}) {
  const ignoreNextComment = 'px-to-viewport-ignore-next';
  const ignoreCurComment = 'px-to-viewport-ignore';

  const prev = decl.prev()

  if (prev && prev.type === 'comment' && prev.text === ignoreNextComment) {
    prev.remove()
    return true;
  }

  const next = decl.next()

  if (next && next.type === 'comment' && next.text === ignoreCurComment) {
    if (/\n/.test(next.raws.before)) {
      result.warn('Unexpected comment /* ' + ignoreCurComment + ' */ must be after declaration at same line.', {node: next});
      return false;
    } else {
      next.remove();
      return true;
    }
  }

  return false;
}


function declarationExists(decls, prop, value) {
  return decls.some(function (decl) {
    return (decl.prop === prop && decl.value === value);
  });
}

function getVariableFromComment(text) {
  const val = /^px-to-viewport-define ([a-zA-Z0-9,= ]+)/.exec(text)

  if (val) {
    const match = val[1]
    const ret = {}
    for (let item of match.split(',')) {
      let [key, value] = item.split('=')
      key = key.trim()
      value = Number(value.trim())

      if (['landscapeWidth', 'viewportWidth'].includes(key.trim())) {
        ret[key] = value;
      }
    }

    return ret
  } else {
    return {}
  }
}

module.exports = {
  filterPropList,
  getUnitRegexp,
  createPxReplace,
  createPropListMatcher,
  getUnit,
  checkRegExpOrArray,
  blacklistedSelector,
  shouldSkipCurrentDesc,
  declarationExists,
  getVariableFromComment
};
