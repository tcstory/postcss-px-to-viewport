const {
  getUnitRegexp,
  createPxReplace,
  createPropListMatcher,
  getUnit,
  checkRegExpOrArray,
  blacklistedSelector,
  shouldSkipCurrentDesc,
  declarationExists,
  getVariableFromComment,
} = require('./utils')


/**
 * @type {import('postcss').PluginCreator}
 */
module.exports = (opts = {}) => {
  const defaultOptions = {
    unitToConvert: 'px',
    viewportWidth: 320,
    unitPrecision: 5,
    propList: ['*'],
    viewportUnit: 'vw',
    fontViewportUnit: 'vw',
    selectorBlackList: [],
    minPixelValue: 1,
    mediaQuery: false,
    replace: true,
    exclude: undefined,
    include: undefined,
    landscape: false,
    landscapeUnit: 'vw',
    landscapeWidth: 568
  }

  opts = Object.assign(defaultOptions, opts)

  checkRegExpOrArray(opts, 'exclude');
  checkRegExpOrArray(opts, 'include');

  const pxRegex = getUnitRegexp(opts.unitToConvert);
  const satisfyPropList = createPropListMatcher(opts.propList);
  let landscapeRule = null;
  let landscapeRules = [];
  let isExcludedFile = false;
  let convertPxInMediaQuery = false;
  let skip = false;
  let hasAddedLandscape = false;

  let inAtRule = {
    inside: false,
    landscape: false,
  }
  let variableMap = {};


  return {
    postcssPlugin: 'postcss-px-to-viewport',
    Once(css) {
      const file = css.source.input.file;

      isExcludedFile = false;
      skip = false
      convertPxInMediaQuery = false;

      if (opts.include && file) {
        if (Object.prototype.toString.call(opts.include) === '[object RegExp]') {
          isExcludedFile = !opts.include.test(file);
        } else if (Object.prototype.toString.call(opts.include) === '[object Array]') {
          let flag = false;
          for (let i = 0; i < opts.include.length; i++) {
            if (opts.include[i].test(file)) {
              flag = true;
              break;
            }
          }
          isExcludedFile = !flag
        }
      }


      if (opts.exclude && file) {
        if (Object.prototype.toString.call(opts.exclude) === '[object RegExp]') {
          isExcludedFile = opts.exclude.test(file);
        } else if (Object.prototype.toString.call(opts.exclude) === '[object Array]') {
          for (let i = 0; i < opts.exclude.length; i++) {
            if (opts.exclude[i].test(file)) {
              isExcludedFile = true;
              break;
            }
          }
        }
      }
    },

    RootExit(css, { AtRule }) {
     if (landscapeRules.length > 0) {
       const landscapeRoot = new AtRule({ params: '(orientation: landscape)', name: 'media' });
       landscapeRules.forEach(function(rule) {
         landscapeRoot.append(rule);
       });
       css.append(landscapeRoot);
       hasAddedLandscape = true;
     }

     landscapeRules = [];
     variableMap = {};
    },

    Comment(node) {
      variableMap =  getVariableFromComment(node.text)
    },

    AtRule(rule) {
      if (isExcludedFile || hasAddedLandscape) {
        return
      }

      inAtRule.inside = true;
      inAtRule.landscape = rule.params.includes('landscape')

      convertPxInMediaQuery = !opts.mediaQuery
    },

    AtRuleExit() {
      inAtRule.inside = false;
      inAtRule.landscape = false;

      convertPxInMediaQuery = false
    },

    Rule(rule) {
      if (isExcludedFile || hasAddedLandscape) {
        return
      }

      skip = blacklistedSelector(opts.selectorBlackList, rule.selector)


      if (opts.landscape && !inAtRule.inside) {
         landscapeRule = rule.clone().removeAll();
      }
    },

    RuleExit() {
      skip = false;
      if (landscapeRule && landscapeRule.nodes.length > 0) {
        landscapeRules.push(landscapeRule);
      }

      landscapeRule = null;
    },

    Declaration(decl, {result}) {
      if (isExcludedFile || hasAddedLandscape || skip || convertPxInMediaQuery) {
        return
      }

      if (decl.value.indexOf(opts.unitToConvert) === -1) {
        return
      }

      if (!satisfyPropList(decl.prop)) {
        return
      }

      if (shouldSkipCurrentDesc(decl, {result})) {
        return
      }

      let unit = getUnit(decl.prop, opts);
      let size = variableMap['viewportWidth'] || opts.viewportWidth;

      if (inAtRule.inside && inAtRule.landscape) {
        unit = opts.landscapeUnit;
        size = variableMap['landscapeWidth'] || opts.landscapeWidth;
      }

      const value = decl.value.replace(pxRegex, createPxReplace(opts, unit, size));

      if (declarationExists(decl.parent, decl.prop, value)) {
        return
      }

      if (landscapeRule) {
        const size = variableMap['landscapeWidth'] || opts.landscapeWidth;
        landscapeRule.append(decl.clone({
          value: decl.value.replace(pxRegex, createPxReplace(opts, opts.landscapeUnit, size))
        }))
      }

      if (opts.replace) {
        decl.value = value
      } else {
        decl.after(decl.clone({value: value}));
      }
    }

  }
}

module.exports.postcss = true
