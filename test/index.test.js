const postcss = require('postcss')

const plugin = require('../lib/index');
const {filterPropList} = require('../lib/utils');

async function run(input, output, opts = {}, args) {
  let result = await postcss([plugin(opts)]).process(input, Object.assign({from: undefined}, args))
  expect(result.css).toEqual(output)
  expect(result.warnings()).toHaveLength(0)
}


const basicCSS = '.rule { font-size: 15px }';

describe('px-to-viewport', function () {
  it('should work on the readme example', async function () {
    const input = 'h1 { margin: 0 0 20px; font-size: 32px; line-height: 2; letter-spacing: 1px; }';
    const output = 'h1 { margin: 0 0 6.25vw; font-size: 10vw; line-height: 2; letter-spacing: 1px; }';

    await run(input, output, {})
  });

  it('should replace the px unit with vw', function () {
    const input = basicCSS;
    const output = '.rule { font-size: 4.6875vw }';

    return run(input, output, {})
  })

  it('should handle < 1 values and values without a leading 0', function () {
    const input = '.rule { margin: 0.5rem .5px -0.2px -.2em }';
    const output = '.rule { margin: 0.5rem 0.15625vw -0.0625vw -.2em }';

    return run(input, output, {
      minPixelValue: 0,
    })
  })

  it('should remain unitless if 0', function () {
    const input = '.rule { font-size: 0px; font-size: 0; }';
    const output = '.rule { font-size: 0px; font-size: 0; }';

    return run(input, output)
  })

  it('should not add properties that already exist', function () {
    const input = '.rule { font-size: 16px; font-size: 5vw; }';
    const output = '.rule { font-size: 16px; font-size: 5vw; }';

    return run(input, output);
  })

  it('should not replace units inside mediaQueries by default', function () {
    const input = `@media (min-width: 500px) { .rule { font-size: 16px } }`;
    const output = '@media (min-width: 500px) { .rule { font-size: 16px } }'

    return run(input, output)
  })
})

describe('value parsing', function () {
  it('should not replace values in double quotes or single quotes', function () {
    const input = '.rule { content: \'16px\'; font-family: "16px"; font-size: 16px; }';
    const output = '.rule { content: \'16px\'; font-family: "16px"; font-size: 5vw; }';

    return run(input, output, {
      propList: ['*']
    })
  });

  it('should not replace values in `url()`', function () {
    const input = '.rule { background: url(16px.jpg); font-size: 16px; }';
    const output = '.rule { background: url(16px.jpg); font-size: 5vw; }';

    return run(input, output)
  });

  it('should not replace values with an uppercase P or X', function () {
    const input = '.rule { margin: 12px calc(100% - 14PX); height: calc(100% - 20px); font-size: 12Px; line-height: 16px; }';
    const output = '.rule { margin: 3.75vw calc(100% - 14PX); height: calc(100% - 6.25vw); font-size: 12Px; line-height: 5vw; }';

    return run(input, output)
  });
})

describe('unitToConvert', function () {
  it('should ignore non px values by default', function () {
    const input = '.rule { font-size: 2em }';
    return run(input, input)
  });

  it('should convert only values described in options', function () {
    const input = '.rule { font-size: 5em; line-height: 2px }';
    const output = '.rule { font-size: 1.5625vw; line-height: 2px }';

    return run(input, output, {
      unitToConvert: 'em'
    })
  });
});

describe('viewportWidth', function () {
  it('should should replace using 320px by default', function () {
    const input = basicCSS;
    const output = '.rule { font-size: 4.6875vw }';

    return run(input, output)
  });

  it('should replace using viewportWidth from options', function () {
    const input = basicCSS;
    const output = '.rule { font-size: 3.125vw }';

    return run(input, output, {
      viewportWidth: 480
    })
  })
});

describe('unitPrecision', function () {
  it('should replace using a decimal of 2 places', function () {
    const input = basicCSS
    const output = '.rule { font-size: 4.69vw }';

    return run(input, output, {
      unitPrecision: 2
    })
  });
});

describe('viewportUnit', function () {
  it('should replace using unit from options', function () {
    const input = '.rule { margin-top: 15px }';
    const output = '.rule { margin-top: 4.6875vh }';

    return run(input, output, {
      viewportUnit: 'vh'
    })
  });
});

describe('fontViewportUnit', function () {
  it('should replace only font-size using unit from options', function () {
    const input = '.rule { margin-top: 15px; font-size: 8px; }';
    const output = '.rule { margin-top: 4.6875vw; font-size: 2.5vmax; }';

    return run(input, output, {
      fontViewportUnit: 'vmax'
    })
  });
});

describe('selectorBlackList', function () {
  it('should ignore selectors in the selector black list', function () {
    const input = '.rule { font-size: 15px } .rule2 { font-size: 15px }';
    const output = '.rule { font-size: 4.6875vw } .rule2 { font-size: 15px }';

    return run(input, output, {
      selectorBlackList: ['.rule2']
    })
  });

  it('should ignore every selector with `body$`', function () {
    const input = 'body { font-size: 16px; } .class-body$ { font-size: 16px; } .simple-class { font-size: 16px; }';
    const output = 'body { font-size: 5vw; } .class-body$ { font-size: 16px; } .simple-class { font-size: 5vw; }';

    return run(input, output, {
      selectorBlackList: ['body$']
    })
  });

  it('should only ignore exactly `body`', function () {
    const input = 'body { font-size: 16px; } .class-body { font-size: 16px; } .simple-class { font-size: 16px; }';
    const output = 'body { font-size: 16px; } .class-body { font-size: 5vw; } .simple-class { font-size: 5vw; }';

    return run(input, output, {
      selectorBlackList: [/^body$/]
    })
  });
});

describe('mediaQuery', function () {
  it('should replace px inside media queries if opts.mediaQuery', function () {
    const input = '@media (min-width: 500px) { .rule { font-size: 16px } }'
    const output = '@media (min-width: 500px) { .rule { font-size: 5vw } }';

    return run(input, output, {
      mediaQuery: true
    })
  });

  it('should not replace px inside media queries if not opts.mediaQuery', function () {
    const input = '@media (min-width: 500px) { .rule { font-size: 16px } }'
    const output = '@media (min-width: 500px) { .rule { font-size: 16px } }';

    return run(input, output, {
      mediaQuery: false
    })
  });

  it('should replace px inside media queries if it has params orientation landscape and landscape option', function () {
    const input = '@media (orientation-landscape) and (min-width: 500px) { .rule { font-size: 16px } }'
    const output = '@media (orientation-landscape) and (min-width: 500px) { .rule { font-size: 2.8169vw } }';

    return run(input, output, {
      mediaQuery: true,
      landscape: true
    })
  });
});

describe('propList', function () {
  it('should only replace properties in the prop list', function () {
    const input = '.rule { font-size: 16px; margin: 16px; margin-left: 5px; padding: 5px; padding-right: 16px }';
    const output = '.rule { font-size: 5vw; margin: 5vw; margin-left: 5px; padding: 5px; padding-right: 5vw }';

    return run(input, output, {
      propList: ['*font*', 'margin*', '!margin-left', '*-right', 'pad']
    })
  });

  it('should only replace properties in the prop list with wildcard', function () {
    const input = '.rule { font-size: 16px; margin: 16px; margin-left: 5px; padding: 5px; padding-right: 16px }';
    const output = '.rule { font-size: 16px; margin: 5vw; margin-left: 5px; padding: 5px; padding-right: 16px }';

    return run(input, output, {
      propList: ['*', '!margin-left', '!*padding*', '!font*']
    })
  });

  it('should replace all properties when prop list is not given', function () {
    const input = '.rule { margin: 16px; font-size: 15px }';
    const output = '.rule { margin: 5vw; font-size: 4.6875vw }';

    return run(input, output)
  });
});

describe('minPixelValue', function () {
  it('should not replace values below minPixelValue', function () {
    const input = '.rule { border: 1px solid #000; font-size: 16px; margin: 1px 10px; }';
    const output = '.rule { border: 1px solid #000; font-size: 5vw; margin: 1px 3.125vw; }';

    return run(input, output, {
      propWhiteList: [],
      minPixelValue: 2
    })
  });
});

describe('exclude', function () {
  const input = '.rule { border: 1px solid #000; font-size: 16px; margin: 1px 10px; }';
  const output = '.rule { border: 1px solid #000; font-size: 5vw; margin: 1px 3.125vw; }';

  it('when using regex at the time, the style should not be overwritten.', function () {
    return run(input, input, {
      exclude: /\/node_modules\//
    }, {
      from: '/node_modules/main.css'
    })
  });

  it('when using regex at the time, the style should be overwritten.', function () {
    return run(input, output, {
      exclude: /\/node_modules\//
    }, {
      from: '/example/main.css'
    })
  });

  it('when using array at the time, the style should not be overwritten.', function () {
    return run(input, input, {
      exclude: [/\/node_modules\//, /\/exclude\//]
    }, {
      from: '/exclude/main.css'
    })
  });

  it('when using array at the time, the style should be overwritten.', function () {
    return run(input, output, {
      exclude: [/\/node_modules\//, /\/exclude\//]
    }, {
      from: '/example/main.css'
    })
  });
});

describe('include', function () {
  const input = '.rule { border: 1px solid #000; font-size: 16px; margin: 1px 10px; }';
  const output = '.rule { border: 1px solid #000; font-size: 5vw; margin: 1px 3.125vw; }';

  it('when using regex at the time, the style should not be overwritten.', function () {
    return run(input, input, {
      include: /\/mobile\//
    }, {
      from: '/pc/main.css'
    })
  });

  it('when using regex at the time, the style should be overwritten.', function () {
    return run(input, output, {
      include: /\/mobile\//
    }, {
      from: '/mobile/main.css'
    })
  });

  it('when using array at the time, the style should not be overwritten.', function () {
    return run(input, input, {
      include: [/\/flexible\//, /\/mobile\//]
    }, {
      from: '/pc/main.css'
    })
  });

  it('when using array at the time, the style should be overwritten.', function () {
    return run(input, output, {
      include: [/\/flexible\//, /\/mobile\//]
    }, {
      from: '/flexible/main.css'
    })
  });
});

describe('include-and-exclude', function () {
  const input = '.rule { border: 1px solid #000; font-size: 16px; margin: 1px 10px; }';
  const output = '.rule { border: 1px solid #000; font-size: 5vw; margin: 1px 3.125vw; }';

  it('when using regex at the time, the style should not be overwritten.', function () {
    return run(input, input, {
      include: /\/mobile\//,
      exclude: /\/not-transform\//
    }, {
      from: '/mobile/not-transform/main.css'
    })
  });

  it('when using regex at the time, the style should be overwritten.', function () {
    return run(input, output, {
      include: /\/mobile\//,
      exclude: /\/not-transform\//
    }, {
      from: '/mobile/style/main.css'
    })
  });

  it('when using array at the time, the style should not be overwritten.', function () {
    return run(input, input, {
      include: [/\/flexible\//, /\/mobile\//],
      exclude: [/\/not-transform\//, /pc/]
    }, {
      from: '/flexible/not-transform/main.css'
    })
  });

  it('when using regex at the time, the style should be overwritten.', function () {
    return run(input, output, {
      include: [/\/flexible\//, /\/mobile\//],
      exclude: [/\/not-transform\//, /pc/]
    }, {
      from: '/mobile/style/main.css'
    })
  });
});

describe('regex', function () {
  const input = '.rule { border: 1px solid #000; font-size: 16px; margin: 1px 10px; }';
  const output = '.rule { border: 1px solid #000; font-size: 5vw; margin: 1px 3.125vw; }';

  it('when using regex at the time, the style should not be overwritten.', function () {
    return run(input, input, {
      exclude: /pc/
    }, {
      from: '/pc-project/main.css'
    })
  });

  it('when using regex at the time, the style should be overwritten.', function () {
    return run(input, output, {
      include: /pc/
    }, {
      from: '/pc-project/main.css'
    })
  });

  it('when using regex at the time, the style should be overwritten.', function () {
    return run(input, output, {
      exclude: /\/pc\//
    }, {
      from: '/pc-project/main.css'
    })
  });

  it('when using regex at the time, the style should not be overwritten.', function () {
    return run(input, input, {
      include: /\/pc\//
    }, {
      from: '/pc-project/main.css'
    })
  });
});

describe('replace', function () {
  it('should leave fallback pixel unit with root em value', function () {
    const input = basicCSS;
    const output = '.rule { font-size: 15px; font-size: 4.6875vw }';

    return run(input, output, {
      replace: false
    })
  });
});

describe('filter-prop-list', function () {
  it('should find "exact" matches from propList', function () {
    const propList = ['font-size', 'margin', '!padding', '*border*', '*', '*y', '!*font*'];
    const expected = 'font-size,margin';
    expect(filterPropList.exact(propList).join()).toBe(expected);
  });

  it('should find "contain" matches from propList and reduce to string', function () {
    const propList = ['font-size', '*margin*', '!padding', '*border*', '*', '*y', '!*font*'];
    const expected = 'margin,border';
    expect(filterPropList.contain(propList).join()).toBe(expected);
  });

  it('should find "start" matches from propList and reduce to string', function () {
    const propList = ['font-size', '*margin*', '!padding', 'border*', '*', '*y', '!*font*'];
    const expected = 'border';
    expect(filterPropList.startWith(propList).join()).toBe(expected);
  });

  it('should find "end" matches from propList and reduce to string', function () {
    const propList = ['font-size', '*margin*', '!padding', 'border*', '*', '*y', '!*font*'];
    const expected = 'y';
    expect(filterPropList.endWith(propList).join()).toBe(expected);
  });

  it('should find "not" matches from propList and reduce to string', function () {
    const propList = ['font-size', '*margin*', '!padding', 'border*', '*', '*y', '!*font*'];
    const expected = 'padding';
    expect(filterPropList.notExact(propList).join()).toBe(expected);
  });

  it('should find "not contain" matches from propList and reduce to string', function () {
    const propList = ['font-size', '*margin*', '!padding', '!border*', '*', '*y', '!*font*'];
    const expected = 'font';
    expect(filterPropList.notContain(propList).join()).toBe(expected);
  });

  it('should find "not start" matches from propList and reduce to string', function () {
    const propList = ['font-size', '*margin*', '!padding', '!border*', '*', '*y', '!*font*'];
    const expected = 'border';
    expect(filterPropList.notStartWith(propList).join()).toBe(expected);
  });

  it('should find "not end" matches from propList and reduce to string', function () {
    const propList = ['font-size', '*margin*', '!padding', '!border*', '*', '!*y', '!*font*'];
    const expected = 'y';
    expect(filterPropList.notEndWith(propList).join()).toBe(expected);
  });
});

describe('landscape', function () {
  it('should add landscape atRule', function () {
    const input = '.rule { font-size: 16px; margin: 16px; margin-left: 5px; padding: 5px; padding-right: 16px }';
    const output = '.rule { font-size: 5vw; margin: 5vw; margin-left: 1.5625vw; padding: 1.5625vw; padding-right: 5vw }@media (orientation: landscape) {.rule { font-size: 2.8169vw; margin: 2.8169vw; margin-left: 0.88028vw; padding: 0.88028vw; padding-right: 2.8169vw } }';

    return run(input, output, {
      landscape: true
    })
  });

  it('should add landscape atRule with specified landscapeUnits', function () {
    const input = '.rule { font-size: 16px; margin: 16px; margin-left: 5px; padding: 5px; padding-right: 16px }';
    const output = '.rule { font-size: 5vw; margin: 5vw; margin-left: 1.5625vw; padding: 1.5625vw; padding-right: 5vw }@media (orientation: landscape) {.rule { font-size: 2.8169vh; margin: 2.8169vh; margin-left: 0.88028vh; padding: 0.88028vh; padding-right: 2.8169vh } }';

    return run(input, output, {
      landscape: true,
      landscapeUnit: 'vh'
    })
  });

  it('should not add landscape atRule in mediaQueries', function () {
    const input = '@media (min-width: 500px) { .rule { font-size: 16px } }';
    const output = '@media (min-width: 500px) { .rule { font-size: 5vw } }';

    return run(input, output, {
      landscape: true,
      mediaQuery: true
    })
  });

  it('should not replace values inside landscape atRule', function () {
    const input = basicCSS;
    const output = '.rule { font-size: 15px; font-size: 4.6875vw }@media (orientation: landscape) {.rule { font-size: 2.64085vw } }';

    return run(input, output, {
      replace: false,
      landscape: true
    })
  });

  it('should add landscape atRule with specified landscapeWidth', function () {
    const input = basicCSS
    const output = '.rule { font-size: 4.6875vw }@media (orientation: landscape) {.rule { font-size: 1.95313vw } }';

    return run(input, output, {
      landscape: true,
      landscapeWidth: 768
    })
  });

  it('should not add landscape atRule if it has no nodes', function () {
    const input = '.rule { font-size: 15vw }';
    const output = '.rule { font-size: 15vw }';

    return run(input, output, {
      landscape: true
    })
  });
});

describe('/* px-to-viewport-ignore */ & /* px-to-viewport-ignore-next */', function() {
  it('should ignore right-commented', function() {
    const input = '.rule { font-size: 15px; /* simple comment */ width: 100px; /* px-to-viewport-ignore */ height: 50px; }';
    const output = '.rule { font-size: 4.6875vw; /* simple comment */ width: 100px; height: 15.625vw; }';

    return run(input, output)
  });

  it('should ignore right-commented in multiline-css', function() {
    const input = '.rule {\n  font-size: 15px;\n  width: 100px; /*px-to-viewport-ignore*/\n  height: 50px;\n}';
    const output = '.rule {\n  font-size: 4.6875vw;\n  width: 100px;\n  height: 15.625vw;\n}';

    return run(input, output)
  });

  it('should ignore before-commented in multiline-css', function() {
    const input = '.rule {\n  font-size: 15px;\n  /*px-to-viewport-ignore-next*/\n  width: 100px;\n  /*px-to-viewport-ignore*/\n  height: 50px;\n}';
    const output = '.rule {\n  font-size: 4.6875vw;\n  width: 100px;\n  /*px-to-viewport-ignore*/\n  height: 15.625vw;\n}';

    return run(input, output)
  });
});
