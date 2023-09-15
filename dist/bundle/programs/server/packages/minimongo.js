Package["core-runtime"].queue("minimongo", ["meteor", "diff-sequence", "ecmascript", "ejson", "geojson-utils", "id-map", "mongo-id", "ordered-dict", "random", "tracker", "mongo-decimal", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var ECMAScript = Package.ecmascript.ECMAScript;
var EJSON = Package.ejson.EJSON;
var GeoJSON = Package['geojson-utils'].GeoJSON;
var IdMap = Package['id-map'].IdMap;
var MongoID = Package['mongo-id'].MongoID;
var OrderedDict = Package['ordered-dict'].OrderedDict;
var Random = Package.random.Random;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Decimal = Package['mongo-decimal'].Decimal;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var operand, selectorValue, MinimongoTest, MinimongoError, selector, doc, callback, options, oldResults, a, b, LocalCollection, Minimongo;

var require = meteorInstall({"node_modules":{"meteor":{"minimongo":{"minimongo_server.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/minimongo_server.js                                                                            //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.link("./minimongo_common.js");
    let hasOwn, isNumericKey, isOperatorObject, pathsToTree, projectionDetails;
    module.link("./common.js", {
      hasOwn(v) {
        hasOwn = v;
      },
      isNumericKey(v) {
        isNumericKey = v;
      },
      isOperatorObject(v) {
        isOperatorObject = v;
      },
      pathsToTree(v) {
        pathsToTree = v;
      },
      projectionDetails(v) {
        projectionDetails = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    Minimongo._pathsElidingNumericKeys = paths => paths.map(path => path.split('.').filter(part => !isNumericKey(part)).join('.'));

    // Returns true if the modifier applied to some document may change the result
    // of matching the document by selector
    // The modifier is always in a form of Object:
    //  - $set
    //    - 'a.b.22.z': value
    //    - 'foo.bar': 42
    //  - $unset
    //    - 'abc.d': 1
    Minimongo.Matcher.prototype.affectedByModifier = function (modifier) {
      // safe check for $set/$unset being objects
      modifier = Object.assign({
        $set: {},
        $unset: {}
      }, modifier);
      const meaningfulPaths = this._getPaths();
      const modifiedPaths = [].concat(Object.keys(modifier.$set), Object.keys(modifier.$unset));
      return modifiedPaths.some(path => {
        const mod = path.split('.');
        return meaningfulPaths.some(meaningfulPath => {
          const sel = meaningfulPath.split('.');
          let i = 0,
            j = 0;
          while (i < sel.length && j < mod.length) {
            if (isNumericKey(sel[i]) && isNumericKey(mod[j])) {
              // foo.4.bar selector affected by foo.4 modifier
              // foo.3.bar selector unaffected by foo.4 modifier
              if (sel[i] === mod[j]) {
                i++;
                j++;
              } else {
                return false;
              }
            } else if (isNumericKey(sel[i])) {
              // foo.4.bar selector unaffected by foo.bar modifier
              return false;
            } else if (isNumericKey(mod[j])) {
              j++;
            } else if (sel[i] === mod[j]) {
              i++;
              j++;
            } else {
              return false;
            }
          }

          // One is a prefix of another, taking numeric fields into account
          return true;
        });
      });
    };

    // @param modifier - Object: MongoDB-styled modifier with `$set`s and `$unsets`
    //                           only. (assumed to come from oplog)
    // @returns - Boolean: if after applying the modifier, selector can start
    //                     accepting the modified value.
    // NOTE: assumes that document affected by modifier didn't match this Matcher
    // before, so if modifier can't convince selector in a positive change it would
    // stay 'false'.
    // Currently doesn't support $-operators and numeric indices precisely.
    Minimongo.Matcher.prototype.canBecomeTrueByModifier = function (modifier) {
      if (!this.affectedByModifier(modifier)) {
        return false;
      }
      if (!this.isSimple()) {
        return true;
      }
      modifier = Object.assign({
        $set: {},
        $unset: {}
      }, modifier);
      const modifierPaths = [].concat(Object.keys(modifier.$set), Object.keys(modifier.$unset));
      if (this._getPaths().some(pathHasNumericKeys) || modifierPaths.some(pathHasNumericKeys)) {
        return true;
      }

      // check if there is a $set or $unset that indicates something is an
      // object rather than a scalar in the actual object where we saw $-operator
      // NOTE: it is correct since we allow only scalars in $-operators
      // Example: for selector {'a.b': {$gt: 5}} the modifier {'a.b.c':7} would
      // definitely set the result to false as 'a.b' appears to be an object.
      const expectedScalarIsObject = Object.keys(this._selector).some(path => {
        if (!isOperatorObject(this._selector[path])) {
          return false;
        }
        return modifierPaths.some(modifierPath => modifierPath.startsWith("".concat(path, ".")));
      });
      if (expectedScalarIsObject) {
        return false;
      }

      // See if we can apply the modifier on the ideally matching object. If it
      // still matches the selector, then the modifier could have turned the real
      // object in the database into something matching.
      const matchingDocument = EJSON.clone(this.matchingDocument());

      // The selector is too complex, anything can happen.
      if (matchingDocument === null) {
        return true;
      }
      try {
        LocalCollection._modify(matchingDocument, modifier);
      } catch (error) {
        // Couldn't set a property on a field which is a scalar or null in the
        // selector.
        // Example:
        // real document: { 'a.b': 3 }
        // selector: { 'a': 12 }
        // converted selector (ideal document): { 'a': 12 }
        // modifier: { $set: { 'a.b': 4 } }
        // We don't know what real document was like but from the error raised by
        // $set on a scalar field we can reason that the structure of real document
        // is completely different.
        if (error.name === 'MinimongoError' && error.setPropertyError) {
          return false;
        }
        throw error;
      }
      return this.documentMatches(matchingDocument).result;
    };

    // Knows how to combine a mongo selector and a fields projection to a new fields
    // projection taking into account active fields from the passed selector.
    // @returns Object - projection object (same as fields option of mongo cursor)
    Minimongo.Matcher.prototype.combineIntoProjection = function (projection) {
      const selectorPaths = Minimongo._pathsElidingNumericKeys(this._getPaths());

      // Special case for $where operator in the selector - projection should depend
      // on all fields of the document. getSelectorPaths returns a list of paths
      // selector depends on. If one of the paths is '' (empty string) representing
      // the root or the whole document, complete projection should be returned.
      if (selectorPaths.includes('')) {
        return {};
      }
      return combineImportantPathsIntoProjection(selectorPaths, projection);
    };

    // Returns an object that would match the selector if possible or null if the
    // selector is too complex for us to analyze
    // { 'a.b': { ans: 42 }, 'foo.bar': null, 'foo.baz': "something" }
    // => { a: { b: { ans: 42 } }, foo: { bar: null, baz: "something" } }
    Minimongo.Matcher.prototype.matchingDocument = function () {
      // check if it was computed before
      if (this._matchingDocument !== undefined) {
        return this._matchingDocument;
      }

      // If the analysis of this selector is too hard for our implementation
      // fallback to "YES"
      let fallback = false;
      this._matchingDocument = pathsToTree(this._getPaths(), path => {
        const valueSelector = this._selector[path];
        if (isOperatorObject(valueSelector)) {
          // if there is a strict equality, there is a good
          // chance we can use one of those as "matching"
          // dummy value
          if (valueSelector.$eq) {
            return valueSelector.$eq;
          }
          if (valueSelector.$in) {
            const matcher = new Minimongo.Matcher({
              placeholder: valueSelector
            });

            // Return anything from $in that matches the whole selector for this
            // path. If nothing matches, returns `undefined` as nothing can make
            // this selector into `true`.
            return valueSelector.$in.find(placeholder => matcher.documentMatches({
              placeholder
            }).result);
          }
          if (onlyContainsKeys(valueSelector, ['$gt', '$gte', '$lt', '$lte'])) {
            let lowerBound = -Infinity;
            let upperBound = Infinity;
            ['$lte', '$lt'].forEach(op => {
              if (hasOwn.call(valueSelector, op) && valueSelector[op] < upperBound) {
                upperBound = valueSelector[op];
              }
            });
            ['$gte', '$gt'].forEach(op => {
              if (hasOwn.call(valueSelector, op) && valueSelector[op] > lowerBound) {
                lowerBound = valueSelector[op];
              }
            });
            const middle = (lowerBound + upperBound) / 2;
            const matcher = new Minimongo.Matcher({
              placeholder: valueSelector
            });
            if (!matcher.documentMatches({
              placeholder: middle
            }).result && (middle === lowerBound || middle === upperBound)) {
              fallback = true;
            }
            return middle;
          }
          if (onlyContainsKeys(valueSelector, ['$nin', '$ne'])) {
            // Since this._isSimple makes sure $nin and $ne are not combined with
            // objects or arrays, we can confidently return an empty object as it
            // never matches any scalar.
            return {};
          }
          fallback = true;
        }
        return this._selector[path];
      }, x => x);
      if (fallback) {
        this._matchingDocument = null;
      }
      return this._matchingDocument;
    };

    // Minimongo.Sorter gets a similar method, which delegates to a Matcher it made
    // for this exact purpose.
    Minimongo.Sorter.prototype.affectedByModifier = function (modifier) {
      return this._selectorForAffectedByModifier.affectedByModifier(modifier);
    };
    Minimongo.Sorter.prototype.combineIntoProjection = function (projection) {
      return combineImportantPathsIntoProjection(Minimongo._pathsElidingNumericKeys(this._getPaths()), projection);
    };
    function combineImportantPathsIntoProjection(paths, projection) {
      const details = projectionDetails(projection);

      // merge the paths to include
      const tree = pathsToTree(paths, path => true, (node, path, fullPath) => true, details.tree);
      const mergedProjection = treeToPaths(tree);
      if (details.including) {
        // both selector and projection are pointing on fields to include
        // so we can just return the merged tree
        return mergedProjection;
      }

      // selector is pointing at fields to include
      // projection is pointing at fields to exclude
      // make sure we don't exclude important paths
      const mergedExclProjection = {};
      Object.keys(mergedProjection).forEach(path => {
        if (!mergedProjection[path]) {
          mergedExclProjection[path] = false;
        }
      });
      return mergedExclProjection;
    }
    function getPaths(selector) {
      return Object.keys(new Minimongo.Matcher(selector)._paths);

      // XXX remove it?
      // return Object.keys(selector).map(k => {
      //   // we don't know how to handle $where because it can be anything
      //   if (k === '$where') {
      //     return ''; // matches everything
      //   }

      //   // we branch from $or/$and/$nor operator
      //   if (['$or', '$and', '$nor'].includes(k)) {
      //     return selector[k].map(getPaths);
      //   }

      //   // the value is a literal or some comparison operator
      //   return k;
      // })
      //   .reduce((a, b) => a.concat(b), [])
      //   .filter((a, b, c) => c.indexOf(a) === b);
    }

    // A helper to ensure object has only certain keys
    function onlyContainsKeys(obj, keys) {
      return Object.keys(obj).every(k => keys.includes(k));
    }
    function pathHasNumericKeys(path) {
      return path.split('.').some(isNumericKey);
    }

    // Returns a set of key paths similar to
    // { 'foo.bar': 1, 'a.b.c': 1 }
    function treeToPaths(tree) {
      let prefix = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
      const result = {};
      Object.keys(tree).forEach(key => {
        const value = tree[key];
        if (value === Object(value)) {
          Object.assign(result, treeToPaths(value, "".concat(prefix + key, ".")));
        } else {
          result[prefix + key] = value;
        }
      });
      return result;
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"common.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/common.js                                                                                      //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      hasOwn: () => hasOwn,
      ELEMENT_OPERATORS: () => ELEMENT_OPERATORS,
      compileDocumentSelector: () => compileDocumentSelector,
      equalityElementMatcher: () => equalityElementMatcher,
      expandArraysInBranches: () => expandArraysInBranches,
      isIndexable: () => isIndexable,
      isNumericKey: () => isNumericKey,
      isOperatorObject: () => isOperatorObject,
      makeLookupFunction: () => makeLookupFunction,
      nothingMatcher: () => nothingMatcher,
      pathsToTree: () => pathsToTree,
      populateDocumentWithQueryFields: () => populateDocumentWithQueryFields,
      projectionDetails: () => projectionDetails,
      regexpElementMatcher: () => regexpElementMatcher
    });
    let LocalCollection;
    module.link("./local_collection.js", {
      default(v) {
        LocalCollection = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const hasOwn = Object.prototype.hasOwnProperty;
    const ELEMENT_OPERATORS = {
      $lt: makeInequality(cmpValue => cmpValue < 0),
      $gt: makeInequality(cmpValue => cmpValue > 0),
      $lte: makeInequality(cmpValue => cmpValue <= 0),
      $gte: makeInequality(cmpValue => cmpValue >= 0),
      $mod: {
        compileElementSelector(operand) {
          if (!(Array.isArray(operand) && operand.length === 2 && typeof operand[0] === 'number' && typeof operand[1] === 'number')) {
            throw Error('argument to $mod must be an array of two numbers');
          }

          // XXX could require to be ints or round or something
          const divisor = operand[0];
          const remainder = operand[1];
          return value => typeof value === 'number' && value % divisor === remainder;
        }
      },
      $in: {
        compileElementSelector(operand) {
          if (!Array.isArray(operand)) {
            throw Error('$in needs an array');
          }
          const elementMatchers = operand.map(option => {
            if (option instanceof RegExp) {
              return regexpElementMatcher(option);
            }
            if (isOperatorObject(option)) {
              throw Error('cannot nest $ under $in');
            }
            return equalityElementMatcher(option);
          });
          return value => {
            // Allow {a: {$in: [null]}} to match when 'a' does not exist.
            if (value === undefined) {
              value = null;
            }
            return elementMatchers.some(matcher => matcher(value));
          };
        }
      },
      $size: {
        // {a: [[5, 5]]} must match {a: {$size: 1}} but not {a: {$size: 2}}, so we
        // don't want to consider the element [5,5] in the leaf array [[5,5]] as a
        // possible value.
        dontExpandLeafArrays: true,
        compileElementSelector(operand) {
          if (typeof operand === 'string') {
            // Don't ask me why, but by experimentation, this seems to be what Mongo
            // does.
            operand = 0;
          } else if (typeof operand !== 'number') {
            throw Error('$size needs a number');
          }
          return value => Array.isArray(value) && value.length === operand;
        }
      },
      $type: {
        // {a: [5]} must not match {a: {$type: 4}} (4 means array), but it should
        // match {a: {$type: 1}} (1 means number), and {a: [[5]]} must match {$a:
        // {$type: 4}}. Thus, when we see a leaf array, we *should* expand it but
        // should *not* include it itself.
        dontIncludeLeafArrays: true,
        compileElementSelector(operand) {
          if (typeof operand === 'string') {
            const operandAliasMap = {
              'double': 1,
              'string': 2,
              'object': 3,
              'array': 4,
              'binData': 5,
              'undefined': 6,
              'objectId': 7,
              'bool': 8,
              'date': 9,
              'null': 10,
              'regex': 11,
              'dbPointer': 12,
              'javascript': 13,
              'symbol': 14,
              'javascriptWithScope': 15,
              'int': 16,
              'timestamp': 17,
              'long': 18,
              'decimal': 19,
              'minKey': -1,
              'maxKey': 127
            };
            if (!hasOwn.call(operandAliasMap, operand)) {
              throw Error("unknown string alias for $type: ".concat(operand));
            }
            operand = operandAliasMap[operand];
          } else if (typeof operand === 'number') {
            if (operand === 0 || operand < -1 || operand > 19 && operand !== 127) {
              throw Error("Invalid numerical $type code: ".concat(operand));
            }
          } else {
            throw Error('argument to $type is not a number or a string');
          }
          return value => value !== undefined && LocalCollection._f._type(value) === operand;
        }
      },
      $bitsAllSet: {
        compileElementSelector(operand) {
          const mask = getOperandBitmask(operand, '$bitsAllSet');
          return value => {
            const bitmask = getValueBitmask(value, mask.length);
            return bitmask && mask.every((byte, i) => (bitmask[i] & byte) === byte);
          };
        }
      },
      $bitsAnySet: {
        compileElementSelector(operand) {
          const mask = getOperandBitmask(operand, '$bitsAnySet');
          return value => {
            const bitmask = getValueBitmask(value, mask.length);
            return bitmask && mask.some((byte, i) => (~bitmask[i] & byte) !== byte);
          };
        }
      },
      $bitsAllClear: {
        compileElementSelector(operand) {
          const mask = getOperandBitmask(operand, '$bitsAllClear');
          return value => {
            const bitmask = getValueBitmask(value, mask.length);
            return bitmask && mask.every((byte, i) => !(bitmask[i] & byte));
          };
        }
      },
      $bitsAnyClear: {
        compileElementSelector(operand) {
          const mask = getOperandBitmask(operand, '$bitsAnyClear');
          return value => {
            const bitmask = getValueBitmask(value, mask.length);
            return bitmask && mask.some((byte, i) => (bitmask[i] & byte) !== byte);
          };
        }
      },
      $regex: {
        compileElementSelector(operand, valueSelector) {
          if (!(typeof operand === 'string' || operand instanceof RegExp)) {
            throw Error('$regex has to be a string or RegExp');
          }
          let regexp;
          if (valueSelector.$options !== undefined) {
            // Options passed in $options (even the empty string) always overrides
            // options in the RegExp object itself.

            // Be clear that we only support the JS-supported options, not extended
            // ones (eg, Mongo supports x and s). Ideally we would implement x and s
            // by transforming the regexp, but not today...
            if (/[^gim]/.test(valueSelector.$options)) {
              throw new Error('Only the i, m, and g regexp options are supported');
            }
            const source = operand instanceof RegExp ? operand.source : operand;
            regexp = new RegExp(source, valueSelector.$options);
          } else if (operand instanceof RegExp) {
            regexp = operand;
          } else {
            regexp = new RegExp(operand);
          }
          return regexpElementMatcher(regexp);
        }
      },
      $elemMatch: {
        dontExpandLeafArrays: true,
        compileElementSelector(operand, valueSelector, matcher) {
          if (!LocalCollection._isPlainObject(operand)) {
            throw Error('$elemMatch need an object');
          }
          const isDocMatcher = !isOperatorObject(Object.keys(operand).filter(key => !hasOwn.call(LOGICAL_OPERATORS, key)).reduce((a, b) => Object.assign(a, {
            [b]: operand[b]
          }), {}), true);
          let subMatcher;
          if (isDocMatcher) {
            // This is NOT the same as compileValueSelector(operand), and not just
            // because of the slightly different calling convention.
            // {$elemMatch: {x: 3}} means "an element has a field x:3", not
            // "consists only of a field x:3". Also, regexps and sub-$ are allowed.
            subMatcher = compileDocumentSelector(operand, matcher, {
              inElemMatch: true
            });
          } else {
            subMatcher = compileValueSelector(operand, matcher);
          }
          return value => {
            if (!Array.isArray(value)) {
              return false;
            }
            for (let i = 0; i < value.length; ++i) {
              const arrayElement = value[i];
              let arg;
              if (isDocMatcher) {
                // We can only match {$elemMatch: {b: 3}} against objects.
                // (We can also match against arrays, if there's numeric indices,
                // eg {$elemMatch: {'0.b': 3}} or {$elemMatch: {0: 3}}.)
                if (!isIndexable(arrayElement)) {
                  return false;
                }
                arg = arrayElement;
              } else {
                // dontIterate ensures that {a: {$elemMatch: {$gt: 5}}} matches
                // {a: [8]} but not {a: [[8]]}
                arg = [{
                  value: arrayElement,
                  dontIterate: true
                }];
              }
              // XXX support $near in $elemMatch by propagating $distance?
              if (subMatcher(arg).result) {
                return i; // specially understood to mean "use as arrayIndices"
              }
            }

            return false;
          };
        }
      }
    };
    // Operators that appear at the top level of a document selector.
    const LOGICAL_OPERATORS = {
      $and(subSelector, matcher, inElemMatch) {
        return andDocumentMatchers(compileArrayOfDocumentSelectors(subSelector, matcher, inElemMatch));
      },
      $or(subSelector, matcher, inElemMatch) {
        const matchers = compileArrayOfDocumentSelectors(subSelector, matcher, inElemMatch);

        // Special case: if there is only one matcher, use it directly, *preserving*
        // any arrayIndices it returns.
        if (matchers.length === 1) {
          return matchers[0];
        }
        return doc => {
          const result = matchers.some(fn => fn(doc).result);
          // $or does NOT set arrayIndices when it has multiple
          // sub-expressions. (Tested against MongoDB.)
          return {
            result
          };
        };
      },
      $nor(subSelector, matcher, inElemMatch) {
        const matchers = compileArrayOfDocumentSelectors(subSelector, matcher, inElemMatch);
        return doc => {
          const result = matchers.every(fn => !fn(doc).result);
          // Never set arrayIndices, because we only match if nothing in particular
          // 'matched' (and because this is consistent with MongoDB).
          return {
            result
          };
        };
      },
      $where(selectorValue, matcher) {
        // Record that *any* path may be used.
        matcher._recordPathUsed('');
        matcher._hasWhere = true;
        if (!(selectorValue instanceof Function)) {
          // XXX MongoDB seems to have more complex logic to decide where or or not
          // to add 'return'; not sure exactly what it is.
          selectorValue = Function('obj', "return ".concat(selectorValue));
        }

        // We make the document available as both `this` and `obj`.
        // // XXX not sure what we should do if this throws
        return doc => ({
          result: selectorValue.call(doc, doc)
        });
      },
      // This is just used as a comment in the query (in MongoDB, it also ends up in
      // query logs); it has no effect on the actual selection.
      $comment() {
        return () => ({
          result: true
        });
      }
    };

    // Operators that (unlike LOGICAL_OPERATORS) pertain to individual paths in a
    // document, but (unlike ELEMENT_OPERATORS) do not have a simple definition as
    // "match each branched value independently and combine with
    // convertElementMatcherToBranchedMatcher".
    const VALUE_OPERATORS = {
      $eq(operand) {
        return convertElementMatcherToBranchedMatcher(equalityElementMatcher(operand));
      },
      $not(operand, valueSelector, matcher) {
        return invertBranchedMatcher(compileValueSelector(operand, matcher));
      },
      $ne(operand) {
        return invertBranchedMatcher(convertElementMatcherToBranchedMatcher(equalityElementMatcher(operand)));
      },
      $nin(operand) {
        return invertBranchedMatcher(convertElementMatcherToBranchedMatcher(ELEMENT_OPERATORS.$in.compileElementSelector(operand)));
      },
      $exists(operand) {
        const exists = convertElementMatcherToBranchedMatcher(value => value !== undefined);
        return operand ? exists : invertBranchedMatcher(exists);
      },
      // $options just provides options for $regex; its logic is inside $regex
      $options(operand, valueSelector) {
        if (!hasOwn.call(valueSelector, '$regex')) {
          throw Error('$options needs a $regex');
        }
        return everythingMatcher;
      },
      // $maxDistance is basically an argument to $near
      $maxDistance(operand, valueSelector) {
        if (!valueSelector.$near) {
          throw Error('$maxDistance needs a $near');
        }
        return everythingMatcher;
      },
      $all(operand, valueSelector, matcher) {
        if (!Array.isArray(operand)) {
          throw Error('$all requires array');
        }

        // Not sure why, but this seems to be what MongoDB does.
        if (operand.length === 0) {
          return nothingMatcher;
        }
        const branchedMatchers = operand.map(criterion => {
          // XXX handle $all/$elemMatch combination
          if (isOperatorObject(criterion)) {
            throw Error('no $ expressions in $all');
          }

          // This is always a regexp or equality selector.
          return compileValueSelector(criterion, matcher);
        });

        // andBranchedMatchers does NOT require all selectors to return true on the
        // SAME branch.
        return andBranchedMatchers(branchedMatchers);
      },
      $near(operand, valueSelector, matcher, isRoot) {
        if (!isRoot) {
          throw Error('$near can\'t be inside another $ operator');
        }
        matcher._hasGeoQuery = true;

        // There are two kinds of geodata in MongoDB: legacy coordinate pairs and
        // GeoJSON. They use different distance metrics, too. GeoJSON queries are
        // marked with a $geometry property, though legacy coordinates can be
        // matched using $geometry.
        let maxDistance, point, distance;
        if (LocalCollection._isPlainObject(operand) && hasOwn.call(operand, '$geometry')) {
          // GeoJSON "2dsphere" mode.
          maxDistance = operand.$maxDistance;
          point = operand.$geometry;
          distance = value => {
            // XXX: for now, we don't calculate the actual distance between, say,
            // polygon and circle. If people care about this use-case it will get
            // a priority.
            if (!value) {
              return null;
            }
            if (!value.type) {
              return GeoJSON.pointDistance(point, {
                type: 'Point',
                coordinates: pointToArray(value)
              });
            }
            if (value.type === 'Point') {
              return GeoJSON.pointDistance(point, value);
            }
            return GeoJSON.geometryWithinRadius(value, point, maxDistance) ? 0 : maxDistance + 1;
          };
        } else {
          maxDistance = valueSelector.$maxDistance;
          if (!isIndexable(operand)) {
            throw Error('$near argument must be coordinate pair or GeoJSON');
          }
          point = pointToArray(operand);
          distance = value => {
            if (!isIndexable(value)) {
              return null;
            }
            return distanceCoordinatePairs(point, value);
          };
        }
        return branchedValues => {
          // There might be multiple points in the document that match the given
          // field. Only one of them needs to be within $maxDistance, but we need to
          // evaluate all of them and use the nearest one for the implicit sort
          // specifier. (That's why we can't just use ELEMENT_OPERATORS here.)
          //
          // Note: This differs from MongoDB's implementation, where a document will
          // actually show up *multiple times* in the result set, with one entry for
          // each within-$maxDistance branching point.
          const result = {
            result: false
          };
          expandArraysInBranches(branchedValues).every(branch => {
            // if operation is an update, don't skip branches, just return the first
            // one (#3599)
            let curDistance;
            if (!matcher._isUpdate) {
              if (!(typeof branch.value === 'object')) {
                return true;
              }
              curDistance = distance(branch.value);

              // Skip branches that aren't real points or are too far away.
              if (curDistance === null || curDistance > maxDistance) {
                return true;
              }

              // Skip anything that's a tie.
              if (result.distance !== undefined && result.distance <= curDistance) {
                return true;
              }
            }
            result.result = true;
            result.distance = curDistance;
            if (branch.arrayIndices) {
              result.arrayIndices = branch.arrayIndices;
            } else {
              delete result.arrayIndices;
            }
            return !matcher._isUpdate;
          });
          return result;
        };
      }
    };

    // NB: We are cheating and using this function to implement 'AND' for both
    // 'document matchers' and 'branched matchers'. They both return result objects
    // but the argument is different: for the former it's a whole doc, whereas for
    // the latter it's an array of 'branched values'.
    function andSomeMatchers(subMatchers) {
      if (subMatchers.length === 0) {
        return everythingMatcher;
      }
      if (subMatchers.length === 1) {
        return subMatchers[0];
      }
      return docOrBranches => {
        const match = {};
        match.result = subMatchers.every(fn => {
          const subResult = fn(docOrBranches);

          // Copy a 'distance' number out of the first sub-matcher that has
          // one. Yes, this means that if there are multiple $near fields in a
          // query, something arbitrary happens; this appears to be consistent with
          // Mongo.
          if (subResult.result && subResult.distance !== undefined && match.distance === undefined) {
            match.distance = subResult.distance;
          }

          // Similarly, propagate arrayIndices from sub-matchers... but to match
          // MongoDB behavior, this time the *last* sub-matcher with arrayIndices
          // wins.
          if (subResult.result && subResult.arrayIndices) {
            match.arrayIndices = subResult.arrayIndices;
          }
          return subResult.result;
        });

        // If we didn't actually match, forget any extra metadata we came up with.
        if (!match.result) {
          delete match.distance;
          delete match.arrayIndices;
        }
        return match;
      };
    }
    const andDocumentMatchers = andSomeMatchers;
    const andBranchedMatchers = andSomeMatchers;
    function compileArrayOfDocumentSelectors(selectors, matcher, inElemMatch) {
      if (!Array.isArray(selectors) || selectors.length === 0) {
        throw Error('$and/$or/$nor must be nonempty array');
      }
      return selectors.map(subSelector => {
        if (!LocalCollection._isPlainObject(subSelector)) {
          throw Error('$or/$and/$nor entries need to be full objects');
        }
        return compileDocumentSelector(subSelector, matcher, {
          inElemMatch
        });
      });
    }

    // Takes in a selector that could match a full document (eg, the original
    // selector). Returns a function mapping document->result object.
    //
    // matcher is the Matcher object we are compiling.
    //
    // If this is the root document selector (ie, not wrapped in $and or the like),
    // then isRoot is true. (This is used by $near.)
    function compileDocumentSelector(docSelector, matcher) {
      let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      const docMatchers = Object.keys(docSelector).map(key => {
        const subSelector = docSelector[key];
        if (key.substr(0, 1) === '$') {
          // Outer operators are either logical operators (they recurse back into
          // this function), or $where.
          if (!hasOwn.call(LOGICAL_OPERATORS, key)) {
            throw new Error("Unrecognized logical operator: ".concat(key));
          }
          matcher._isSimple = false;
          return LOGICAL_OPERATORS[key](subSelector, matcher, options.inElemMatch);
        }

        // Record this path, but only if we aren't in an elemMatcher, since in an
        // elemMatch this is a path inside an object in an array, not in the doc
        // root.
        if (!options.inElemMatch) {
          matcher._recordPathUsed(key);
        }

        // Don't add a matcher if subSelector is a function -- this is to match
        // the behavior of Meteor on the server (inherited from the node mongodb
        // driver), which is to ignore any part of a selector which is a function.
        if (typeof subSelector === 'function') {
          return undefined;
        }
        const lookUpByIndex = makeLookupFunction(key);
        const valueMatcher = compileValueSelector(subSelector, matcher, options.isRoot);
        return doc => valueMatcher(lookUpByIndex(doc));
      }).filter(Boolean);
      return andDocumentMatchers(docMatchers);
    }
    // Takes in a selector that could match a key-indexed value in a document; eg,
    // {$gt: 5, $lt: 9}, or a regular expression, or any non-expression object (to
    // indicate equality).  Returns a branched matcher: a function mapping
    // [branched value]->result object.
    function compileValueSelector(valueSelector, matcher, isRoot) {
      if (valueSelector instanceof RegExp) {
        matcher._isSimple = false;
        return convertElementMatcherToBranchedMatcher(regexpElementMatcher(valueSelector));
      }
      if (isOperatorObject(valueSelector)) {
        return operatorBranchedMatcher(valueSelector, matcher, isRoot);
      }
      return convertElementMatcherToBranchedMatcher(equalityElementMatcher(valueSelector));
    }

    // Given an element matcher (which evaluates a single value), returns a branched
    // value (which evaluates the element matcher on all the branches and returns a
    // more structured return value possibly including arrayIndices).
    function convertElementMatcherToBranchedMatcher(elementMatcher) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      return branches => {
        const expanded = options.dontExpandLeafArrays ? branches : expandArraysInBranches(branches, options.dontIncludeLeafArrays);
        const match = {};
        match.result = expanded.some(element => {
          let matched = elementMatcher(element.value);

          // Special case for $elemMatch: it means "true, and use this as an array
          // index if I didn't already have one".
          if (typeof matched === 'number') {
            // XXX This code dates from when we only stored a single array index
            // (for the outermost array). Should we be also including deeper array
            // indices from the $elemMatch match?
            if (!element.arrayIndices) {
              element.arrayIndices = [matched];
            }
            matched = true;
          }

          // If some element matched, and it's tagged with array indices, include
          // those indices in our result object.
          if (matched && element.arrayIndices) {
            match.arrayIndices = element.arrayIndices;
          }
          return matched;
        });
        return match;
      };
    }

    // Helpers for $near.
    function distanceCoordinatePairs(a, b) {
      const pointA = pointToArray(a);
      const pointB = pointToArray(b);
      return Math.hypot(pointA[0] - pointB[0], pointA[1] - pointB[1]);
    }

    // Takes something that is not an operator object and returns an element matcher
    // for equality with that thing.
    function equalityElementMatcher(elementSelector) {
      if (isOperatorObject(elementSelector)) {
        throw Error('Can\'t create equalityValueSelector for operator object');
      }

      // Special-case: null and undefined are equal (if you got undefined in there
      // somewhere, or if you got it due to some branch being non-existent in the
      // weird special case), even though they aren't with EJSON.equals.
      // undefined or null
      if (elementSelector == null) {
        return value => value == null;
      }
      return value => LocalCollection._f._equal(elementSelector, value);
    }
    function everythingMatcher(docOrBranchedValues) {
      return {
        result: true
      };
    }
    function expandArraysInBranches(branches, skipTheArrays) {
      const branchesOut = [];
      branches.forEach(branch => {
        const thisIsArray = Array.isArray(branch.value);

        // We include the branch itself, *UNLESS* we it's an array that we're going
        // to iterate and we're told to skip arrays.  (That's right, we include some
        // arrays even skipTheArrays is true: these are arrays that were found via
        // explicit numerical indices.)
        if (!(skipTheArrays && thisIsArray && !branch.dontIterate)) {
          branchesOut.push({
            arrayIndices: branch.arrayIndices,
            value: branch.value
          });
        }
        if (thisIsArray && !branch.dontIterate) {
          branch.value.forEach((value, i) => {
            branchesOut.push({
              arrayIndices: (branch.arrayIndices || []).concat(i),
              value
            });
          });
        }
      });
      return branchesOut;
    }
    // Helpers for $bitsAllSet/$bitsAnySet/$bitsAllClear/$bitsAnyClear.
    function getOperandBitmask(operand, selector) {
      // numeric bitmask
      // You can provide a numeric bitmask to be matched against the operand field.
      // It must be representable as a non-negative 32-bit signed integer.
      // Otherwise, $bitsAllSet will return an error.
      if (Number.isInteger(operand) && operand >= 0) {
        return new Uint8Array(new Int32Array([operand]).buffer);
      }

      // bindata bitmask
      // You can also use an arbitrarily large BinData instance as a bitmask.
      if (EJSON.isBinary(operand)) {
        return new Uint8Array(operand.buffer);
      }

      // position list
      // If querying a list of bit positions, each <position> must be a non-negative
      // integer. Bit positions start at 0 from the least significant bit.
      if (Array.isArray(operand) && operand.every(x => Number.isInteger(x) && x >= 0)) {
        const buffer = new ArrayBuffer((Math.max(...operand) >> 3) + 1);
        const view = new Uint8Array(buffer);
        operand.forEach(x => {
          view[x >> 3] |= 1 << (x & 0x7);
        });
        return view;
      }

      // bad operand
      throw Error("operand to ".concat(selector, " must be a numeric bitmask (representable as a ") + 'non-negative 32-bit signed integer), a bindata bitmask or an array with ' + 'bit positions (non-negative integers)');
    }
    function getValueBitmask(value, length) {
      // The field value must be either numerical or a BinData instance. Otherwise,
      // $bits... will not match the current document.

      // numerical
      if (Number.isSafeInteger(value)) {
        // $bits... will not match numerical values that cannot be represented as a
        // signed 64-bit integer. This can be the case if a value is either too
        // large or small to fit in a signed 64-bit integer, or if it has a
        // fractional component.
        const buffer = new ArrayBuffer(Math.max(length, 2 * Uint32Array.BYTES_PER_ELEMENT));
        let view = new Uint32Array(buffer, 0, 2);
        view[0] = value % ((1 << 16) * (1 << 16)) | 0;
        view[1] = value / ((1 << 16) * (1 << 16)) | 0;

        // sign extension
        if (value < 0) {
          view = new Uint8Array(buffer, 2);
          view.forEach((byte, i) => {
            view[i] = 0xff;
          });
        }
        return new Uint8Array(buffer);
      }

      // bindata
      if (EJSON.isBinary(value)) {
        return new Uint8Array(value.buffer);
      }

      // no match
      return false;
    }

    // Actually inserts a key value into the selector document
    // However, this checks there is no ambiguity in setting
    // the value for the given key, throws otherwise
    function insertIntoDocument(document, key, value) {
      Object.keys(document).forEach(existingKey => {
        if (existingKey.length > key.length && existingKey.indexOf("".concat(key, ".")) === 0 || key.length > existingKey.length && key.indexOf("".concat(existingKey, ".")) === 0) {
          throw new Error("cannot infer query fields to set, both paths '".concat(existingKey, "' and ") + "'".concat(key, "' are matched"));
        } else if (existingKey === key) {
          throw new Error("cannot infer query fields to set, path '".concat(key, "' is matched twice"));
        }
      });
      document[key] = value;
    }

    // Returns a branched matcher that matches iff the given matcher does not.
    // Note that this implicitly "deMorganizes" the wrapped function.  ie, it
    // means that ALL branch values need to fail to match innerBranchedMatcher.
    function invertBranchedMatcher(branchedMatcher) {
      return branchValues => {
        // We explicitly choose to strip arrayIndices here: it doesn't make sense to
        // say "update the array element that does not match something", at least
        // in mongo-land.
        return {
          result: !branchedMatcher(branchValues).result
        };
      };
    }
    function isIndexable(obj) {
      return Array.isArray(obj) || LocalCollection._isPlainObject(obj);
    }
    function isNumericKey(s) {
      return /^[0-9]+$/.test(s);
    }
    function isOperatorObject(valueSelector, inconsistentOK) {
      if (!LocalCollection._isPlainObject(valueSelector)) {
        return false;
      }
      let theseAreOperators = undefined;
      Object.keys(valueSelector).forEach(selKey => {
        const thisIsOperator = selKey.substr(0, 1) === '$' || selKey === 'diff';
        if (theseAreOperators === undefined) {
          theseAreOperators = thisIsOperator;
        } else if (theseAreOperators !== thisIsOperator) {
          if (!inconsistentOK) {
            throw new Error("Inconsistent operator: ".concat(JSON.stringify(valueSelector)));
          }
          theseAreOperators = false;
        }
      });
      return !!theseAreOperators; // {} has no operators
    }

    // Helper for $lt/$gt/$lte/$gte.
    function makeInequality(cmpValueComparator) {
      return {
        compileElementSelector(operand) {
          // Arrays never compare false with non-arrays for any inequality.
          // XXX This was behavior we observed in pre-release MongoDB 2.5, but
          //     it seems to have been reverted.
          //     See https://jira.mongodb.org/browse/SERVER-11444
          if (Array.isArray(operand)) {
            return () => false;
          }

          // Special case: consider undefined and null the same (so true with
          // $gte/$lte).
          if (operand === undefined) {
            operand = null;
          }
          const operandType = LocalCollection._f._type(operand);
          return value => {
            if (value === undefined) {
              value = null;
            }

            // Comparisons are never true among things of different type (except
            // null vs undefined).
            if (LocalCollection._f._type(value) !== operandType) {
              return false;
            }
            return cmpValueComparator(LocalCollection._f._cmp(value, operand));
          };
        }
      };
    }

    // makeLookupFunction(key) returns a lookup function.
    //
    // A lookup function takes in a document and returns an array of matching
    // branches.  If no arrays are found while looking up the key, this array will
    // have exactly one branches (possibly 'undefined', if some segment of the key
    // was not found).
    //
    // If arrays are found in the middle, this can have more than one element, since
    // we 'branch'. When we 'branch', if there are more key segments to look up,
    // then we only pursue branches that are plain objects (not arrays or scalars).
    // This means we can actually end up with no branches!
    //
    // We do *NOT* branch on arrays that are found at the end (ie, at the last
    // dotted member of the key). We just return that array; if you want to
    // effectively 'branch' over the array's values, post-process the lookup
    // function with expandArraysInBranches.
    //
    // Each branch is an object with keys:
    //  - value: the value at the branch
    //  - dontIterate: an optional bool; if true, it means that 'value' is an array
    //    that expandArraysInBranches should NOT expand. This specifically happens
    //    when there is a numeric index in the key, and ensures the
    //    perhaps-surprising MongoDB behavior where {'a.0': 5} does NOT
    //    match {a: [[5]]}.
    //  - arrayIndices: if any array indexing was done during lookup (either due to
    //    explicit numeric indices or implicit branching), this will be an array of
    //    the array indices used, from outermost to innermost; it is falsey or
    //    absent if no array index is used. If an explicit numeric index is used,
    //    the index will be followed in arrayIndices by the string 'x'.
    //
    //    Note: arrayIndices is used for two purposes. First, it is used to
    //    implement the '$' modifier feature, which only ever looks at its first
    //    element.
    //
    //    Second, it is used for sort key generation, which needs to be able to tell
    //    the difference between different paths. Moreover, it needs to
    //    differentiate between explicit and implicit branching, which is why
    //    there's the somewhat hacky 'x' entry: this means that explicit and
    //    implicit array lookups will have different full arrayIndices paths. (That
    //    code only requires that different paths have different arrayIndices; it
    //    doesn't actually 'parse' arrayIndices. As an alternative, arrayIndices
    //    could contain objects with flags like 'implicit', but I think that only
    //    makes the code surrounding them more complex.)
    //
    //    (By the way, this field ends up getting passed around a lot without
    //    cloning, so never mutate any arrayIndices field/var in this package!)
    //
    //
    // At the top level, you may only pass in a plain object or array.
    //
    // See the test 'minimongo - lookup' for some examples of what lookup functions
    // return.
    function makeLookupFunction(key) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      const parts = key.split('.');
      const firstPart = parts.length ? parts[0] : '';
      const lookupRest = parts.length > 1 && makeLookupFunction(parts.slice(1).join('.'), options);
      function buildResult(arrayIndices, dontIterate, value) {
        return arrayIndices && arrayIndices.length ? dontIterate ? [{
          arrayIndices,
          dontIterate,
          value
        }] : [{
          arrayIndices,
          value
        }] : dontIterate ? [{
          dontIterate,
          value
        }] : [{
          value
        }];
      }

      // Doc will always be a plain object or an array.
      // apply an explicit numeric index, an array.
      return (doc, arrayIndices) => {
        if (Array.isArray(doc)) {
          // If we're being asked to do an invalid lookup into an array (non-integer
          // or out-of-bounds), return no results (which is different from returning
          // a single undefined result, in that `null` equality checks won't match).
          if (!(isNumericKey(firstPart) && firstPart < doc.length)) {
            return [];
          }

          // Remember that we used this array index. Include an 'x' to indicate that
          // the previous index came from being considered as an explicit array
          // index (not branching).
          arrayIndices = arrayIndices ? arrayIndices.concat(+firstPart, 'x') : [+firstPart, 'x'];
        }

        // Do our first lookup.
        const firstLevel = doc[firstPart];

        // If there is no deeper to dig, return what we found.
        //
        // If what we found is an array, most value selectors will choose to treat
        // the elements of the array as matchable values in their own right, but
        // that's done outside of the lookup function. (Exceptions to this are $size
        // and stuff relating to $elemMatch.  eg, {a: {$size: 2}} does not match {a:
        // [[1, 2]]}.)
        //
        // That said, if we just did an *explicit* array lookup (on doc) to find
        // firstLevel, and firstLevel is an array too, we do NOT want value
        // selectors to iterate over it.  eg, {'a.0': 5} does not match {a: [[5]]}.
        // So in that case, we mark the return value as 'don't iterate'.
        if (!lookupRest) {
          return buildResult(arrayIndices, Array.isArray(doc) && Array.isArray(firstLevel), firstLevel);
        }

        // We need to dig deeper.  But if we can't, because what we've found is not
        // an array or plain object, we're done. If we just did a numeric index into
        // an array, we return nothing here (this is a change in Mongo 2.5 from
        // Mongo 2.4, where {'a.0.b': null} stopped matching {a: [5]}). Otherwise,
        // return a single `undefined` (which can, for example, match via equality
        // with `null`).
        if (!isIndexable(firstLevel)) {
          if (Array.isArray(doc)) {
            return [];
          }
          return buildResult(arrayIndices, false, undefined);
        }
        const result = [];
        const appendToResult = more => {
          result.push(...more);
        };

        // Dig deeper: look up the rest of the parts on whatever we've found.
        // (lookupRest is smart enough to not try to do invalid lookups into
        // firstLevel if it's an array.)
        appendToResult(lookupRest(firstLevel, arrayIndices));

        // If we found an array, then in *addition* to potentially treating the next
        // part as a literal integer lookup, we should also 'branch': try to look up
        // the rest of the parts on each array element in parallel.
        //
        // In this case, we *only* dig deeper into array elements that are plain
        // objects. (Recall that we only got this far if we have further to dig.)
        // This makes sense: we certainly don't dig deeper into non-indexable
        // objects. And it would be weird to dig into an array: it's simpler to have
        // a rule that explicit integer indexes only apply to an outer array, not to
        // an array you find after a branching search.
        //
        // In the special case of a numeric part in a *sort selector* (not a query
        // selector), we skip the branching: we ONLY allow the numeric part to mean
        // 'look up this index' in that case, not 'also look up this index in all
        // the elements of the array'.
        if (Array.isArray(firstLevel) && !(isNumericKey(parts[1]) && options.forSort)) {
          firstLevel.forEach((branch, arrayIndex) => {
            if (LocalCollection._isPlainObject(branch)) {
              appendToResult(lookupRest(branch, arrayIndices ? arrayIndices.concat(arrayIndex) : [arrayIndex]));
            }
          });
        }
        return result;
      };
    }
    // Object exported only for unit testing.
    // Use it to export private functions to test in Tinytest.
    MinimongoTest = {
      makeLookupFunction
    };
    MinimongoError = function (message) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (typeof message === 'string' && options.field) {
        message += " for field '".concat(options.field, "'");
      }
      const error = new Error(message);
      error.name = 'MinimongoError';
      return error;
    };
    function nothingMatcher(docOrBranchedValues) {
      return {
        result: false
      };
    }
    // Takes an operator object (an object with $ keys) and returns a branched
    // matcher for it.
    function operatorBranchedMatcher(valueSelector, matcher, isRoot) {
      // Each valueSelector works separately on the various branches.  So one
      // operator can match one branch and another can match another branch.  This
      // is OK.
      const operatorMatchers = Object.keys(valueSelector).map(operator => {
        const operand = valueSelector[operator];
        const simpleRange = ['$lt', '$lte', '$gt', '$gte'].includes(operator) && typeof operand === 'number';
        const simpleEquality = ['$ne', '$eq'].includes(operator) && operand !== Object(operand);
        const simpleInclusion = ['$in', '$nin'].includes(operator) && Array.isArray(operand) && !operand.some(x => x === Object(x));
        if (!(simpleRange || simpleInclusion || simpleEquality)) {
          matcher._isSimple = false;
        }
        if (hasOwn.call(VALUE_OPERATORS, operator)) {
          return VALUE_OPERATORS[operator](operand, valueSelector, matcher, isRoot);
        }
        if (hasOwn.call(ELEMENT_OPERATORS, operator)) {
          const options = ELEMENT_OPERATORS[operator];
          return convertElementMatcherToBranchedMatcher(options.compileElementSelector(operand, valueSelector, matcher), options);
        }
        throw new Error("Unrecognized operator: ".concat(operator));
      });
      return andBranchedMatchers(operatorMatchers);
    }

    // paths - Array: list of mongo style paths
    // newLeafFn - Function: of form function(path) should return a scalar value to
    //                       put into list created for that path
    // conflictFn - Function: of form function(node, path, fullPath) is called
    //                        when building a tree path for 'fullPath' node on
    //                        'path' was already a leaf with a value. Must return a
    //                        conflict resolution.
    // initial tree - Optional Object: starting tree.
    // @returns - Object: tree represented as a set of nested objects
    function pathsToTree(paths, newLeafFn, conflictFn) {
      let root = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
      paths.forEach(path => {
        const pathArray = path.split('.');
        let tree = root;

        // use .every just for iteration with break
        const success = pathArray.slice(0, -1).every((key, i) => {
          if (!hasOwn.call(tree, key)) {
            tree[key] = {};
          } else if (tree[key] !== Object(tree[key])) {
            tree[key] = conflictFn(tree[key], pathArray.slice(0, i + 1).join('.'), path);

            // break out of loop if we are failing for this path
            if (tree[key] !== Object(tree[key])) {
              return false;
            }
          }
          tree = tree[key];
          return true;
        });
        if (success) {
          const lastKey = pathArray[pathArray.length - 1];
          if (hasOwn.call(tree, lastKey)) {
            tree[lastKey] = conflictFn(tree[lastKey], path, path);
          } else {
            tree[lastKey] = newLeafFn(path);
          }
        }
      });
      return root;
    }
    // Makes sure we get 2 elements array and assume the first one to be x and
    // the second one to y no matter what user passes.
    // In case user passes { lon: x, lat: y } returns [x, y]
    function pointToArray(point) {
      return Array.isArray(point) ? point.slice() : [point.x, point.y];
    }

    // Creating a document from an upsert is quite tricky.
    // E.g. this selector: {"$or": [{"b.foo": {"$all": ["bar"]}}]}, should result
    // in: {"b.foo": "bar"}
    // But this selector: {"$or": [{"b": {"foo": {"$all": ["bar"]}}}]} should throw
    // an error

    // Some rules (found mainly with trial & error, so there might be more):
    // - handle all childs of $and (or implicit $and)
    // - handle $or nodes with exactly 1 child
    // - ignore $or nodes with more than 1 child
    // - ignore $nor and $not nodes
    // - throw when a value can not be set unambiguously
    // - every value for $all should be dealt with as separate $eq-s
    // - threat all children of $all as $eq setters (=> set if $all.length === 1,
    //   otherwise throw error)
    // - you can not mix '$'-prefixed keys and non-'$'-prefixed keys
    // - you can only have dotted keys on a root-level
    // - you can not have '$'-prefixed keys more than one-level deep in an object

    // Handles one key/value pair to put in the selector document
    function populateDocumentWithKeyValue(document, key, value) {
      if (value && Object.getPrototypeOf(value) === Object.prototype) {
        populateDocumentWithObject(document, key, value);
      } else if (!(value instanceof RegExp)) {
        insertIntoDocument(document, key, value);
      }
    }

    // Handles a key, value pair to put in the selector document
    // if the value is an object
    function populateDocumentWithObject(document, key, value) {
      const keys = Object.keys(value);
      const unprefixedKeys = keys.filter(op => op[0] !== '$');
      if (unprefixedKeys.length > 0 || !keys.length) {
        // Literal (possibly empty) object ( or empty object )
        // Don't allow mixing '$'-prefixed with non-'$'-prefixed fields
        if (keys.length !== unprefixedKeys.length) {
          throw new Error("unknown operator: ".concat(unprefixedKeys[0]));
        }
        validateObject(value, key);
        insertIntoDocument(document, key, value);
      } else {
        Object.keys(value).forEach(op => {
          const object = value[op];
          if (op === '$eq') {
            populateDocumentWithKeyValue(document, key, object);
          } else if (op === '$all') {
            // every value for $all should be dealt with as separate $eq-s
            object.forEach(element => populateDocumentWithKeyValue(document, key, element));
          }
        });
      }
    }

    // Fills a document with certain fields from an upsert selector
    function populateDocumentWithQueryFields(query) {
      let document = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (Object.getPrototypeOf(query) === Object.prototype) {
        // handle implicit $and
        Object.keys(query).forEach(key => {
          const value = query[key];
          if (key === '$and') {
            // handle explicit $and
            value.forEach(element => populateDocumentWithQueryFields(element, document));
          } else if (key === '$or') {
            // handle $or nodes with exactly 1 child
            if (value.length === 1) {
              populateDocumentWithQueryFields(value[0], document);
            }
          } else if (key[0] !== '$') {
            // Ignore other '$'-prefixed logical selectors
            populateDocumentWithKeyValue(document, key, value);
          }
        });
      } else {
        // Handle meteor-specific shortcut for selecting _id
        if (LocalCollection._selectorIsId(query)) {
          insertIntoDocument(document, '_id', query);
        }
      }
      return document;
    }
    function projectionDetails(fields) {
      // Find the non-_id keys (_id is handled specially because it is included
      // unless explicitly excluded). Sort the keys, so that our code to detect
      // overlaps like 'foo' and 'foo.bar' can assume that 'foo' comes first.
      let fieldsKeys = Object.keys(fields).sort();

      // If _id is the only field in the projection, do not remove it, since it is
      // required to determine if this is an exclusion or exclusion. Also keep an
      // inclusive _id, since inclusive _id follows the normal rules about mixing
      // inclusive and exclusive fields. If _id is not the only field in the
      // projection and is exclusive, remove it so it can be handled later by a
      // special case, since exclusive _id is always allowed.
      if (!(fieldsKeys.length === 1 && fieldsKeys[0] === '_id') && !(fieldsKeys.includes('_id') && fields._id)) {
        fieldsKeys = fieldsKeys.filter(key => key !== '_id');
      }
      let including = null; // Unknown

      fieldsKeys.forEach(keyPath => {
        const rule = !!fields[keyPath];
        if (including === null) {
          including = rule;
        }

        // This error message is copied from MongoDB shell
        if (including !== rule) {
          throw MinimongoError('You cannot currently mix including and excluding fields.');
        }
      });
      const projectionRulesTree = pathsToTree(fieldsKeys, path => including, (node, path, fullPath) => {
        // Check passed projection fields' keys: If you have two rules such as
        // 'foo.bar' and 'foo.bar.baz', then the result becomes ambiguous. If
        // that happens, there is a probability you are doing something wrong,
        // framework should notify you about such mistake earlier on cursor
        // compilation step than later during runtime.  Note, that real mongo
        // doesn't do anything about it and the later rule appears in projection
        // project, more priority it takes.
        //
        // Example, assume following in mongo shell:
        // > db.coll.insert({ a: { b: 23, c: 44 } })
        // > db.coll.find({}, { 'a': 1, 'a.b': 1 })
        // {"_id": ObjectId("520bfe456024608e8ef24af3"), "a": {"b": 23}}
        // > db.coll.find({}, { 'a.b': 1, 'a': 1 })
        // {"_id": ObjectId("520bfe456024608e8ef24af3"), "a": {"b": 23, "c": 44}}
        //
        // Note, how second time the return set of keys is different.
        const currentPath = fullPath;
        const anotherPath = path;
        throw MinimongoError("both ".concat(currentPath, " and ").concat(anotherPath, " found in fields option, ") + 'using both of them may trigger unexpected behavior. Did you mean to ' + 'use only one of them?');
      });
      return {
        including,
        tree: projectionRulesTree
      };
    }
    function regexpElementMatcher(regexp) {
      return value => {
        if (value instanceof RegExp) {
          return value.toString() === regexp.toString();
        }

        // Regexps only work against strings.
        if (typeof value !== 'string') {
          return false;
        }

        // Reset regexp's state to avoid inconsistent matching for objects with the
        // same value on consecutive calls of regexp.test. This happens only if the
        // regexp has the 'g' flag. Also note that ES6 introduces a new flag 'y' for
        // which we should *not* change the lastIndex but MongoDB doesn't support
        // either of these flags.
        regexp.lastIndex = 0;
        return regexp.test(value);
      };
    }
    // Validates the key in a path.
    // Objects that are nested more then 1 level cannot have dotted fields
    // or fields starting with '$'
    function validateKeyInPath(key, path) {
      if (key.includes('.')) {
        throw new Error("The dotted field '".concat(key, "' in '").concat(path, ".").concat(key, " is not valid for storage."));
      }
      if (key[0] === '$') {
        throw new Error("The dollar ($) prefixed field  '".concat(path, ".").concat(key, " is not valid for storage."));
      }
    }

    // Recursively validates an object that is nested more than one level deep
    function validateObject(object, path) {
      if (object && Object.getPrototypeOf(object) === Object.prototype) {
        Object.keys(object).forEach(key => {
          validateKeyInPath(key, path);
          validateObject(object[key], path + '.' + key);
        });
      }
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"constants.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/constants.js                                                                                   //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
module.export({
  getAsyncMethodName: () => getAsyncMethodName,
  ASYNC_COLLECTION_METHODS: () => ASYNC_COLLECTION_METHODS,
  ASYNC_CURSOR_METHODS: () => ASYNC_CURSOR_METHODS
});
function getAsyncMethodName(method) {
  return "".concat(method.replace('_', ''), "Async");
}
const ASYNC_COLLECTION_METHODS = ['_createCappedCollection', 'dropCollection', 'dropIndex', 'createIndex', 'findOne', 'insert', 'remove', 'update', 'upsert'];
const ASYNC_CURSOR_METHODS = ['count', 'fetch', 'forEach', 'map'];
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"cursor.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/cursor.js                                                                                      //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      default: () => Cursor
    });
    let LocalCollection;
    module.link("./local_collection.js", {
      default(v) {
        LocalCollection = v;
      }
    }, 0);
    let hasOwn;
    module.link("./common.js", {
      hasOwn(v) {
        hasOwn = v;
      }
    }, 1);
    let ASYNC_CURSOR_METHODS, getAsyncMethodName;
    module.link("./constants", {
      ASYNC_CURSOR_METHODS(v) {
        ASYNC_CURSOR_METHODS = v;
      },
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class Cursor {
      // don't call this ctor directly.  use LocalCollection.find().
      constructor(collection, selector) {
        let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
        this.collection = collection;
        this.sorter = null;
        this.matcher = new Minimongo.Matcher(selector);
        if (LocalCollection._selectorIsIdPerhapsAsObject(selector)) {
          // stash for fast _id and { _id }
          this._selectorId = hasOwn.call(selector, '_id') ? selector._id : selector;
        } else {
          this._selectorId = undefined;
          if (this.matcher.hasGeoQuery() || options.sort) {
            this.sorter = new Minimongo.Sorter(options.sort || []);
          }
        }
        this.skip = options.skip || 0;
        this.limit = options.limit;
        this.fields = options.projection || options.fields;
        this._projectionFn = LocalCollection._compileProjection(this.fields || {});
        this._transform = LocalCollection.wrapTransform(options.transform);

        // by default, queries register w/ Tracker when it is available.
        if (typeof Tracker !== 'undefined') {
          this.reactive = options.reactive === undefined ? true : options.reactive;
        }
      }

      /**
       * @deprecated in 2.9
       * @summary Returns the number of documents that match a query. This method is
       *          [deprecated since MongoDB 4.0](https://www.mongodb.com/docs/v4.4/reference/command/count/);
       *          see `Collection.countDocuments` and
       *          `Collection.estimatedDocumentCount` for a replacement.
       * @memberOf Mongo.Cursor
       * @method  count
       * @instance
       * @locus Anywhere
       * @returns {Number}
       */
      count() {
        if (this.reactive) {
          // allow the observe to be unordered
          this._depend({
            added: true,
            removed: true
          }, true);
        }
        return this._getRawObjects({
          ordered: true
        }).length;
      }

      /**
       * @summary Return all matching documents as an Array.
       * @memberOf Mongo.Cursor
       * @method  fetch
       * @instance
       * @locus Anywhere
       * @returns {Object[]}
       */
      fetch() {
        const result = [];
        this.forEach(doc => {
          result.push(doc);
        });
        return result;
      }
      [Symbol.iterator]() {
        if (this.reactive) {
          this._depend({
            addedBefore: true,
            removed: true,
            changed: true,
            movedBefore: true
          });
        }
        let index = 0;
        const objects = this._getRawObjects({
          ordered: true
        });
        return {
          next: () => {
            if (index < objects.length) {
              // This doubles as a clone operation.
              let element = this._projectionFn(objects[index++]);
              if (this._transform) element = this._transform(element);
              return {
                value: element
              };
            }
            return {
              done: true
            };
          }
        };
      }
      [Symbol.asyncIterator]() {
        const syncResult = this[Symbol.iterator]();
        return {
          async next() {
            return Promise.resolve(syncResult.next());
          }
        };
      }

      /**
       * @callback IterationCallback
       * @param {Object} doc
       * @param {Number} index
       */
      /**
       * @summary Call `callback` once for each matching document, sequentially and
       *          synchronously.
       * @locus Anywhere
       * @method  forEach
       * @instance
       * @memberOf Mongo.Cursor
       * @param {IterationCallback} callback Function to call. It will be called
       *                                     with three arguments: the document, a
       *                                     0-based index, and <em>cursor</em>
       *                                     itself.
       * @param {Any} [thisArg] An object which will be the value of `this` inside
       *                        `callback`.
       */
      forEach(callback, thisArg) {
        if (this.reactive) {
          this._depend({
            addedBefore: true,
            removed: true,
            changed: true,
            movedBefore: true
          });
        }
        this._getRawObjects({
          ordered: true
        }).forEach((element, i) => {
          // This doubles as a clone operation.
          element = this._projectionFn(element);
          if (this._transform) {
            element = this._transform(element);
          }
          callback.call(thisArg, element, i, this);
        });
      }
      getTransform() {
        return this._transform;
      }

      /**
       * @summary Map callback over all matching documents.  Returns an Array.
       * @locus Anywhere
       * @method map
       * @instance
       * @memberOf Mongo.Cursor
       * @param {IterationCallback} callback Function to call. It will be called
       *                                     with three arguments: the document, a
       *                                     0-based index, and <em>cursor</em>
       *                                     itself.
       * @param {Any} [thisArg] An object which will be the value of `this` inside
       *                        `callback`.
       */
      map(callback, thisArg) {
        const result = [];
        this.forEach((doc, i) => {
          result.push(callback.call(thisArg, doc, i, this));
        });
        return result;
      }

      // options to contain:
      //  * callbacks for observe():
      //    - addedAt (document, atIndex)
      //    - added (document)
      //    - changedAt (newDocument, oldDocument, atIndex)
      //    - changed (newDocument, oldDocument)
      //    - removedAt (document, atIndex)
      //    - removed (document)
      //    - movedTo (document, oldIndex, newIndex)
      //
      // attributes available on returned query handle:
      //  * stop(): end updates
      //  * collection: the collection this query is querying
      //
      // iff x is a returned query handle, (x instanceof
      // LocalCollection.ObserveHandle) is true
      //
      // initial results delivered through added callback
      // XXX maybe callbacks should take a list of objects, to expose transactions?
      // XXX maybe support field limiting (to limit what you're notified on)

      /**
       * @summary Watch a query.  Receive callbacks as the result set changes.
       * @locus Anywhere
       * @memberOf Mongo.Cursor
       * @instance
       * @param {Object} callbacks Functions to call to deliver the result set as it
       *                           changes
       */
      observe(options) {
        return LocalCollection._observeFromObserveChanges(this, options);
      }

      /**
       * @summary Watch a query. Receive callbacks as the result set changes. Only
       *          the differences between the old and new documents are passed to
       *          the callbacks.
       * @locus Anywhere
       * @memberOf Mongo.Cursor
       * @instance
       * @param {Object} callbacks Functions to call to deliver the result set as it
       *                           changes
       */
      observeChanges(options) {
        const ordered = LocalCollection._observeChangesCallbacksAreOrdered(options);

        // there are several places that assume you aren't combining skip/limit with
        // unordered observe.  eg, update's EJSON.clone, and the "there are several"
        // comment in _modifyAndNotify
        // XXX allow skip/limit with unordered observe
        if (!options._allow_unordered && !ordered && (this.skip || this.limit)) {
          throw new Error("Must use an ordered observe with skip or limit (i.e. 'addedBefore' " + "for observeChanges or 'addedAt' for observe, instead of 'added').");
        }
        if (this.fields && (this.fields._id === 0 || this.fields._id === false)) {
          throw Error("You may not observe a cursor with {fields: {_id: 0}}");
        }
        const distances = this.matcher.hasGeoQuery() && ordered && new LocalCollection._IdMap();
        const query = {
          cursor: this,
          dirty: false,
          distances,
          matcher: this.matcher,
          // not fast pathed
          ordered,
          projectionFn: this._projectionFn,
          resultsSnapshot: null,
          sorter: ordered && this.sorter
        };
        let qid;

        // Non-reactive queries call added[Before] and then never call anything
        // else.
        if (this.reactive) {
          qid = this.collection.next_qid++;
          this.collection.queries[qid] = query;
        }
        query.results = this._getRawObjects({
          ordered,
          distances: query.distances
        });
        if (this.collection.paused) {
          query.resultsSnapshot = ordered ? [] : new LocalCollection._IdMap();
        }

        // wrap callbacks we were passed. callbacks only fire when not paused and
        // are never undefined
        // Filters out blacklisted fields according to cursor's projection.
        // XXX wrong place for this?

        // furthermore, callbacks enqueue until the operation we're working on is
        // done.
        const wrapCallback = fn => {
          if (!fn) {
            return () => {};
          }
          const self = this;
          return function /* args*/
          () {
            if (self.collection.paused) {
              return;
            }
            const args = arguments;
            self.collection._observeQueue.queueTask(() => {
              fn.apply(this, args);
            });
          };
        };
        query.added = wrapCallback(options.added);
        query.changed = wrapCallback(options.changed);
        query.removed = wrapCallback(options.removed);
        if (ordered) {
          query.addedBefore = wrapCallback(options.addedBefore);
          query.movedBefore = wrapCallback(options.movedBefore);
        }
        if (!options._suppress_initial && !this.collection.paused) {
          var _query$results, _query$results$size;
          const handler = doc => {
            const fields = EJSON.clone(doc);
            delete fields._id;
            if (ordered) {
              query.addedBefore(doc._id, this._projectionFn(fields), null);
            }
            query.added(doc._id, this._projectionFn(fields));
          };
          // it means it's just an array
          if (query.results.length) {
            for (const doc of query.results) {
              handler(doc);
            }
          }
          // it means it's an id map
          if ((_query$results = query.results) !== null && _query$results !== void 0 && (_query$results$size = _query$results.size) !== null && _query$results$size !== void 0 && _query$results$size.call(_query$results)) {
            query.results.forEach(handler);
          }
        }
        const handle = Object.assign(new LocalCollection.ObserveHandle(), {
          collection: this.collection,
          stop: () => {
            if (this.reactive) {
              delete this.collection.queries[qid];
            }
          },
          isReady: false,
          isReadyPromise: null
        });
        if (this.reactive && Tracker.active) {
          // XXX in many cases, the same observe will be recreated when
          // the current autorun is rerun.  we could save work by
          // letting it linger across rerun and potentially get
          // repurposed if the same observe is performed, using logic
          // similar to that of Meteor.subscribe.
          Tracker.onInvalidate(() => {
            handle.stop();
          });
        }

        // run the observe callbacks resulting from the initial contents
        // before we leave the observe.
        const drainResult = this.collection._observeQueue.drain();
        if (drainResult instanceof Promise) {
          handle.isReadyPromise = drainResult;
          drainResult.then(() => handle.isReady = true);
        } else {
          handle.isReady = true;
          handle.isReadyPromise = Promise.resolve();
        }
        return handle;
      }

      // XXX Maybe we need a version of observe that just calls a callback if
      // anything changed.
      _depend(changers, _allow_unordered) {
        if (Tracker.active) {
          const dependency = new Tracker.Dependency();
          const notify = dependency.changed.bind(dependency);
          dependency.depend();
          const options = {
            _allow_unordered,
            _suppress_initial: true
          };
          ['added', 'addedBefore', 'changed', 'movedBefore', 'removed'].forEach(fn => {
            if (changers[fn]) {
              options[fn] = notify;
            }
          });

          // observeChanges will stop() when this computation is invalidated
          this.observeChanges(options);
        }
      }
      _getCollectionName() {
        return this.collection.name;
      }

      // Returns a collection of matching objects, but doesn't deep copy them.
      //
      // If ordered is set, returns a sorted array, respecting sorter, skip, and
      // limit properties of the query provided that options.applySkipLimit is
      // not set to false (#1201). If sorter is falsey, no sort -- you get the
      // natural order.
      //
      // If ordered is not set, returns an object mapping from ID to doc (sorter,
      // skip and limit should not be set).
      //
      // If ordered is set and this cursor is a $near geoquery, then this function
      // will use an _IdMap to track each distance from the $near argument point in
      // order to use it as a sort key. If an _IdMap is passed in the 'distances'
      // argument, this function will clear it and use it for this purpose
      // (otherwise it will just create its own _IdMap). The observeChanges
      // implementation uses this to remember the distances after this function
      // returns.
      _getRawObjects() {
        let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        // By default this method will respect skip and limit because .fetch(),
        // .forEach() etc... expect this behaviour. It can be forced to ignore
        // skip and limit by setting applySkipLimit to false (.count() does this,
        // for example)
        const applySkipLimit = options.applySkipLimit !== false;

        // XXX use OrderedDict instead of array, and make IdMap and OrderedDict
        // compatible
        const results = options.ordered ? [] : new LocalCollection._IdMap();

        // fast path for single ID value
        if (this._selectorId !== undefined) {
          // If you have non-zero skip and ask for a single id, you get nothing.
          // This is so it matches the behavior of the '{_id: foo}' path.
          if (applySkipLimit && this.skip) {
            return results;
          }
          const selectedDoc = this.collection._docs.get(this._selectorId);
          if (selectedDoc) {
            if (options.ordered) {
              results.push(selectedDoc);
            } else {
              results.set(this._selectorId, selectedDoc);
            }
          }
          return results;
        }

        // slow path for arbitrary selector, sort, skip, limit

        // in the observeChanges case, distances is actually part of the "query"
        // (ie, live results set) object.  in other cases, distances is only used
        // inside this function.
        let distances;
        if (this.matcher.hasGeoQuery() && options.ordered) {
          if (options.distances) {
            distances = options.distances;
            distances.clear();
          } else {
            distances = new LocalCollection._IdMap();
          }
        }
        this.collection._docs.forEach((doc, id) => {
          const matchResult = this.matcher.documentMatches(doc);
          if (matchResult.result) {
            if (options.ordered) {
              results.push(doc);
              if (distances && matchResult.distance !== undefined) {
                distances.set(id, matchResult.distance);
              }
            } else {
              results.set(id, doc);
            }
          }

          // Override to ensure all docs are matched if ignoring skip & limit
          if (!applySkipLimit) {
            return true;
          }

          // Fast path for limited unsorted queries.
          // XXX 'length' check here seems wrong for ordered
          return !this.limit || this.skip || this.sorter || results.length !== this.limit;
        });
        if (!options.ordered) {
          return results;
        }
        if (this.sorter) {
          results.sort(this.sorter.getComparator({
            distances
          }));
        }

        // Return the full set of results if there is no skip or limit or if we're
        // ignoring them
        if (!applySkipLimit || !this.limit && !this.skip) {
          return results;
        }
        return results.slice(this.skip, this.limit ? this.limit + this.skip : results.length);
      }
      _publishCursor(subscription) {
        // XXX minimongo should not depend on mongo-livedata!
        if (!Package.mongo) {
          throw new Error('Can\'t publish from Minimongo without the `mongo` package.');
        }
        if (!this.collection.name) {
          throw new Error('Can\'t publish a cursor from a collection without a name.');
        }
        return Package.mongo.Mongo.Collection._publishCursor(this, subscription, this.collection.name);
      }
    }
    // Implements async version of cursor methods to keep collections isomorphic
    ASYNC_CURSOR_METHODS.forEach(method => {
      const asyncName = getAsyncMethodName(method);
      Cursor.prototype[asyncName] = function () {
        try {
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          return Promise.resolve(this[method].apply(this, args));
        } catch (error) {
          return Promise.reject(error);
        }
      };
    });
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"local_collection.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/local_collection.js                                                                            //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectSpread;
    module.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 0);
    module.export({
      default: () => LocalCollection
    });
    let Cursor;
    module.link("./cursor.js", {
      default(v) {
        Cursor = v;
      }
    }, 0);
    let ObserveHandle;
    module.link("./observe_handle.js", {
      default(v) {
        ObserveHandle = v;
      }
    }, 1);
    let hasOwn, isIndexable, isNumericKey, isOperatorObject, populateDocumentWithQueryFields, projectionDetails;
    module.link("./common.js", {
      hasOwn(v) {
        hasOwn = v;
      },
      isIndexable(v) {
        isIndexable = v;
      },
      isNumericKey(v) {
        isNumericKey = v;
      },
      isOperatorObject(v) {
        isOperatorObject = v;
      },
      populateDocumentWithQueryFields(v) {
        populateDocumentWithQueryFields = v;
      },
      projectionDetails(v) {
        projectionDetails = v;
      }
    }, 2);
    let getAsyncMethodName;
    module.link("./constants", {
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      }
    }, 3);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class LocalCollection {
      constructor(name) {
        this.name = name;
        // _id -> document (also containing id)
        this._docs = new LocalCollection._IdMap();
        this._observeQueue = Meteor.isClient ? new Meteor._SynchronousQueue() : new Meteor._AsynchronousQueue();
        this.next_qid = 1; // live query id generator

        // qid -> live query object. keys:
        //  ordered: bool. ordered queries have addedBefore/movedBefore callbacks.
        //  results: array (ordered) or object (unordered) of current results
        //    (aliased with this._docs!)
        //  resultsSnapshot: snapshot of results. null if not paused.
        //  cursor: Cursor object for the query.
        //  selector, sorter, (callbacks): functions
        this.queries = Object.create(null);

        // null if not saving originals; an IdMap from id to original document value
        // if saving originals. See comments before saveOriginals().
        this._savedOriginals = null;

        // True when observers are paused and we should not send callbacks.
        this.paused = false;
      }
      countDocuments(selector, options) {
        return this.find(selector !== null && selector !== void 0 ? selector : {}, options).countAsync();
      }
      estimatedDocumentCount(options) {
        return this.find({}, options).countAsync();
      }

      // options may include sort, skip, limit, reactive
      // sort may be any of these forms:
      //     {a: 1, b: -1}
      //     [["a", "asc"], ["b", "desc"]]
      //     ["a", ["b", "desc"]]
      //   (in the first form you're beholden to key enumeration order in
      //   your javascript VM)
      //
      // reactive: if given, and false, don't register with Tracker (default
      // is true)
      //
      // XXX possibly should support retrieving a subset of fields? and
      // have it be a hint (ignored on the client, when not copying the
      // doc?)
      //
      // XXX sort does not yet support subkeys ('a.b') .. fix that!
      // XXX add one more sort form: "key"
      // XXX tests
      find(selector, options) {
        // default syntax for everything is to omit the selector argument.
        // but if selector is explicitly passed in as false or undefined, we
        // want a selector that matches nothing.
        if (arguments.length === 0) {
          selector = {};
        }
        return new LocalCollection.Cursor(this, selector, options);
      }
      findOne(selector) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        if (arguments.length === 0) {
          selector = {};
        }

        // NOTE: by setting limit 1 here, we end up using very inefficient
        // code that recomputes the whole query on each update. The upside is
        // that when you reactively depend on a findOne you only get
        // invalidated when the found object changes, not any object in the
        // collection. Most findOne will be by id, which has a fast path, so
        // this might not be a big deal. In most cases, invalidation causes
        // the called to re-query anyway, so this should be a net performance
        // improvement.
        options.limit = 1;
        return this.find(selector, options).fetch()[0];
      }
      async findOneAsync(selector) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        if (arguments.length === 0) {
          selector = {};
        }
        options.limit = 1;
        return (await this.find(selector, options).fetchAsync())[0];
      }
      prepareInsert(doc) {
        assertHasValidFieldNames(doc);

        // if you really want to use ObjectIDs, set this global.
        // Mongo.Collection specifies its own ids and does not use this code.
        if (!hasOwn.call(doc, '_id')) {
          doc._id = LocalCollection._useOID ? new MongoID.ObjectID() : Random.id();
        }
        const id = doc._id;
        if (this._docs.has(id)) {
          throw MinimongoError("Duplicate _id '".concat(id, "'"));
        }
        this._saveOriginal(id, undefined);
        this._docs.set(id, doc);
        return id;
      }

      // XXX possibly enforce that 'undefined' does not appear (we assume
      // this in our handling of null and $exists)
      insert(doc, callback) {
        doc = EJSON.clone(doc);
        const id = this.prepareInsert(doc);
        const queriesToRecompute = [];

        // trigger live queries that match
        for (const qid of Object.keys(this.queries)) {
          const query = this.queries[qid];
          if (query.dirty) {
            continue;
          }
          const matchResult = query.matcher.documentMatches(doc);
          if (matchResult.result) {
            if (query.distances && matchResult.distance !== undefined) {
              query.distances.set(id, matchResult.distance);
            }
            if (query.cursor.skip || query.cursor.limit) {
              queriesToRecompute.push(qid);
            } else {
              LocalCollection._insertInResultsSync(query, doc);
            }
          }
        }
        queriesToRecompute.forEach(qid => {
          if (this.queries[qid]) {
            this._recomputeResults(this.queries[qid]);
          }
        });
        this._observeQueue.drain();
        if (callback) {
          Meteor.defer(() => {
            callback(null, id);
          });
        }
        return id;
      }
      async insertAsync(doc, callback) {
        doc = EJSON.clone(doc);
        const id = this.prepareInsert(doc);
        const queriesToRecompute = [];

        // trigger live queries that match
        for (const qid of Object.keys(this.queries)) {
          const query = this.queries[qid];
          if (query.dirty) {
            continue;
          }
          const matchResult = query.matcher.documentMatches(doc);
          if (matchResult.result) {
            if (query.distances && matchResult.distance !== undefined) {
              query.distances.set(id, matchResult.distance);
            }
            if (query.cursor.skip || query.cursor.limit) {
              queriesToRecompute.push(qid);
            } else {
              await LocalCollection._insertInResultsAsync(query, doc);
            }
          }
        }
        queriesToRecompute.forEach(qid => {
          if (this.queries[qid]) {
            this._recomputeResults(this.queries[qid]);
          }
        });
        await this._observeQueue.drain();
        if (callback) {
          Meteor.defer(() => {
            callback(null, id);
          });
        }
        return id;
      }

      // Pause the observers. No callbacks from observers will fire until
      // 'resumeObservers' is called.
      pauseObservers() {
        // No-op if already paused.
        if (this.paused) {
          return;
        }

        // Set the 'paused' flag such that new observer messages don't fire.
        this.paused = true;

        // Take a snapshot of the query results for each query.
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          query.resultsSnapshot = EJSON.clone(query.results);
        });
      }
      clearResultQueries(callback) {
        const result = this._docs.size();
        this._docs.clear();
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          if (query.ordered) {
            query.results = [];
          } else {
            query.results.clear();
          }
        });
        if (callback) {
          Meteor.defer(() => {
            callback(null, result);
          });
        }
        return result;
      }
      prepareRemove(selector) {
        const matcher = new Minimongo.Matcher(selector);
        const remove = [];
        this._eachPossiblyMatchingDocSync(selector, (doc, id) => {
          if (matcher.documentMatches(doc).result) {
            remove.push(id);
          }
        });
        const queriesToRecompute = [];
        const queryRemove = [];
        for (let i = 0; i < remove.length; i++) {
          const removeId = remove[i];
          const removeDoc = this._docs.get(removeId);
          Object.keys(this.queries).forEach(qid => {
            const query = this.queries[qid];
            if (query.dirty) {
              return;
            }
            if (query.matcher.documentMatches(removeDoc).result) {
              if (query.cursor.skip || query.cursor.limit) {
                queriesToRecompute.push(qid);
              } else {
                queryRemove.push({
                  qid,
                  doc: removeDoc
                });
              }
            }
          });
          this._saveOriginal(removeId, removeDoc);
          this._docs.remove(removeId);
        }
        return {
          queriesToRecompute,
          queryRemove,
          remove
        };
      }
      remove(selector, callback) {
        // Easy special case: if we're not calling observeChanges callbacks and
        // we're not saving originals and we got asked to remove everything, then
        // just empty everything directly.
        if (this.paused && !this._savedOriginals && EJSON.equals(selector, {})) {
          return this.clearResultQueries(callback);
        }
        const {
          queriesToRecompute,
          queryRemove,
          remove
        } = this.prepareRemove(selector);

        // run live query callbacks _after_ we've removed the documents.
        queryRemove.forEach(remove => {
          const query = this.queries[remove.qid];
          if (query) {
            query.distances && query.distances.remove(remove.doc._id);
            LocalCollection._removeFromResultsSync(query, remove.doc);
          }
        });
        queriesToRecompute.forEach(qid => {
          const query = this.queries[qid];
          if (query) {
            this._recomputeResults(query);
          }
        });
        this._observeQueue.drain();
        const result = remove.length;
        if (callback) {
          Meteor.defer(() => {
            callback(null, result);
          });
        }
        return result;
      }
      async removeAsync(selector, callback) {
        // Easy special case: if we're not calling observeChanges callbacks and
        // we're not saving originals and we got asked to remove everything, then
        // just empty everything directly.
        if (this.paused && !this._savedOriginals && EJSON.equals(selector, {})) {
          return this.clearResultQueries(callback);
        }
        const {
          queriesToRecompute,
          queryRemove,
          remove
        } = this.prepareRemove(selector);

        // run live query callbacks _after_ we've removed the documents.
        for (const remove of queryRemove) {
          const query = this.queries[remove.qid];
          if (query) {
            query.distances && query.distances.remove(remove.doc._id);
            await LocalCollection._removeFromResultsAsync(query, remove.doc);
          }
        }
        queriesToRecompute.forEach(qid => {
          const query = this.queries[qid];
          if (query) {
            this._recomputeResults(query);
          }
        });
        await this._observeQueue.drain();
        const result = remove.length;
        if (callback) {
          Meteor.defer(() => {
            callback(null, result);
          });
        }
        return result;
      }

      // Resume the observers. Observers immediately receive change
      // notifications to bring them to the current state of the
      // database. Note that this is not just replaying all the changes that
      // happened during the pause, it is a smarter 'coalesced' diff.
      _resumeObservers() {
        // No-op if not paused.
        if (!this.paused) {
          return;
        }

        // Unset the 'paused' flag. Make sure to do this first, otherwise
        // observer methods won't actually fire when we trigger them.
        this.paused = false;
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          if (query.dirty) {
            query.dirty = false;

            // re-compute results will perform `LocalCollection._diffQueryChanges`
            // automatically.
            this._recomputeResults(query, query.resultsSnapshot);
          } else {
            // Diff the current results against the snapshot and send to observers.
            // pass the query object for its observer callbacks.
            LocalCollection._diffQueryChanges(query.ordered, query.resultsSnapshot, query.results, query, {
              projectionFn: query.projectionFn
            });
          }
          query.resultsSnapshot = null;
        });
      }
      async resumeObserversServer() {
        this._resumeObservers();
        await this._observeQueue.drain();
      }
      resumeObserversClient() {
        this._resumeObservers();
        this._observeQueue.drain();
      }
      retrieveOriginals() {
        if (!this._savedOriginals) {
          throw new Error('Called retrieveOriginals without saveOriginals');
        }
        const originals = this._savedOriginals;
        this._savedOriginals = null;
        return originals;
      }

      // To track what documents are affected by a piece of code, call
      // saveOriginals() before it and retrieveOriginals() after it.
      // retrieveOriginals returns an object whose keys are the ids of the documents
      // that were affected since the call to saveOriginals(), and the values are
      // equal to the document's contents at the time of saveOriginals. (In the case
      // of an inserted document, undefined is the value.) You must alternate
      // between calls to saveOriginals() and retrieveOriginals().
      saveOriginals() {
        if (this._savedOriginals) {
          throw new Error('Called saveOriginals twice without retrieveOriginals');
        }
        this._savedOriginals = new LocalCollection._IdMap();
      }
      prepareUpdate(selector) {
        // Save the original results of any query that we might need to
        // _recomputeResults on, because _modifyAndNotify will mutate the objects in
        // it. (We don't need to save the original results of paused queries because
        // they already have a resultsSnapshot and we won't be diffing in
        // _recomputeResults.)
        const qidToOriginalResults = {};

        // We should only clone each document once, even if it appears in multiple
        // queries
        const docMap = new LocalCollection._IdMap();
        const idsMatched = LocalCollection._idsMatchedBySelector(selector);
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          if ((query.cursor.skip || query.cursor.limit) && !this.paused) {
            // Catch the case of a reactive `count()` on a cursor with skip
            // or limit, which registers an unordered observe. This is a
            // pretty rare case, so we just clone the entire result set with
            // no optimizations for documents that appear in these result
            // sets and other queries.
            if (query.results instanceof LocalCollection._IdMap) {
              qidToOriginalResults[qid] = query.results.clone();
              return;
            }
            if (!(query.results instanceof Array)) {
              throw new Error('Assertion failed: query.results not an array');
            }

            // Clones a document to be stored in `qidToOriginalResults`
            // because it may be modified before the new and old result sets
            // are diffed. But if we know exactly which document IDs we're
            // going to modify, then we only need to clone those.
            const memoizedCloneIfNeeded = doc => {
              if (docMap.has(doc._id)) {
                return docMap.get(doc._id);
              }
              const docToMemoize = idsMatched && !idsMatched.some(id => EJSON.equals(id, doc._id)) ? doc : EJSON.clone(doc);
              docMap.set(doc._id, docToMemoize);
              return docToMemoize;
            };
            qidToOriginalResults[qid] = query.results.map(memoizedCloneIfNeeded);
          }
        });
        return qidToOriginalResults;
      }
      finishUpdate(_ref) {
        let {
          options,
          updateCount,
          callback,
          insertedId
        } = _ref;
        // Return the number of affected documents, or in the upsert case, an object
        // containing the number of affected docs and the id of the doc that was
        // inserted, if any.
        let result;
        if (options._returnObject) {
          result = {
            numberAffected: updateCount
          };
          if (insertedId !== undefined) {
            result.insertedId = insertedId;
          }
        } else {
          result = updateCount;
        }
        if (callback) {
          Meteor.defer(() => {
            callback(null, result);
          });
        }
        return result;
      }

      // XXX atomicity: if multi is true, and one modification fails, do
      // we rollback the whole operation, or what?
      async updateAsync(selector, mod, options, callback) {
        if (!callback && options instanceof Function) {
          callback = options;
          options = null;
        }
        if (!options) {
          options = {};
        }
        const matcher = new Minimongo.Matcher(selector, true);
        const qidToOriginalResults = this.prepareUpdate(selector);
        let recomputeQids = {};
        let updateCount = 0;
        await this._eachPossiblyMatchingDocAsync(selector, async (doc, id) => {
          const queryResult = matcher.documentMatches(doc);
          if (queryResult.result) {
            // XXX Should we save the original even if mod ends up being a no-op?
            this._saveOriginal(id, doc);
            recomputeQids = await this._modifyAndNotifyAsync(doc, mod, queryResult.arrayIndices);
            ++updateCount;
            if (!options.multi) {
              return false; // break
            }
          }

          return true;
        });
        Object.keys(recomputeQids).forEach(qid => {
          const query = this.queries[qid];
          if (query) {
            this._recomputeResults(query, qidToOriginalResults[qid]);
          }
        });
        await this._observeQueue.drain();

        // If we are doing an upsert, and we didn't modify any documents yet, then
        // it's time to do an insert. Figure out what document we are inserting, and
        // generate an id for it.
        let insertedId;
        if (updateCount === 0 && options.upsert) {
          const doc = LocalCollection._createUpsertDocument(selector, mod);
          if (!doc._id && options.insertedId) {
            doc._id = options.insertedId;
          }
          insertedId = await this.insertAsync(doc);
          updateCount = 1;
        }
        return this.finishUpdate({
          options,
          insertedId,
          updateCount,
          callback
        });
      }
      // XXX atomicity: if multi is true, and one modification fails, do
      // we rollback the whole operation, or what?
      update(selector, mod, options, callback) {
        if (!callback && options instanceof Function) {
          callback = options;
          options = null;
        }
        if (!options) {
          options = {};
        }
        const matcher = new Minimongo.Matcher(selector, true);
        const qidToOriginalResults = this.prepareUpdate(selector);
        let recomputeQids = {};
        let updateCount = 0;
        this._eachPossiblyMatchingDocSync(selector, (doc, id) => {
          const queryResult = matcher.documentMatches(doc);
          if (queryResult.result) {
            // XXX Should we save the original even if mod ends up being a no-op?
            this._saveOriginal(id, doc);
            recomputeQids = this._modifyAndNotifySync(doc, mod, queryResult.arrayIndices);
            ++updateCount;
            if (!options.multi) {
              return false; // break
            }
          }

          return true;
        });
        Object.keys(recomputeQids).forEach(qid => {
          const query = this.queries[qid];
          if (query) {
            this._recomputeResults(query, qidToOriginalResults[qid]);
          }
        });
        this._observeQueue.drain();
        return this.finishUpdate({
          options,
          updateCount,
          callback,
          selector,
          mod
        });
      }

      // A convenience wrapper on update. LocalCollection.upsert(sel, mod) is
      // equivalent to LocalCollection.update(sel, mod, {upsert: true,
      // _returnObject: true}).
      upsert(selector, mod, options, callback) {
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        }
        return this.update(selector, mod, Object.assign({}, options, {
          upsert: true,
          _returnObject: true
        }), callback);
      }
      upsertAsync(selector, mod, options, callback) {
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        }
        return this.updateAsync(selector, mod, Object.assign({}, options, {
          upsert: true,
          _returnObject: true
        }), callback);
      }

      // Iterates over a subset of documents that could match selector; calls
      // fn(doc, id) on each of them.  Specifically, if selector specifies
      // specific _id's, it only looks at those.  doc is *not* cloned: it is the
      // same object that is in _docs.
      async _eachPossiblyMatchingDocAsync(selector, fn) {
        const specificIds = LocalCollection._idsMatchedBySelector(selector);
        if (specificIds) {
          for (const id of specificIds) {
            const doc = this._docs.get(id);
            if (doc && !(await fn(doc, id))) {
              break;
            }
          }
        } else {
          await this._docs.forEachAsync(fn);
        }
      }
      _eachPossiblyMatchingDocSync(selector, fn) {
        const specificIds = LocalCollection._idsMatchedBySelector(selector);
        if (specificIds) {
          for (const id of specificIds) {
            const doc = this._docs.get(id);
            if (doc && !fn(doc, id)) {
              break;
            }
          }
        } else {
          this._docs.forEach(fn);
        }
      }
      _getMatchedDocAndModify(doc, mod, arrayIndices) {
        const matched_before = {};
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          if (query.dirty) {
            return;
          }
          if (query.ordered) {
            matched_before[qid] = query.matcher.documentMatches(doc).result;
          } else {
            // Because we don't support skip or limit (yet) in unordered queries, we
            // can just do a direct lookup.
            matched_before[qid] = query.results.has(doc._id);
          }
        });
        return matched_before;
      }
      _modifyAndNotifySync(doc, mod, arrayIndices) {
        const matched_before = this._getMatchedDocAndModify(doc, mod, arrayIndices);
        const old_doc = EJSON.clone(doc);
        LocalCollection._modify(doc, mod, {
          arrayIndices
        });
        const recomputeQids = {};
        for (const qid of Object.keys(this.queries)) {
          const query = this.queries[qid];
          if (query.dirty) {
            continue;
          }
          const afterMatch = query.matcher.documentMatches(doc);
          const after = afterMatch.result;
          const before = matched_before[qid];
          if (after && query.distances && afterMatch.distance !== undefined) {
            query.distances.set(doc._id, afterMatch.distance);
          }
          if (query.cursor.skip || query.cursor.limit) {
            // We need to recompute any query where the doc may have been in the
            // cursor's window either before or after the update. (Note that if skip
            // or limit is set, "before" and "after" being true do not necessarily
            // mean that the document is in the cursor's output after skip/limit is
            // applied... but if they are false, then the document definitely is NOT
            // in the output. So it's safe to skip recompute if neither before or
            // after are true.)
            if (before || after) {
              recomputeQids[qid] = true;
            }
          } else if (before && !after) {
            LocalCollection._removeFromResultsSync(query, doc);
          } else if (!before && after) {
            LocalCollection._insertInResultsSync(query, doc);
          } else if (before && after) {
            LocalCollection._updateInResultsSync(query, doc, old_doc);
          }
        }
        return recomputeQids;
      }
      async _modifyAndNotifyAsync(doc, mod, arrayIndices) {
        const matched_before = this._getMatchedDocAndModify(doc, mod, arrayIndices);
        const old_doc = EJSON.clone(doc);
        LocalCollection._modify(doc, mod, {
          arrayIndices
        });
        const recomputeQids = {};
        for (const qid of Object.keys(this.queries)) {
          const query = this.queries[qid];
          if (query.dirty) {
            continue;
          }
          const afterMatch = query.matcher.documentMatches(doc);
          const after = afterMatch.result;
          const before = matched_before[qid];
          if (after && query.distances && afterMatch.distance !== undefined) {
            query.distances.set(doc._id, afterMatch.distance);
          }
          if (query.cursor.skip || query.cursor.limit) {
            // We need to recompute any query where the doc may have been in the
            // cursor's window either before or after the update. (Note that if skip
            // or limit is set, "before" and "after" being true do not necessarily
            // mean that the document is in the cursor's output after skip/limit is
            // applied... but if they are false, then the document definitely is NOT
            // in the output. So it's safe to skip recompute if neither before or
            // after are true.)
            if (before || after) {
              recomputeQids[qid] = true;
            }
          } else if (before && !after) {
            await LocalCollection._removeFromResultsAsync(query, doc);
          } else if (!before && after) {
            await LocalCollection._insertInResultsAsync(query, doc);
          } else if (before && after) {
            await LocalCollection._updateInResultsAsync(query, doc, old_doc);
          }
        }
        return recomputeQids;
      }

      // Recomputes the results of a query and runs observe callbacks for the
      // difference between the previous results and the current results (unless
      // paused). Used for skip/limit queries.
      //
      // When this is used by insert or remove, it can just use query.results for
      // the old results (and there's no need to pass in oldResults), because these
      // operations don't mutate the documents in the collection. Update needs to
      // pass in an oldResults which was deep-copied before the modifier was
      // applied.
      //
      // oldResults is guaranteed to be ignored if the query is not paused.
      _recomputeResults(query, oldResults) {
        if (this.paused) {
          // There's no reason to recompute the results now as we're still paused.
          // By flagging the query as "dirty", the recompute will be performed
          // when resumeObservers is called.
          query.dirty = true;
          return;
        }
        if (!this.paused && !oldResults) {
          oldResults = query.results;
        }
        if (query.distances) {
          query.distances.clear();
        }
        query.results = query.cursor._getRawObjects({
          distances: query.distances,
          ordered: query.ordered
        });
        if (!this.paused) {
          LocalCollection._diffQueryChanges(query.ordered, oldResults, query.results, query, {
            projectionFn: query.projectionFn
          });
        }
      }
      _saveOriginal(id, doc) {
        // Are we even trying to save originals?
        if (!this._savedOriginals) {
          return;
        }

        // Have we previously mutated the original (and so 'doc' is not actually
        // original)?  (Note the 'has' check rather than truth: we store undefined
        // here for inserted docs!)
        if (this._savedOriginals.has(id)) {
          return;
        }
        this._savedOriginals.set(id, EJSON.clone(doc));
      }
    }
    LocalCollection.Cursor = Cursor;
    LocalCollection.ObserveHandle = ObserveHandle;

    // XXX maybe move these into another ObserveHelpers package or something

    // _CachingChangeObserver is an object which receives observeChanges callbacks
    // and keeps a cache of the current cursor state up to date in this.docs. Users
    // of this class should read the docs field but not modify it. You should pass
    // the "applyChange" field as the callbacks to the underlying observeChanges
    // call. Optionally, you can specify your own observeChanges callbacks which are
    // invoked immediately before the docs field is updated; this object is made
    // available as `this` to those callbacks.
    LocalCollection._CachingChangeObserver = class _CachingChangeObserver {
      constructor() {
        let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        const orderedFromCallbacks = options.callbacks && LocalCollection._observeChangesCallbacksAreOrdered(options.callbacks);
        if (hasOwn.call(options, 'ordered')) {
          this.ordered = options.ordered;
          if (options.callbacks && options.ordered !== orderedFromCallbacks) {
            throw Error('ordered option doesn\'t match callbacks');
          }
        } else if (options.callbacks) {
          this.ordered = orderedFromCallbacks;
        } else {
          throw Error('must provide ordered or callbacks');
        }
        const callbacks = options.callbacks || {};
        if (this.ordered) {
          this.docs = new OrderedDict(MongoID.idStringify);
          this.applyChange = {
            addedBefore: (id, fields, before) => {
              // Take a shallow copy since the top-level properties can be changed
              const doc = _objectSpread({}, fields);
              doc._id = id;
              if (callbacks.addedBefore) {
                callbacks.addedBefore.call(this, id, EJSON.clone(fields), before);
              }

              // This line triggers if we provide added with movedBefore.
              if (callbacks.added) {
                callbacks.added.call(this, id, EJSON.clone(fields));
              }

              // XXX could `before` be a falsy ID?  Technically
              // idStringify seems to allow for them -- though
              // OrderedDict won't call stringify on a falsy arg.
              this.docs.putBefore(id, doc, before || null);
            },
            movedBefore: (id, before) => {
              if (callbacks.movedBefore) {
                callbacks.movedBefore.call(this, id, before);
              }
              this.docs.moveBefore(id, before || null);
            }
          };
        } else {
          this.docs = new LocalCollection._IdMap();
          this.applyChange = {
            added: (id, fields) => {
              // Take a shallow copy since the top-level properties can be changed
              const doc = _objectSpread({}, fields);
              if (callbacks.added) {
                callbacks.added.call(this, id, EJSON.clone(fields));
              }
              doc._id = id;
              this.docs.set(id, doc);
            }
          };
        }

        // The methods in _IdMap and OrderedDict used by these callbacks are
        // identical.
        this.applyChange.changed = (id, fields) => {
          const doc = this.docs.get(id);
          if (!doc) {
            throw new Error("Unknown id for changed: ".concat(id));
          }
          if (callbacks.changed) {
            callbacks.changed.call(this, id, EJSON.clone(fields));
          }
          DiffSequence.applyChanges(doc, fields);
        };
        this.applyChange.removed = id => {
          if (callbacks.removed) {
            callbacks.removed.call(this, id);
          }
          this.docs.remove(id);
        };
      }
    };
    LocalCollection._IdMap = class _IdMap extends IdMap {
      constructor() {
        super(MongoID.idStringify, MongoID.idParse);
      }
    };

    // Wrap a transform function to return objects that have the _id field
    // of the untransformed document. This ensures that subsystems such as
    // the observe-sequence package that call `observe` can keep track of
    // the documents identities.
    //
    // - Require that it returns objects
    // - If the return value has an _id field, verify that it matches the
    //   original _id field
    // - If the return value doesn't have an _id field, add it back.
    LocalCollection.wrapTransform = transform => {
      if (!transform) {
        return null;
      }

      // No need to doubly-wrap transforms.
      if (transform.__wrappedTransform__) {
        return transform;
      }
      const wrapped = doc => {
        if (!hasOwn.call(doc, '_id')) {
          // XXX do we ever have a transform on the oplog's collection? because that
          // collection has no _id.
          throw new Error('can only transform documents with _id');
        }
        const id = doc._id;

        // XXX consider making tracker a weak dependency and checking
        // Package.tracker here
        const transformed = Tracker.nonreactive(() => transform(doc));
        if (!LocalCollection._isPlainObject(transformed)) {
          throw new Error('transform must return object');
        }
        if (hasOwn.call(transformed, '_id')) {
          if (!EJSON.equals(transformed._id, id)) {
            throw new Error('transformed document can\'t have different _id');
          }
        } else {
          transformed._id = id;
        }
        return transformed;
      };
      wrapped.__wrappedTransform__ = true;
      return wrapped;
    };

    // XXX the sorted-query logic below is laughably inefficient. we'll
    // need to come up with a better datastructure for this.
    //
    // XXX the logic for observing with a skip or a limit is even more
    // laughably inefficient. we recompute the whole results every time!

    // This binary search puts a value between any equal values, and the first
    // lesser value.
    LocalCollection._binarySearch = (cmp, array, value) => {
      let first = 0;
      let range = array.length;
      while (range > 0) {
        const halfRange = Math.floor(range / 2);
        if (cmp(value, array[first + halfRange]) >= 0) {
          first += halfRange + 1;
          range -= halfRange + 1;
        } else {
          range = halfRange;
        }
      }
      return first;
    };
    LocalCollection._checkSupportedProjection = fields => {
      if (fields !== Object(fields) || Array.isArray(fields)) {
        throw MinimongoError('fields option must be an object');
      }
      Object.keys(fields).forEach(keyPath => {
        if (keyPath.split('.').includes('$')) {
          throw MinimongoError('Minimongo doesn\'t support $ operator in projections yet.');
        }
        const value = fields[keyPath];
        if (typeof value === 'object' && ['$elemMatch', '$meta', '$slice'].some(key => hasOwn.call(value, key))) {
          throw MinimongoError('Minimongo doesn\'t support operators in projections yet.');
        }
        if (![1, 0, true, false].includes(value)) {
          throw MinimongoError('Projection values should be one of 1, 0, true, or false');
        }
      });
    };

    // Knows how to compile a fields projection to a predicate function.
    // @returns - Function: a closure that filters out an object according to the
    //            fields projection rules:
    //            @param obj - Object: MongoDB-styled document
    //            @returns - Object: a document with the fields filtered out
    //                       according to projection rules. Doesn't retain subfields
    //                       of passed argument.
    LocalCollection._compileProjection = fields => {
      LocalCollection._checkSupportedProjection(fields);
      const _idProjection = fields._id === undefined ? true : fields._id;
      const details = projectionDetails(fields);

      // returns transformed doc according to ruleTree
      const transform = (doc, ruleTree) => {
        // Special case for "sets"
        if (Array.isArray(doc)) {
          return doc.map(subdoc => transform(subdoc, ruleTree));
        }
        const result = details.including ? {} : EJSON.clone(doc);
        Object.keys(ruleTree).forEach(key => {
          if (doc == null || !hasOwn.call(doc, key)) {
            return;
          }
          const rule = ruleTree[key];
          if (rule === Object(rule)) {
            // For sub-objects/subsets we branch
            if (doc[key] === Object(doc[key])) {
              result[key] = transform(doc[key], rule);
            }
          } else if (details.including) {
            // Otherwise we don't even touch this subfield
            result[key] = EJSON.clone(doc[key]);
          } else {
            delete result[key];
          }
        });
        return doc != null ? result : doc;
      };
      return doc => {
        const result = transform(doc, details.tree);
        if (_idProjection && hasOwn.call(doc, '_id')) {
          result._id = doc._id;
        }
        if (!_idProjection && hasOwn.call(result, '_id')) {
          delete result._id;
        }
        return result;
      };
    };

    // Calculates the document to insert in case we're doing an upsert and the
    // selector does not match any elements
    LocalCollection._createUpsertDocument = (selector, modifier) => {
      const selectorDocument = populateDocumentWithQueryFields(selector);
      const isModify = LocalCollection._isModificationMod(modifier);
      const newDoc = {};
      if (selectorDocument._id) {
        newDoc._id = selectorDocument._id;
        delete selectorDocument._id;
      }

      // This double _modify call is made to help with nested properties (see issue
      // #8631). We do this even if it's a replacement for validation purposes (e.g.
      // ambiguous id's)
      LocalCollection._modify(newDoc, {
        $set: selectorDocument
      });
      LocalCollection._modify(newDoc, modifier, {
        isInsert: true
      });
      if (isModify) {
        return newDoc;
      }

      // Replacement can take _id from query document
      const replacement = Object.assign({}, modifier);
      if (newDoc._id) {
        replacement._id = newDoc._id;
      }
      return replacement;
    };
    LocalCollection._diffObjects = (left, right, callbacks) => {
      return DiffSequence.diffObjects(left, right, callbacks);
    };

    // ordered: bool.
    // old_results and new_results: collections of documents.
    //    if ordered, they are arrays.
    //    if unordered, they are IdMaps
    LocalCollection._diffQueryChanges = (ordered, oldResults, newResults, observer, options) => DiffSequence.diffQueryChanges(ordered, oldResults, newResults, observer, options);
    LocalCollection._diffQueryOrderedChanges = (oldResults, newResults, observer, options) => DiffSequence.diffQueryOrderedChanges(oldResults, newResults, observer, options);
    LocalCollection._diffQueryUnorderedChanges = (oldResults, newResults, observer, options) => DiffSequence.diffQueryUnorderedChanges(oldResults, newResults, observer, options);
    LocalCollection._findInOrderedResults = (query, doc) => {
      if (!query.ordered) {
        throw new Error('Can\'t call _findInOrderedResults on unordered query');
      }
      for (let i = 0; i < query.results.length; i++) {
        if (query.results[i] === doc) {
          return i;
        }
      }
      throw Error('object missing from query');
    };

    // If this is a selector which explicitly constrains the match by ID to a finite
    // number of documents, returns a list of their IDs.  Otherwise returns
    // null. Note that the selector may have other restrictions so it may not even
    // match those document!  We care about $in and $and since those are generated
    // access-controlled update and remove.
    LocalCollection._idsMatchedBySelector = selector => {
      // Is the selector just an ID?
      if (LocalCollection._selectorIsId(selector)) {
        return [selector];
      }
      if (!selector) {
        return null;
      }

      // Do we have an _id clause?
      if (hasOwn.call(selector, '_id')) {
        // Is the _id clause just an ID?
        if (LocalCollection._selectorIsId(selector._id)) {
          return [selector._id];
        }

        // Is the _id clause {_id: {$in: ["x", "y", "z"]}}?
        if (selector._id && Array.isArray(selector._id.$in) && selector._id.$in.length && selector._id.$in.every(LocalCollection._selectorIsId)) {
          return selector._id.$in;
        }
        return null;
      }

      // If this is a top-level $and, and any of the clauses constrain their
      // documents, then the whole selector is constrained by any one clause's
      // constraint. (Well, by their intersection, but that seems unlikely.)
      if (Array.isArray(selector.$and)) {
        for (let i = 0; i < selector.$and.length; ++i) {
          const subIds = LocalCollection._idsMatchedBySelector(selector.$and[i]);
          if (subIds) {
            return subIds;
          }
        }
      }
      return null;
    };
    LocalCollection._insertInResultsSync = (query, doc) => {
      const fields = EJSON.clone(doc);
      delete fields._id;
      if (query.ordered) {
        if (!query.sorter) {
          query.addedBefore(doc._id, query.projectionFn(fields), null);
          query.results.push(doc);
        } else {
          const i = LocalCollection._insertInSortedList(query.sorter.getComparator({
            distances: query.distances
          }), query.results, doc);
          let next = query.results[i + 1];
          if (next) {
            next = next._id;
          } else {
            next = null;
          }
          query.addedBefore(doc._id, query.projectionFn(fields), next);
        }
        query.added(doc._id, query.projectionFn(fields));
      } else {
        query.added(doc._id, query.projectionFn(fields));
        query.results.set(doc._id, doc);
      }
    };
    LocalCollection._insertInResultsAsync = async (query, doc) => {
      const fields = EJSON.clone(doc);
      delete fields._id;
      if (query.ordered) {
        if (!query.sorter) {
          await query.addedBefore(doc._id, query.projectionFn(fields), null);
          query.results.push(doc);
        } else {
          const i = LocalCollection._insertInSortedList(query.sorter.getComparator({
            distances: query.distances
          }), query.results, doc);
          let next = query.results[i + 1];
          if (next) {
            next = next._id;
          } else {
            next = null;
          }
          await query.addedBefore(doc._id, query.projectionFn(fields), next);
        }
        await query.added(doc._id, query.projectionFn(fields));
      } else {
        await query.added(doc._id, query.projectionFn(fields));
        query.results.set(doc._id, doc);
      }
    };
    LocalCollection._insertInSortedList = (cmp, array, value) => {
      if (array.length === 0) {
        array.push(value);
        return 0;
      }
      const i = LocalCollection._binarySearch(cmp, array, value);
      array.splice(i, 0, value);
      return i;
    };
    LocalCollection._isModificationMod = mod => {
      let isModify = false;
      let isReplace = false;
      Object.keys(mod).forEach(key => {
        if (key.substr(0, 1) === '$') {
          isModify = true;
        } else {
          isReplace = true;
        }
      });
      if (isModify && isReplace) {
        throw new Error('Update parameter cannot have both modifier and non-modifier fields.');
      }
      return isModify;
    };

    // XXX maybe this should be EJSON.isObject, though EJSON doesn't know about
    // RegExp
    // XXX note that _type(undefined) === 3!!!!
    LocalCollection._isPlainObject = x => {
      return x && LocalCollection._f._type(x) === 3;
    };

    // XXX need a strategy for passing the binding of $ into this
    // function, from the compiled selector
    //
    // maybe just {key.up.to.just.before.dollarsign: array_index}
    //
    // XXX atomicity: if one modification fails, do we roll back the whole
    // change?
    //
    // options:
    //   - isInsert is set when _modify is being called to compute the document to
    //     insert as part of an upsert operation. We use this primarily to figure
    //     out when to set the fields in $setOnInsert, if present.
    LocalCollection._modify = function (doc, modifier) {
      let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      if (!LocalCollection._isPlainObject(modifier)) {
        throw MinimongoError('Modifier must be an object');
      }

      // Make sure the caller can't mutate our data structures.
      modifier = EJSON.clone(modifier);
      const isModifier = isOperatorObject(modifier);
      const newDoc = isModifier ? EJSON.clone(doc) : modifier;
      if (isModifier) {
        // apply modifiers to the doc.
        Object.keys(modifier).forEach(operator => {
          // Treat $setOnInsert as $set if this is an insert.
          const setOnInsert = options.isInsert && operator === '$setOnInsert';
          const modFunc = MODIFIERS[setOnInsert ? '$set' : operator];
          const operand = modifier[operator];
          if (!modFunc) {
            throw MinimongoError("Invalid modifier specified ".concat(operator));
          }
          Object.keys(operand).forEach(keypath => {
            const arg = operand[keypath];
            if (keypath === '') {
              throw MinimongoError('An empty update path is not valid.');
            }
            const keyparts = keypath.split('.');
            if (!keyparts.every(Boolean)) {
              throw MinimongoError("The update path '".concat(keypath, "' contains an empty field name, ") + 'which is not allowed.');
            }
            const target = findModTarget(newDoc, keyparts, {
              arrayIndices: options.arrayIndices,
              forbidArray: operator === '$rename',
              noCreate: NO_CREATE_MODIFIERS[operator]
            });
            modFunc(target, keyparts.pop(), arg, keypath, newDoc);
          });
        });
        if (doc._id && !EJSON.equals(doc._id, newDoc._id)) {
          throw MinimongoError("After applying the update to the document {_id: \"".concat(doc._id, "\", ...},") + ' the (immutable) field \'_id\' was found to have been altered to ' + "_id: \"".concat(newDoc._id, "\""));
        }
      } else {
        if (doc._id && modifier._id && !EJSON.equals(doc._id, modifier._id)) {
          throw MinimongoError("The _id field cannot be changed from {_id: \"".concat(doc._id, "\"} to ") + "{_id: \"".concat(modifier._id, "\"}"));
        }

        // replace the whole document
        assertHasValidFieldNames(modifier);
      }

      // move new document into place.
      Object.keys(doc).forEach(key => {
        // Note: this used to be for (var key in doc) however, this does not
        // work right in Opera. Deleting from a doc while iterating over it
        // would sometimes cause opera to skip some keys.
        if (key !== '_id') {
          delete doc[key];
        }
      });
      Object.keys(newDoc).forEach(key => {
        doc[key] = newDoc[key];
      });
    };
    LocalCollection._observeFromObserveChanges = (cursor, observeCallbacks) => {
      const transform = cursor.getTransform() || (doc => doc);
      let suppressed = !!observeCallbacks._suppress_initial;
      let observeChangesCallbacks;
      if (LocalCollection._observeCallbacksAreOrdered(observeCallbacks)) {
        // The "_no_indices" option sets all index arguments to -1 and skips the
        // linear scans required to generate them.  This lets observers that don't
        // need absolute indices benefit from the other features of this API --
        // relative order, transforms, and applyChanges -- without the speed hit.
        const indices = !observeCallbacks._no_indices;
        observeChangesCallbacks = {
          addedBefore(id, fields, before) {
            const check = suppressed || !(observeCallbacks.addedAt || observeCallbacks.added);
            if (check) {
              return;
            }
            const doc = transform(Object.assign(fields, {
              _id: id
            }));
            if (observeCallbacks.addedAt) {
              observeCallbacks.addedAt(doc, indices ? before ? this.docs.indexOf(before) : this.docs.size() : -1, before);
            } else {
              observeCallbacks.added(doc);
            }
          },
          changed(id, fields) {
            if (!(observeCallbacks.changedAt || observeCallbacks.changed)) {
              return;
            }
            let doc = EJSON.clone(this.docs.get(id));
            if (!doc) {
              throw new Error("Unknown id for changed: ".concat(id));
            }
            const oldDoc = transform(EJSON.clone(doc));
            DiffSequence.applyChanges(doc, fields);
            if (observeCallbacks.changedAt) {
              observeCallbacks.changedAt(transform(doc), oldDoc, indices ? this.docs.indexOf(id) : -1);
            } else {
              observeCallbacks.changed(transform(doc), oldDoc);
            }
          },
          movedBefore(id, before) {
            if (!observeCallbacks.movedTo) {
              return;
            }
            const from = indices ? this.docs.indexOf(id) : -1;
            let to = indices ? before ? this.docs.indexOf(before) : this.docs.size() : -1;

            // When not moving backwards, adjust for the fact that removing the
            // document slides everything back one slot.
            if (to > from) {
              --to;
            }
            observeCallbacks.movedTo(transform(EJSON.clone(this.docs.get(id))), from, to, before || null);
          },
          removed(id) {
            if (!(observeCallbacks.removedAt || observeCallbacks.removed)) {
              return;
            }

            // technically maybe there should be an EJSON.clone here, but it's about
            // to be removed from this.docs!
            const doc = transform(this.docs.get(id));
            if (observeCallbacks.removedAt) {
              observeCallbacks.removedAt(doc, indices ? this.docs.indexOf(id) : -1);
            } else {
              observeCallbacks.removed(doc);
            }
          }
        };
      } else {
        observeChangesCallbacks = {
          added(id, fields) {
            if (!suppressed && observeCallbacks.added) {
              observeCallbacks.added(transform(Object.assign(fields, {
                _id: id
              })));
            }
          },
          changed(id, fields) {
            if (observeCallbacks.changed) {
              const oldDoc = this.docs.get(id);
              const doc = EJSON.clone(oldDoc);
              DiffSequence.applyChanges(doc, fields);
              observeCallbacks.changed(transform(doc), transform(EJSON.clone(oldDoc)));
            }
          },
          removed(id) {
            if (observeCallbacks.removed) {
              observeCallbacks.removed(transform(this.docs.get(id)));
            }
          }
        };
      }
      const changeObserver = new LocalCollection._CachingChangeObserver({
        callbacks: observeChangesCallbacks
      });

      // CachingChangeObserver clones all received input on its callbacks
      // So we can mark it as safe to reduce the ejson clones.
      // This is tested by the `mongo-livedata - (extended) scribbling` tests
      changeObserver.applyChange._fromObserve = true;
      const handle = cursor.observeChanges(changeObserver.applyChange, {
        nonMutatingCallbacks: true
      });

      // If needed, re-enable callbacks as soon as the initial batch is ready.
      const setSuppressed = h => {
        var _h$isReadyPromise;
        if (h.isReady) suppressed = false;else (_h$isReadyPromise = h.isReadyPromise) === null || _h$isReadyPromise === void 0 ? void 0 : _h$isReadyPromise.then(() => suppressed = false);
      };
      // When we call cursor.observeChanges() it can be the on from
      // the mongo package (instead of the minimongo one) and it doesn't have isReady and isReadyPromise
      if (Meteor._isPromise(handle)) {
        handle.then(setSuppressed);
      } else {
        setSuppressed(handle);
      }
      return handle;
    };
    LocalCollection._observeCallbacksAreOrdered = callbacks => {
      if (callbacks.added && callbacks.addedAt) {
        throw new Error('Please specify only one of added() and addedAt()');
      }
      if (callbacks.changed && callbacks.changedAt) {
        throw new Error('Please specify only one of changed() and changedAt()');
      }
      if (callbacks.removed && callbacks.removedAt) {
        throw new Error('Please specify only one of removed() and removedAt()');
      }
      return !!(callbacks.addedAt || callbacks.changedAt || callbacks.movedTo || callbacks.removedAt);
    };
    LocalCollection._observeChangesCallbacksAreOrdered = callbacks => {
      if (callbacks.added && callbacks.addedBefore) {
        throw new Error('Please specify only one of added() and addedBefore()');
      }
      return !!(callbacks.addedBefore || callbacks.movedBefore);
    };
    LocalCollection._removeFromResultsSync = (query, doc) => {
      if (query.ordered) {
        const i = LocalCollection._findInOrderedResults(query, doc);
        query.removed(doc._id);
        query.results.splice(i, 1);
      } else {
        const id = doc._id; // in case callback mutates doc

        query.removed(doc._id);
        query.results.remove(id);
      }
    };
    LocalCollection._removeFromResultsAsync = async (query, doc) => {
      if (query.ordered) {
        const i = LocalCollection._findInOrderedResults(query, doc);
        await query.removed(doc._id);
        query.results.splice(i, 1);
      } else {
        const id = doc._id; // in case callback mutates doc

        await query.removed(doc._id);
        query.results.remove(id);
      }
    };

    // Is this selector just shorthand for lookup by _id?
    LocalCollection._selectorIsId = selector => typeof selector === 'number' || typeof selector === 'string' || selector instanceof MongoID.ObjectID;

    // Is the selector just lookup by _id (shorthand or not)?
    LocalCollection._selectorIsIdPerhapsAsObject = selector => LocalCollection._selectorIsId(selector) || LocalCollection._selectorIsId(selector && selector._id) && Object.keys(selector).length === 1;
    LocalCollection._updateInResultsSync = (query, doc, old_doc) => {
      if (!EJSON.equals(doc._id, old_doc._id)) {
        throw new Error('Can\'t change a doc\'s _id while updating');
      }
      const projectionFn = query.projectionFn;
      const changedFields = DiffSequence.makeChangedFields(projectionFn(doc), projectionFn(old_doc));
      if (!query.ordered) {
        if (Object.keys(changedFields).length) {
          query.changed(doc._id, changedFields);
          query.results.set(doc._id, doc);
        }
        return;
      }
      const old_idx = LocalCollection._findInOrderedResults(query, doc);
      if (Object.keys(changedFields).length) {
        query.changed(doc._id, changedFields);
      }
      if (!query.sorter) {
        return;
      }

      // just take it out and put it back in again, and see if the index changes
      query.results.splice(old_idx, 1);
      const new_idx = LocalCollection._insertInSortedList(query.sorter.getComparator({
        distances: query.distances
      }), query.results, doc);
      if (old_idx !== new_idx) {
        let next = query.results[new_idx + 1];
        if (next) {
          next = next._id;
        } else {
          next = null;
        }
        query.movedBefore && query.movedBefore(doc._id, next);
      }
    };
    LocalCollection._updateInResultsAsync = async (query, doc, old_doc) => {
      if (!EJSON.equals(doc._id, old_doc._id)) {
        throw new Error('Can\'t change a doc\'s _id while updating');
      }
      const projectionFn = query.projectionFn;
      const changedFields = DiffSequence.makeChangedFields(projectionFn(doc), projectionFn(old_doc));
      if (!query.ordered) {
        if (Object.keys(changedFields).length) {
          await query.changed(doc._id, changedFields);
          query.results.set(doc._id, doc);
        }
        return;
      }
      const old_idx = LocalCollection._findInOrderedResults(query, doc);
      if (Object.keys(changedFields).length) {
        await query.changed(doc._id, changedFields);
      }
      if (!query.sorter) {
        return;
      }

      // just take it out and put it back in again, and see if the index changes
      query.results.splice(old_idx, 1);
      const new_idx = LocalCollection._insertInSortedList(query.sorter.getComparator({
        distances: query.distances
      }), query.results, doc);
      if (old_idx !== new_idx) {
        let next = query.results[new_idx + 1];
        if (next) {
          next = next._id;
        } else {
          next = null;
        }
        query.movedBefore && (await query.movedBefore(doc._id, next));
      }
    };
    const MODIFIERS = {
      $currentDate(target, field, arg) {
        if (typeof arg === 'object' && hasOwn.call(arg, '$type')) {
          if (arg.$type !== 'date') {
            throw MinimongoError('Minimongo does currently only support the date type in ' + '$currentDate modifiers', {
              field
            });
          }
        } else if (arg !== true) {
          throw MinimongoError('Invalid $currentDate modifier', {
            field
          });
        }
        target[field] = new Date();
      },
      $inc(target, field, arg) {
        if (typeof arg !== 'number') {
          throw MinimongoError('Modifier $inc allowed for numbers only', {
            field
          });
        }
        if (field in target) {
          if (typeof target[field] !== 'number') {
            throw MinimongoError('Cannot apply $inc modifier to non-number', {
              field
            });
          }
          target[field] += arg;
        } else {
          target[field] = arg;
        }
      },
      $min(target, field, arg) {
        if (typeof arg !== 'number') {
          throw MinimongoError('Modifier $min allowed for numbers only', {
            field
          });
        }
        if (field in target) {
          if (typeof target[field] !== 'number') {
            throw MinimongoError('Cannot apply $min modifier to non-number', {
              field
            });
          }
          if (target[field] > arg) {
            target[field] = arg;
          }
        } else {
          target[field] = arg;
        }
      },
      $max(target, field, arg) {
        if (typeof arg !== 'number') {
          throw MinimongoError('Modifier $max allowed for numbers only', {
            field
          });
        }
        if (field in target) {
          if (typeof target[field] !== 'number') {
            throw MinimongoError('Cannot apply $max modifier to non-number', {
              field
            });
          }
          if (target[field] < arg) {
            target[field] = arg;
          }
        } else {
          target[field] = arg;
        }
      },
      $mul(target, field, arg) {
        if (typeof arg !== 'number') {
          throw MinimongoError('Modifier $mul allowed for numbers only', {
            field
          });
        }
        if (field in target) {
          if (typeof target[field] !== 'number') {
            throw MinimongoError('Cannot apply $mul modifier to non-number', {
              field
            });
          }
          target[field] *= arg;
        } else {
          target[field] = 0;
        }
      },
      $rename(target, field, arg, keypath, doc) {
        // no idea why mongo has this restriction..
        if (keypath === arg) {
          throw MinimongoError('$rename source must differ from target', {
            field
          });
        }
        if (target === null) {
          throw MinimongoError('$rename source field invalid', {
            field
          });
        }
        if (typeof arg !== 'string') {
          throw MinimongoError('$rename target must be a string', {
            field
          });
        }
        if (arg.includes('\0')) {
          // Null bytes are not allowed in Mongo field names
          // https://docs.mongodb.com/manual/reference/limits/#Restrictions-on-Field-Names
          throw MinimongoError('The \'to\' field for $rename cannot contain an embedded null byte', {
            field
          });
        }
        if (target === undefined) {
          return;
        }
        const object = target[field];
        delete target[field];
        const keyparts = arg.split('.');
        const target2 = findModTarget(doc, keyparts, {
          forbidArray: true
        });
        if (target2 === null) {
          throw MinimongoError('$rename target field invalid', {
            field
          });
        }
        target2[keyparts.pop()] = object;
      },
      $set(target, field, arg) {
        if (target !== Object(target)) {
          // not an array or an object
          const error = MinimongoError('Cannot set property on non-object field', {
            field
          });
          error.setPropertyError = true;
          throw error;
        }
        if (target === null) {
          const error = MinimongoError('Cannot set property on null', {
            field
          });
          error.setPropertyError = true;
          throw error;
        }
        assertHasValidFieldNames(arg);
        target[field] = arg;
      },
      $setOnInsert(target, field, arg) {
        // converted to `$set` in `_modify`
      },
      $unset(target, field, arg) {
        if (target !== undefined) {
          if (target instanceof Array) {
            if (field in target) {
              target[field] = null;
            }
          } else {
            delete target[field];
          }
        }
      },
      $push(target, field, arg) {
        if (target[field] === undefined) {
          target[field] = [];
        }
        if (!(target[field] instanceof Array)) {
          throw MinimongoError('Cannot apply $push modifier to non-array', {
            field
          });
        }
        if (!(arg && arg.$each)) {
          // Simple mode: not $each
          assertHasValidFieldNames(arg);
          target[field].push(arg);
          return;
        }

        // Fancy mode: $each (and maybe $slice and $sort and $position)
        const toPush = arg.$each;
        if (!(toPush instanceof Array)) {
          throw MinimongoError('$each must be an array', {
            field
          });
        }
        assertHasValidFieldNames(toPush);

        // Parse $position
        let position = undefined;
        if ('$position' in arg) {
          if (typeof arg.$position !== 'number') {
            throw MinimongoError('$position must be a numeric value', {
              field
            });
          }

          // XXX should check to make sure integer
          if (arg.$position < 0) {
            throw MinimongoError('$position in $push must be zero or positive', {
              field
            });
          }
          position = arg.$position;
        }

        // Parse $slice.
        let slice = undefined;
        if ('$slice' in arg) {
          if (typeof arg.$slice !== 'number') {
            throw MinimongoError('$slice must be a numeric value', {
              field
            });
          }

          // XXX should check to make sure integer
          slice = arg.$slice;
        }

        // Parse $sort.
        let sortFunction = undefined;
        if (arg.$sort) {
          if (slice === undefined) {
            throw MinimongoError('$sort requires $slice to be present', {
              field
            });
          }

          // XXX this allows us to use a $sort whose value is an array, but that's
          // actually an extension of the Node driver, so it won't work
          // server-side. Could be confusing!
          // XXX is it correct that we don't do geo-stuff here?
          sortFunction = new Minimongo.Sorter(arg.$sort).getComparator();
          toPush.forEach(element => {
            if (LocalCollection._f._type(element) !== 3) {
              throw MinimongoError('$push like modifiers using $sort require all elements to be ' + 'objects', {
                field
              });
            }
          });
        }

        // Actually push.
        if (position === undefined) {
          toPush.forEach(element => {
            target[field].push(element);
          });
        } else {
          const spliceArguments = [position, 0];
          toPush.forEach(element => {
            spliceArguments.push(element);
          });
          target[field].splice(...spliceArguments);
        }

        // Actually sort.
        if (sortFunction) {
          target[field].sort(sortFunction);
        }

        // Actually slice.
        if (slice !== undefined) {
          if (slice === 0) {
            target[field] = []; // differs from Array.slice!
          } else if (slice < 0) {
            target[field] = target[field].slice(slice);
          } else {
            target[field] = target[field].slice(0, slice);
          }
        }
      },
      $pushAll(target, field, arg) {
        if (!(typeof arg === 'object' && arg instanceof Array)) {
          throw MinimongoError('Modifier $pushAll/pullAll allowed for arrays only');
        }
        assertHasValidFieldNames(arg);
        const toPush = target[field];
        if (toPush === undefined) {
          target[field] = arg;
        } else if (!(toPush instanceof Array)) {
          throw MinimongoError('Cannot apply $pushAll modifier to non-array', {
            field
          });
        } else {
          toPush.push(...arg);
        }
      },
      $addToSet(target, field, arg) {
        let isEach = false;
        if (typeof arg === 'object') {
          // check if first key is '$each'
          const keys = Object.keys(arg);
          if (keys[0] === '$each') {
            isEach = true;
          }
        }
        const values = isEach ? arg.$each : [arg];
        assertHasValidFieldNames(values);
        const toAdd = target[field];
        if (toAdd === undefined) {
          target[field] = values;
        } else if (!(toAdd instanceof Array)) {
          throw MinimongoError('Cannot apply $addToSet modifier to non-array', {
            field
          });
        } else {
          values.forEach(value => {
            if (toAdd.some(element => LocalCollection._f._equal(value, element))) {
              return;
            }
            toAdd.push(value);
          });
        }
      },
      $pop(target, field, arg) {
        if (target === undefined) {
          return;
        }
        const toPop = target[field];
        if (toPop === undefined) {
          return;
        }
        if (!(toPop instanceof Array)) {
          throw MinimongoError('Cannot apply $pop modifier to non-array', {
            field
          });
        }
        if (typeof arg === 'number' && arg < 0) {
          toPop.splice(0, 1);
        } else {
          toPop.pop();
        }
      },
      $pull(target, field, arg) {
        if (target === undefined) {
          return;
        }
        const toPull = target[field];
        if (toPull === undefined) {
          return;
        }
        if (!(toPull instanceof Array)) {
          throw MinimongoError('Cannot apply $pull/pullAll modifier to non-array', {
            field
          });
        }
        let out;
        if (arg != null && typeof arg === 'object' && !(arg instanceof Array)) {
          // XXX would be much nicer to compile this once, rather than
          // for each document we modify.. but usually we're not
          // modifying that many documents, so we'll let it slide for
          // now

          // XXX Minimongo.Matcher isn't up for the job, because we need
          // to permit stuff like {$pull: {a: {$gt: 4}}}.. something
          // like {$gt: 4} is not normally a complete selector.
          // same issue as $elemMatch possibly?
          const matcher = new Minimongo.Matcher(arg);
          out = toPull.filter(element => !matcher.documentMatches(element).result);
        } else {
          out = toPull.filter(element => !LocalCollection._f._equal(element, arg));
        }
        target[field] = out;
      },
      $pullAll(target, field, arg) {
        if (!(typeof arg === 'object' && arg instanceof Array)) {
          throw MinimongoError('Modifier $pushAll/pullAll allowed for arrays only', {
            field
          });
        }
        if (target === undefined) {
          return;
        }
        const toPull = target[field];
        if (toPull === undefined) {
          return;
        }
        if (!(toPull instanceof Array)) {
          throw MinimongoError('Cannot apply $pull/pullAll modifier to non-array', {
            field
          });
        }
        target[field] = toPull.filter(object => !arg.some(element => LocalCollection._f._equal(object, element)));
      },
      $bit(target, field, arg) {
        // XXX mongo only supports $bit on integers, and we only support
        // native javascript numbers (doubles) so far, so we can't support $bit
        throw MinimongoError('$bit is not supported', {
          field
        });
      },
      $v() {
        // As discussed in https://github.com/meteor/meteor/issues/9623,
        // the `$v` operator is not needed by Meteor, but problems can occur if
        // it's not at least callable (as of Mongo >= 3.6). It's defined here as
        // a no-op to work around these problems.
      }
    };
    const NO_CREATE_MODIFIERS = {
      $pop: true,
      $pull: true,
      $pullAll: true,
      $rename: true,
      $unset: true
    };

    // Make sure field names do not contain Mongo restricted
    // characters ('.', '$', '\0').
    // https://docs.mongodb.com/manual/reference/limits/#Restrictions-on-Field-Names
    const invalidCharMsg = {
      $: 'start with \'$\'',
      '.': 'contain \'.\'',
      '\0': 'contain null bytes'
    };

    // checks if all field names in an object are valid
    function assertHasValidFieldNames(doc) {
      if (doc && typeof doc === 'object') {
        JSON.stringify(doc, (key, value) => {
          assertIsValidFieldName(key);
          return value;
        });
      }
    }
    function assertIsValidFieldName(key) {
      let match;
      if (typeof key === 'string' && (match = key.match(/^\$|\.|\0/))) {
        throw MinimongoError("Key ".concat(key, " must not ").concat(invalidCharMsg[match[0]]));
      }
    }

    // for a.b.c.2.d.e, keyparts should be ['a', 'b', 'c', '2', 'd', 'e'],
    // and then you would operate on the 'e' property of the returned
    // object.
    //
    // if options.noCreate is falsey, creates intermediate levels of
    // structure as necessary, like mkdir -p (and raises an exception if
    // that would mean giving a non-numeric property to an array.) if
    // options.noCreate is true, return undefined instead.
    //
    // may modify the last element of keyparts to signal to the caller that it needs
    // to use a different value to index into the returned object (for example,
    // ['a', '01'] -> ['a', 1]).
    //
    // if forbidArray is true, return null if the keypath goes through an array.
    //
    // if options.arrayIndices is set, use its first element for the (first) '$' in
    // the path.
    function findModTarget(doc, keyparts) {
      let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      let usedArrayIndex = false;
      for (let i = 0; i < keyparts.length; i++) {
        const last = i === keyparts.length - 1;
        let keypart = keyparts[i];
        if (!isIndexable(doc)) {
          if (options.noCreate) {
            return undefined;
          }
          const error = MinimongoError("cannot use the part '".concat(keypart, "' to traverse ").concat(doc));
          error.setPropertyError = true;
          throw error;
        }
        if (doc instanceof Array) {
          if (options.forbidArray) {
            return null;
          }
          if (keypart === '$') {
            if (usedArrayIndex) {
              throw MinimongoError('Too many positional (i.e. \'$\') elements');
            }
            if (!options.arrayIndices || !options.arrayIndices.length) {
              throw MinimongoError('The positional operator did not find the match needed from the ' + 'query');
            }
            keypart = options.arrayIndices[0];
            usedArrayIndex = true;
          } else if (isNumericKey(keypart)) {
            keypart = parseInt(keypart);
          } else {
            if (options.noCreate) {
              return undefined;
            }
            throw MinimongoError("can't append to array using string field name [".concat(keypart, "]"));
          }
          if (last) {
            keyparts[i] = keypart; // handle 'a.01'
          }

          if (options.noCreate && keypart >= doc.length) {
            return undefined;
          }
          while (doc.length < keypart) {
            doc.push(null);
          }
          if (!last) {
            if (doc.length === keypart) {
              doc.push({});
            } else if (typeof doc[keypart] !== 'object') {
              throw MinimongoError("can't modify field '".concat(keyparts[i + 1], "' of list value ") + JSON.stringify(doc[keypart]));
            }
          }
        } else {
          assertIsValidFieldName(keypart);
          if (!(keypart in doc)) {
            if (options.noCreate) {
              return undefined;
            }
            if (!last) {
              doc[keypart] = {};
            }
          }
        }
        if (last) {
          return doc;
        }
        doc = doc[keypart];
      }

      // notreached
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"matcher.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/matcher.js                                                                                     //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    var _Package$mongoDecima;
    module.export({
      default: () => Matcher
    });
    let LocalCollection;
    module.link("./local_collection.js", {
      default(v) {
        LocalCollection = v;
      }
    }, 0);
    let compileDocumentSelector, hasOwn, nothingMatcher;
    module.link("./common.js", {
      compileDocumentSelector(v) {
        compileDocumentSelector = v;
      },
      hasOwn(v) {
        hasOwn = v;
      },
      nothingMatcher(v) {
        nothingMatcher = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const Decimal = ((_Package$mongoDecima = Package['mongo-decimal']) === null || _Package$mongoDecima === void 0 ? void 0 : _Package$mongoDecima.Decimal) || class DecimalStub {};

    // The minimongo selector compiler!

    // Terminology:
    //  - a 'selector' is the EJSON object representing a selector
    //  - a 'matcher' is its compiled form (whether a full Minimongo.Matcher
    //    object or one of the component lambdas that matches parts of it)
    //  - a 'result object' is an object with a 'result' field and maybe
    //    distance and arrayIndices.
    //  - a 'branched value' is an object with a 'value' field and maybe
    //    'dontIterate' and 'arrayIndices'.
    //  - a 'document' is a top-level object that can be stored in a collection.
    //  - a 'lookup function' is a function that takes in a document and returns
    //    an array of 'branched values'.
    //  - a 'branched matcher' maps from an array of branched values to a result
    //    object.
    //  - an 'element matcher' maps from a single value to a bool.

    // Main entry point.
    //   var matcher = new Minimongo.Matcher({a: {$gt: 5}});
    //   if (matcher.documentMatches({a: 7})) ...
    class Matcher {
      constructor(selector, isUpdate) {
        // A set (object mapping string -> *) of all of the document paths looked
        // at by the selector. Also includes the empty string if it may look at any
        // path (eg, $where).
        this._paths = {};
        // Set to true if compilation finds a $near.
        this._hasGeoQuery = false;
        // Set to true if compilation finds a $where.
        this._hasWhere = false;
        // Set to false if compilation finds anything other than a simple equality
        // or one or more of '$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin' used
        // with scalars as operands.
        this._isSimple = true;
        // Set to a dummy document which always matches this Matcher. Or set to null
        // if such document is too hard to find.
        this._matchingDocument = undefined;
        // A clone of the original selector. It may just be a function if the user
        // passed in a function; otherwise is definitely an object (eg, IDs are
        // translated into {_id: ID} first. Used by canBecomeTrueByModifier and
        // Sorter._useWithMatcher.
        this._selector = null;
        this._docMatcher = this._compileSelector(selector);
        // Set to true if selection is done for an update operation
        // Default is false
        // Used for $near array update (issue #3599)
        this._isUpdate = isUpdate;
      }
      documentMatches(doc) {
        if (doc !== Object(doc)) {
          throw Error('documentMatches needs a document');
        }
        return this._docMatcher(doc);
      }
      hasGeoQuery() {
        return this._hasGeoQuery;
      }
      hasWhere() {
        return this._hasWhere;
      }
      isSimple() {
        return this._isSimple;
      }

      // Given a selector, return a function that takes one argument, a
      // document. It returns a result object.
      _compileSelector(selector) {
        // you can pass a literal function instead of a selector
        if (selector instanceof Function) {
          this._isSimple = false;
          this._selector = selector;
          this._recordPathUsed('');
          return doc => ({
            result: !!selector.call(doc)
          });
        }

        // shorthand -- scalar _id
        if (LocalCollection._selectorIsId(selector)) {
          this._selector = {
            _id: selector
          };
          this._recordPathUsed('_id');
          return doc => ({
            result: EJSON.equals(doc._id, selector)
          });
        }

        // protect against dangerous selectors.  falsey and {_id: falsey} are both
        // likely programmer error, and not what you want, particularly for
        // destructive operations.
        if (!selector || hasOwn.call(selector, '_id') && !selector._id) {
          this._isSimple = false;
          return nothingMatcher;
        }

        // Top level can't be an array or true or binary.
        if (Array.isArray(selector) || EJSON.isBinary(selector) || typeof selector === 'boolean') {
          throw new Error("Invalid selector: ".concat(selector));
        }
        this._selector = EJSON.clone(selector);
        return compileDocumentSelector(selector, this, {
          isRoot: true
        });
      }

      // Returns a list of key paths the given selector is looking for. It includes
      // the empty string if there is a $where.
      _getPaths() {
        return Object.keys(this._paths);
      }
      _recordPathUsed(path) {
        this._paths[path] = true;
      }
    }
    // helpers used by compiled selector code
    LocalCollection._f = {
      // XXX for _all and _in, consider building 'inquery' at compile time..
      _type(v) {
        if (typeof v === 'number') {
          return 1;
        }
        if (typeof v === 'string') {
          return 2;
        }
        if (typeof v === 'boolean') {
          return 8;
        }
        if (Array.isArray(v)) {
          return 4;
        }
        if (v === null) {
          return 10;
        }

        // note that typeof(/x/) === "object"
        if (v instanceof RegExp) {
          return 11;
        }
        if (typeof v === 'function') {
          return 13;
        }
        if (v instanceof Date) {
          return 9;
        }
        if (EJSON.isBinary(v)) {
          return 5;
        }
        if (v instanceof MongoID.ObjectID) {
          return 7;
        }
        if (v instanceof Decimal) {
          return 1;
        }

        // object
        return 3;

        // XXX support some/all of these:
        // 14, symbol
        // 15, javascript code with scope
        // 16, 18: 32-bit/64-bit integer
        // 17, timestamp
        // 255, minkey
        // 127, maxkey
      },

      // deep equality test: use for literal document and array matches
      _equal(a, b) {
        return EJSON.equals(a, b, {
          keyOrderSensitive: true
        });
      },
      // maps a type code to a value that can be used to sort values of different
      // types
      _typeorder(t) {
        // http://www.mongodb.org/display/DOCS/What+is+the+Compare+Order+for+BSON+Types
        // XXX what is the correct sort position for Javascript code?
        // ('100' in the matrix below)
        // XXX minkey/maxkey
        return [-1,
        // (not a type)
        1,
        // number
        2,
        // string
        3,
        // object
        4,
        // array
        5,
        // binary
        -1,
        // deprecated
        6,
        // ObjectID
        7,
        // bool
        8,
        // Date
        0,
        // null
        9,
        // RegExp
        -1,
        // deprecated
        100,
        // JS code
        2,
        // deprecated (symbol)
        100,
        // JS code
        1,
        // 32-bit int
        8,
        // Mongo timestamp
        1 // 64-bit int
        ][t];
      },
      // compare two values of unknown type according to BSON ordering
      // semantics. (as an extension, consider 'undefined' to be less than
      // any other value.) return negative if a is less, positive if b is
      // less, or 0 if equal
      _cmp(a, b) {
        if (a === undefined) {
          return b === undefined ? 0 : -1;
        }
        if (b === undefined) {
          return 1;
        }
        let ta = LocalCollection._f._type(a);
        let tb = LocalCollection._f._type(b);
        const oa = LocalCollection._f._typeorder(ta);
        const ob = LocalCollection._f._typeorder(tb);
        if (oa !== ob) {
          return oa < ob ? -1 : 1;
        }

        // XXX need to implement this if we implement Symbol or integers, or
        // Timestamp
        if (ta !== tb) {
          throw Error('Missing type coercion logic in _cmp');
        }
        if (ta === 7) {
          // ObjectID
          // Convert to string.
          ta = tb = 2;
          a = a.toHexString();
          b = b.toHexString();
        }
        if (ta === 9) {
          // Date
          // Convert to millis.
          ta = tb = 1;
          a = isNaN(a) ? 0 : a.getTime();
          b = isNaN(b) ? 0 : b.getTime();
        }
        if (ta === 1) {
          // double
          if (a instanceof Decimal) {
            return a.minus(b).toNumber();
          } else {
            return a - b;
          }
        }
        if (tb === 2)
          // string
          return a < b ? -1 : a === b ? 0 : 1;
        if (ta === 3) {
          // Object
          // this could be much more efficient in the expected case ...
          const toArray = object => {
            const result = [];
            Object.keys(object).forEach(key => {
              result.push(key, object[key]);
            });
            return result;
          };
          return LocalCollection._f._cmp(toArray(a), toArray(b));
        }
        if (ta === 4) {
          // Array
          for (let i = 0;; i++) {
            if (i === a.length) {
              return i === b.length ? 0 : -1;
            }
            if (i === b.length) {
              return 1;
            }
            const s = LocalCollection._f._cmp(a[i], b[i]);
            if (s !== 0) {
              return s;
            }
          }
        }
        if (ta === 5) {
          // binary
          // Surprisingly, a small binary blob is always less than a large one in
          // Mongo.
          if (a.length !== b.length) {
            return a.length - b.length;
          }
          for (let i = 0; i < a.length; i++) {
            if (a[i] < b[i]) {
              return -1;
            }
            if (a[i] > b[i]) {
              return 1;
            }
          }
          return 0;
        }
        if (ta === 8) {
          // boolean
          if (a) {
            return b ? 0 : 1;
          }
          return b ? -1 : 0;
        }
        if (ta === 10)
          // null
          return 0;
        if (ta === 11)
          // regexp
          throw Error('Sorting not supported on regular expression'); // XXX

        // 13: javascript code
        // 14: symbol
        // 15: javascript code with scope
        // 16: 32-bit integer
        // 17: timestamp
        // 18: 64-bit integer
        // 255: minkey
        // 127: maxkey
        if (ta === 13)
          // javascript code
          throw Error('Sorting not supported on Javascript code'); // XXX

        throw Error('Unknown type to sort');
      }
    };
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"minimongo_common.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/minimongo_common.js                                                                            //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let LocalCollection_;
    module.link("./local_collection.js", {
      default(v) {
        LocalCollection_ = v;
      }
    }, 0);
    let Matcher;
    module.link("./matcher.js", {
      default(v) {
        Matcher = v;
      }
    }, 1);
    let Sorter;
    module.link("./sorter.js", {
      default(v) {
        Sorter = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    LocalCollection = LocalCollection_;
    Minimongo = {
      LocalCollection: LocalCollection_,
      Matcher,
      Sorter
    };
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"observe_handle.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/observe_handle.js                                                                              //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
module.export({
  default: () => ObserveHandle
});
class ObserveHandle {}
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"sorter.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/sorter.js                                                                                      //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      default: () => Sorter
    });
    let ELEMENT_OPERATORS, equalityElementMatcher, expandArraysInBranches, hasOwn, isOperatorObject, makeLookupFunction, regexpElementMatcher;
    module.link("./common.js", {
      ELEMENT_OPERATORS(v) {
        ELEMENT_OPERATORS = v;
      },
      equalityElementMatcher(v) {
        equalityElementMatcher = v;
      },
      expandArraysInBranches(v) {
        expandArraysInBranches = v;
      },
      hasOwn(v) {
        hasOwn = v;
      },
      isOperatorObject(v) {
        isOperatorObject = v;
      },
      makeLookupFunction(v) {
        makeLookupFunction = v;
      },
      regexpElementMatcher(v) {
        regexpElementMatcher = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class Sorter {
      constructor(spec) {
        this._sortSpecParts = [];
        this._sortFunction = null;
        const addSpecPart = (path, ascending) => {
          if (!path) {
            throw Error('sort keys must be non-empty');
          }
          if (path.charAt(0) === '$') {
            throw Error("unsupported sort key: ".concat(path));
          }
          this._sortSpecParts.push({
            ascending,
            lookup: makeLookupFunction(path, {
              forSort: true
            }),
            path
          });
        };
        if (spec instanceof Array) {
          spec.forEach(element => {
            if (typeof element === 'string') {
              addSpecPart(element, true);
            } else {
              addSpecPart(element[0], element[1] !== 'desc');
            }
          });
        } else if (typeof spec === 'object') {
          Object.keys(spec).forEach(key => {
            addSpecPart(key, spec[key] >= 0);
          });
        } else if (typeof spec === 'function') {
          this._sortFunction = spec;
        } else {
          throw Error("Bad sort specification: ".concat(JSON.stringify(spec)));
        }

        // If a function is specified for sorting, we skip the rest.
        if (this._sortFunction) {
          return;
        }

        // To implement affectedByModifier, we piggy-back on top of Matcher's
        // affectedByModifier code; we create a selector that is affected by the
        // same modifiers as this sort order. This is only implemented on the
        // server.
        if (this.affectedByModifier) {
          const selector = {};
          this._sortSpecParts.forEach(spec => {
            selector[spec.path] = 1;
          });
          this._selectorForAffectedByModifier = new Minimongo.Matcher(selector);
        }
        this._keyComparator = composeComparators(this._sortSpecParts.map((spec, i) => this._keyFieldComparator(i)));
      }
      getComparator(options) {
        // If sort is specified or have no distances, just use the comparator from
        // the source specification (which defaults to "everything is equal".
        // issue #3599
        // https://docs.mongodb.com/manual/reference/operator/query/near/#sort-operation
        // sort effectively overrides $near
        if (this._sortSpecParts.length || !options || !options.distances) {
          return this._getBaseComparator();
        }
        const distances = options.distances;

        // Return a comparator which compares using $near distances.
        return (a, b) => {
          if (!distances.has(a._id)) {
            throw Error("Missing distance for ".concat(a._id));
          }
          if (!distances.has(b._id)) {
            throw Error("Missing distance for ".concat(b._id));
          }
          return distances.get(a._id) - distances.get(b._id);
        };
      }

      // Takes in two keys: arrays whose lengths match the number of spec
      // parts. Returns negative, 0, or positive based on using the sort spec to
      // compare fields.
      _compareKeys(key1, key2) {
        if (key1.length !== this._sortSpecParts.length || key2.length !== this._sortSpecParts.length) {
          throw Error('Key has wrong length');
        }
        return this._keyComparator(key1, key2);
      }

      // Iterates over each possible "key" from doc (ie, over each branch), calling
      // 'cb' with the key.
      _generateKeysFromDoc(doc, cb) {
        if (this._sortSpecParts.length === 0) {
          throw new Error('can\'t generate keys without a spec');
        }
        const pathFromIndices = indices => "".concat(indices.join(','), ",");
        let knownPaths = null;

        // maps index -> ({'' -> value} or {path -> value})
        const valuesByIndexAndPath = this._sortSpecParts.map(spec => {
          // Expand any leaf arrays that we find, and ignore those arrays
          // themselves.  (We never sort based on an array itself.)
          let branches = expandArraysInBranches(spec.lookup(doc), true);

          // If there are no values for a key (eg, key goes to an empty array),
          // pretend we found one undefined value.
          if (!branches.length) {
            branches = [{
              value: void 0
            }];
          }
          const element = Object.create(null);
          let usedPaths = false;
          branches.forEach(branch => {
            if (!branch.arrayIndices) {
              // If there are no array indices for a branch, then it must be the
              // only branch, because the only thing that produces multiple branches
              // is the use of arrays.
              if (branches.length > 1) {
                throw Error('multiple branches but no array used?');
              }
              element[''] = branch.value;
              return;
            }
            usedPaths = true;
            const path = pathFromIndices(branch.arrayIndices);
            if (hasOwn.call(element, path)) {
              throw Error("duplicate path: ".concat(path));
            }
            element[path] = branch.value;

            // If two sort fields both go into arrays, they have to go into the
            // exact same arrays and we have to find the same paths.  This is
            // roughly the same condition that makes MongoDB throw this strange
            // error message.  eg, the main thing is that if sort spec is {a: 1,
            // b:1} then a and b cannot both be arrays.
            //
            // (In MongoDB it seems to be OK to have {a: 1, 'a.x.y': 1} where 'a'
            // and 'a.x.y' are both arrays, but we don't allow this for now.
            // #NestedArraySort
            // XXX achieve full compatibility here
            if (knownPaths && !hasOwn.call(knownPaths, path)) {
              throw Error('cannot index parallel arrays');
            }
          });
          if (knownPaths) {
            // Similarly to above, paths must match everywhere, unless this is a
            // non-array field.
            if (!hasOwn.call(element, '') && Object.keys(knownPaths).length !== Object.keys(element).length) {
              throw Error('cannot index parallel arrays!');
            }
          } else if (usedPaths) {
            knownPaths = {};
            Object.keys(element).forEach(path => {
              knownPaths[path] = true;
            });
          }
          return element;
        });
        if (!knownPaths) {
          // Easy case: no use of arrays.
          const soleKey = valuesByIndexAndPath.map(values => {
            if (!hasOwn.call(values, '')) {
              throw Error('no value in sole key case?');
            }
            return values[''];
          });
          cb(soleKey);
          return;
        }
        Object.keys(knownPaths).forEach(path => {
          const key = valuesByIndexAndPath.map(values => {
            if (hasOwn.call(values, '')) {
              return values[''];
            }
            if (!hasOwn.call(values, path)) {
              throw Error('missing path?');
            }
            return values[path];
          });
          cb(key);
        });
      }

      // Returns a comparator that represents the sort specification (but not
      // including a possible geoquery distance tie-breaker).
      _getBaseComparator() {
        if (this._sortFunction) {
          return this._sortFunction;
        }

        // If we're only sorting on geoquery distance and no specs, just say
        // everything is equal.
        if (!this._sortSpecParts.length) {
          return (doc1, doc2) => 0;
        }
        return (doc1, doc2) => {
          const key1 = this._getMinKeyFromDoc(doc1);
          const key2 = this._getMinKeyFromDoc(doc2);
          return this._compareKeys(key1, key2);
        };
      }

      // Finds the minimum key from the doc, according to the sort specs.  (We say
      // "minimum" here but this is with respect to the sort spec, so "descending"
      // sort fields mean we're finding the max for that field.)
      //
      // Note that this is NOT "find the minimum value of the first field, the
      // minimum value of the second field, etc"... it's "choose the
      // lexicographically minimum value of the key vector, allowing only keys which
      // you can find along the same paths".  ie, for a doc {a: [{x: 0, y: 5}, {x:
      // 1, y: 3}]} with sort spec {'a.x': 1, 'a.y': 1}, the only keys are [0,5] and
      // [1,3], and the minimum key is [0,5]; notably, [0,3] is NOT a key.
      _getMinKeyFromDoc(doc) {
        let minKey = null;
        this._generateKeysFromDoc(doc, key => {
          if (minKey === null) {
            minKey = key;
            return;
          }
          if (this._compareKeys(key, minKey) < 0) {
            minKey = key;
          }
        });
        return minKey;
      }
      _getPaths() {
        return this._sortSpecParts.map(part => part.path);
      }

      // Given an index 'i', returns a comparator that compares two key arrays based
      // on field 'i'.
      _keyFieldComparator(i) {
        const invert = !this._sortSpecParts[i].ascending;
        return (key1, key2) => {
          const compare = LocalCollection._f._cmp(key1[i], key2[i]);
          return invert ? -compare : compare;
        };
      }
    }
    // Given an array of comparators
    // (functions (a,b)->(negative or positive or zero)), returns a single
    // comparator which uses each comparator in order and returns the first
    // non-zero value.
    function composeComparators(comparatorArray) {
      return (a, b) => {
        for (let i = 0; i < comparatorArray.length; ++i) {
          const compare = comparatorArray[i](a, b);
          if (compare !== 0) {
            return compare;
          }
        }
        return 0;
      };
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      LocalCollection: LocalCollection,
      Minimongo: Minimongo,
      MinimongoTest: MinimongoTest,
      MinimongoError: MinimongoError
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/minimongo/minimongo_server.js"
  ],
  mainModulePath: "/node_modules/meteor/minimongo/minimongo_server.js"
}});

//# sourceURL=meteor://💻app/packages/minimongo.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaW1vbmdvL21pbmltb25nb19zZXJ2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9jb21tb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9jb25zdGFudHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9jdXJzb3IuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9sb2NhbF9jb2xsZWN0aW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9taW5pbW9uZ28vbWF0Y2hlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaW1vbmdvL21pbmltb25nb19jb21tb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9vYnNlcnZlX2hhbmRsZS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaW1vbmdvL3NvcnRlci5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJsaW5rIiwiaGFzT3duIiwiaXNOdW1lcmljS2V5IiwiaXNPcGVyYXRvck9iamVjdCIsInBhdGhzVG9UcmVlIiwicHJvamVjdGlvbkRldGFpbHMiLCJ2IiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJNaW5pbW9uZ28iLCJfcGF0aHNFbGlkaW5nTnVtZXJpY0tleXMiLCJwYXRocyIsIm1hcCIsInBhdGgiLCJzcGxpdCIsImZpbHRlciIsInBhcnQiLCJqb2luIiwiTWF0Y2hlciIsInByb3RvdHlwZSIsImFmZmVjdGVkQnlNb2RpZmllciIsIm1vZGlmaWVyIiwiT2JqZWN0IiwiYXNzaWduIiwiJHNldCIsIiR1bnNldCIsIm1lYW5pbmdmdWxQYXRocyIsIl9nZXRQYXRocyIsIm1vZGlmaWVkUGF0aHMiLCJjb25jYXQiLCJrZXlzIiwic29tZSIsIm1vZCIsIm1lYW5pbmdmdWxQYXRoIiwic2VsIiwiaSIsImoiLCJsZW5ndGgiLCJjYW5CZWNvbWVUcnVlQnlNb2RpZmllciIsImlzU2ltcGxlIiwibW9kaWZpZXJQYXRocyIsInBhdGhIYXNOdW1lcmljS2V5cyIsImV4cGVjdGVkU2NhbGFySXNPYmplY3QiLCJfc2VsZWN0b3IiLCJtb2RpZmllclBhdGgiLCJzdGFydHNXaXRoIiwibWF0Y2hpbmdEb2N1bWVudCIsIkVKU09OIiwiY2xvbmUiLCJMb2NhbENvbGxlY3Rpb24iLCJfbW9kaWZ5IiwiZXJyb3IiLCJuYW1lIiwic2V0UHJvcGVydHlFcnJvciIsImRvY3VtZW50TWF0Y2hlcyIsInJlc3VsdCIsImNvbWJpbmVJbnRvUHJvamVjdGlvbiIsInByb2plY3Rpb24iLCJzZWxlY3RvclBhdGhzIiwiaW5jbHVkZXMiLCJjb21iaW5lSW1wb3J0YW50UGF0aHNJbnRvUHJvamVjdGlvbiIsIl9tYXRjaGluZ0RvY3VtZW50IiwidW5kZWZpbmVkIiwiZmFsbGJhY2siLCJ2YWx1ZVNlbGVjdG9yIiwiJGVxIiwiJGluIiwibWF0Y2hlciIsInBsYWNlaG9sZGVyIiwiZmluZCIsIm9ubHlDb250YWluc0tleXMiLCJsb3dlckJvdW5kIiwiSW5maW5pdHkiLCJ1cHBlckJvdW5kIiwiZm9yRWFjaCIsIm9wIiwiY2FsbCIsIm1pZGRsZSIsIngiLCJTb3J0ZXIiLCJfc2VsZWN0b3JGb3JBZmZlY3RlZEJ5TW9kaWZpZXIiLCJkZXRhaWxzIiwidHJlZSIsIm5vZGUiLCJmdWxsUGF0aCIsIm1lcmdlZFByb2plY3Rpb24iLCJ0cmVlVG9QYXRocyIsImluY2x1ZGluZyIsIm1lcmdlZEV4Y2xQcm9qZWN0aW9uIiwiZ2V0UGF0aHMiLCJzZWxlY3RvciIsIl9wYXRocyIsIm9iaiIsImV2ZXJ5IiwiayIsInByZWZpeCIsImFyZ3VtZW50cyIsImtleSIsInZhbHVlIiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwic2VsZiIsImFzeW5jIiwiZXhwb3J0IiwiRUxFTUVOVF9PUEVSQVRPUlMiLCJjb21waWxlRG9jdW1lbnRTZWxlY3RvciIsImVxdWFsaXR5RWxlbWVudE1hdGNoZXIiLCJleHBhbmRBcnJheXNJbkJyYW5jaGVzIiwiaXNJbmRleGFibGUiLCJtYWtlTG9va3VwRnVuY3Rpb24iLCJub3RoaW5nTWF0Y2hlciIsInBvcHVsYXRlRG9jdW1lbnRXaXRoUXVlcnlGaWVsZHMiLCJyZWdleHBFbGVtZW50TWF0Y2hlciIsImRlZmF1bHQiLCJoYXNPd25Qcm9wZXJ0eSIsIiRsdCIsIm1ha2VJbmVxdWFsaXR5IiwiY21wVmFsdWUiLCIkZ3QiLCIkbHRlIiwiJGd0ZSIsIiRtb2QiLCJjb21waWxlRWxlbWVudFNlbGVjdG9yIiwib3BlcmFuZCIsIkFycmF5IiwiaXNBcnJheSIsIkVycm9yIiwiZGl2aXNvciIsInJlbWFpbmRlciIsImVsZW1lbnRNYXRjaGVycyIsIm9wdGlvbiIsIlJlZ0V4cCIsIiRzaXplIiwiZG9udEV4cGFuZExlYWZBcnJheXMiLCIkdHlwZSIsImRvbnRJbmNsdWRlTGVhZkFycmF5cyIsIm9wZXJhbmRBbGlhc01hcCIsIl9mIiwiX3R5cGUiLCIkYml0c0FsbFNldCIsIm1hc2siLCJnZXRPcGVyYW5kQml0bWFzayIsImJpdG1hc2siLCJnZXRWYWx1ZUJpdG1hc2siLCJieXRlIiwiJGJpdHNBbnlTZXQiLCIkYml0c0FsbENsZWFyIiwiJGJpdHNBbnlDbGVhciIsIiRyZWdleCIsInJlZ2V4cCIsIiRvcHRpb25zIiwidGVzdCIsInNvdXJjZSIsIiRlbGVtTWF0Y2giLCJfaXNQbGFpbk9iamVjdCIsImlzRG9jTWF0Y2hlciIsIkxPR0lDQUxfT1BFUkFUT1JTIiwicmVkdWNlIiwiYSIsImIiLCJzdWJNYXRjaGVyIiwiaW5FbGVtTWF0Y2giLCJjb21waWxlVmFsdWVTZWxlY3RvciIsImFycmF5RWxlbWVudCIsImFyZyIsImRvbnRJdGVyYXRlIiwiJGFuZCIsInN1YlNlbGVjdG9yIiwiYW5kRG9jdW1lbnRNYXRjaGVycyIsImNvbXBpbGVBcnJheU9mRG9jdW1lbnRTZWxlY3RvcnMiLCIkb3IiLCJtYXRjaGVycyIsImRvYyIsImZuIiwiJG5vciIsIiR3aGVyZSIsInNlbGVjdG9yVmFsdWUiLCJfcmVjb3JkUGF0aFVzZWQiLCJfaGFzV2hlcmUiLCJGdW5jdGlvbiIsIiRjb21tZW50IiwiVkFMVUVfT1BFUkFUT1JTIiwiY29udmVydEVsZW1lbnRNYXRjaGVyVG9CcmFuY2hlZE1hdGNoZXIiLCIkbm90IiwiaW52ZXJ0QnJhbmNoZWRNYXRjaGVyIiwiJG5lIiwiJG5pbiIsIiRleGlzdHMiLCJleGlzdHMiLCJldmVyeXRoaW5nTWF0Y2hlciIsIiRtYXhEaXN0YW5jZSIsIiRuZWFyIiwiJGFsbCIsImJyYW5jaGVkTWF0Y2hlcnMiLCJjcml0ZXJpb24iLCJhbmRCcmFuY2hlZE1hdGNoZXJzIiwiaXNSb290IiwiX2hhc0dlb1F1ZXJ5IiwibWF4RGlzdGFuY2UiLCJwb2ludCIsImRpc3RhbmNlIiwiJGdlb21ldHJ5IiwidHlwZSIsIkdlb0pTT04iLCJwb2ludERpc3RhbmNlIiwiY29vcmRpbmF0ZXMiLCJwb2ludFRvQXJyYXkiLCJnZW9tZXRyeVdpdGhpblJhZGl1cyIsImRpc3RhbmNlQ29vcmRpbmF0ZVBhaXJzIiwiYnJhbmNoZWRWYWx1ZXMiLCJicmFuY2giLCJjdXJEaXN0YW5jZSIsIl9pc1VwZGF0ZSIsImFycmF5SW5kaWNlcyIsImFuZFNvbWVNYXRjaGVycyIsInN1Yk1hdGNoZXJzIiwiZG9jT3JCcmFuY2hlcyIsIm1hdGNoIiwic3ViUmVzdWx0Iiwic2VsZWN0b3JzIiwiZG9jU2VsZWN0b3IiLCJvcHRpb25zIiwiZG9jTWF0Y2hlcnMiLCJzdWJzdHIiLCJfaXNTaW1wbGUiLCJsb29rVXBCeUluZGV4IiwidmFsdWVNYXRjaGVyIiwiQm9vbGVhbiIsIm9wZXJhdG9yQnJhbmNoZWRNYXRjaGVyIiwiZWxlbWVudE1hdGNoZXIiLCJicmFuY2hlcyIsImV4cGFuZGVkIiwiZWxlbWVudCIsIm1hdGNoZWQiLCJwb2ludEEiLCJwb2ludEIiLCJNYXRoIiwiaHlwb3QiLCJlbGVtZW50U2VsZWN0b3IiLCJfZXF1YWwiLCJkb2NPckJyYW5jaGVkVmFsdWVzIiwic2tpcFRoZUFycmF5cyIsImJyYW5jaGVzT3V0IiwidGhpc0lzQXJyYXkiLCJwdXNoIiwiTnVtYmVyIiwiaXNJbnRlZ2VyIiwiVWludDhBcnJheSIsIkludDMyQXJyYXkiLCJidWZmZXIiLCJpc0JpbmFyeSIsIkFycmF5QnVmZmVyIiwibWF4IiwidmlldyIsImlzU2FmZUludGVnZXIiLCJVaW50MzJBcnJheSIsIkJZVEVTX1BFUl9FTEVNRU5UIiwiaW5zZXJ0SW50b0RvY3VtZW50IiwiZG9jdW1lbnQiLCJleGlzdGluZ0tleSIsImluZGV4T2YiLCJicmFuY2hlZE1hdGNoZXIiLCJicmFuY2hWYWx1ZXMiLCJzIiwiaW5jb25zaXN0ZW50T0siLCJ0aGVzZUFyZU9wZXJhdG9ycyIsInNlbEtleSIsInRoaXNJc09wZXJhdG9yIiwiSlNPTiIsInN0cmluZ2lmeSIsImNtcFZhbHVlQ29tcGFyYXRvciIsIm9wZXJhbmRUeXBlIiwiX2NtcCIsInBhcnRzIiwiZmlyc3RQYXJ0IiwibG9va3VwUmVzdCIsInNsaWNlIiwiYnVpbGRSZXN1bHQiLCJmaXJzdExldmVsIiwiYXBwZW5kVG9SZXN1bHQiLCJtb3JlIiwiZm9yU29ydCIsImFycmF5SW5kZXgiLCJNaW5pbW9uZ29UZXN0IiwiTWluaW1vbmdvRXJyb3IiLCJtZXNzYWdlIiwiZmllbGQiLCJvcGVyYXRvck1hdGNoZXJzIiwib3BlcmF0b3IiLCJzaW1wbGVSYW5nZSIsInNpbXBsZUVxdWFsaXR5Iiwic2ltcGxlSW5jbHVzaW9uIiwibmV3TGVhZkZuIiwiY29uZmxpY3RGbiIsInJvb3QiLCJwYXRoQXJyYXkiLCJzdWNjZXNzIiwibGFzdEtleSIsInkiLCJwb3B1bGF0ZURvY3VtZW50V2l0aEtleVZhbHVlIiwiZ2V0UHJvdG90eXBlT2YiLCJwb3B1bGF0ZURvY3VtZW50V2l0aE9iamVjdCIsInVucHJlZml4ZWRLZXlzIiwidmFsaWRhdGVPYmplY3QiLCJvYmplY3QiLCJxdWVyeSIsIl9zZWxlY3RvcklzSWQiLCJmaWVsZHMiLCJmaWVsZHNLZXlzIiwic29ydCIsIl9pZCIsImtleVBhdGgiLCJydWxlIiwicHJvamVjdGlvblJ1bGVzVHJlZSIsImN1cnJlbnRQYXRoIiwiYW5vdGhlclBhdGgiLCJ0b1N0cmluZyIsImxhc3RJbmRleCIsInZhbGlkYXRlS2V5SW5QYXRoIiwiZ2V0QXN5bmNNZXRob2ROYW1lIiwiQVNZTkNfQ09MTEVDVElPTl9NRVRIT0RTIiwiQVNZTkNfQ1VSU09SX01FVEhPRFMiLCJtZXRob2QiLCJyZXBsYWNlIiwiQ3Vyc29yIiwiY29uc3RydWN0b3IiLCJjb2xsZWN0aW9uIiwic29ydGVyIiwiX3NlbGVjdG9ySXNJZFBlcmhhcHNBc09iamVjdCIsIl9zZWxlY3RvcklkIiwiaGFzR2VvUXVlcnkiLCJza2lwIiwibGltaXQiLCJfcHJvamVjdGlvbkZuIiwiX2NvbXBpbGVQcm9qZWN0aW9uIiwiX3RyYW5zZm9ybSIsIndyYXBUcmFuc2Zvcm0iLCJ0cmFuc2Zvcm0iLCJUcmFja2VyIiwicmVhY3RpdmUiLCJjb3VudCIsIl9kZXBlbmQiLCJhZGRlZCIsInJlbW92ZWQiLCJfZ2V0UmF3T2JqZWN0cyIsIm9yZGVyZWQiLCJmZXRjaCIsIlN5bWJvbCIsIml0ZXJhdG9yIiwiYWRkZWRCZWZvcmUiLCJjaGFuZ2VkIiwibW92ZWRCZWZvcmUiLCJpbmRleCIsIm9iamVjdHMiLCJuZXh0IiwiZG9uZSIsImFzeW5jSXRlcmF0b3IiLCJzeW5jUmVzdWx0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJjYWxsYmFjayIsInRoaXNBcmciLCJnZXRUcmFuc2Zvcm0iLCJvYnNlcnZlIiwiX29ic2VydmVGcm9tT2JzZXJ2ZUNoYW5nZXMiLCJvYnNlcnZlQ2hhbmdlcyIsIl9vYnNlcnZlQ2hhbmdlc0NhbGxiYWNrc0FyZU9yZGVyZWQiLCJfYWxsb3dfdW5vcmRlcmVkIiwiZGlzdGFuY2VzIiwiX0lkTWFwIiwiY3Vyc29yIiwiZGlydHkiLCJwcm9qZWN0aW9uRm4iLCJyZXN1bHRzU25hcHNob3QiLCJxaWQiLCJuZXh0X3FpZCIsInF1ZXJpZXMiLCJyZXN1bHRzIiwicGF1c2VkIiwid3JhcENhbGxiYWNrIiwiYXJncyIsIl9vYnNlcnZlUXVldWUiLCJxdWV1ZVRhc2siLCJhcHBseSIsIl9zdXBwcmVzc19pbml0aWFsIiwiX3F1ZXJ5JHJlc3VsdHMiLCJfcXVlcnkkcmVzdWx0cyRzaXplIiwiaGFuZGxlciIsInNpemUiLCJoYW5kbGUiLCJPYnNlcnZlSGFuZGxlIiwic3RvcCIsImlzUmVhZHkiLCJpc1JlYWR5UHJvbWlzZSIsImFjdGl2ZSIsIm9uSW52YWxpZGF0ZSIsImRyYWluUmVzdWx0IiwiZHJhaW4iLCJ0aGVuIiwiY2hhbmdlcnMiLCJkZXBlbmRlbmN5IiwiRGVwZW5kZW5jeSIsIm5vdGlmeSIsImJpbmQiLCJkZXBlbmQiLCJfZ2V0Q29sbGVjdGlvbk5hbWUiLCJhcHBseVNraXBMaW1pdCIsInNlbGVjdGVkRG9jIiwiX2RvY3MiLCJnZXQiLCJzZXQiLCJjbGVhciIsImlkIiwibWF0Y2hSZXN1bHQiLCJnZXRDb21wYXJhdG9yIiwiX3B1Ymxpc2hDdXJzb3IiLCJzdWJzY3JpcHRpb24iLCJQYWNrYWdlIiwibW9uZ28iLCJNb25nbyIsIkNvbGxlY3Rpb24iLCJhc3luY05hbWUiLCJfbGVuIiwiX2tleSIsInJlamVjdCIsIl9vYmplY3RTcHJlYWQiLCJNZXRlb3IiLCJpc0NsaWVudCIsIl9TeW5jaHJvbm91c1F1ZXVlIiwiX0FzeW5jaHJvbm91c1F1ZXVlIiwiY3JlYXRlIiwiX3NhdmVkT3JpZ2luYWxzIiwiY291bnREb2N1bWVudHMiLCJjb3VudEFzeW5jIiwiZXN0aW1hdGVkRG9jdW1lbnRDb3VudCIsImZpbmRPbmUiLCJmaW5kT25lQXN5bmMiLCJmZXRjaEFzeW5jIiwicHJlcGFyZUluc2VydCIsImFzc2VydEhhc1ZhbGlkRmllbGROYW1lcyIsIl91c2VPSUQiLCJNb25nb0lEIiwiT2JqZWN0SUQiLCJSYW5kb20iLCJoYXMiLCJfc2F2ZU9yaWdpbmFsIiwiaW5zZXJ0IiwicXVlcmllc1RvUmVjb21wdXRlIiwiX2luc2VydEluUmVzdWx0c1N5bmMiLCJfcmVjb21wdXRlUmVzdWx0cyIsImRlZmVyIiwiaW5zZXJ0QXN5bmMiLCJfaW5zZXJ0SW5SZXN1bHRzQXN5bmMiLCJwYXVzZU9ic2VydmVycyIsImNsZWFyUmVzdWx0UXVlcmllcyIsInByZXBhcmVSZW1vdmUiLCJyZW1vdmUiLCJfZWFjaFBvc3NpYmx5TWF0Y2hpbmdEb2NTeW5jIiwicXVlcnlSZW1vdmUiLCJyZW1vdmVJZCIsInJlbW92ZURvYyIsImVxdWFscyIsIl9yZW1vdmVGcm9tUmVzdWx0c1N5bmMiLCJyZW1vdmVBc3luYyIsIl9yZW1vdmVGcm9tUmVzdWx0c0FzeW5jIiwiX3Jlc3VtZU9ic2VydmVycyIsIl9kaWZmUXVlcnlDaGFuZ2VzIiwicmVzdW1lT2JzZXJ2ZXJzU2VydmVyIiwicmVzdW1lT2JzZXJ2ZXJzQ2xpZW50IiwicmV0cmlldmVPcmlnaW5hbHMiLCJvcmlnaW5hbHMiLCJzYXZlT3JpZ2luYWxzIiwicHJlcGFyZVVwZGF0ZSIsInFpZFRvT3JpZ2luYWxSZXN1bHRzIiwiZG9jTWFwIiwiaWRzTWF0Y2hlZCIsIl9pZHNNYXRjaGVkQnlTZWxlY3RvciIsIm1lbW9pemVkQ2xvbmVJZk5lZWRlZCIsImRvY1RvTWVtb2l6ZSIsImZpbmlzaFVwZGF0ZSIsIl9yZWYiLCJ1cGRhdGVDb3VudCIsImluc2VydGVkSWQiLCJfcmV0dXJuT2JqZWN0IiwibnVtYmVyQWZmZWN0ZWQiLCJ1cGRhdGVBc3luYyIsInJlY29tcHV0ZVFpZHMiLCJfZWFjaFBvc3NpYmx5TWF0Y2hpbmdEb2NBc3luYyIsInF1ZXJ5UmVzdWx0IiwiX21vZGlmeUFuZE5vdGlmeUFzeW5jIiwibXVsdGkiLCJ1cHNlcnQiLCJfY3JlYXRlVXBzZXJ0RG9jdW1lbnQiLCJ1cGRhdGUiLCJfbW9kaWZ5QW5kTm90aWZ5U3luYyIsInVwc2VydEFzeW5jIiwic3BlY2lmaWNJZHMiLCJmb3JFYWNoQXN5bmMiLCJfZ2V0TWF0Y2hlZERvY0FuZE1vZGlmeSIsIm1hdGNoZWRfYmVmb3JlIiwib2xkX2RvYyIsImFmdGVyTWF0Y2giLCJhZnRlciIsImJlZm9yZSIsIl91cGRhdGVJblJlc3VsdHNTeW5jIiwiX3VwZGF0ZUluUmVzdWx0c0FzeW5jIiwib2xkUmVzdWx0cyIsIl9DYWNoaW5nQ2hhbmdlT2JzZXJ2ZXIiLCJvcmRlcmVkRnJvbUNhbGxiYWNrcyIsImNhbGxiYWNrcyIsImRvY3MiLCJPcmRlcmVkRGljdCIsImlkU3RyaW5naWZ5IiwiYXBwbHlDaGFuZ2UiLCJwdXRCZWZvcmUiLCJtb3ZlQmVmb3JlIiwiRGlmZlNlcXVlbmNlIiwiYXBwbHlDaGFuZ2VzIiwiSWRNYXAiLCJpZFBhcnNlIiwiX193cmFwcGVkVHJhbnNmb3JtX18iLCJ3cmFwcGVkIiwidHJhbnNmb3JtZWQiLCJub25yZWFjdGl2ZSIsIl9iaW5hcnlTZWFyY2giLCJjbXAiLCJhcnJheSIsImZpcnN0IiwicmFuZ2UiLCJoYWxmUmFuZ2UiLCJmbG9vciIsIl9jaGVja1N1cHBvcnRlZFByb2plY3Rpb24iLCJfaWRQcm9qZWN0aW9uIiwicnVsZVRyZWUiLCJzdWJkb2MiLCJzZWxlY3RvckRvY3VtZW50IiwiaXNNb2RpZnkiLCJfaXNNb2RpZmljYXRpb25Nb2QiLCJuZXdEb2MiLCJpc0luc2VydCIsInJlcGxhY2VtZW50IiwiX2RpZmZPYmplY3RzIiwibGVmdCIsInJpZ2h0IiwiZGlmZk9iamVjdHMiLCJuZXdSZXN1bHRzIiwib2JzZXJ2ZXIiLCJkaWZmUXVlcnlDaGFuZ2VzIiwiX2RpZmZRdWVyeU9yZGVyZWRDaGFuZ2VzIiwiZGlmZlF1ZXJ5T3JkZXJlZENoYW5nZXMiLCJfZGlmZlF1ZXJ5VW5vcmRlcmVkQ2hhbmdlcyIsImRpZmZRdWVyeVVub3JkZXJlZENoYW5nZXMiLCJfZmluZEluT3JkZXJlZFJlc3VsdHMiLCJzdWJJZHMiLCJfaW5zZXJ0SW5Tb3J0ZWRMaXN0Iiwic3BsaWNlIiwiaXNSZXBsYWNlIiwiaXNNb2RpZmllciIsInNldE9uSW5zZXJ0IiwibW9kRnVuYyIsIk1PRElGSUVSUyIsImtleXBhdGgiLCJrZXlwYXJ0cyIsInRhcmdldCIsImZpbmRNb2RUYXJnZXQiLCJmb3JiaWRBcnJheSIsIm5vQ3JlYXRlIiwiTk9fQ1JFQVRFX01PRElGSUVSUyIsInBvcCIsIm9ic2VydmVDYWxsYmFja3MiLCJzdXBwcmVzc2VkIiwib2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3MiLCJfb2JzZXJ2ZUNhbGxiYWNrc0FyZU9yZGVyZWQiLCJpbmRpY2VzIiwiX25vX2luZGljZXMiLCJjaGVjayIsImFkZGVkQXQiLCJjaGFuZ2VkQXQiLCJvbGREb2MiLCJtb3ZlZFRvIiwiZnJvbSIsInRvIiwicmVtb3ZlZEF0IiwiY2hhbmdlT2JzZXJ2ZXIiLCJfZnJvbU9ic2VydmUiLCJub25NdXRhdGluZ0NhbGxiYWNrcyIsInNldFN1cHByZXNzZWQiLCJoIiwiX2gkaXNSZWFkeVByb21pc2UiLCJfaXNQcm9taXNlIiwiY2hhbmdlZEZpZWxkcyIsIm1ha2VDaGFuZ2VkRmllbGRzIiwib2xkX2lkeCIsIm5ld19pZHgiLCIkY3VycmVudERhdGUiLCJEYXRlIiwiJGluYyIsIiRtaW4iLCIkbWF4IiwiJG11bCIsIiRyZW5hbWUiLCJ0YXJnZXQyIiwiJHNldE9uSW5zZXJ0IiwiJHB1c2giLCIkZWFjaCIsInRvUHVzaCIsInBvc2l0aW9uIiwiJHBvc2l0aW9uIiwiJHNsaWNlIiwic29ydEZ1bmN0aW9uIiwiJHNvcnQiLCJzcGxpY2VBcmd1bWVudHMiLCIkcHVzaEFsbCIsIiRhZGRUb1NldCIsImlzRWFjaCIsInZhbHVlcyIsInRvQWRkIiwiJHBvcCIsInRvUG9wIiwiJHB1bGwiLCJ0b1B1bGwiLCJvdXQiLCIkcHVsbEFsbCIsIiRiaXQiLCIkdiIsImludmFsaWRDaGFyTXNnIiwiJCIsImFzc2VydElzVmFsaWRGaWVsZE5hbWUiLCJ1c2VkQXJyYXlJbmRleCIsImxhc3QiLCJrZXlwYXJ0IiwicGFyc2VJbnQiLCJEZWNpbWFsIiwiX1BhY2thZ2UkbW9uZ29EZWNpbWEiLCJEZWNpbWFsU3R1YiIsImlzVXBkYXRlIiwiX2RvY01hdGNoZXIiLCJfY29tcGlsZVNlbGVjdG9yIiwiaGFzV2hlcmUiLCJrZXlPcmRlclNlbnNpdGl2ZSIsIl90eXBlb3JkZXIiLCJ0IiwidGEiLCJ0YiIsIm9hIiwib2IiLCJ0b0hleFN0cmluZyIsImlzTmFOIiwiZ2V0VGltZSIsIm1pbnVzIiwidG9OdW1iZXIiLCJ0b0FycmF5IiwiTG9jYWxDb2xsZWN0aW9uXyIsInNwZWMiLCJfc29ydFNwZWNQYXJ0cyIsIl9zb3J0RnVuY3Rpb24iLCJhZGRTcGVjUGFydCIsImFzY2VuZGluZyIsImNoYXJBdCIsImxvb2t1cCIsIl9rZXlDb21wYXJhdG9yIiwiY29tcG9zZUNvbXBhcmF0b3JzIiwiX2tleUZpZWxkQ29tcGFyYXRvciIsIl9nZXRCYXNlQ29tcGFyYXRvciIsIl9jb21wYXJlS2V5cyIsImtleTEiLCJrZXkyIiwiX2dlbmVyYXRlS2V5c0Zyb21Eb2MiLCJjYiIsInBhdGhGcm9tSW5kaWNlcyIsImtub3duUGF0aHMiLCJ2YWx1ZXNCeUluZGV4QW5kUGF0aCIsInVzZWRQYXRocyIsInNvbGVLZXkiLCJkb2MxIiwiZG9jMiIsIl9nZXRNaW5LZXlGcm9tRG9jIiwibWluS2V5IiwiaW52ZXJ0IiwiY29tcGFyZSIsImNvbXBhcmF0b3JBcnJheSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUFBLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLHVCQUF1QixDQUFDO0lBQUMsSUFBSUMsTUFBTSxFQUFDQyxZQUFZLEVBQUNDLGdCQUFnQixFQUFDQyxXQUFXLEVBQUNDLGlCQUFpQjtJQUFDTixNQUFNLENBQUNDLElBQUksQ0FBQyxhQUFhLEVBQUM7TUFBQ0MsTUFBTUEsQ0FBQ0ssQ0FBQyxFQUFDO1FBQUNMLE1BQU0sR0FBQ0ssQ0FBQztNQUFBLENBQUM7TUFBQ0osWUFBWUEsQ0FBQ0ksQ0FBQyxFQUFDO1FBQUNKLFlBQVksR0FBQ0ksQ0FBQztNQUFBLENBQUM7TUFBQ0gsZ0JBQWdCQSxDQUFDRyxDQUFDLEVBQUM7UUFBQ0gsZ0JBQWdCLEdBQUNHLENBQUM7TUFBQSxDQUFDO01BQUNGLFdBQVdBLENBQUNFLENBQUMsRUFBQztR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QyxDQUFDOG1CLFNBQVM7UUFFaEQsT0FBTyxDQUFDUSxJQUFJLEVBQUVDLElBQUksS0FBSztVQUNyQixNQUFNYSxPQUFPLEdBQUd0bkIsZUFBZSxDQUFDd0YsRUFBRSxDQUFDdUksSUFBSSxDQUFDeVksSUFBSSxDQUFDdG5CLENBQUMsQ0FBQyxFQUFFdW5CLElBQUksQ0FBQ3ZuQixDQUFDLENBQUMsQ0FBQztVQUN6RCxPQUFPbW9CLE1BQU0sR0FBRyxDQUFDQyxPQUFPLEdBQUdBLE9BQU87UUFDcEMsQ0FBQztNQUNIO0lBQ0Y7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLFNBQVNsQixrQkFBa0JBLENBQUNtQixlQUFlLEVBQUU7TUFDM0MsT0FBTyxDQUFDMWdCLENBQUMsRUFBRUMsQ0FBQyxLQUFLO1FBQ2YsS0FBSyxJQUFJNUgsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHcW9CLGVBQWUsQ0FBQ25vQixNQUFNLEVBQUUsRUFBRUYsQ0FBQyxFQUFFO1VBQy9DLE1BQU1vb0IsT0FBTyxHQUFHQyxlQUFlLENBQUNyb0IsQ0FBQyxDQUFDLENBQUMySCxDQUFDLEVBQUVDLENBQUMsQ0FBQztVQUN4QyxJQUFJd2dCLE9BQU8sS0FBSyxDQUFDLEVBQUU7WUFDakIsT0FBT0EsT0FBTztVQUNoQjtRQUNGO1FBRUEsT0FBTyxDQUFDO01BQ1YsQ0FBQztJQUNIO0lBQUNwa0Isc0JBQUE7RUFBQSxTQUFBQyxXQUFBO0lBQUEsT0FBQUQsc0JBQUEsQ0FBQUMsV0FBQTtFQUFBO0VBQUFELHNCQUFBO0FBQUE7RUFBQUUsSUFBQTtFQUFBQyxLQUFBO0FBQUEsRyIsImZpbGUiOiIvcGFja2FnZXMvbWluaW1vbmdvLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICcuL21pbmltb25nb19jb21tb24uanMnO1xuaW1wb3J0IHtcbiAgaGFzT3duLFxuICBpc051bWVyaWNLZXksXG4gIGlzT3BlcmF0b3JPYmplY3QsXG4gIHBhdGhzVG9UcmVlLFxuICBwcm9qZWN0aW9uRGV0YWlscyxcbn0gZnJvbSAnLi9jb21tb24uanMnO1xuXG5NaW5pbW9uZ28uX3BhdGhzRWxpZGluZ051bWVyaWNLZXlzID0gcGF0aHMgPT4gcGF0aHMubWFwKHBhdGggPT5cbiAgcGF0aC5zcGxpdCgnLicpLmZpbHRlcihwYXJ0ID0+ICFpc051bWVyaWNLZXkocGFydCkpLmpvaW4oJy4nKVxuKTtcblxuLy8gUmV0dXJucyB0cnVlIGlmIHRoZSBtb2RpZmllciBhcHBsaWVkIHRvIHNvbWUgZG9jdW1lbnQgbWF5IGNoYW5nZSB0aGUgcmVzdWx0XG4vLyBvZiBtYXRjaGluZyB0aGUgZG9jdW1lbnQgYnkgc2VsZWN0b3Jcbi8vIFRoZSBtb2RpZmllciBpcyBhbHdheXMgaW4gYSBmb3JtIG9mIE9iamVjdDpcbi8vICAtICRzZXRcbi8vICAgIC0gJ2EuYi4yMi56JzogdmFsdWVcbi8vICAgIC0gJ2Zvby5iYXInOiA0MlxuLy8gIC0gJHVuc2V0XG4vLyAgICAtICdhYmMuZCc6IDFcbk1pbmltb25nby5NYXRjaGVyLnByb3RvdHlwZS5hZmZlY3RlZEJ5TW9kaWZpZXIgPSBmdW5jdGlvbihtb2RpZmllcikge1xuICAvLyBzYWZlIGNoZWNrIGZvciAkc2V0LyR1bnNldCBiZWluZyBvYmplY3RzXG4gIG1vZGlmaWVyID0gT2JqZWN0LmFzc2lnbih7JHNldDoge30sICR1bnNldDoge319LCBtb2RpZmllcik7XG5cbiAgY29uc3QgbWVhbmluZ2Z1bFBhdGhzID0gdGhpcy5fZ2V0UGF0aHMoKTtcbiAgY29uc3QgbW9kaWZpZWRQYXRocyA9IFtdLmNvbmNhdChcbiAgICBPYmplY3Qua2V5cyhtb2RpZmllci4kc2V0KSxcbiAgICBPYmplY3Qua2V5cyhtb2RpZmllci4kdW5zZXQpXG4gICk7XG5cbiAgcmV0dXJuIG1vZGlmaWVkUGF0aHMuc29tZShwYXRoID0+IHtcbiAgICBjb25zdCBtb2QgPSBwYXRoLnNwbGl0KCcuJyk7XG5cbiAgICByZXR1cm4gbWVhbmluZ2Z1bFBhdGhzLnNvbWUobWVhbmluZ2Z1bFBhdGggPT4ge1xuICAgICAgY29uc3Qgc2VsID0gbWVhbmluZ2Z1bFBhdGguc3BsaXQoJy4nKTtcblxuICAgICAgbGV0IGkgPSAwLCBqID0gMDtcblxuICAgICAgd2hpbGUgKGkgPCBzZWwubGVuZ3RoICYmIGogPCBtb2QubGVuZ3RoKSB7XG4gICAgICAgIGlmIChpc051bWVyaWNLZXkoc2VsW2ldKSAmJiBpc051bWVyaWNLZXkobW9kW2pdKSkge1xuICAgICAgICAgIC8vIGZvby40LmJhciBzZWxlY3RvciBhZmZlY3RlZCBieSBmb28uNCBtb2RpZmllclxuICAgICAgICAgIC8vIGZvby4zLmJhciBzZWxlY3RvciB1bmFmZmVjdGVkIGJ5IGZvby40IG1vZGlmaWVyXG4gICAgICAgICAgaWYgKHNlbFtpXSA9PT0gbW9kW2pdKSB7XG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgICBqKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoaXNOdW1lcmljS2V5KHNlbFtpXSkpIHtcbiAgICAgICAgICAvLyBmb28uNC5iYXIgc2VsZWN0b3IgdW5hZmZlY3RlZCBieSBmb28uYmFyIG1vZGlmaWVyXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9IGVsc2UgaWYgKGlzTnVtZXJpY0tleShtb2Rbal0pKSB7XG4gICAgICAgICAgaisrO1xuICAgICAgICB9IGVsc2UgaWYgKHNlbFtpXSA9PT0gbW9kW2pdKSB7XG4gICAgICAgICAgaSsrO1xuICAgICAgICAgIGorKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gT25lIGlzIGEgcHJlZml4IG9mIGFub3RoZXIsIHRha2luZyBudW1lcmljIGZpZWxkcyBpbnRvIGFjY291bnRcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xuICB9KTtcbn07XG5cbi8vIEBwYXJhbSBtb2RpZmllciAtIE9iamVjdDogTW9uZ29EQi1zdHlsZWQgbW9kaWZpZXIgd2l0aCBgJHNldGBzIGFuZCBgJHVuc2V0c2Bcbi8vICAgICAgICAgICAgICAgICAgICAgICAgICAgb25seS4gKGFzc3VtZWQgdG8gY29tZSBmcm9tIG9wbG9nKVxuLy8gQHJldHVybnMgLSBCb29sZWFuOiBpZiBhZnRlciBhcHBseWluZyB0aGUgbW9kaWZpZXIsIHNlbGVjdG9yIGNhbiBzdGFydFxuLy8gICAgICAgICAgICAgICAgICAgICBhY2NlcHRpbmcgdGhlIG1vZGlmaWVkIHZhbHVlLlxuLy8gTk9URTogYXNzdW1lcyB0aGF0IGRvY3VtZW50IGFmZmVjdGVkIGJ5IG1vZGlmaWVyIGRpZG4ndCBtYXRjaCB0aGlzIE1hdGNoZXJcbi8vIGJlZm9yZSwgc28gaWYgbW9kaWZpZXIgY2FuJ3QgY29udmluY2Ugc2VsZWN0b3IgaW4gYSBwb3NpdGl2ZSBjaGFuZ2UgaXQgd291bGRcbi8vIHN0YXkgJ2ZhbHNlJy5cbi8vIEN1cnJlbnRseSBkb2Vzbid0IHN1cHBvcnQgJC1vcGVyYXRvcnMgYW5kIG51bWVyaWMgaW5kaWNlcyBwcmVjaXNlbHkuXG5NaW5pbW9uZ28uTWF0Y2hlci5wcm90b3R5cGUuY2FuQmVjb21lVHJ1ZUJ5TW9kaWZpZXIgPSBmdW5jdGlvbihtb2RpZmllcikge1xuICBpZiAoIXRoaXMuYWZmZWN0ZWRCeU1vZGlmaWVyKG1vZGlmaWVyKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmICghdGhpcy5pc1NpbXBsZSgpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBtb2RpZmllciA9IE9iamVjdC5hc3NpZ24oeyRzZXQ6IHt9LCAkdW5zZXQ6IHt9fSwgbW9kaWZpZXIpO1xuXG4gIGNvbnN0IG1vZGlmaWVyUGF0aHMgPSBbXS5jb25jYXQoXG4gICAgT2JqZWN0LmtleXMobW9kaWZpZXIuJHNldCksXG4gICAgT2JqZWN0LmtleXMobW9kaWZpZXIuJHVuc2V0KVxuICApO1xuXG4gIGlmICh0aGlzLl9nZXRQYXRocygpLnNvbWUocGF0aEhhc051bWVyaWNLZXlzKSB8fFxuICAgICAgbW9kaWZpZXJQYXRocy5zb21lKHBhdGhIYXNOdW1lcmljS2V5cykpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIGNoZWNrIGlmIHRoZXJlIGlzIGEgJHNldCBvciAkdW5zZXQgdGhhdCBpbmRpY2F0ZXMgc29tZXRoaW5nIGlzIGFuXG4gIC8vIG9iamVjdCByYXRoZXIgdGhhbiBhIHNjYWxhciBpbiB0aGUgYWN0dWFsIG9iamVjdCB3aGVyZSB3ZSBzYXcgJC1vcGVyYXRvclxuICAvLyBOT1RFOiBpdCBpcyBjb3JyZWN0IHNpbmNlIHdlIGFsbG93IG9ubHkgc2NhbGFycyBpbiAkLW9wZXJhdG9yc1xuICAvLyBFeGFtcGxlOiBmb3Igc2VsZWN0b3IgeydhLmInOiB7JGd0OiA1fX0gdGhlIG1vZGlmaWVyIHsnYS5iLmMnOjd9IHdvdWxkXG4gIC8vIGRlZmluaXRlbHkgc2V0IHRoZSByZXN1bHQgdG8gZmFsc2UgYXMgJ2EuYicgYXBwZWFycyB0byBiZSBhbiBvYmplY3QuXG4gIGNvbnN0IGV4cGVjdGVkU2NhbGFySXNPYmplY3QgPSBPYmplY3Qua2V5cyh0aGlzLl9zZWxlY3Rvcikuc29tZShwYXRoID0+IHtcbiAgICBpZiAoIWlzT3BlcmF0b3JPYmplY3QodGhpcy5fc2VsZWN0b3JbcGF0aF0pKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1vZGlmaWVyUGF0aHMuc29tZShtb2RpZmllclBhdGggPT5cbiAgICAgIG1vZGlmaWVyUGF0aC5zdGFydHNXaXRoKGAke3BhdGh9LmApXG4gICAgKTtcbiAgfSk7XG5cbiAgaWYgKGV4cGVjdGVkU2NhbGFySXNPYmplY3QpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBTZWUgaWYgd2UgY2FuIGFwcGx5IHRoZSBtb2RpZmllciBvbiB0aGUgaWRlYWxseSBtYXRjaGluZyBvYmplY3QuIElmIGl0XG4gIC8vIHN0aWxsIG1hdGNoZXMgdGhlIHNlbGVjdG9yLCB0aGVuIHRoZSBtb2RpZmllciBjb3VsZCBoYXZlIHR1cm5lZCB0aGUgcmVhbFxuICAvLyBvYmplY3QgaW4gdGhlIGRhdGFiYXNlIGludG8gc29tZXRoaW5nIG1hdGNoaW5nLlxuICBjb25zdCBtYXRjaGluZ0RvY3VtZW50ID0gRUpTT04uY2xvbmUodGhpcy5tYXRjaGluZ0RvY3VtZW50KCkpO1xuXG4gIC8vIFRoZSBzZWxlY3RvciBpcyB0b28gY29tcGxleCwgYW55dGhpbmcgY2FuIGhhcHBlbi5cbiAgaWYgKG1hdGNoaW5nRG9jdW1lbnQgPT09IG51bGwpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgTG9jYWxDb2xsZWN0aW9uLl9tb2RpZnkobWF0Y2hpbmdEb2N1bWVudCwgbW9kaWZpZXIpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIENvdWxkbid0IHNldCBhIHByb3BlcnR5IG9uIGEgZmllbGQgd2hpY2ggaXMgYSBzY2FsYXIgb3IgbnVsbCBpbiB0aGVcbiAgICAvLyBzZWxlY3Rvci5cbiAgICAvLyBFeGFtcGxlOlxuICAgIC8vIHJlYWwgZG9jdW1lbnQ6IHsgJ2EuYic6IDMgfVxuICAgIC8vIHNlbGVjdG9yOiB7ICdhJzogMTIgfVxuICAgIC8vIGNvbnZlcnRlZCBzZWxlY3RvciAoaWRlYWwgZG9jdW1lbnQpOiB7ICdhJzogMTIgfVxuICAgIC8vIG1vZGlmaWVyOiB7ICRzZXQ6IHsgJ2EuYic6IDQgfSB9XG4gICAgLy8gV2UgZG9uJ3Qga25vdyB3aGF0IHJlYWwgZG9jdW1lbnQgd2FzIGxpa2UgYnV0IGZyb20gdGhlIGVycm9yIHJhaXNlZCBieVxuICAgIC8vICRzZXQgb24gYSBzY2FsYXIgZmllbGQgd2UgY2FuIHJlYXNvbiB0aGF0IHRoZSBzdHJ1Y3R1cmUgb2YgcmVhbCBkb2N1bWVudFxuICAgIC8vIGlzIGNvbXBsZXRlbHkgZGlmZmVyZW50LlxuICAgIGlmIChlcnJvci5uYW1lID09PSAnTWluaW1vbmdvRXJyb3InICYmIGVycm9yLnNldFByb3BlcnR5RXJyb3IpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuXG4gIHJldHVybiB0aGlzLmRvY3VtZW50TWF0Y2hlcyhtYXRjaGluZ0RvY3VtZW50KS5yZXN1bHQ7XG59O1xuXG4vLyBLbm93cyBob3cgdG8gY29tYmluZSBhIG1vbmdvIHNlbGVjdG9yIGFuZCBhIGZpZWxkcyBwcm9qZWN0aW9uIHRvIGEgbmV3IGZpZWxkc1xuLy8gcHJvamVjdGlvbiB0YWtpbmcgaW50byBhY2NvdW50IGFjdGl2ZSBmaWVsZHMgZnJvbSB0aGUgcGFzc2VkIHNlbGVjdG9yLlxuLy8gQHJldHVybnMgT2JqZWN0IC0gcHJvamVjdGlvbiBvYmplY3QgKHNhbWUgYXMgZmllbGRzIG9wdGlvbiBvZiBtb25nbyBjdXJzb3IpXG5NaW5pbW9uZ28uTWF0Y2hlci5wcm90b3R5cGUuY29tYmluZUludG9Qcm9qZWN0aW9uID0gZnVuY3Rpb24ocHJvamVjdGlvbikge1xuICBjb25zdCBzZWxlY3RvclBhdGhzID0gTWluaW1vbmdvLl9wYXRoc0VsaWRpbmdOdW1lcmljS2V5cyh0aGlzLl9nZXRQYXRocygpKTtcblxuICAvLyBTcGVjaWFsIGNhc2UgZm9yICR3aGVyZSBvcGVyYXRvciBpbiB0aGUgc2VsZWN0b3IgLSBwcm9qZWN0aW9uIHNob3VsZCBkZXBlbmRcbiAgLy8gb24gYWxsIGZpZWxkcyBvZiB0aGUgZG9jdW1lbnQuIGdldFNlbGVjdG9yUGF0aHMgcmV0dXJucyBhIGxpc3Qgb2YgcGF0aHNcbiAgLy8gc2VsZWN0b3IgZGVwZW5kcyBvbi4gSWYgb25lIG9mIHRoZSBwYXRocyBpcyAnJyAoZW1wdHkgc3RyaW5nKSByZXByZXNlbnRpbmdcbiAgLy8gdGhlIHJvb3Qgb3IgdGhlIHdob2xlIGRvY3VtZW50LCBjb21wbGV0ZSBwcm9qZWN0aW9uIHNob3VsZCBiZSByZXR1cm5lZC5cbiAgaWYgKHNlbGVjdG9yUGF0aHMuaW5jbHVkZXMoJycpKSB7XG4gICAgcmV0dXJuIHt9O1xuICB9XG5cbiAgcmV0dXJuIGNvbWJpbmVJbXBvcnRhbnRQYXRoc0ludG9Qcm9qZWN0aW9uKHNlbGVjdG9yUGF0aHMsIHByb2plY3Rpb24pO1xufTtcblxuLy8gUmV0dXJucyBhbiBvYmplY3QgdGhhdCB3b3VsZCBtYXRjaCB0aGUgc2VsZWN0b3IgaWYgcG9zc2libGUgb3IgbnVsbCBpZiB0aGVcbi8vIHNlbGVjdG9yIGlzIHRvbyBjb21wbGV4IGZvciB1cyB0byBhbmFseXplXG4vLyB7ICdhLmInOiB7IGFuczogNDIgfSwgJ2Zvby5iYXInOiBudWxsLCAnZm9vLmJheic6IFwic29tZXRoaW5nXCIgfVxuLy8gPT4geyBhOiB7IGI6IHsgYW5zOiA0MiB9IH0sIGZvbzogeyBiYXI6IG51bGwsIGJhejogXCJzb21ldGhpbmdcIiB9IH1cbk1pbmltb25nby5NYXRjaGVyLnByb3RvdHlwZS5tYXRjaGluZ0RvY3VtZW50ID0gZnVuY3Rpb24oKSB7XG4gIC8vIGNoZWNrIGlmIGl0IHdhcyBjb21wdXRlZCBiZWZvcmVcbiAgaWYgKHRoaXMuX21hdGNoaW5nRG9jdW1lbnQgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiB0aGlzLl9tYXRjaGluZ0RvY3VtZW50O1xuICB9XG5cbiAgLy8gSWYgdGhlIGFuYWx5c2lzIG9mIHRoaXMgc2VsZWN0b3IgaXMgdG9vIGhhcmQgZm9yIG91ciBpbXBsZW1lbnRhdGlvblxuICAvLyBmYWxsYmFjayB0byBcIllFU1wiXG4gIGxldCBmYWxsYmFjayA9IGZhbHNlO1xuXG4gIHRoaXMuX21hdGNoaW5nRG9jdW1lbnQgPSBwYXRoc1RvVHJlZShcbiAgICB0aGlzLl9nZXRQYXRocygpLFxuICAgIHBhdGggPT4ge1xuICAgICAgY29uc3QgdmFsdWVTZWxlY3RvciA9IHRoaXMuX3NlbGVjdG9yW3BhdGhdO1xuXG4gICAgICBpZiAoaXNPcGVyYXRvck9iamVjdCh2YWx1ZVNlbGVjdG9yKSkge1xuICAgICAgICAvLyBpZiB0aGVyZSBpcyBhIHN0cmljdCBlcXVhbGl0eSwgdGhlcmUgaXMgYSBnb29kXG4gICAgICAgIC8vIGNoYW5jZSB3ZSBjYW4gdXNlIG9uZSBvZiB0aG9zZSBhcyBcIm1hdGNoaW5nXCJcbiAgICAgICAgLy8gZHVtbXkgdmFsdWVcbiAgICAgICAgaWYgKHZhbHVlU2VsZWN0b3IuJGVxKSB7XG4gICAgICAgICAgcmV0dXJuIHZhbHVlU2VsZWN0b3IuJGVxO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZhbHVlU2VsZWN0b3IuJGluKSB7XG4gICAgICAgICAgY29uc3QgbWF0Y2hlciA9IG5ldyBNaW5pbW9uZ28uTWF0Y2hlcih7cGxhY2Vob2xkZXI6IHZhbHVlU2VsZWN0b3J9KTtcblxuICAgICAgICAgIC8vIFJldHVybiBhbnl0aGluZyBmcm9tICRpbiB0aGF0IG1hdGNoZXMgdGhlIHdob2xlIHNlbGVjdG9yIGZvciB0aGlzXG4gICAgICAgICAgLy8gcGF0aC4gSWYgbm90aGluZyBtYXRjaGVzLCByZXR1cm5zIGB1bmRlZmluZWRgIGFzIG5vdGhpbmcgY2FuIG1ha2VcbiAgICAgICAgICAvLyB0aGlzIHNlbGVjdG9yIGludG8gYHRydWVgLlxuICAgICAgICAgIHJldHVybiB2YWx1ZVNlbGVjdG9yLiRpbi5maW5kKHBsYWNlaG9sZGVyID0+XG4gICAgICAgICAgICBtYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyh7cGxhY2Vob2xkZXJ9KS5yZXN1bHRcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9ubHlDb250YWluc0tleXModmFsdWVTZWxlY3RvciwgWyckZ3QnLCAnJGd0ZScsICckbHQnLCAnJGx0ZSddKSkge1xuICAgICAgICAgIGxldCBsb3dlckJvdW5kID0gLUluZmluaXR5O1xuICAgICAgICAgIGxldCB1cHBlckJvdW5kID0gSW5maW5pdHk7XG5cbiAgICAgICAgICBbJyRsdGUnLCAnJGx0J10uZm9yRWFjaChvcCA9PiB7XG4gICAgICAgICAgICBpZiAoaGFzT3duLmNhbGwodmFsdWVTZWxlY3Rvciwgb3ApICYmXG4gICAgICAgICAgICAgICAgdmFsdWVTZWxlY3RvcltvcF0gPCB1cHBlckJvdW5kKSB7XG4gICAgICAgICAgICAgIHVwcGVyQm91bmQgPSB2YWx1ZVNlbGVjdG9yW29wXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIFsnJGd0ZScsICckZ3QnXS5mb3JFYWNoKG9wID0+IHtcbiAgICAgICAgICAgIGlmIChoYXNPd24uY2FsbCh2YWx1ZVNlbGVjdG9yLCBvcCkgJiZcbiAgICAgICAgICAgICAgICB2YWx1ZVNlbGVjdG9yW29wXSA+IGxvd2VyQm91bmQpIHtcbiAgICAgICAgICAgICAgbG93ZXJCb3VuZCA9IHZhbHVlU2VsZWN0b3Jbb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgY29uc3QgbWlkZGxlID0gKGxvd2VyQm91bmQgKyB1cHBlckJvdW5kKSAvIDI7XG4gICAgICAgICAgY29uc3QgbWF0Y2hlciA9IG5ldyBNaW5pbW9uZ28uTWF0Y2hlcih7cGxhY2Vob2xkZXI6IHZhbHVlU2VsZWN0b3J9KTtcblxuICAgICAgICAgIGlmICghbWF0Y2hlci5kb2N1bWVudE1hdGNoZXMoe3BsYWNlaG9sZGVyOiBtaWRkbGV9KS5yZXN1bHQgJiZcbiAgICAgICAgICAgICAgKG1pZGRsZSA9PT0gbG93ZXJCb3VuZCB8fCBtaWRkbGUgPT09IHVwcGVyQm91bmQpKSB7XG4gICAgICAgICAgICBmYWxsYmFjayA9IHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIG1pZGRsZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvbmx5Q29udGFpbnNLZXlzKHZhbHVlU2VsZWN0b3IsIFsnJG5pbicsICckbmUnXSkpIHtcbiAgICAgICAgICAvLyBTaW5jZSB0aGlzLl9pc1NpbXBsZSBtYWtlcyBzdXJlICRuaW4gYW5kICRuZSBhcmUgbm90IGNvbWJpbmVkIHdpdGhcbiAgICAgICAgICAvLyBvYmplY3RzIG9yIGFycmF5cywgd2UgY2FuIGNvbmZpZGVudGx5IHJldHVybiBhbiBlbXB0eSBvYmplY3QgYXMgaXRcbiAgICAgICAgICAvLyBuZXZlciBtYXRjaGVzIGFueSBzY2FsYXIuXG4gICAgICAgICAgcmV0dXJuIHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgZmFsbGJhY2sgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5fc2VsZWN0b3JbcGF0aF07XG4gICAgfSxcbiAgICB4ID0+IHgpO1xuXG4gIGlmIChmYWxsYmFjaykge1xuICAgIHRoaXMuX21hdGNoaW5nRG9jdW1lbnQgPSBudWxsO1xuICB9XG5cbiAgcmV0dXJuIHRoaXMuX21hdGNoaW5nRG9jdW1lbnQ7XG59O1xuXG4vLyBNaW5pbW9uZ28uU29ydGVyIGdldHMgYSBzaW1pbGFyIG1ldGhvZCwgd2hpY2ggZGVsZWdhdGVzIHRvIGEgTWF0Y2hlciBpdCBtYWRlXG4vLyBmb3IgdGhpcyBleGFjdCBwdXJwb3NlLlxuTWluaW1vbmdvLlNvcnRlci5wcm90b3R5cGUuYWZmZWN0ZWRCeU1vZGlmaWVyID0gZnVuY3Rpb24obW9kaWZpZXIpIHtcbiAgcmV0dXJuIHRoaXMuX3NlbGVjdG9yRm9yQWZmZWN0ZWRCeU1vZGlmaWVyLmFmZmVjdGVkQnlNb2RpZmllcihtb2RpZmllcik7XG59O1xuXG5NaW5pbW9uZ28uU29ydGVyLnByb3RvdHlwZS5jb21iaW5lSW50b1Byb2plY3Rpb24gPSBmdW5jdGlvbihwcm9qZWN0aW9uKSB7XG4gIHJldHVybiBjb21iaW5lSW1wb3J0YW50UGF0aHNJbnRvUHJvamVjdGlvbihcbiAgICBNaW5pbW9uZ28uX3BhdGhzRWxpZGluZ051bWVyaWNLZXlzKHRoaXMuX2dldFBhdGhzKCkpLFxuICAgIHByb2plY3Rpb25cbiAgKTtcbn07XG5cbmZ1bmN0aW9uIGNvbWJpbmVJbXBvcnRhbnRQYXRoc0ludG9Qcm9qZWN0aW9uKHBhdGhzLCBwcm9qZWN0aW9uKSB7XG4gIGNvbnN0IGRldGFpbHMgPSBwcm9qZWN0aW9uRGV0YWlscyhwcm9qZWN0aW9uKTtcblxuICAvLyBtZXJnZSB0aGUgcGF0aHMgdG8gaW5jbHVkZVxuICBjb25zdCB0cmVlID0gcGF0aHNUb1RyZWUoXG4gICAgcGF0aHMsXG4gICAgcGF0aCA9PiB0cnVlLFxuICAgIChub2RlLCBwYXRoLCBmdWxsUGF0aCkgPT4gdHJ1ZSxcbiAgICBkZXRhaWxzLnRyZWVcbiAgKTtcbiAgY29uc3QgbWVyZ2VkUHJvamVjdGlvbiA9IHRyZWVUb1BhdGhzKHRyZWUpO1xuXG4gIGlmIChkZXRhaWxzLmluY2x1ZGluZykge1xuICAgIC8vIGJvdGggc2VsZWN0b3IgYW5kIHByb2plY3Rpb24gYXJlIHBvaW50aW5nIG9uIGZpZWxkcyB0byBpbmNsdWRlXG4gICAgLy8gc28gd2UgY2FuIGp1c3QgcmV0dXJuIHRoZSBtZXJnZWQgdHJlZVxuICAgIHJldHVybiBtZXJnZWRQcm9qZWN0aW9uO1xuICB9XG5cbiAgLy8gc2VsZWN0b3IgaXMgcG9pbnRpbmcgYXQgZmllbGRzIHRvIGluY2x1ZGVcbiAgLy8gcHJvamVjdGlvbiBpcyBwb2ludGluZyBhdCBmaWVsZHMgdG8gZXhjbHVkZVxuICAvLyBtYWtlIHN1cmUgd2UgZG9uJ3QgZXhjbHVkZSBpbXBvcnRhbnQgcGF0aHNcbiAgY29uc3QgbWVyZ2VkRXhjbFByb2plY3Rpb24gPSB7fTtcblxuICBPYmplY3Qua2V5cyhtZXJnZWRQcm9qZWN0aW9uKS5mb3JFYWNoKHBhdGggPT4ge1xuICAgIGlmICghbWVyZ2VkUHJvamVjdGlvbltwYXRoXSkge1xuICAgICAgbWVyZ2VkRXhjbFByb2plY3Rpb25bcGF0aF0gPSBmYWxzZTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBtZXJnZWRFeGNsUHJvamVjdGlvbjtcbn1cblxuZnVuY3Rpb24gZ2V0UGF0aHMoc2VsZWN0b3IpIHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKG5ldyBNaW5pbW9uZ28uTWF0Y2hlcihzZWxlY3RvcikuX3BhdGhzKTtcblxuICAvLyBYWFggcmVtb3ZlIGl0P1xuICAvLyByZXR1cm4gT2JqZWN0LmtleXMoc2VsZWN0b3IpLm1hcChrID0+IHtcbiAgLy8gICAvLyB3ZSBkb24ndCBrbm93IGhvdyB0byBoYW5kbGUgJHdoZXJlIGJlY2F1c2UgaXQgY2FuIGJlIGFueXRoaW5nXG4gIC8vICAgaWYgKGsgPT09ICckd2hlcmUnKSB7XG4gIC8vICAgICByZXR1cm4gJyc7IC8vIG1hdGNoZXMgZXZlcnl0aGluZ1xuICAvLyAgIH1cblxuICAvLyAgIC8vIHdlIGJyYW5jaCBmcm9tICRvci8kYW5kLyRub3Igb3BlcmF0b3JcbiAgLy8gICBpZiAoWyckb3InLCAnJGFuZCcsICckbm9yJ10uaW5jbHVkZXMoaykpIHtcbiAgLy8gICAgIHJldHVybiBzZWxlY3RvcltrXS5tYXAoZ2V0UGF0aHMpO1xuICAvLyAgIH1cblxuICAvLyAgIC8vIHRoZSB2YWx1ZSBpcyBhIGxpdGVyYWwgb3Igc29tZSBjb21wYXJpc29uIG9wZXJhdG9yXG4gIC8vICAgcmV0dXJuIGs7XG4gIC8vIH0pXG4gIC8vICAgLnJlZHVjZSgoYSwgYikgPT4gYS5jb25jYXQoYiksIFtdKVxuICAvLyAgIC5maWx0ZXIoKGEsIGIsIGMpID0+IGMuaW5kZXhPZihhKSA9PT0gYik7XG59XG5cbi8vIEEgaGVscGVyIHRvIGVuc3VyZSBvYmplY3QgaGFzIG9ubHkgY2VydGFpbiBrZXlzXG5mdW5jdGlvbiBvbmx5Q29udGFpbnNLZXlzKG9iaiwga2V5cykge1xuICByZXR1cm4gT2JqZWN0LmtleXMob2JqKS5ldmVyeShrID0+IGtleXMuaW5jbHVkZXMoaykpO1xufVxuXG5mdW5jdGlvbiBwYXRoSGFzTnVtZXJpY0tleXMocGF0aCkge1xuICByZXR1cm4gcGF0aC5zcGxpdCgnLicpLnNvbWUoaXNOdW1lcmljS2V5KTtcbn1cblxuLy8gUmV0dXJucyBhIHNldCBvZiBrZXkgcGF0aHMgc2ltaWxhciB0b1xuLy8geyAnZm9vLmJhcic6IDEsICdhLmIuYyc6IDEgfVxuZnVuY3Rpb24gdHJlZVRvUGF0aHModHJlZSwgcHJlZml4ID0gJycpIHtcbiAgY29uc3QgcmVzdWx0ID0ge307XG5cbiAgT2JqZWN0LmtleXModHJlZSkuZm9yRWFjaChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gdHJlZVtrZXldO1xuICAgIGlmICh2YWx1ZSA9PT0gT2JqZWN0KHZhbHVlKSkge1xuICAgICAgT2JqZWN0LmFzc2lnbihyZXN1bHQsIHRyZWVUb1BhdGhzKHZhbHVlLCBgJHtwcmVmaXggKyBrZXl9LmApKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0W3ByZWZpeCArIGtleV0gPSB2YWx1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiByZXN1bHQ7XG59XG4iLCJpbXBvcnQgTG9jYWxDb2xsZWN0aW9uIGZyb20gJy4vbG9jYWxfY29sbGVjdGlvbi5qcyc7XG5cbmV4cG9ydCBjb25zdCBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4vLyBFYWNoIGVsZW1lbnQgc2VsZWN0b3IgY29udGFpbnM6XG4vLyAgLSBjb21waWxlRWxlbWVudFNlbGVjdG9yLCBhIGZ1bmN0aW9uIHdpdGggYXJnczpcbi8vICAgIC0gb3BlcmFuZCAtIHRoZSBcInJpZ2h0IGhhbmQgc2lkZVwiIG9mIHRoZSBvcGVyYXRvclxuLy8gICAgLSB2YWx1ZVNlbGVjdG9yIC0gdGhlIFwiY29udGV4dFwiIGZvciB0aGUgb3BlcmF0b3IgKHNvIHRoYXQgJHJlZ2V4IGNhbiBmaW5kXG4vLyAgICAgICRvcHRpb25zKVxuLy8gICAgLSBtYXRjaGVyIC0gdGhlIE1hdGNoZXIgdGhpcyBpcyBnb2luZyBpbnRvIChzbyB0aGF0ICRlbGVtTWF0Y2ggY2FuIGNvbXBpbGVcbi8vICAgICAgbW9yZSB0aGluZ3MpXG4vLyAgICByZXR1cm5pbmcgYSBmdW5jdGlvbiBtYXBwaW5nIGEgc2luZ2xlIHZhbHVlIHRvIGJvb2wuXG4vLyAgLSBkb250RXhwYW5kTGVhZkFycmF5cywgYSBib29sIHdoaWNoIHByZXZlbnRzIGV4cGFuZEFycmF5c0luQnJhbmNoZXMgZnJvbVxuLy8gICAgYmVpbmcgY2FsbGVkXG4vLyAgLSBkb250SW5jbHVkZUxlYWZBcnJheXMsIGEgYm9vbCB3aGljaCBjYXVzZXMgYW4gYXJndW1lbnQgdG8gYmUgcGFzc2VkIHRvXG4vLyAgICBleHBhbmRBcnJheXNJbkJyYW5jaGVzIGlmIGl0IGlzIGNhbGxlZFxuZXhwb3J0IGNvbnN0IEVMRU1FTlRfT1BFUkFUT1JTID0ge1xuICAkbHQ6IG1ha2VJbmVxdWFsaXR5KGNtcFZhbHVlID0+IGNtcFZhbHVlIDwgMCksXG4gICRndDogbWFrZUluZXF1YWxpdHkoY21wVmFsdWUgPT4gY21wVmFsdWUgPiAwKSxcbiAgJGx0ZTogbWFrZUluZXF1YWxpdHkoY21wVmFsdWUgPT4gY21wVmFsdWUgPD0gMCksXG4gICRndGU6IG1ha2VJbmVxdWFsaXR5KGNtcFZhbHVlID0+IGNtcFZhbHVlID49IDApLFxuICAkbW9kOiB7XG4gICAgY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kKSB7XG4gICAgICBpZiAoIShBcnJheS5pc0FycmF5KG9wZXJhbmQpICYmIG9wZXJhbmQubGVuZ3RoID09PSAyXG4gICAgICAgICAgICAmJiB0eXBlb2Ygb3BlcmFuZFswXSA9PT0gJ251bWJlcidcbiAgICAgICAgICAgICYmIHR5cGVvZiBvcGVyYW5kWzFdID09PSAnbnVtYmVyJykpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ2FyZ3VtZW50IHRvICRtb2QgbXVzdCBiZSBhbiBhcnJheSBvZiB0d28gbnVtYmVycycpO1xuICAgICAgfVxuXG4gICAgICAvLyBYWFggY291bGQgcmVxdWlyZSB0byBiZSBpbnRzIG9yIHJvdW5kIG9yIHNvbWV0aGluZ1xuICAgICAgY29uc3QgZGl2aXNvciA9IG9wZXJhbmRbMF07XG4gICAgICBjb25zdCByZW1haW5kZXIgPSBvcGVyYW5kWzFdO1xuICAgICAgcmV0dXJuIHZhbHVlID0+IChcbiAgICAgICAgdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiB2YWx1ZSAlIGRpdmlzb3IgPT09IHJlbWFpbmRlclxuICAgICAgKTtcbiAgICB9LFxuICB9LFxuICAkaW46IHtcbiAgICBjb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQpIHtcbiAgICAgIGlmICghQXJyYXkuaXNBcnJheShvcGVyYW5kKSkge1xuICAgICAgICB0aHJvdyBFcnJvcignJGluIG5lZWRzIGFuIGFycmF5Jyk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGVsZW1lbnRNYXRjaGVycyA9IG9wZXJhbmQubWFwKG9wdGlvbiA9PiB7XG4gICAgICAgIGlmIChvcHRpb24gaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgICByZXR1cm4gcmVnZXhwRWxlbWVudE1hdGNoZXIob3B0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc09wZXJhdG9yT2JqZWN0KG9wdGlvbikpIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcignY2Fubm90IG5lc3QgJCB1bmRlciAkaW4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBlcXVhbGl0eUVsZW1lbnRNYXRjaGVyKG9wdGlvbik7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHZhbHVlID0+IHtcbiAgICAgICAgLy8gQWxsb3cge2E6IHskaW46IFtudWxsXX19IHRvIG1hdGNoIHdoZW4gJ2EnIGRvZXMgbm90IGV4aXN0LlxuICAgICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHZhbHVlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBlbGVtZW50TWF0Y2hlcnMuc29tZShtYXRjaGVyID0+IG1hdGNoZXIodmFsdWUpKTtcbiAgICAgIH07XG4gICAgfSxcbiAgfSxcbiAgJHNpemU6IHtcbiAgICAvLyB7YTogW1s1LCA1XV19IG11c3QgbWF0Y2gge2E6IHskc2l6ZTogMX19IGJ1dCBub3Qge2E6IHskc2l6ZTogMn19LCBzbyB3ZVxuICAgIC8vIGRvbid0IHdhbnQgdG8gY29uc2lkZXIgdGhlIGVsZW1lbnQgWzUsNV0gaW4gdGhlIGxlYWYgYXJyYXkgW1s1LDVdXSBhcyBhXG4gICAgLy8gcG9zc2libGUgdmFsdWUuXG4gICAgZG9udEV4cGFuZExlYWZBcnJheXM6IHRydWUsXG4gICAgY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kKSB7XG4gICAgICBpZiAodHlwZW9mIG9wZXJhbmQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIERvbid0IGFzayBtZSB3aHksIGJ1dCBieSBleHBlcmltZW50YXRpb24sIHRoaXMgc2VlbXMgdG8gYmUgd2hhdCBNb25nb1xuICAgICAgICAvLyBkb2VzLlxuICAgICAgICBvcGVyYW5kID0gMDtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIG9wZXJhbmQgIT09ICdudW1iZXInKSB7XG4gICAgICAgIHRocm93IEVycm9yKCckc2l6ZSBuZWVkcyBhIG51bWJlcicpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdmFsdWUgPT4gQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgdmFsdWUubGVuZ3RoID09PSBvcGVyYW5kO1xuICAgIH0sXG4gIH0sXG4gICR0eXBlOiB7XG4gICAgLy8ge2E6IFs1XX0gbXVzdCBub3QgbWF0Y2gge2E6IHskdHlwZTogNH19ICg0IG1lYW5zIGFycmF5KSwgYnV0IGl0IHNob3VsZFxuICAgIC8vIG1hdGNoIHthOiB7JHR5cGU6IDF9fSAoMSBtZWFucyBudW1iZXIpLCBhbmQge2E6IFtbNV1dfSBtdXN0IG1hdGNoIHskYTpcbiAgICAvLyB7JHR5cGU6IDR9fS4gVGh1cywgd2hlbiB3ZSBzZWUgYSBsZWFmIGFycmF5LCB3ZSAqc2hvdWxkKiBleHBhbmQgaXQgYnV0XG4gICAgLy8gc2hvdWxkICpub3QqIGluY2x1ZGUgaXQgaXRzZWxmLlxuICAgIGRvbnRJbmNsdWRlTGVhZkFycmF5czogdHJ1ZSxcbiAgICBjb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQpIHtcbiAgICAgIGlmICh0eXBlb2Ygb3BlcmFuZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgY29uc3Qgb3BlcmFuZEFsaWFzTWFwID0ge1xuICAgICAgICAgICdkb3VibGUnOiAxLFxuICAgICAgICAgICdzdHJpbmcnOiAyLFxuICAgICAgICAgICdvYmplY3QnOiAzLFxuICAgICAgICAgICdhcnJheSc6IDQsXG4gICAgICAgICAgJ2JpbkRhdGEnOiA1LFxuICAgICAgICAgICd1bmRlZmluZWQnOiA2LFxuICAgICAgICAgICdvYmplY3RJZCc6IDcsXG4gICAgICAgICAgJ2Jvb2wnOiA4LFxuICAgICAgICAgICdkYXRlJzogOSxcbiAgICAgICAgICAnbnVsbCc6IDEwLFxuICAgICAgICAgICdyZWdleCc6IDExLFxuICAgICAgICAgICdkYlBvaW50ZXInOiAxMixcbiAgICAgICAgICAnamF2YXNjcmlwdCc6IDEzLFxuICAgICAgICAgICdzeW1ib2wnOiAxNCxcbiAgICAgICAgICAnamF2YXNjcmlwdFdpdGhTY29wZSc6IDE1LFxuICAgICAgICAgICdpbnQnOiAxNixcbiAgICAgICAgICAndGltZXN0YW1wJzogMTcsXG4gICAgICAgICAgJ2xvbmcnOiAxOCxcbiAgICAgICAgICAnZGVjaW1hbCc6IDE5LFxuICAgICAgICAgICdtaW5LZXknOiAtMSxcbiAgICAgICAgICAnbWF4S2V5JzogMTI3LFxuICAgICAgICB9O1xuICAgICAgICBpZiAoIWhhc093bi5jYWxsKG9wZXJhbmRBbGlhc01hcCwgb3BlcmFuZCkpIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcihgdW5rbm93biBzdHJpbmcgYWxpYXMgZm9yICR0eXBlOiAke29wZXJhbmR9YCk7XG4gICAgICAgIH1cbiAgICAgICAgb3BlcmFuZCA9IG9wZXJhbmRBbGlhc01hcFtvcGVyYW5kXTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIG9wZXJhbmQgPT09ICdudW1iZXInKSB7XG4gICAgICAgIGlmIChvcGVyYW5kID09PSAwIHx8IG9wZXJhbmQgPCAtMVxuICAgICAgICAgIHx8IChvcGVyYW5kID4gMTkgJiYgb3BlcmFuZCAhPT0gMTI3KSkge1xuICAgICAgICAgIHRocm93IEVycm9yKGBJbnZhbGlkIG51bWVyaWNhbCAkdHlwZSBjb2RlOiAke29wZXJhbmR9YCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IEVycm9yKCdhcmd1bWVudCB0byAkdHlwZSBpcyBub3QgYSBudW1iZXIgb3IgYSBzdHJpbmcnKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHZhbHVlID0+IChcbiAgICAgICAgdmFsdWUgIT09IHVuZGVmaW5lZCAmJiBMb2NhbENvbGxlY3Rpb24uX2YuX3R5cGUodmFsdWUpID09PSBvcGVyYW5kXG4gICAgICApO1xuICAgIH0sXG4gIH0sXG4gICRiaXRzQWxsU2V0OiB7XG4gICAgY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kKSB7XG4gICAgICBjb25zdCBtYXNrID0gZ2V0T3BlcmFuZEJpdG1hc2sob3BlcmFuZCwgJyRiaXRzQWxsU2V0Jyk7XG4gICAgICByZXR1cm4gdmFsdWUgPT4ge1xuICAgICAgICBjb25zdCBiaXRtYXNrID0gZ2V0VmFsdWVCaXRtYXNrKHZhbHVlLCBtYXNrLmxlbmd0aCk7XG4gICAgICAgIHJldHVybiBiaXRtYXNrICYmIG1hc2suZXZlcnkoKGJ5dGUsIGkpID0+IChiaXRtYXNrW2ldICYgYnl0ZSkgPT09IGJ5dGUpO1xuICAgICAgfTtcbiAgICB9LFxuICB9LFxuICAkYml0c0FueVNldDoge1xuICAgIGNvbXBpbGVFbGVtZW50U2VsZWN0b3Iob3BlcmFuZCkge1xuICAgICAgY29uc3QgbWFzayA9IGdldE9wZXJhbmRCaXRtYXNrKG9wZXJhbmQsICckYml0c0FueVNldCcpO1xuICAgICAgcmV0dXJuIHZhbHVlID0+IHtcbiAgICAgICAgY29uc3QgYml0bWFzayA9IGdldFZhbHVlQml0bWFzayh2YWx1ZSwgbWFzay5sZW5ndGgpO1xuICAgICAgICByZXR1cm4gYml0bWFzayAmJiBtYXNrLnNvbWUoKGJ5dGUsIGkpID0+ICh+Yml0bWFza1tpXSAmIGJ5dGUpICE9PSBieXRlKTtcbiAgICAgIH07XG4gICAgfSxcbiAgfSxcbiAgJGJpdHNBbGxDbGVhcjoge1xuICAgIGNvbXBpbGVFbGVtZW50U2VsZWN0b3Iob3BlcmFuZCkge1xuICAgICAgY29uc3QgbWFzayA9IGdldE9wZXJhbmRCaXRtYXNrKG9wZXJhbmQsICckYml0c0FsbENsZWFyJyk7XG4gICAgICByZXR1cm4gdmFsdWUgPT4ge1xuICAgICAgICBjb25zdCBiaXRtYXNrID0gZ2V0VmFsdWVCaXRtYXNrKHZhbHVlLCBtYXNrLmxlbmd0aCk7XG4gICAgICAgIHJldHVybiBiaXRtYXNrICYmIG1hc2suZXZlcnkoKGJ5dGUsIGkpID0+ICEoYml0bWFza1tpXSAmIGJ5dGUpKTtcbiAgICAgIH07XG4gICAgfSxcbiAgfSxcbiAgJGJpdHNBbnlDbGVhcjoge1xuICAgIGNvbXBpbGVFbGVtZW50U2VsZWN0b3Iob3BlcmFuZCkge1xuICAgICAgY29uc3QgbWFzayA9IGdldE9wZXJhbmRCaXRtYXNrKG9wZXJhbmQsICckYml0c0FueUNsZWFyJyk7XG4gICAgICByZXR1cm4gdmFsdWUgPT4ge1xuICAgICAgICBjb25zdCBiaXRtYXNrID0gZ2V0VmFsdWVCaXRtYXNrKHZhbHVlLCBtYXNrLmxlbmd0aCk7XG4gICAgICAgIHJldHVybiBiaXRtYXNrICYmIG1hc2suc29tZSgoYnl0ZSwgaSkgPT4gKGJpdG1hc2tbaV0gJiBieXRlKSAhPT0gYnl0ZSk7XG4gICAgICB9O1xuICAgIH0sXG4gIH0sXG4gICRyZWdleDoge1xuICAgIGNvbXBpbGVFbGVtZW50U2VsZWN0b3Iob3BlcmFuZCwgdmFsdWVTZWxlY3Rvcikge1xuICAgICAgaWYgKCEodHlwZW9mIG9wZXJhbmQgPT09ICdzdHJpbmcnIHx8IG9wZXJhbmQgaW5zdGFuY2VvZiBSZWdFeHApKSB7XG4gICAgICAgIHRocm93IEVycm9yKCckcmVnZXggaGFzIHRvIGJlIGEgc3RyaW5nIG9yIFJlZ0V4cCcpO1xuICAgICAgfVxuXG4gICAgICBsZXQgcmVnZXhwO1xuICAgICAgaWYgKHZhbHVlU2VsZWN0b3IuJG9wdGlvbnMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyBPcHRpb25zIHBhc3NlZCBpbiAkb3B0aW9ucyAoZXZlbiB0aGUgZW1wdHkgc3RyaW5nKSBhbHdheXMgb3ZlcnJpZGVzXG4gICAgICAgIC8vIG9wdGlvbnMgaW4gdGhlIFJlZ0V4cCBvYmplY3QgaXRzZWxmLlxuXG4gICAgICAgIC8vIEJlIGNsZWFyIHRoYXQgd2Ugb25seSBzdXBwb3J0IHRoZSBKUy1zdXBwb3J0ZWQgb3B0aW9ucywgbm90IGV4dGVuZGVkXG4gICAgICAgIC8vIG9uZXMgKGVnLCBNb25nbyBzdXBwb3J0cyB4IGFuZCBzKS4gSWRlYWxseSB3ZSB3b3VsZCBpbXBsZW1lbnQgeCBhbmQgc1xuICAgICAgICAvLyBieSB0cmFuc2Zvcm1pbmcgdGhlIHJlZ2V4cCwgYnV0IG5vdCB0b2RheS4uLlxuICAgICAgICBpZiAoL1teZ2ltXS8udGVzdCh2YWx1ZVNlbGVjdG9yLiRvcHRpb25zKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignT25seSB0aGUgaSwgbSwgYW5kIGcgcmVnZXhwIG9wdGlvbnMgYXJlIHN1cHBvcnRlZCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc291cmNlID0gb3BlcmFuZCBpbnN0YW5jZW9mIFJlZ0V4cCA/IG9wZXJhbmQuc291cmNlIDogb3BlcmFuZDtcbiAgICAgICAgcmVnZXhwID0gbmV3IFJlZ0V4cChzb3VyY2UsIHZhbHVlU2VsZWN0b3IuJG9wdGlvbnMpO1xuICAgICAgfSBlbHNlIGlmIChvcGVyYW5kIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgIHJlZ2V4cCA9IG9wZXJhbmQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZWdleHAgPSBuZXcgUmVnRXhwKG9wZXJhbmQpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVnZXhwRWxlbWVudE1hdGNoZXIocmVnZXhwKTtcbiAgICB9LFxuICB9LFxuICAkZWxlbU1hdGNoOiB7XG4gICAgZG9udEV4cGFuZExlYWZBcnJheXM6IHRydWUsXG4gICAgY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kLCB2YWx1ZVNlbGVjdG9yLCBtYXRjaGVyKSB7XG4gICAgICBpZiAoIUxvY2FsQ29sbGVjdGlvbi5faXNQbGFpbk9iamVjdChvcGVyYW5kKSkge1xuICAgICAgICB0aHJvdyBFcnJvcignJGVsZW1NYXRjaCBuZWVkIGFuIG9iamVjdCcpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBpc0RvY01hdGNoZXIgPSAhaXNPcGVyYXRvck9iamVjdChcbiAgICAgICAgT2JqZWN0LmtleXMob3BlcmFuZClcbiAgICAgICAgICAuZmlsdGVyKGtleSA9PiAhaGFzT3duLmNhbGwoTE9HSUNBTF9PUEVSQVRPUlMsIGtleSkpXG4gICAgICAgICAgLnJlZHVjZSgoYSwgYikgPT4gT2JqZWN0LmFzc2lnbihhLCB7W2JdOiBvcGVyYW5kW2JdfSksIHt9KSxcbiAgICAgICAgdHJ1ZSk7XG5cbiAgICAgIGxldCBzdWJNYXRjaGVyO1xuICAgICAgaWYgKGlzRG9jTWF0Y2hlcikge1xuICAgICAgICAvLyBUaGlzIGlzIE5PVCB0aGUgc2FtZSBhcyBjb21waWxlVmFsdWVTZWxlY3RvcihvcGVyYW5kKSwgYW5kIG5vdCBqdXN0XG4gICAgICAgIC8vIGJlY2F1c2Ugb2YgdGhlIHNsaWdodGx5IGRpZmZlcmVudCBjYWxsaW5nIGNvbnZlbnRpb24uXG4gICAgICAgIC8vIHskZWxlbU1hdGNoOiB7eDogM319IG1lYW5zIFwiYW4gZWxlbWVudCBoYXMgYSBmaWVsZCB4OjNcIiwgbm90XG4gICAgICAgIC8vIFwiY29uc2lzdHMgb25seSBvZiBhIGZpZWxkIHg6M1wiLiBBbHNvLCByZWdleHBzIGFuZCBzdWItJCBhcmUgYWxsb3dlZC5cbiAgICAgICAgc3ViTWF0Y2hlciA9XG4gICAgICAgICAgY29tcGlsZURvY3VtZW50U2VsZWN0b3Iob3BlcmFuZCwgbWF0Y2hlciwge2luRWxlbU1hdGNoOiB0cnVlfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdWJNYXRjaGVyID0gY29tcGlsZVZhbHVlU2VsZWN0b3Iob3BlcmFuZCwgbWF0Y2hlcik7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB2YWx1ZSA9PiB7XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgY29uc3QgYXJyYXlFbGVtZW50ID0gdmFsdWVbaV07XG4gICAgICAgICAgbGV0IGFyZztcbiAgICAgICAgICBpZiAoaXNEb2NNYXRjaGVyKSB7XG4gICAgICAgICAgICAvLyBXZSBjYW4gb25seSBtYXRjaCB7JGVsZW1NYXRjaDoge2I6IDN9fSBhZ2FpbnN0IG9iamVjdHMuXG4gICAgICAgICAgICAvLyAoV2UgY2FuIGFsc28gbWF0Y2ggYWdhaW5zdCBhcnJheXMsIGlmIHRoZXJlJ3MgbnVtZXJpYyBpbmRpY2VzLFxuICAgICAgICAgICAgLy8gZWcgeyRlbGVtTWF0Y2g6IHsnMC5iJzogM319IG9yIHskZWxlbU1hdGNoOiB7MDogM319LilcbiAgICAgICAgICAgIGlmICghaXNJbmRleGFibGUoYXJyYXlFbGVtZW50KSkge1xuICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFyZyA9IGFycmF5RWxlbWVudDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZG9udEl0ZXJhdGUgZW5zdXJlcyB0aGF0IHthOiB7JGVsZW1NYXRjaDogeyRndDogNX19fSBtYXRjaGVzXG4gICAgICAgICAgICAvLyB7YTogWzhdfSBidXQgbm90IHthOiBbWzhdXX1cbiAgICAgICAgICAgIGFyZyA9IFt7dmFsdWU6IGFycmF5RWxlbWVudCwgZG9udEl0ZXJhdGU6IHRydWV9XTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gWFhYIHN1cHBvcnQgJG5lYXIgaW4gJGVsZW1NYXRjaCBieSBwcm9wYWdhdGluZyAkZGlzdGFuY2U/XG4gICAgICAgICAgaWYgKHN1Yk1hdGNoZXIoYXJnKS5yZXN1bHQpIHtcbiAgICAgICAgICAgIHJldHVybiBpOyAvLyBzcGVjaWFsbHkgdW5kZXJzdG9vZCB0byBtZWFuIFwidXNlIGFzIGFycmF5SW5kaWNlc1wiXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfTtcbiAgICB9LFxuICB9LFxufTtcblxuLy8gT3BlcmF0b3JzIHRoYXQgYXBwZWFyIGF0IHRoZSB0b3AgbGV2ZWwgb2YgYSBkb2N1bWVudCBzZWxlY3Rvci5cbmNvbnN0IExPR0lDQUxfT1BFUkFUT1JTID0ge1xuICAkYW5kKHN1YlNlbGVjdG9yLCBtYXRjaGVyLCBpbkVsZW1NYXRjaCkge1xuICAgIHJldHVybiBhbmREb2N1bWVudE1hdGNoZXJzKFxuICAgICAgY29tcGlsZUFycmF5T2ZEb2N1bWVudFNlbGVjdG9ycyhzdWJTZWxlY3RvciwgbWF0Y2hlciwgaW5FbGVtTWF0Y2gpXG4gICAgKTtcbiAgfSxcblxuICAkb3Ioc3ViU2VsZWN0b3IsIG1hdGNoZXIsIGluRWxlbU1hdGNoKSB7XG4gICAgY29uc3QgbWF0Y2hlcnMgPSBjb21waWxlQXJyYXlPZkRvY3VtZW50U2VsZWN0b3JzKFxuICAgICAgc3ViU2VsZWN0b3IsXG4gICAgICBtYXRjaGVyLFxuICAgICAgaW5FbGVtTWF0Y2hcbiAgICApO1xuXG4gICAgLy8gU3BlY2lhbCBjYXNlOiBpZiB0aGVyZSBpcyBvbmx5IG9uZSBtYXRjaGVyLCB1c2UgaXQgZGlyZWN0bHksICpwcmVzZXJ2aW5nKlxuICAgIC8vIGFueSBhcnJheUluZGljZXMgaXQgcmV0dXJucy5cbiAgICBpZiAobWF0Y2hlcnMubGVuZ3RoID09PSAxKSB7XG4gICAgICByZXR1cm4gbWF0Y2hlcnNbMF07XG4gICAgfVxuXG4gICAgcmV0dXJuIGRvYyA9PiB7XG4gICAgICBjb25zdCByZXN1bHQgPSBtYXRjaGVycy5zb21lKGZuID0+IGZuKGRvYykucmVzdWx0KTtcbiAgICAgIC8vICRvciBkb2VzIE5PVCBzZXQgYXJyYXlJbmRpY2VzIHdoZW4gaXQgaGFzIG11bHRpcGxlXG4gICAgICAvLyBzdWItZXhwcmVzc2lvbnMuIChUZXN0ZWQgYWdhaW5zdCBNb25nb0RCLilcbiAgICAgIHJldHVybiB7cmVzdWx0fTtcbiAgICB9O1xuICB9LFxuXG4gICRub3Ioc3ViU2VsZWN0b3IsIG1hdGNoZXIsIGluRWxlbU1hdGNoKSB7XG4gICAgY29uc3QgbWF0Y2hlcnMgPSBjb21waWxlQXJyYXlPZkRvY3VtZW50U2VsZWN0b3JzKFxuICAgICAgc3ViU2VsZWN0b3IsXG4gICAgICBtYXRjaGVyLFxuICAgICAgaW5FbGVtTWF0Y2hcbiAgICApO1xuICAgIHJldHVybiBkb2MgPT4ge1xuICAgICAgY29uc3QgcmVzdWx0ID0gbWF0Y2hlcnMuZXZlcnkoZm4gPT4gIWZuKGRvYykucmVzdWx0KTtcbiAgICAgIC8vIE5ldmVyIHNldCBhcnJheUluZGljZXMsIGJlY2F1c2Ugd2Ugb25seSBtYXRjaCBpZiBub3RoaW5nIGluIHBhcnRpY3VsYXJcbiAgICAgIC8vICdtYXRjaGVkJyAoYW5kIGJlY2F1c2UgdGhpcyBpcyBjb25zaXN0ZW50IHdpdGggTW9uZ29EQikuXG4gICAgICByZXR1cm4ge3Jlc3VsdH07XG4gICAgfTtcbiAgfSxcblxuICAkd2hlcmUoc2VsZWN0b3JWYWx1ZSwgbWF0Y2hlcikge1xuICAgIC8vIFJlY29yZCB0aGF0ICphbnkqIHBhdGggbWF5IGJlIHVzZWQuXG4gICAgbWF0Y2hlci5fcmVjb3JkUGF0aFVzZWQoJycpO1xuICAgIG1hdGNoZXIuX2hhc1doZXJlID0gdHJ1ZTtcblxuICAgIGlmICghKHNlbGVjdG9yVmFsdWUgaW5zdGFuY2VvZiBGdW5jdGlvbikpIHtcbiAgICAgIC8vIFhYWCBNb25nb0RCIHNlZW1zIHRvIGhhdmUgbW9yZSBjb21wbGV4IGxvZ2ljIHRvIGRlY2lkZSB3aGVyZSBvciBvciBub3RcbiAgICAgIC8vIHRvIGFkZCAncmV0dXJuJzsgbm90IHN1cmUgZXhhY3RseSB3aGF0IGl0IGlzLlxuICAgICAgc2VsZWN0b3JWYWx1ZSA9IEZ1bmN0aW9uKCdvYmonLCBgcmV0dXJuICR7c2VsZWN0b3JWYWx1ZX1gKTtcbiAgICB9XG5cbiAgICAvLyBXZSBtYWtlIHRoZSBkb2N1bWVudCBhdmFpbGFibGUgYXMgYm90aCBgdGhpc2AgYW5kIGBvYmpgLlxuICAgIC8vIC8vIFhYWCBub3Qgc3VyZSB3aGF0IHdlIHNob3VsZCBkbyBpZiB0aGlzIHRocm93c1xuICAgIHJldHVybiBkb2MgPT4gKHtyZXN1bHQ6IHNlbGVjdG9yVmFsdWUuY2FsbChkb2MsIGRvYyl9KTtcbiAgfSxcblxuICAvLyBUaGlzIGlzIGp1c3QgdXNlZCBhcyBhIGNvbW1lbnQgaW4gdGhlIHF1ZXJ5IChpbiBNb25nb0RCLCBpdCBhbHNvIGVuZHMgdXAgaW5cbiAgLy8gcXVlcnkgbG9ncyk7IGl0IGhhcyBubyBlZmZlY3Qgb24gdGhlIGFjdHVhbCBzZWxlY3Rpb24uXG4gICRjb21tZW50KCkge1xuICAgIHJldHVybiAoKSA9PiAoe3Jlc3VsdDogdHJ1ZX0pO1xuICB9LFxufTtcblxuLy8gT3BlcmF0b3JzIHRoYXQgKHVubGlrZSBMT0dJQ0FMX09QRVJBVE9SUykgcGVydGFpbiB0byBpbmRpdmlkdWFsIHBhdGhzIGluIGFcbi8vIGRvY3VtZW50LCBidXQgKHVubGlrZSBFTEVNRU5UX09QRVJBVE9SUykgZG8gbm90IGhhdmUgYSBzaW1wbGUgZGVmaW5pdGlvbiBhc1xuLy8gXCJtYXRjaCBlYWNoIGJyYW5jaGVkIHZhbHVlIGluZGVwZW5kZW50bHkgYW5kIGNvbWJpbmUgd2l0aFxuLy8gY29udmVydEVsZW1lbnRNYXRjaGVyVG9CcmFuY2hlZE1hdGNoZXJcIi5cbmNvbnN0IFZBTFVFX09QRVJBVE9SUyA9IHtcbiAgJGVxKG9wZXJhbmQpIHtcbiAgICByZXR1cm4gY29udmVydEVsZW1lbnRNYXRjaGVyVG9CcmFuY2hlZE1hdGNoZXIoXG4gICAgICBlcXVhbGl0eUVsZW1lbnRNYXRjaGVyKG9wZXJhbmQpXG4gICAgKTtcbiAgfSxcbiAgJG5vdChvcGVyYW5kLCB2YWx1ZVNlbGVjdG9yLCBtYXRjaGVyKSB7XG4gICAgcmV0dXJuIGludmVydEJyYW5jaGVkTWF0Y2hlcihjb21waWxlVmFsdWVTZWxlY3RvcihvcGVyYW5kLCBtYXRjaGVyKSk7XG4gIH0sXG4gICRuZShvcGVyYW5kKSB7XG4gICAgcmV0dXJuIGludmVydEJyYW5jaGVkTWF0Y2hlcihcbiAgICAgIGNvbnZlcnRFbGVtZW50TWF0Y2hlclRvQnJhbmNoZWRNYXRjaGVyKGVxdWFsaXR5RWxlbWVudE1hdGNoZXIob3BlcmFuZCkpXG4gICAgKTtcbiAgfSxcbiAgJG5pbihvcGVyYW5kKSB7XG4gICAgcmV0dXJuIGludmVydEJyYW5jaGVkTWF0Y2hlcihcbiAgICAgIGNvbnZlcnRFbGVtZW50TWF0Y2hlclRvQnJhbmNoZWRNYXRjaGVyKFxuICAgICAgICBFTEVNRU5UX09QRVJBVE9SUy4kaW4uY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kKVxuICAgICAgKVxuICAgICk7XG4gIH0sXG4gICRleGlzdHMob3BlcmFuZCkge1xuICAgIGNvbnN0IGV4aXN0cyA9IGNvbnZlcnRFbGVtZW50TWF0Y2hlclRvQnJhbmNoZWRNYXRjaGVyKFxuICAgICAgdmFsdWUgPT4gdmFsdWUgIT09IHVuZGVmaW5lZFxuICAgICk7XG4gICAgcmV0dXJuIG9wZXJhbmQgPyBleGlzdHMgOiBpbnZlcnRCcmFuY2hlZE1hdGNoZXIoZXhpc3RzKTtcbiAgfSxcbiAgLy8gJG9wdGlvbnMganVzdCBwcm92aWRlcyBvcHRpb25zIGZvciAkcmVnZXg7IGl0cyBsb2dpYyBpcyBpbnNpZGUgJHJlZ2V4XG4gICRvcHRpb25zKG9wZXJhbmQsIHZhbHVlU2VsZWN0b3IpIHtcbiAgICBpZiAoIWhhc093bi5jYWxsKHZhbHVlU2VsZWN0b3IsICckcmVnZXgnKSkge1xuICAgICAgdGhyb3cgRXJyb3IoJyRvcHRpb25zIG5lZWRzIGEgJHJlZ2V4Jyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGV2ZXJ5dGhpbmdNYXRjaGVyO1xuICB9LFxuICAvLyAkbWF4RGlzdGFuY2UgaXMgYmFzaWNhbGx5IGFuIGFyZ3VtZW50IHRvICRuZWFyXG4gICRtYXhEaXN0YW5jZShvcGVyYW5kLCB2YWx1ZVNlbGVjdG9yKSB7XG4gICAgaWYgKCF2YWx1ZVNlbGVjdG9yLiRuZWFyKSB7XG4gICAgICB0aHJvdyBFcnJvcignJG1heERpc3RhbmNlIG5lZWRzIGEgJG5lYXInKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZXZlcnl0aGluZ01hdGNoZXI7XG4gIH0sXG4gICRhbGwob3BlcmFuZCwgdmFsdWVTZWxlY3RvciwgbWF0Y2hlcikge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShvcGVyYW5kKSkge1xuICAgICAgdGhyb3cgRXJyb3IoJyRhbGwgcmVxdWlyZXMgYXJyYXknKTtcbiAgICB9XG5cbiAgICAvLyBOb3Qgc3VyZSB3aHksIGJ1dCB0aGlzIHNlZW1zIHRvIGJlIHdoYXQgTW9uZ29EQiBkb2VzLlxuICAgIGlmIChvcGVyYW5kLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG5vdGhpbmdNYXRjaGVyO1xuICAgIH1cblxuICAgIGNvbnN0IGJyYW5jaGVkTWF0Y2hlcnMgPSBvcGVyYW5kLm1hcChjcml0ZXJpb24gPT4ge1xuICAgICAgLy8gWFhYIGhhbmRsZSAkYWxsLyRlbGVtTWF0Y2ggY29tYmluYXRpb25cbiAgICAgIGlmIChpc09wZXJhdG9yT2JqZWN0KGNyaXRlcmlvbikpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ25vICQgZXhwcmVzc2lvbnMgaW4gJGFsbCcpO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGlzIGlzIGFsd2F5cyBhIHJlZ2V4cCBvciBlcXVhbGl0eSBzZWxlY3Rvci5cbiAgICAgIHJldHVybiBjb21waWxlVmFsdWVTZWxlY3Rvcihjcml0ZXJpb24sIG1hdGNoZXIpO1xuICAgIH0pO1xuXG4gICAgLy8gYW5kQnJhbmNoZWRNYXRjaGVycyBkb2VzIE5PVCByZXF1aXJlIGFsbCBzZWxlY3RvcnMgdG8gcmV0dXJuIHRydWUgb24gdGhlXG4gICAgLy8gU0FNRSBicmFuY2guXG4gICAgcmV0dXJuIGFuZEJyYW5jaGVkTWF0Y2hlcnMoYnJhbmNoZWRNYXRjaGVycyk7XG4gIH0sXG4gICRuZWFyKG9wZXJhbmQsIHZhbHVlU2VsZWN0b3IsIG1hdGNoZXIsIGlzUm9vdCkge1xuICAgIGlmICghaXNSb290KSB7XG4gICAgICB0aHJvdyBFcnJvcignJG5lYXIgY2FuXFwndCBiZSBpbnNpZGUgYW5vdGhlciAkIG9wZXJhdG9yJyk7XG4gICAgfVxuXG4gICAgbWF0Y2hlci5faGFzR2VvUXVlcnkgPSB0cnVlO1xuXG4gICAgLy8gVGhlcmUgYXJlIHR3byBraW5kcyBvZiBnZW9kYXRhIGluIE1vbmdvREI6IGxlZ2FjeSBjb29yZGluYXRlIHBhaXJzIGFuZFxuICAgIC8vIEdlb0pTT04uIFRoZXkgdXNlIGRpZmZlcmVudCBkaXN0YW5jZSBtZXRyaWNzLCB0b28uIEdlb0pTT04gcXVlcmllcyBhcmVcbiAgICAvLyBtYXJrZWQgd2l0aCBhICRnZW9tZXRyeSBwcm9wZXJ0eSwgdGhvdWdoIGxlZ2FjeSBjb29yZGluYXRlcyBjYW4gYmVcbiAgICAvLyBtYXRjaGVkIHVzaW5nICRnZW9tZXRyeS5cbiAgICBsZXQgbWF4RGlzdGFuY2UsIHBvaW50LCBkaXN0YW5jZTtcbiAgICBpZiAoTG9jYWxDb2xsZWN0aW9uLl9pc1BsYWluT2JqZWN0KG9wZXJhbmQpICYmIGhhc093bi5jYWxsKG9wZXJhbmQsICckZ2VvbWV0cnknKSkge1xuICAgICAgLy8gR2VvSlNPTiBcIjJkc3BoZXJlXCIgbW9kZS5cbiAgICAgIG1heERpc3RhbmNlID0gb3BlcmFuZC4kbWF4RGlzdGFuY2U7XG4gICAgICBwb2ludCA9IG9wZXJhbmQuJGdlb21ldHJ5O1xuICAgICAgZGlzdGFuY2UgPSB2YWx1ZSA9PiB7XG4gICAgICAgIC8vIFhYWDogZm9yIG5vdywgd2UgZG9uJ3QgY2FsY3VsYXRlIHRoZSBhY3R1YWwgZGlzdGFuY2UgYmV0d2Vlbiwgc2F5LFxuICAgICAgICAvLyBwb2x5Z29uIGFuZCBjaXJjbGUuIElmIHBlb3BsZSBjYXJlIGFib3V0IHRoaXMgdXNlLWNhc2UgaXQgd2lsbCBnZXRcbiAgICAgICAgLy8gYSBwcmlvcml0eS5cbiAgICAgICAgaWYgKCF2YWx1ZSkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF2YWx1ZS50eXBlKSB7XG4gICAgICAgICAgcmV0dXJuIEdlb0pTT04ucG9pbnREaXN0YW5jZShcbiAgICAgICAgICAgIHBvaW50LFxuICAgICAgICAgICAge3R5cGU6ICdQb2ludCcsIGNvb3JkaW5hdGVzOiBwb2ludFRvQXJyYXkodmFsdWUpfVxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWUudHlwZSA9PT0gJ1BvaW50Jykge1xuICAgICAgICAgIHJldHVybiBHZW9KU09OLnBvaW50RGlzdGFuY2UocG9pbnQsIHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBHZW9KU09OLmdlb21ldHJ5V2l0aGluUmFkaXVzKHZhbHVlLCBwb2ludCwgbWF4RGlzdGFuY2UpXG4gICAgICAgICAgPyAwXG4gICAgICAgICAgOiBtYXhEaXN0YW5jZSArIDE7XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBtYXhEaXN0YW5jZSA9IHZhbHVlU2VsZWN0b3IuJG1heERpc3RhbmNlO1xuXG4gICAgICBpZiAoIWlzSW5kZXhhYmxlKG9wZXJhbmQpKSB7XG4gICAgICAgIHRocm93IEVycm9yKCckbmVhciBhcmd1bWVudCBtdXN0IGJlIGNvb3JkaW5hdGUgcGFpciBvciBHZW9KU09OJyk7XG4gICAgICB9XG5cbiAgICAgIHBvaW50ID0gcG9pbnRUb0FycmF5KG9wZXJhbmQpO1xuXG4gICAgICBkaXN0YW5jZSA9IHZhbHVlID0+IHtcbiAgICAgICAgaWYgKCFpc0luZGV4YWJsZSh2YWx1ZSkpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkaXN0YW5jZUNvb3JkaW5hdGVQYWlycyhwb2ludCwgdmFsdWUpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gYnJhbmNoZWRWYWx1ZXMgPT4ge1xuICAgICAgLy8gVGhlcmUgbWlnaHQgYmUgbXVsdGlwbGUgcG9pbnRzIGluIHRoZSBkb2N1bWVudCB0aGF0IG1hdGNoIHRoZSBnaXZlblxuICAgICAgLy8gZmllbGQuIE9ubHkgb25lIG9mIHRoZW0gbmVlZHMgdG8gYmUgd2l0aGluICRtYXhEaXN0YW5jZSwgYnV0IHdlIG5lZWQgdG9cbiAgICAgIC8vIGV2YWx1YXRlIGFsbCBvZiB0aGVtIGFuZCB1c2UgdGhlIG5lYXJlc3Qgb25lIGZvciB0aGUgaW1wbGljaXQgc29ydFxuICAgICAgLy8gc3BlY2lmaWVyLiAoVGhhdCdzIHdoeSB3ZSBjYW4ndCBqdXN0IHVzZSBFTEVNRU5UX09QRVJBVE9SUyBoZXJlLilcbiAgICAgIC8vXG4gICAgICAvLyBOb3RlOiBUaGlzIGRpZmZlcnMgZnJvbSBNb25nb0RCJ3MgaW1wbGVtZW50YXRpb24sIHdoZXJlIGEgZG9jdW1lbnQgd2lsbFxuICAgICAgLy8gYWN0dWFsbHkgc2hvdyB1cCAqbXVsdGlwbGUgdGltZXMqIGluIHRoZSByZXN1bHQgc2V0LCB3aXRoIG9uZSBlbnRyeSBmb3JcbiAgICAgIC8vIGVhY2ggd2l0aGluLSRtYXhEaXN0YW5jZSBicmFuY2hpbmcgcG9pbnQuXG4gICAgICBjb25zdCByZXN1bHQgPSB7cmVzdWx0OiBmYWxzZX07XG4gICAgICBleHBhbmRBcnJheXNJbkJyYW5jaGVzKGJyYW5jaGVkVmFsdWVzKS5ldmVyeShicmFuY2ggPT4ge1xuICAgICAgICAvLyBpZiBvcGVyYXRpb24gaXMgYW4gdXBkYXRlLCBkb24ndCBza2lwIGJyYW5jaGVzLCBqdXN0IHJldHVybiB0aGUgZmlyc3RcbiAgICAgICAgLy8gb25lICgjMzU5OSlcbiAgICAgICAgbGV0IGN1ckRpc3RhbmNlO1xuICAgICAgICBpZiAoIW1hdGNoZXIuX2lzVXBkYXRlKSB7XG4gICAgICAgICAgaWYgKCEodHlwZW9mIGJyYW5jaC52YWx1ZSA9PT0gJ29iamVjdCcpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjdXJEaXN0YW5jZSA9IGRpc3RhbmNlKGJyYW5jaC52YWx1ZSk7XG5cbiAgICAgICAgICAvLyBTa2lwIGJyYW5jaGVzIHRoYXQgYXJlbid0IHJlYWwgcG9pbnRzIG9yIGFyZSB0b28gZmFyIGF3YXkuXG4gICAgICAgICAgaWYgKGN1ckRpc3RhbmNlID09PSBudWxsIHx8IGN1ckRpc3RhbmNlID4gbWF4RGlzdGFuY2UpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFNraXAgYW55dGhpbmcgdGhhdCdzIGEgdGllLlxuICAgICAgICAgIGlmIChyZXN1bHQuZGlzdGFuY2UgIT09IHVuZGVmaW5lZCAmJiByZXN1bHQuZGlzdGFuY2UgPD0gY3VyRGlzdGFuY2UpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJlc3VsdC5yZXN1bHQgPSB0cnVlO1xuICAgICAgICByZXN1bHQuZGlzdGFuY2UgPSBjdXJEaXN0YW5jZTtcblxuICAgICAgICBpZiAoYnJhbmNoLmFycmF5SW5kaWNlcykge1xuICAgICAgICAgIHJlc3VsdC5hcnJheUluZGljZXMgPSBicmFuY2guYXJyYXlJbmRpY2VzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRlbGV0ZSByZXN1bHQuYXJyYXlJbmRpY2VzO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuICFtYXRjaGVyLl9pc1VwZGF0ZTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH0sXG59O1xuXG4vLyBOQjogV2UgYXJlIGNoZWF0aW5nIGFuZCB1c2luZyB0aGlzIGZ1bmN0aW9uIHRvIGltcGxlbWVudCAnQU5EJyBmb3IgYm90aFxuLy8gJ2RvY3VtZW50IG1hdGNoZXJzJyBhbmQgJ2JyYW5jaGVkIG1hdGNoZXJzJy4gVGhleSBib3RoIHJldHVybiByZXN1bHQgb2JqZWN0c1xuLy8gYnV0IHRoZSBhcmd1bWVudCBpcyBkaWZmZXJlbnQ6IGZvciB0aGUgZm9ybWVyIGl0J3MgYSB3aG9sZSBkb2MsIHdoZXJlYXMgZm9yXG4vLyB0aGUgbGF0dGVyIGl0J3MgYW4gYXJyYXkgb2YgJ2JyYW5jaGVkIHZhbHVlcycuXG5mdW5jdGlvbiBhbmRTb21lTWF0Y2hlcnMoc3ViTWF0Y2hlcnMpIHtcbiAgaWYgKHN1Yk1hdGNoZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBldmVyeXRoaW5nTWF0Y2hlcjtcbiAgfVxuXG4gIGlmIChzdWJNYXRjaGVycy5sZW5ndGggPT09IDEpIHtcbiAgICByZXR1cm4gc3ViTWF0Y2hlcnNbMF07XG4gIH1cblxuICByZXR1cm4gZG9jT3JCcmFuY2hlcyA9PiB7XG4gICAgY29uc3QgbWF0Y2ggPSB7fTtcbiAgICBtYXRjaC5yZXN1bHQgPSBzdWJNYXRjaGVycy5ldmVyeShmbiA9PiB7XG4gICAgICBjb25zdCBzdWJSZXN1bHQgPSBmbihkb2NPckJyYW5jaGVzKTtcblxuICAgICAgLy8gQ29weSBhICdkaXN0YW5jZScgbnVtYmVyIG91dCBvZiB0aGUgZmlyc3Qgc3ViLW1hdGNoZXIgdGhhdCBoYXNcbiAgICAgIC8vIG9uZS4gWWVzLCB0aGlzIG1lYW5zIHRoYXQgaWYgdGhlcmUgYXJlIG11bHRpcGxlICRuZWFyIGZpZWxkcyBpbiBhXG4gICAgICAvLyBxdWVyeSwgc29tZXRoaW5nIGFyYml0cmFyeSBoYXBwZW5zOyB0aGlzIGFwcGVhcnMgdG8gYmUgY29uc2lzdGVudCB3aXRoXG4gICAgICAvLyBNb25nby5cbiAgICAgIGlmIChzdWJSZXN1bHQucmVzdWx0ICYmXG4gICAgICAgICAgc3ViUmVzdWx0LmRpc3RhbmNlICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICBtYXRjaC5kaXN0YW5jZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG1hdGNoLmRpc3RhbmNlID0gc3ViUmVzdWx0LmRpc3RhbmNlO1xuICAgICAgfVxuXG4gICAgICAvLyBTaW1pbGFybHksIHByb3BhZ2F0ZSBhcnJheUluZGljZXMgZnJvbSBzdWItbWF0Y2hlcnMuLi4gYnV0IHRvIG1hdGNoXG4gICAgICAvLyBNb25nb0RCIGJlaGF2aW9yLCB0aGlzIHRpbWUgdGhlICpsYXN0KiBzdWItbWF0Y2hlciB3aXRoIGFycmF5SW5kaWNlc1xuICAgICAgLy8gd2lucy5cbiAgICAgIGlmIChzdWJSZXN1bHQucmVzdWx0ICYmIHN1YlJlc3VsdC5hcnJheUluZGljZXMpIHtcbiAgICAgICAgbWF0Y2guYXJyYXlJbmRpY2VzID0gc3ViUmVzdWx0LmFycmF5SW5kaWNlcztcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHN1YlJlc3VsdC5yZXN1bHQ7XG4gICAgfSk7XG5cbiAgICAvLyBJZiB3ZSBkaWRuJ3QgYWN0dWFsbHkgbWF0Y2gsIGZvcmdldCBhbnkgZXh0cmEgbWV0YWRhdGEgd2UgY2FtZSB1cCB3aXRoLlxuICAgIGlmICghbWF0Y2gucmVzdWx0KSB7XG4gICAgICBkZWxldGUgbWF0Y2guZGlzdGFuY2U7XG4gICAgICBkZWxldGUgbWF0Y2guYXJyYXlJbmRpY2VzO1xuICAgIH1cblxuICAgIHJldHVybiBtYXRjaDtcbiAgfTtcbn1cblxuY29uc3QgYW5kRG9jdW1lbnRNYXRjaGVycyA9IGFuZFNvbWVNYXRjaGVycztcbmNvbnN0IGFuZEJyYW5jaGVkTWF0Y2hlcnMgPSBhbmRTb21lTWF0Y2hlcnM7XG5cbmZ1bmN0aW9uIGNvbXBpbGVBcnJheU9mRG9jdW1lbnRTZWxlY3RvcnMoc2VsZWN0b3JzLCBtYXRjaGVyLCBpbkVsZW1NYXRjaCkge1xuICBpZiAoIUFycmF5LmlzQXJyYXkoc2VsZWN0b3JzKSB8fCBzZWxlY3RvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgRXJyb3IoJyRhbmQvJG9yLyRub3IgbXVzdCBiZSBub25lbXB0eSBhcnJheScpO1xuICB9XG5cbiAgcmV0dXJuIHNlbGVjdG9ycy5tYXAoc3ViU2VsZWN0b3IgPT4ge1xuICAgIGlmICghTG9jYWxDb2xsZWN0aW9uLl9pc1BsYWluT2JqZWN0KHN1YlNlbGVjdG9yKSkge1xuICAgICAgdGhyb3cgRXJyb3IoJyRvci8kYW5kLyRub3IgZW50cmllcyBuZWVkIHRvIGJlIGZ1bGwgb2JqZWN0cycpO1xuICAgIH1cblxuICAgIHJldHVybiBjb21waWxlRG9jdW1lbnRTZWxlY3RvcihzdWJTZWxlY3RvciwgbWF0Y2hlciwge2luRWxlbU1hdGNofSk7XG4gIH0pO1xufVxuXG4vLyBUYWtlcyBpbiBhIHNlbGVjdG9yIHRoYXQgY291bGQgbWF0Y2ggYSBmdWxsIGRvY3VtZW50IChlZywgdGhlIG9yaWdpbmFsXG4vLyBzZWxlY3RvcikuIFJldHVybnMgYSBmdW5jdGlvbiBtYXBwaW5nIGRvY3VtZW50LT5yZXN1bHQgb2JqZWN0LlxuLy9cbi8vIG1hdGNoZXIgaXMgdGhlIE1hdGNoZXIgb2JqZWN0IHdlIGFyZSBjb21waWxpbmcuXG4vL1xuLy8gSWYgdGhpcyBpcyB0aGUgcm9vdCBkb2N1bWVudCBzZWxlY3RvciAoaWUsIG5vdCB3cmFwcGVkIGluICRhbmQgb3IgdGhlIGxpa2UpLFxuLy8gdGhlbiBpc1Jvb3QgaXMgdHJ1ZS4gKFRoaXMgaXMgdXNlZCBieSAkbmVhci4pXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURvY3VtZW50U2VsZWN0b3IoZG9jU2VsZWN0b3IsIG1hdGNoZXIsIG9wdGlvbnMgPSB7fSkge1xuICBjb25zdCBkb2NNYXRjaGVycyA9IE9iamVjdC5rZXlzKGRvY1NlbGVjdG9yKS5tYXAoa2V5ID0+IHtcbiAgICBjb25zdCBzdWJTZWxlY3RvciA9IGRvY1NlbGVjdG9yW2tleV07XG5cbiAgICBpZiAoa2V5LnN1YnN0cigwLCAxKSA9PT0gJyQnKSB7XG4gICAgICAvLyBPdXRlciBvcGVyYXRvcnMgYXJlIGVpdGhlciBsb2dpY2FsIG9wZXJhdG9ycyAodGhleSByZWN1cnNlIGJhY2sgaW50b1xuICAgICAgLy8gdGhpcyBmdW5jdGlvbiksIG9yICR3aGVyZS5cbiAgICAgIGlmICghaGFzT3duLmNhbGwoTE9HSUNBTF9PUEVSQVRPUlMsIGtleSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnJlY29nbml6ZWQgbG9naWNhbCBvcGVyYXRvcjogJHtrZXl9YCk7XG4gICAgICB9XG5cbiAgICAgIG1hdGNoZXIuX2lzU2ltcGxlID0gZmFsc2U7XG4gICAgICByZXR1cm4gTE9HSUNBTF9PUEVSQVRPUlNba2V5XShzdWJTZWxlY3RvciwgbWF0Y2hlciwgb3B0aW9ucy5pbkVsZW1NYXRjaCk7XG4gICAgfVxuXG4gICAgLy8gUmVjb3JkIHRoaXMgcGF0aCwgYnV0IG9ubHkgaWYgd2UgYXJlbid0IGluIGFuIGVsZW1NYXRjaGVyLCBzaW5jZSBpbiBhblxuICAgIC8vIGVsZW1NYXRjaCB0aGlzIGlzIGEgcGF0aCBpbnNpZGUgYW4gb2JqZWN0IGluIGFuIGFycmF5LCBub3QgaW4gdGhlIGRvY1xuICAgIC8vIHJvb3QuXG4gICAgaWYgKCFvcHRpb25zLmluRWxlbU1hdGNoKSB7XG4gICAgICBtYXRjaGVyLl9yZWNvcmRQYXRoVXNlZChrZXkpO1xuICAgIH1cblxuICAgIC8vIERvbid0IGFkZCBhIG1hdGNoZXIgaWYgc3ViU2VsZWN0b3IgaXMgYSBmdW5jdGlvbiAtLSB0aGlzIGlzIHRvIG1hdGNoXG4gICAgLy8gdGhlIGJlaGF2aW9yIG9mIE1ldGVvciBvbiB0aGUgc2VydmVyIChpbmhlcml0ZWQgZnJvbSB0aGUgbm9kZSBtb25nb2RiXG4gICAgLy8gZHJpdmVyKSwgd2hpY2ggaXMgdG8gaWdub3JlIGFueSBwYXJ0IG9mIGEgc2VsZWN0b3Igd2hpY2ggaXMgYSBmdW5jdGlvbi5cbiAgICBpZiAodHlwZW9mIHN1YlNlbGVjdG9yID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGNvbnN0IGxvb2tVcEJ5SW5kZXggPSBtYWtlTG9va3VwRnVuY3Rpb24oa2V5KTtcbiAgICBjb25zdCB2YWx1ZU1hdGNoZXIgPSBjb21waWxlVmFsdWVTZWxlY3RvcihcbiAgICAgIHN1YlNlbGVjdG9yLFxuICAgICAgbWF0Y2hlcixcbiAgICAgIG9wdGlvbnMuaXNSb290XG4gICAgKTtcblxuICAgIHJldHVybiBkb2MgPT4gdmFsdWVNYXRjaGVyKGxvb2tVcEJ5SW5kZXgoZG9jKSk7XG4gIH0pLmZpbHRlcihCb29sZWFuKTtcblxuICByZXR1cm4gYW5kRG9jdW1lbnRNYXRjaGVycyhkb2NNYXRjaGVycyk7XG59XG5cbi8vIFRha2VzIGluIGEgc2VsZWN0b3IgdGhhdCBjb3VsZCBtYXRjaCBhIGtleS1pbmRleGVkIHZhbHVlIGluIGEgZG9jdW1lbnQ7IGVnLFxuLy8geyRndDogNSwgJGx0OiA5fSwgb3IgYSByZWd1bGFyIGV4cHJlc3Npb24sIG9yIGFueSBub24tZXhwcmVzc2lvbiBvYmplY3QgKHRvXG4vLyBpbmRpY2F0ZSBlcXVhbGl0eSkuICBSZXR1cm5zIGEgYnJhbmNoZWQgbWF0Y2hlcjogYSBmdW5jdGlvbiBtYXBwaW5nXG4vLyBbYnJhbmNoZWQgdmFsdWVdLT5yZXN1bHQgb2JqZWN0LlxuZnVuY3Rpb24gY29tcGlsZVZhbHVlU2VsZWN0b3IodmFsdWVTZWxlY3RvciwgbWF0Y2hlciwgaXNSb290KSB7XG4gIGlmICh2YWx1ZVNlbGVjdG9yIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgbWF0Y2hlci5faXNTaW1wbGUgPSBmYWxzZTtcbiAgICByZXR1cm4gY29udmVydEVsZW1lbnRNYXRjaGVyVG9CcmFuY2hlZE1hdGNoZXIoXG4gICAgICByZWdleHBFbGVtZW50TWF0Y2hlcih2YWx1ZVNlbGVjdG9yKVxuICAgICk7XG4gIH1cblxuICBpZiAoaXNPcGVyYXRvck9iamVjdCh2YWx1ZVNlbGVjdG9yKSkge1xuICAgIHJldHVybiBvcGVyYXRvckJyYW5jaGVkTWF0Y2hlcih2YWx1ZVNlbGVjdG9yLCBtYXRjaGVyLCBpc1Jvb3QpO1xuICB9XG5cbiAgcmV0dXJuIGNvbnZlcnRFbGVtZW50TWF0Y2hlclRvQnJhbmNoZWRNYXRjaGVyKFxuICAgIGVxdWFsaXR5RWxlbWVudE1hdGNoZXIodmFsdWVTZWxlY3RvcilcbiAgKTtcbn1cblxuLy8gR2l2ZW4gYW4gZWxlbWVudCBtYXRjaGVyICh3aGljaCBldmFsdWF0ZXMgYSBzaW5nbGUgdmFsdWUpLCByZXR1cm5zIGEgYnJhbmNoZWRcbi8vIHZhbHVlICh3aGljaCBldmFsdWF0ZXMgdGhlIGVsZW1lbnQgbWF0Y2hlciBvbiBhbGwgdGhlIGJyYW5jaGVzIGFuZCByZXR1cm5zIGFcbi8vIG1vcmUgc3RydWN0dXJlZCByZXR1cm4gdmFsdWUgcG9zc2libHkgaW5jbHVkaW5nIGFycmF5SW5kaWNlcykuXG5mdW5jdGlvbiBjb252ZXJ0RWxlbWVudE1hdGNoZXJUb0JyYW5jaGVkTWF0Y2hlcihlbGVtZW50TWF0Y2hlciwgb3B0aW9ucyA9IHt9KSB7XG4gIHJldHVybiBicmFuY2hlcyA9PiB7XG4gICAgY29uc3QgZXhwYW5kZWQgPSBvcHRpb25zLmRvbnRFeHBhbmRMZWFmQXJyYXlzXG4gICAgICA/IGJyYW5jaGVzXG4gICAgICA6IGV4cGFuZEFycmF5c0luQnJhbmNoZXMoYnJhbmNoZXMsIG9wdGlvbnMuZG9udEluY2x1ZGVMZWFmQXJyYXlzKTtcblxuICAgIGNvbnN0IG1hdGNoID0ge307XG4gICAgbWF0Y2gucmVzdWx0ID0gZXhwYW5kZWQuc29tZShlbGVtZW50ID0+IHtcbiAgICAgIGxldCBtYXRjaGVkID0gZWxlbWVudE1hdGNoZXIoZWxlbWVudC52YWx1ZSk7XG5cbiAgICAgIC8vIFNwZWNpYWwgY2FzZSBmb3IgJGVsZW1NYXRjaDogaXQgbWVhbnMgXCJ0cnVlLCBhbmQgdXNlIHRoaXMgYXMgYW4gYXJyYXlcbiAgICAgIC8vIGluZGV4IGlmIEkgZGlkbid0IGFscmVhZHkgaGF2ZSBvbmVcIi5cbiAgICAgIGlmICh0eXBlb2YgbWF0Y2hlZCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgLy8gWFhYIFRoaXMgY29kZSBkYXRlcyBmcm9tIHdoZW4gd2Ugb25seSBzdG9yZWQgYSBzaW5nbGUgYXJyYXkgaW5kZXhcbiAgICAgICAgLy8gKGZvciB0aGUgb3V0ZXJtb3N0IGFycmF5KS4gU2hvdWxkIHdlIGJlIGFsc28gaW5jbHVkaW5nIGRlZXBlciBhcnJheVxuICAgICAgICAvLyBpbmRpY2VzIGZyb20gdGhlICRlbGVtTWF0Y2ggbWF0Y2g/XG4gICAgICAgIGlmICghZWxlbWVudC5hcnJheUluZGljZXMpIHtcbiAgICAgICAgICBlbGVtZW50LmFycmF5SW5kaWNlcyA9IFttYXRjaGVkXTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1hdGNoZWQgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiBzb21lIGVsZW1lbnQgbWF0Y2hlZCwgYW5kIGl0J3MgdGFnZ2VkIHdpdGggYXJyYXkgaW5kaWNlcywgaW5jbHVkZVxuICAgICAgLy8gdGhvc2UgaW5kaWNlcyBpbiBvdXIgcmVzdWx0IG9iamVjdC5cbiAgICAgIGlmIChtYXRjaGVkICYmIGVsZW1lbnQuYXJyYXlJbmRpY2VzKSB7XG4gICAgICAgIG1hdGNoLmFycmF5SW5kaWNlcyA9IGVsZW1lbnQuYXJyYXlJbmRpY2VzO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbWF0Y2hlZDtcbiAgICB9KTtcblxuICAgIHJldHVybiBtYXRjaDtcbiAgfTtcbn1cblxuLy8gSGVscGVycyBmb3IgJG5lYXIuXG5mdW5jdGlvbiBkaXN0YW5jZUNvb3JkaW5hdGVQYWlycyhhLCBiKSB7XG4gIGNvbnN0IHBvaW50QSA9IHBvaW50VG9BcnJheShhKTtcbiAgY29uc3QgcG9pbnRCID0gcG9pbnRUb0FycmF5KGIpO1xuXG4gIHJldHVybiBNYXRoLmh5cG90KHBvaW50QVswXSAtIHBvaW50QlswXSwgcG9pbnRBWzFdIC0gcG9pbnRCWzFdKTtcbn1cblxuLy8gVGFrZXMgc29tZXRoaW5nIHRoYXQgaXMgbm90IGFuIG9wZXJhdG9yIG9iamVjdCBhbmQgcmV0dXJucyBhbiBlbGVtZW50IG1hdGNoZXJcbi8vIGZvciBlcXVhbGl0eSB3aXRoIHRoYXQgdGhpbmcuXG5leHBvcnQgZnVuY3Rpb24gZXF1YWxpdHlFbGVtZW50TWF0Y2hlcihlbGVtZW50U2VsZWN0b3IpIHtcbiAgaWYgKGlzT3BlcmF0b3JPYmplY3QoZWxlbWVudFNlbGVjdG9yKSkge1xuICAgIHRocm93IEVycm9yKCdDYW5cXCd0IGNyZWF0ZSBlcXVhbGl0eVZhbHVlU2VsZWN0b3IgZm9yIG9wZXJhdG9yIG9iamVjdCcpO1xuICB9XG5cbiAgLy8gU3BlY2lhbC1jYXNlOiBudWxsIGFuZCB1bmRlZmluZWQgYXJlIGVxdWFsIChpZiB5b3UgZ290IHVuZGVmaW5lZCBpbiB0aGVyZVxuICAvLyBzb21ld2hlcmUsIG9yIGlmIHlvdSBnb3QgaXQgZHVlIHRvIHNvbWUgYnJhbmNoIGJlaW5nIG5vbi1leGlzdGVudCBpbiB0aGVcbiAgLy8gd2VpcmQgc3BlY2lhbCBjYXNlKSwgZXZlbiB0aG91Z2ggdGhleSBhcmVuJ3Qgd2l0aCBFSlNPTi5lcXVhbHMuXG4gIC8vIHVuZGVmaW5lZCBvciBudWxsXG4gIGlmIChlbGVtZW50U2VsZWN0b3IgPT0gbnVsbCkge1xuICAgIHJldHVybiB2YWx1ZSA9PiB2YWx1ZSA9PSBudWxsO1xuICB9XG5cbiAgcmV0dXJuIHZhbHVlID0+IExvY2FsQ29sbGVjdGlvbi5fZi5fZXF1YWwoZWxlbWVudFNlbGVjdG9yLCB2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGV2ZXJ5dGhpbmdNYXRjaGVyKGRvY09yQnJhbmNoZWRWYWx1ZXMpIHtcbiAgcmV0dXJuIHtyZXN1bHQ6IHRydWV9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXhwYW5kQXJyYXlzSW5CcmFuY2hlcyhicmFuY2hlcywgc2tpcFRoZUFycmF5cykge1xuICBjb25zdCBicmFuY2hlc091dCA9IFtdO1xuXG4gIGJyYW5jaGVzLmZvckVhY2goYnJhbmNoID0+IHtcbiAgICBjb25zdCB0aGlzSXNBcnJheSA9IEFycmF5LmlzQXJyYXkoYnJhbmNoLnZhbHVlKTtcblxuICAgIC8vIFdlIGluY2x1ZGUgdGhlIGJyYW5jaCBpdHNlbGYsICpVTkxFU1MqIHdlIGl0J3MgYW4gYXJyYXkgdGhhdCB3ZSdyZSBnb2luZ1xuICAgIC8vIHRvIGl0ZXJhdGUgYW5kIHdlJ3JlIHRvbGQgdG8gc2tpcCBhcnJheXMuICAoVGhhdCdzIHJpZ2h0LCB3ZSBpbmNsdWRlIHNvbWVcbiAgICAvLyBhcnJheXMgZXZlbiBza2lwVGhlQXJyYXlzIGlzIHRydWU6IHRoZXNlIGFyZSBhcnJheXMgdGhhdCB3ZXJlIGZvdW5kIHZpYVxuICAgIC8vIGV4cGxpY2l0IG51bWVyaWNhbCBpbmRpY2VzLilcbiAgICBpZiAoIShza2lwVGhlQXJyYXlzICYmIHRoaXNJc0FycmF5ICYmICFicmFuY2guZG9udEl0ZXJhdGUpKSB7XG4gICAgICBicmFuY2hlc091dC5wdXNoKHthcnJheUluZGljZXM6IGJyYW5jaC5hcnJheUluZGljZXMsIHZhbHVlOiBicmFuY2gudmFsdWV9KTtcbiAgICB9XG5cbiAgICBpZiAodGhpc0lzQXJyYXkgJiYgIWJyYW5jaC5kb250SXRlcmF0ZSkge1xuICAgICAgYnJhbmNoLnZhbHVlLmZvckVhY2goKHZhbHVlLCBpKSA9PiB7XG4gICAgICAgIGJyYW5jaGVzT3V0LnB1c2goe1xuICAgICAgICAgIGFycmF5SW5kaWNlczogKGJyYW5jaC5hcnJheUluZGljZXMgfHwgW10pLmNvbmNhdChpKSxcbiAgICAgICAgICB2YWx1ZVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGJyYW5jaGVzT3V0O1xufVxuXG4vLyBIZWxwZXJzIGZvciAkYml0c0FsbFNldC8kYml0c0FueVNldC8kYml0c0FsbENsZWFyLyRiaXRzQW55Q2xlYXIuXG5mdW5jdGlvbiBnZXRPcGVyYW5kQml0bWFzayhvcGVyYW5kLCBzZWxlY3Rvcikge1xuICAvLyBudW1lcmljIGJpdG1hc2tcbiAgLy8gWW91IGNhbiBwcm92aWRlIGEgbnVtZXJpYyBiaXRtYXNrIHRvIGJlIG1hdGNoZWQgYWdhaW5zdCB0aGUgb3BlcmFuZCBmaWVsZC5cbiAgLy8gSXQgbXVzdCBiZSByZXByZXNlbnRhYmxlIGFzIGEgbm9uLW5lZ2F0aXZlIDMyLWJpdCBzaWduZWQgaW50ZWdlci5cbiAgLy8gT3RoZXJ3aXNlLCAkYml0c0FsbFNldCB3aWxsIHJldHVybiBhbiBlcnJvci5cbiAgaWYgKE51bWJlci5pc0ludGVnZXIob3BlcmFuZCkgJiYgb3BlcmFuZCA+PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KG5ldyBJbnQzMkFycmF5KFtvcGVyYW5kXSkuYnVmZmVyKTtcbiAgfVxuXG4gIC8vIGJpbmRhdGEgYml0bWFza1xuICAvLyBZb3UgY2FuIGFsc28gdXNlIGFuIGFyYml0cmFyaWx5IGxhcmdlIEJpbkRhdGEgaW5zdGFuY2UgYXMgYSBiaXRtYXNrLlxuICBpZiAoRUpTT04uaXNCaW5hcnkob3BlcmFuZCkpIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkob3BlcmFuZC5idWZmZXIpO1xuICB9XG5cbiAgLy8gcG9zaXRpb24gbGlzdFxuICAvLyBJZiBxdWVyeWluZyBhIGxpc3Qgb2YgYml0IHBvc2l0aW9ucywgZWFjaCA8cG9zaXRpb24+IG11c3QgYmUgYSBub24tbmVnYXRpdmVcbiAgLy8gaW50ZWdlci4gQml0IHBvc2l0aW9ucyBzdGFydCBhdCAwIGZyb20gdGhlIGxlYXN0IHNpZ25pZmljYW50IGJpdC5cbiAgaWYgKEFycmF5LmlzQXJyYXkob3BlcmFuZCkgJiZcbiAgICAgIG9wZXJhbmQuZXZlcnkoeCA9PiBOdW1iZXIuaXNJbnRlZ2VyKHgpICYmIHggPj0gMCkpIHtcbiAgICBjb25zdCBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoKE1hdGgubWF4KC4uLm9wZXJhbmQpID4+IDMpICsgMSk7XG4gICAgY29uc3QgdmlldyA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlcik7XG5cbiAgICBvcGVyYW5kLmZvckVhY2goeCA9PiB7XG4gICAgICB2aWV3W3ggPj4gM10gfD0gMSA8PCAoeCAmIDB4Nyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdmlldztcbiAgfVxuXG4gIC8vIGJhZCBvcGVyYW5kXG4gIHRocm93IEVycm9yKFxuICAgIGBvcGVyYW5kIHRvICR7c2VsZWN0b3J9IG11c3QgYmUgYSBudW1lcmljIGJpdG1hc2sgKHJlcHJlc2VudGFibGUgYXMgYSBgICtcbiAgICAnbm9uLW5lZ2F0aXZlIDMyLWJpdCBzaWduZWQgaW50ZWdlciksIGEgYmluZGF0YSBiaXRtYXNrIG9yIGFuIGFycmF5IHdpdGggJyArXG4gICAgJ2JpdCBwb3NpdGlvbnMgKG5vbi1uZWdhdGl2ZSBpbnRlZ2VycyknXG4gICk7XG59XG5cbmZ1bmN0aW9uIGdldFZhbHVlQml0bWFzayh2YWx1ZSwgbGVuZ3RoKSB7XG4gIC8vIFRoZSBmaWVsZCB2YWx1ZSBtdXN0IGJlIGVpdGhlciBudW1lcmljYWwgb3IgYSBCaW5EYXRhIGluc3RhbmNlLiBPdGhlcndpc2UsXG4gIC8vICRiaXRzLi4uIHdpbGwgbm90IG1hdGNoIHRoZSBjdXJyZW50IGRvY3VtZW50LlxuXG4gIC8vIG51bWVyaWNhbFxuICBpZiAoTnVtYmVyLmlzU2FmZUludGVnZXIodmFsdWUpKSB7XG4gICAgLy8gJGJpdHMuLi4gd2lsbCBub3QgbWF0Y2ggbnVtZXJpY2FsIHZhbHVlcyB0aGF0IGNhbm5vdCBiZSByZXByZXNlbnRlZCBhcyBhXG4gICAgLy8gc2lnbmVkIDY0LWJpdCBpbnRlZ2VyLiBUaGlzIGNhbiBiZSB0aGUgY2FzZSBpZiBhIHZhbHVlIGlzIGVpdGhlciB0b29cbiAgICAvLyBsYXJnZSBvciBzbWFsbCB0byBmaXQgaW4gYSBzaWduZWQgNjQtYml0IGludGVnZXIsIG9yIGlmIGl0IGhhcyBhXG4gICAgLy8gZnJhY3Rpb25hbCBjb21wb25lbnQuXG4gICAgY29uc3QgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKFxuICAgICAgTWF0aC5tYXgobGVuZ3RoLCAyICogVWludDMyQXJyYXkuQllURVNfUEVSX0VMRU1FTlQpXG4gICAgKTtcblxuICAgIGxldCB2aWV3ID0gbmV3IFVpbnQzMkFycmF5KGJ1ZmZlciwgMCwgMik7XG4gICAgdmlld1swXSA9IHZhbHVlICUgKCgxIDw8IDE2KSAqICgxIDw8IDE2KSkgfCAwO1xuICAgIHZpZXdbMV0gPSB2YWx1ZSAvICgoMSA8PCAxNikgKiAoMSA8PCAxNikpIHwgMDtcblxuICAgIC8vIHNpZ24gZXh0ZW5zaW9uXG4gICAgaWYgKHZhbHVlIDwgMCkge1xuICAgICAgdmlldyA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlciwgMik7XG4gICAgICB2aWV3LmZvckVhY2goKGJ5dGUsIGkpID0+IHtcbiAgICAgICAgdmlld1tpXSA9IDB4ZmY7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcbiAgfVxuXG4gIC8vIGJpbmRhdGFcbiAgaWYgKEVKU09OLmlzQmluYXJ5KHZhbHVlKSkge1xuICAgIHJldHVybiBuZXcgVWludDhBcnJheSh2YWx1ZS5idWZmZXIpO1xuICB9XG5cbiAgLy8gbm8gbWF0Y2hcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vLyBBY3R1YWxseSBpbnNlcnRzIGEga2V5IHZhbHVlIGludG8gdGhlIHNlbGVjdG9yIGRvY3VtZW50XG4vLyBIb3dldmVyLCB0aGlzIGNoZWNrcyB0aGVyZSBpcyBubyBhbWJpZ3VpdHkgaW4gc2V0dGluZ1xuLy8gdGhlIHZhbHVlIGZvciB0aGUgZ2l2ZW4ga2V5LCB0aHJvd3Mgb3RoZXJ3aXNlXG5mdW5jdGlvbiBpbnNlcnRJbnRvRG9jdW1lbnQoZG9jdW1lbnQsIGtleSwgdmFsdWUpIHtcbiAgT2JqZWN0LmtleXMoZG9jdW1lbnQpLmZvckVhY2goZXhpc3RpbmdLZXkgPT4ge1xuICAgIGlmIChcbiAgICAgIChleGlzdGluZ0tleS5sZW5ndGggPiBrZXkubGVuZ3RoICYmIGV4aXN0aW5nS2V5LmluZGV4T2YoYCR7a2V5fS5gKSA9PT0gMCkgfHxcbiAgICAgIChrZXkubGVuZ3RoID4gZXhpc3RpbmdLZXkubGVuZ3RoICYmIGtleS5pbmRleE9mKGAke2V4aXN0aW5nS2V5fS5gKSA9PT0gMClcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYGNhbm5vdCBpbmZlciBxdWVyeSBmaWVsZHMgdG8gc2V0LCBib3RoIHBhdGhzICcke2V4aXN0aW5nS2V5fScgYW5kIGAgK1xuICAgICAgICBgJyR7a2V5fScgYXJlIG1hdGNoZWRgXG4gICAgICApO1xuICAgIH0gZWxzZSBpZiAoZXhpc3RpbmdLZXkgPT09IGtleSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgY2Fubm90IGluZmVyIHF1ZXJ5IGZpZWxkcyB0byBzZXQsIHBhdGggJyR7a2V5fScgaXMgbWF0Y2hlZCB0d2ljZWBcbiAgICAgICk7XG4gICAgfVxuICB9KTtcblxuICBkb2N1bWVudFtrZXldID0gdmFsdWU7XG59XG5cbi8vIFJldHVybnMgYSBicmFuY2hlZCBtYXRjaGVyIHRoYXQgbWF0Y2hlcyBpZmYgdGhlIGdpdmVuIG1hdGNoZXIgZG9lcyBub3QuXG4vLyBOb3RlIHRoYXQgdGhpcyBpbXBsaWNpdGx5IFwiZGVNb3JnYW5pemVzXCIgdGhlIHdyYXBwZWQgZnVuY3Rpb24uICBpZSwgaXRcbi8vIG1lYW5zIHRoYXQgQUxMIGJyYW5jaCB2YWx1ZXMgbmVlZCB0byBmYWlsIHRvIG1hdGNoIGlubmVyQnJhbmNoZWRNYXRjaGVyLlxuZnVuY3Rpb24gaW52ZXJ0QnJhbmNoZWRNYXRjaGVyKGJyYW5jaGVkTWF0Y2hlcikge1xuICByZXR1cm4gYnJhbmNoVmFsdWVzID0+IHtcbiAgICAvLyBXZSBleHBsaWNpdGx5IGNob29zZSB0byBzdHJpcCBhcnJheUluZGljZXMgaGVyZTogaXQgZG9lc24ndCBtYWtlIHNlbnNlIHRvXG4gICAgLy8gc2F5IFwidXBkYXRlIHRoZSBhcnJheSBlbGVtZW50IHRoYXQgZG9lcyBub3QgbWF0Y2ggc29tZXRoaW5nXCIsIGF0IGxlYXN0XG4gICAgLy8gaW4gbW9uZ28tbGFuZC5cbiAgICByZXR1cm4ge3Jlc3VsdDogIWJyYW5jaGVkTWF0Y2hlcihicmFuY2hWYWx1ZXMpLnJlc3VsdH07XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0luZGV4YWJsZShvYmopIHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkob2JqKSB8fCBMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3Qob2JqKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzTnVtZXJpY0tleShzKSB7XG4gIHJldHVybiAvXlswLTldKyQvLnRlc3Qocyk7XG59XG5cbi8vIFJldHVybnMgdHJ1ZSBpZiB0aGlzIGlzIGFuIG9iamVjdCB3aXRoIGF0IGxlYXN0IG9uZSBrZXkgYW5kIGFsbCBrZXlzIGJlZ2luXG4vLyB3aXRoICQuICBVbmxlc3MgaW5jb25zaXN0ZW50T0sgaXMgc2V0LCB0aHJvd3MgaWYgc29tZSBrZXlzIGJlZ2luIHdpdGggJCBhbmRcbi8vIG90aGVycyBkb24ndC5cbmV4cG9ydCBmdW5jdGlvbiBpc09wZXJhdG9yT2JqZWN0KHZhbHVlU2VsZWN0b3IsIGluY29uc2lzdGVudE9LKSB7XG4gIGlmICghTG9jYWxDb2xsZWN0aW9uLl9pc1BsYWluT2JqZWN0KHZhbHVlU2VsZWN0b3IpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgbGV0IHRoZXNlQXJlT3BlcmF0b3JzID0gdW5kZWZpbmVkO1xuICBPYmplY3Qua2V5cyh2YWx1ZVNlbGVjdG9yKS5mb3JFYWNoKHNlbEtleSA9PiB7XG4gICAgY29uc3QgdGhpc0lzT3BlcmF0b3IgPSBzZWxLZXkuc3Vic3RyKDAsIDEpID09PSAnJCcgfHwgc2VsS2V5ID09PSAnZGlmZic7XG5cbiAgICBpZiAodGhlc2VBcmVPcGVyYXRvcnMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhlc2VBcmVPcGVyYXRvcnMgPSB0aGlzSXNPcGVyYXRvcjtcbiAgICB9IGVsc2UgaWYgKHRoZXNlQXJlT3BlcmF0b3JzICE9PSB0aGlzSXNPcGVyYXRvcikge1xuICAgICAgaWYgKCFpbmNvbnNpc3RlbnRPSykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYEluY29uc2lzdGVudCBvcGVyYXRvcjogJHtKU09OLnN0cmluZ2lmeSh2YWx1ZVNlbGVjdG9yKX1gXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHRoZXNlQXJlT3BlcmF0b3JzID0gZmFsc2U7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gISF0aGVzZUFyZU9wZXJhdG9yczsgLy8ge30gaGFzIG5vIG9wZXJhdG9yc1xufVxuXG4vLyBIZWxwZXIgZm9yICRsdC8kZ3QvJGx0ZS8kZ3RlLlxuZnVuY3Rpb24gbWFrZUluZXF1YWxpdHkoY21wVmFsdWVDb21wYXJhdG9yKSB7XG4gIHJldHVybiB7XG4gICAgY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kKSB7XG4gICAgICAvLyBBcnJheXMgbmV2ZXIgY29tcGFyZSBmYWxzZSB3aXRoIG5vbi1hcnJheXMgZm9yIGFueSBpbmVxdWFsaXR5LlxuICAgICAgLy8gWFhYIFRoaXMgd2FzIGJlaGF2aW9yIHdlIG9ic2VydmVkIGluIHByZS1yZWxlYXNlIE1vbmdvREIgMi41LCBidXRcbiAgICAgIC8vICAgICBpdCBzZWVtcyB0byBoYXZlIGJlZW4gcmV2ZXJ0ZWQuXG4gICAgICAvLyAgICAgU2VlIGh0dHBzOi8vamlyYS5tb25nb2RiLm9yZy9icm93c2UvU0VSVkVSLTExNDQ0XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShvcGVyYW5kKSkge1xuICAgICAgICByZXR1cm4gKCkgPT4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIC8vIFNwZWNpYWwgY2FzZTogY29uc2lkZXIgdW5kZWZpbmVkIGFuZCBudWxsIHRoZSBzYW1lIChzbyB0cnVlIHdpdGhcbiAgICAgIC8vICRndGUvJGx0ZSkuXG4gICAgICBpZiAob3BlcmFuZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG9wZXJhbmQgPSBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBvcGVyYW5kVHlwZSA9IExvY2FsQ29sbGVjdGlvbi5fZi5fdHlwZShvcGVyYW5kKTtcblxuICAgICAgcmV0dXJuIHZhbHVlID0+IHtcbiAgICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB2YWx1ZSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb21wYXJpc29ucyBhcmUgbmV2ZXIgdHJ1ZSBhbW9uZyB0aGluZ3Mgb2YgZGlmZmVyZW50IHR5cGUgKGV4Y2VwdFxuICAgICAgICAvLyBudWxsIHZzIHVuZGVmaW5lZCkuXG4gICAgICAgIGlmIChMb2NhbENvbGxlY3Rpb24uX2YuX3R5cGUodmFsdWUpICE9PSBvcGVyYW5kVHlwZSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjbXBWYWx1ZUNvbXBhcmF0b3IoTG9jYWxDb2xsZWN0aW9uLl9mLl9jbXAodmFsdWUsIG9wZXJhbmQpKTtcbiAgICAgIH07XG4gICAgfSxcbiAgfTtcbn1cblxuLy8gbWFrZUxvb2t1cEZ1bmN0aW9uKGtleSkgcmV0dXJucyBhIGxvb2t1cCBmdW5jdGlvbi5cbi8vXG4vLyBBIGxvb2t1cCBmdW5jdGlvbiB0YWtlcyBpbiBhIGRvY3VtZW50IGFuZCByZXR1cm5zIGFuIGFycmF5IG9mIG1hdGNoaW5nXG4vLyBicmFuY2hlcy4gIElmIG5vIGFycmF5cyBhcmUgZm91bmQgd2hpbGUgbG9va2luZyB1cCB0aGUga2V5LCB0aGlzIGFycmF5IHdpbGxcbi8vIGhhdmUgZXhhY3RseSBvbmUgYnJhbmNoZXMgKHBvc3NpYmx5ICd1bmRlZmluZWQnLCBpZiBzb21lIHNlZ21lbnQgb2YgdGhlIGtleVxuLy8gd2FzIG5vdCBmb3VuZCkuXG4vL1xuLy8gSWYgYXJyYXlzIGFyZSBmb3VuZCBpbiB0aGUgbWlkZGxlLCB0aGlzIGNhbiBoYXZlIG1vcmUgdGhhbiBvbmUgZWxlbWVudCwgc2luY2Vcbi8vIHdlICdicmFuY2gnLiBXaGVuIHdlICdicmFuY2gnLCBpZiB0aGVyZSBhcmUgbW9yZSBrZXkgc2VnbWVudHMgdG8gbG9vayB1cCxcbi8vIHRoZW4gd2Ugb25seSBwdXJzdWUgYnJhbmNoZXMgdGhhdCBhcmUgcGxhaW4gb2JqZWN0cyAobm90IGFycmF5cyBvciBzY2FsYXJzKS5cbi8vIFRoaXMgbWVhbnMgd2UgY2FuIGFjdHVhbGx5IGVuZCB1cCB3aXRoIG5vIGJyYW5jaGVzIVxuLy9cbi8vIFdlIGRvICpOT1QqIGJyYW5jaCBvbiBhcnJheXMgdGhhdCBhcmUgZm91bmQgYXQgdGhlIGVuZCAoaWUsIGF0IHRoZSBsYXN0XG4vLyBkb3R0ZWQgbWVtYmVyIG9mIHRoZSBrZXkpLiBXZSBqdXN0IHJldHVybiB0aGF0IGFycmF5OyBpZiB5b3Ugd2FudCB0b1xuLy8gZWZmZWN0aXZlbHkgJ2JyYW5jaCcgb3ZlciB0aGUgYXJyYXkncyB2YWx1ZXMsIHBvc3QtcHJvY2VzcyB0aGUgbG9va3VwXG4vLyBmdW5jdGlvbiB3aXRoIGV4cGFuZEFycmF5c0luQnJhbmNoZXMuXG4vL1xuLy8gRWFjaCBicmFuY2ggaXMgYW4gb2JqZWN0IHdpdGgga2V5czpcbi8vICAtIHZhbHVlOiB0aGUgdmFsdWUgYXQgdGhlIGJyYW5jaFxuLy8gIC0gZG9udEl0ZXJhdGU6IGFuIG9wdGlvbmFsIGJvb2w7IGlmIHRydWUsIGl0IG1lYW5zIHRoYXQgJ3ZhbHVlJyBpcyBhbiBhcnJheVxuLy8gICAgdGhhdCBleHBhbmRBcnJheXNJbkJyYW5jaGVzIHNob3VsZCBOT1QgZXhwYW5kLiBUaGlzIHNwZWNpZmljYWxseSBoYXBwZW5zXG4vLyAgICB3aGVuIHRoZXJlIGlzIGEgbnVtZXJpYyBpbmRleCBpbiB0aGUga2V5LCBhbmQgZW5zdXJlcyB0aGVcbi8vICAgIHBlcmhhcHMtc3VycHJpc2luZyBNb25nb0RCIGJlaGF2aW9yIHdoZXJlIHsnYS4wJzogNX0gZG9lcyBOT1Rcbi8vICAgIG1hdGNoIHthOiBbWzVdXX0uXG4vLyAgLSBhcnJheUluZGljZXM6IGlmIGFueSBhcnJheSBpbmRleGluZyB3YXMgZG9uZSBkdXJpbmcgbG9va3VwIChlaXRoZXIgZHVlIHRvXG4vLyAgICBleHBsaWNpdCBudW1lcmljIGluZGljZXMgb3IgaW1wbGljaXQgYnJhbmNoaW5nKSwgdGhpcyB3aWxsIGJlIGFuIGFycmF5IG9mXG4vLyAgICB0aGUgYXJyYXkgaW5kaWNlcyB1c2VkLCBmcm9tIG91dGVybW9zdCB0byBpbm5lcm1vc3Q7IGl0IGlzIGZhbHNleSBvclxuLy8gICAgYWJzZW50IGlmIG5vIGFycmF5IGluZGV4IGlzIHVzZWQuIElmIGFuIGV4cGxpY2l0IG51bWVyaWMgaW5kZXggaXMgdXNlZCxcbi8vICAgIHRoZSBpbmRleCB3aWxsIGJlIGZvbGxvd2VkIGluIGFycmF5SW5kaWNlcyBieSB0aGUgc3RyaW5nICd4Jy5cbi8vXG4vLyAgICBOb3RlOiBhcnJheUluZGljZXMgaXMgdXNlZCBmb3IgdHdvIHB1cnBvc2VzLiBGaXJzdCwgaXQgaXMgdXNlZCB0b1xuLy8gICAgaW1wbGVtZW50IHRoZSAnJCcgbW9kaWZpZXIgZmVhdHVyZSwgd2hpY2ggb25seSBldmVyIGxvb2tzIGF0IGl0cyBmaXJzdFxuLy8gICAgZWxlbWVudC5cbi8vXG4vLyAgICBTZWNvbmQsIGl0IGlzIHVzZWQgZm9yIHNvcnQga2V5IGdlbmVyYXRpb24sIHdoaWNoIG5lZWRzIHRvIGJlIGFibGUgdG8gdGVsbFxuLy8gICAgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiBkaWZmZXJlbnQgcGF0aHMuIE1vcmVvdmVyLCBpdCBuZWVkcyB0b1xuLy8gICAgZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIGV4cGxpY2l0IGFuZCBpbXBsaWNpdCBicmFuY2hpbmcsIHdoaWNoIGlzIHdoeVxuLy8gICAgdGhlcmUncyB0aGUgc29tZXdoYXQgaGFja3kgJ3gnIGVudHJ5OiB0aGlzIG1lYW5zIHRoYXQgZXhwbGljaXQgYW5kXG4vLyAgICBpbXBsaWNpdCBhcnJheSBsb29rdXBzIHdpbGwgaGF2ZSBkaWZmZXJlbnQgZnVsbCBhcnJheUluZGljZXMgcGF0aHMuIChUaGF0XG4vLyAgICBjb2RlIG9ubHkgcmVxdWlyZXMgdGhhdCBkaWZmZXJlbnQgcGF0aHMgaGF2ZSBkaWZmZXJlbnQgYXJyYXlJbmRpY2VzOyBpdFxuLy8gICAgZG9lc24ndCBhY3R1YWxseSAncGFyc2UnIGFycmF5SW5kaWNlcy4gQXMgYW4gYWx0ZXJuYXRpdmUsIGFycmF5SW5kaWNlc1xuLy8gICAgY291bGQgY29udGFpbiBvYmplY3RzIHdpdGggZmxhZ3MgbGlrZSAnaW1wbGljaXQnLCBidXQgSSB0aGluayB0aGF0IG9ubHlcbi8vICAgIG1ha2VzIHRoZSBjb2RlIHN1cnJvdW5kaW5nIHRoZW0gbW9yZSBjb21wbGV4Lilcbi8vXG4vLyAgICAoQnkgdGhlIHdheSwgdGhpcyBmaWVsZCBlbmRzIHVwIGdldHRpbmcgcGFzc2VkIGFyb3VuZCBhIGxvdCB3aXRob3V0XG4vLyAgICBjbG9uaW5nLCBzbyBuZXZlciBtdXRhdGUgYW55IGFycmF5SW5kaWNlcyBmaWVsZC92YXIgaW4gdGhpcyBwYWNrYWdlISlcbi8vXG4vL1xuLy8gQXQgdGhlIHRvcCBsZXZlbCwgeW91IG1heSBvbmx5IHBhc3MgaW4gYSBwbGFpbiBvYmplY3Qgb3IgYXJyYXkuXG4vL1xuLy8gU2VlIHRoZSB0ZXN0ICdtaW5pbW9uZ28gLSBsb29rdXAnIGZvciBzb21lIGV4YW1wbGVzIG9mIHdoYXQgbG9va3VwIGZ1bmN0aW9uc1xuLy8gcmV0dXJuLlxuZXhwb3J0IGZ1bmN0aW9uIG1ha2VMb29rdXBGdW5jdGlvbihrZXksIG9wdGlvbnMgPSB7fSkge1xuICBjb25zdCBwYXJ0cyA9IGtleS5zcGxpdCgnLicpO1xuICBjb25zdCBmaXJzdFBhcnQgPSBwYXJ0cy5sZW5ndGggPyBwYXJ0c1swXSA6ICcnO1xuICBjb25zdCBsb29rdXBSZXN0ID0gKFxuICAgIHBhcnRzLmxlbmd0aCA+IDEgJiZcbiAgICBtYWtlTG9va3VwRnVuY3Rpb24ocGFydHMuc2xpY2UoMSkuam9pbignLicpLCBvcHRpb25zKVxuICApO1xuXG4gIGZ1bmN0aW9uIGJ1aWxkUmVzdWx0KGFycmF5SW5kaWNlcywgZG9udEl0ZXJhdGUsIHZhbHVlKSB7XG4gICAgcmV0dXJuIGFycmF5SW5kaWNlcyAmJiBhcnJheUluZGljZXMubGVuZ3RoXG4gICAgICA/IGRvbnRJdGVyYXRlXG4gICAgICAgID8gW3sgYXJyYXlJbmRpY2VzLCBkb250SXRlcmF0ZSwgdmFsdWUgfV1cbiAgICAgICAgOiBbeyBhcnJheUluZGljZXMsIHZhbHVlIH1dXG4gICAgICA6IGRvbnRJdGVyYXRlXG4gICAgICAgID8gW3sgZG9udEl0ZXJhdGUsIHZhbHVlIH1dXG4gICAgICAgIDogW3sgdmFsdWUgfV07XG4gIH1cblxuICAvLyBEb2Mgd2lsbCBhbHdheXMgYmUgYSBwbGFpbiBvYmplY3Qgb3IgYW4gYXJyYXkuXG4gIC8vIGFwcGx5IGFuIGV4cGxpY2l0IG51bWVyaWMgaW5kZXgsIGFuIGFycmF5LlxuICByZXR1cm4gKGRvYywgYXJyYXlJbmRpY2VzKSA9PiB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoZG9jKSkge1xuICAgICAgLy8gSWYgd2UncmUgYmVpbmcgYXNrZWQgdG8gZG8gYW4gaW52YWxpZCBsb29rdXAgaW50byBhbiBhcnJheSAobm9uLWludGVnZXJcbiAgICAgIC8vIG9yIG91dC1vZi1ib3VuZHMpLCByZXR1cm4gbm8gcmVzdWx0cyAod2hpY2ggaXMgZGlmZmVyZW50IGZyb20gcmV0dXJuaW5nXG4gICAgICAvLyBhIHNpbmdsZSB1bmRlZmluZWQgcmVzdWx0LCBpbiB0aGF0IGBudWxsYCBlcXVhbGl0eSBjaGVja3Mgd29uJ3QgbWF0Y2gpLlxuICAgICAgaWYgKCEoaXNOdW1lcmljS2V5KGZpcnN0UGFydCkgJiYgZmlyc3RQYXJ0IDwgZG9jLmxlbmd0aCkpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgfVxuXG4gICAgICAvLyBSZW1lbWJlciB0aGF0IHdlIHVzZWQgdGhpcyBhcnJheSBpbmRleC4gSW5jbHVkZSBhbiAneCcgdG8gaW5kaWNhdGUgdGhhdFxuICAgICAgLy8gdGhlIHByZXZpb3VzIGluZGV4IGNhbWUgZnJvbSBiZWluZyBjb25zaWRlcmVkIGFzIGFuIGV4cGxpY2l0IGFycmF5XG4gICAgICAvLyBpbmRleCAobm90IGJyYW5jaGluZykuXG4gICAgICBhcnJheUluZGljZXMgPSBhcnJheUluZGljZXMgPyBhcnJheUluZGljZXMuY29uY2F0KCtmaXJzdFBhcnQsICd4JykgOiBbK2ZpcnN0UGFydCwgJ3gnXTtcbiAgICB9XG5cbiAgICAvLyBEbyBvdXIgZmlyc3QgbG9va3VwLlxuICAgIGNvbnN0IGZpcnN0TGV2ZWwgPSBkb2NbZmlyc3RQYXJ0XTtcblxuICAgIC8vIElmIHRoZXJlIGlzIG5vIGRlZXBlciB0byBkaWcsIHJldHVybiB3aGF0IHdlIGZvdW5kLlxuICAgIC8vXG4gICAgLy8gSWYgd2hhdCB3ZSBmb3VuZCBpcyBhbiBhcnJheSwgbW9zdCB2YWx1ZSBzZWxlY3RvcnMgd2lsbCBjaG9vc2UgdG8gdHJlYXRcbiAgICAvLyB0aGUgZWxlbWVudHMgb2YgdGhlIGFycmF5IGFzIG1hdGNoYWJsZSB2YWx1ZXMgaW4gdGhlaXIgb3duIHJpZ2h0LCBidXRcbiAgICAvLyB0aGF0J3MgZG9uZSBvdXRzaWRlIG9mIHRoZSBsb29rdXAgZnVuY3Rpb24uIChFeGNlcHRpb25zIHRvIHRoaXMgYXJlICRzaXplXG4gICAgLy8gYW5kIHN0dWZmIHJlbGF0aW5nIHRvICRlbGVtTWF0Y2guICBlZywge2E6IHskc2l6ZTogMn19IGRvZXMgbm90IG1hdGNoIHthOlxuICAgIC8vIFtbMSwgMl1dfS4pXG4gICAgLy9cbiAgICAvLyBUaGF0IHNhaWQsIGlmIHdlIGp1c3QgZGlkIGFuICpleHBsaWNpdCogYXJyYXkgbG9va3VwIChvbiBkb2MpIHRvIGZpbmRcbiAgICAvLyBmaXJzdExldmVsLCBhbmQgZmlyc3RMZXZlbCBpcyBhbiBhcnJheSB0b28sIHdlIGRvIE5PVCB3YW50IHZhbHVlXG4gICAgLy8gc2VsZWN0b3JzIHRvIGl0ZXJhdGUgb3ZlciBpdC4gIGVnLCB7J2EuMCc6IDV9IGRvZXMgbm90IG1hdGNoIHthOiBbWzVdXX0uXG4gICAgLy8gU28gaW4gdGhhdCBjYXNlLCB3ZSBtYXJrIHRoZSByZXR1cm4gdmFsdWUgYXMgJ2Rvbid0IGl0ZXJhdGUnLlxuICAgIGlmICghbG9va3VwUmVzdCkge1xuICAgICAgcmV0dXJuIGJ1aWxkUmVzdWx0KFxuICAgICAgICBhcnJheUluZGljZXMsXG4gICAgICAgIEFycmF5LmlzQXJyYXkoZG9jKSAmJiBBcnJheS5pc0FycmF5KGZpcnN0TGV2ZWwpLFxuICAgICAgICBmaXJzdExldmVsLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBXZSBuZWVkIHRvIGRpZyBkZWVwZXIuICBCdXQgaWYgd2UgY2FuJ3QsIGJlY2F1c2Ugd2hhdCB3ZSd2ZSBmb3VuZCBpcyBub3RcbiAgICAvLyBhbiBhcnJheSBvciBwbGFpbiBvYmplY3QsIHdlJ3JlIGRvbmUuIElmIHdlIGp1c3QgZGlkIGEgbnVtZXJpYyBpbmRleCBpbnRvXG4gICAgLy8gYW4gYXJyYXksIHdlIHJldHVybiBub3RoaW5nIGhlcmUgKHRoaXMgaXMgYSBjaGFuZ2UgaW4gTW9uZ28gMi41IGZyb21cbiAgICAvLyBNb25nbyAyLjQsIHdoZXJlIHsnYS4wLmInOiBudWxsfSBzdG9wcGVkIG1hdGNoaW5nIHthOiBbNV19KS4gT3RoZXJ3aXNlLFxuICAgIC8vIHJldHVybiBhIHNpbmdsZSBgdW5kZWZpbmVkYCAod2hpY2ggY2FuLCBmb3IgZXhhbXBsZSwgbWF0Y2ggdmlhIGVxdWFsaXR5XG4gICAgLy8gd2l0aCBgbnVsbGApLlxuICAgIGlmICghaXNJbmRleGFibGUoZmlyc3RMZXZlbCkpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGRvYykpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gYnVpbGRSZXN1bHQoYXJyYXlJbmRpY2VzLCBmYWxzZSwgdW5kZWZpbmVkKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICBjb25zdCBhcHBlbmRUb1Jlc3VsdCA9IG1vcmUgPT4ge1xuICAgICAgcmVzdWx0LnB1c2goLi4ubW9yZSk7XG4gICAgfTtcblxuICAgIC8vIERpZyBkZWVwZXI6IGxvb2sgdXAgdGhlIHJlc3Qgb2YgdGhlIHBhcnRzIG9uIHdoYXRldmVyIHdlJ3ZlIGZvdW5kLlxuICAgIC8vIChsb29rdXBSZXN0IGlzIHNtYXJ0IGVub3VnaCB0byBub3QgdHJ5IHRvIGRvIGludmFsaWQgbG9va3VwcyBpbnRvXG4gICAgLy8gZmlyc3RMZXZlbCBpZiBpdCdzIGFuIGFycmF5LilcbiAgICBhcHBlbmRUb1Jlc3VsdChsb29rdXBSZXN0KGZpcnN0TGV2ZWwsIGFycmF5SW5kaWNlcykpO1xuXG4gICAgLy8gSWYgd2UgZm91bmQgYW4gYXJyYXksIHRoZW4gaW4gKmFkZGl0aW9uKiB0byBwb3RlbnRpYWxseSB0cmVhdGluZyB0aGUgbmV4dFxuICAgIC8vIHBhcnQgYXMgYSBsaXRlcmFsIGludGVnZXIgbG9va3VwLCB3ZSBzaG91bGQgYWxzbyAnYnJhbmNoJzogdHJ5IHRvIGxvb2sgdXBcbiAgICAvLyB0aGUgcmVzdCBvZiB0aGUgcGFydHMgb24gZWFjaCBhcnJheSBlbGVtZW50IGluIHBhcmFsbGVsLlxuICAgIC8vXG4gICAgLy8gSW4gdGhpcyBjYXNlLCB3ZSAqb25seSogZGlnIGRlZXBlciBpbnRvIGFycmF5IGVsZW1lbnRzIHRoYXQgYXJlIHBsYWluXG4gICAgLy8gb2JqZWN0cy4gKFJlY2FsbCB0aGF0IHdlIG9ubHkgZ290IHRoaXMgZmFyIGlmIHdlIGhhdmUgZnVydGhlciB0byBkaWcuKVxuICAgIC8vIFRoaXMgbWFrZXMgc2Vuc2U6IHdlIGNlcnRhaW5seSBkb24ndCBkaWcgZGVlcGVyIGludG8gbm9uLWluZGV4YWJsZVxuICAgIC8vIG9iamVjdHMuIEFuZCBpdCB3b3VsZCBiZSB3ZWlyZCB0byBkaWcgaW50byBhbiBhcnJheTogaXQncyBzaW1wbGVyIHRvIGhhdmVcbiAgICAvLyBhIHJ1bGUgdGhhdCBleHBsaWNpdCBpbnRlZ2VyIGluZGV4ZXMgb25seSBhcHBseSB0byBhbiBvdXRlciBhcnJheSwgbm90IHRvXG4gICAgLy8gYW4gYXJyYXkgeW91IGZpbmQgYWZ0ZXIgYSBicmFuY2hpbmcgc2VhcmNoLlxuICAgIC8vXG4gICAgLy8gSW4gdGhlIHNwZWNpYWwgY2FzZSBvZiBhIG51bWVyaWMgcGFydCBpbiBhICpzb3J0IHNlbGVjdG9yKiAobm90IGEgcXVlcnlcbiAgICAvLyBzZWxlY3RvciksIHdlIHNraXAgdGhlIGJyYW5jaGluZzogd2UgT05MWSBhbGxvdyB0aGUgbnVtZXJpYyBwYXJ0IHRvIG1lYW5cbiAgICAvLyAnbG9vayB1cCB0aGlzIGluZGV4JyBpbiB0aGF0IGNhc2UsIG5vdCAnYWxzbyBsb29rIHVwIHRoaXMgaW5kZXggaW4gYWxsXG4gICAgLy8gdGhlIGVsZW1lbnRzIG9mIHRoZSBhcnJheScuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoZmlyc3RMZXZlbCkgJiZcbiAgICAgICAgIShpc051bWVyaWNLZXkocGFydHNbMV0pICYmIG9wdGlvbnMuZm9yU29ydCkpIHtcbiAgICAgIGZpcnN0TGV2ZWwuZm9yRWFjaCgoYnJhbmNoLCBhcnJheUluZGV4KSA9PiB7XG4gICAgICAgIGlmIChMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3QoYnJhbmNoKSkge1xuICAgICAgICAgIGFwcGVuZFRvUmVzdWx0KGxvb2t1cFJlc3QoYnJhbmNoLCBhcnJheUluZGljZXMgPyBhcnJheUluZGljZXMuY29uY2F0KGFycmF5SW5kZXgpIDogW2FycmF5SW5kZXhdKSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG59XG5cbi8vIE9iamVjdCBleHBvcnRlZCBvbmx5IGZvciB1bml0IHRlc3RpbmcuXG4vLyBVc2UgaXQgdG8gZXhwb3J0IHByaXZhdGUgZnVuY3Rpb25zIHRvIHRlc3QgaW4gVGlueXRlc3QuXG5NaW5pbW9uZ29UZXN0ID0ge21ha2VMb29rdXBGdW5jdGlvbn07XG5NaW5pbW9uZ29FcnJvciA9IChtZXNzYWdlLCBvcHRpb25zID0ge30pID0+IHtcbiAgaWYgKHR5cGVvZiBtZXNzYWdlID09PSAnc3RyaW5nJyAmJiBvcHRpb25zLmZpZWxkKSB7XG4gICAgbWVzc2FnZSArPSBgIGZvciBmaWVsZCAnJHtvcHRpb25zLmZpZWxkfSdgO1xuICB9XG5cbiAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IobWVzc2FnZSk7XG4gIGVycm9yLm5hbWUgPSAnTWluaW1vbmdvRXJyb3InO1xuICByZXR1cm4gZXJyb3I7XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gbm90aGluZ01hdGNoZXIoZG9jT3JCcmFuY2hlZFZhbHVlcykge1xuICByZXR1cm4ge3Jlc3VsdDogZmFsc2V9O1xufVxuXG4vLyBUYWtlcyBhbiBvcGVyYXRvciBvYmplY3QgKGFuIG9iamVjdCB3aXRoICQga2V5cykgYW5kIHJldHVybnMgYSBicmFuY2hlZFxuLy8gbWF0Y2hlciBmb3IgaXQuXG5mdW5jdGlvbiBvcGVyYXRvckJyYW5jaGVkTWF0Y2hlcih2YWx1ZVNlbGVjdG9yLCBtYXRjaGVyLCBpc1Jvb3QpIHtcbiAgLy8gRWFjaCB2YWx1ZVNlbGVjdG9yIHdvcmtzIHNlcGFyYXRlbHkgb24gdGhlIHZhcmlvdXMgYnJhbmNoZXMuICBTbyBvbmVcbiAgLy8gb3BlcmF0b3IgY2FuIG1hdGNoIG9uZSBicmFuY2ggYW5kIGFub3RoZXIgY2FuIG1hdGNoIGFub3RoZXIgYnJhbmNoLiAgVGhpc1xuICAvLyBpcyBPSy5cbiAgY29uc3Qgb3BlcmF0b3JNYXRjaGVycyA9IE9iamVjdC5rZXlzKHZhbHVlU2VsZWN0b3IpLm1hcChvcGVyYXRvciA9PiB7XG4gICAgY29uc3Qgb3BlcmFuZCA9IHZhbHVlU2VsZWN0b3Jbb3BlcmF0b3JdO1xuXG4gICAgY29uc3Qgc2ltcGxlUmFuZ2UgPSAoXG4gICAgICBbJyRsdCcsICckbHRlJywgJyRndCcsICckZ3RlJ10uaW5jbHVkZXMob3BlcmF0b3IpICYmXG4gICAgICB0eXBlb2Ygb3BlcmFuZCA9PT0gJ251bWJlcidcbiAgICApO1xuXG4gICAgY29uc3Qgc2ltcGxlRXF1YWxpdHkgPSAoXG4gICAgICBbJyRuZScsICckZXEnXS5pbmNsdWRlcyhvcGVyYXRvcikgJiZcbiAgICAgIG9wZXJhbmQgIT09IE9iamVjdChvcGVyYW5kKVxuICAgICk7XG5cbiAgICBjb25zdCBzaW1wbGVJbmNsdXNpb24gPSAoXG4gICAgICBbJyRpbicsICckbmluJ10uaW5jbHVkZXMob3BlcmF0b3IpXG4gICAgICAmJiBBcnJheS5pc0FycmF5KG9wZXJhbmQpXG4gICAgICAmJiAhb3BlcmFuZC5zb21lKHggPT4geCA9PT0gT2JqZWN0KHgpKVxuICAgICk7XG5cbiAgICBpZiAoIShzaW1wbGVSYW5nZSB8fCBzaW1wbGVJbmNsdXNpb24gfHwgc2ltcGxlRXF1YWxpdHkpKSB7XG4gICAgICBtYXRjaGVyLl9pc1NpbXBsZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIGlmIChoYXNPd24uY2FsbChWQUxVRV9PUEVSQVRPUlMsIG9wZXJhdG9yKSkge1xuICAgICAgcmV0dXJuIFZBTFVFX09QRVJBVE9SU1tvcGVyYXRvcl0ob3BlcmFuZCwgdmFsdWVTZWxlY3RvciwgbWF0Y2hlciwgaXNSb290KTtcbiAgICB9XG5cbiAgICBpZiAoaGFzT3duLmNhbGwoRUxFTUVOVF9PUEVSQVRPUlMsIG9wZXJhdG9yKSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IEVMRU1FTlRfT1BFUkFUT1JTW29wZXJhdG9yXTtcbiAgICAgIHJldHVybiBjb252ZXJ0RWxlbWVudE1hdGNoZXJUb0JyYW5jaGVkTWF0Y2hlcihcbiAgICAgICAgb3B0aW9ucy5jb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQsIHZhbHVlU2VsZWN0b3IsIG1hdGNoZXIpLFxuICAgICAgICBvcHRpb25zXG4gICAgICApO1xuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihgVW5yZWNvZ25pemVkIG9wZXJhdG9yOiAke29wZXJhdG9yfWApO1xuICB9KTtcblxuICByZXR1cm4gYW5kQnJhbmNoZWRNYXRjaGVycyhvcGVyYXRvck1hdGNoZXJzKTtcbn1cblxuLy8gcGF0aHMgLSBBcnJheTogbGlzdCBvZiBtb25nbyBzdHlsZSBwYXRoc1xuLy8gbmV3TGVhZkZuIC0gRnVuY3Rpb246IG9mIGZvcm0gZnVuY3Rpb24ocGF0aCkgc2hvdWxkIHJldHVybiBhIHNjYWxhciB2YWx1ZSB0b1xuLy8gICAgICAgICAgICAgICAgICAgICAgIHB1dCBpbnRvIGxpc3QgY3JlYXRlZCBmb3IgdGhhdCBwYXRoXG4vLyBjb25mbGljdEZuIC0gRnVuY3Rpb246IG9mIGZvcm0gZnVuY3Rpb24obm9kZSwgcGF0aCwgZnVsbFBhdGgpIGlzIGNhbGxlZFxuLy8gICAgICAgICAgICAgICAgICAgICAgICB3aGVuIGJ1aWxkaW5nIGEgdHJlZSBwYXRoIGZvciAnZnVsbFBhdGgnIG5vZGUgb25cbi8vICAgICAgICAgICAgICAgICAgICAgICAgJ3BhdGgnIHdhcyBhbHJlYWR5IGEgbGVhZiB3aXRoIGEgdmFsdWUuIE11c3QgcmV0dXJuIGFcbi8vICAgICAgICAgICAgICAgICAgICAgICAgY29uZmxpY3QgcmVzb2x1dGlvbi5cbi8vIGluaXRpYWwgdHJlZSAtIE9wdGlvbmFsIE9iamVjdDogc3RhcnRpbmcgdHJlZS5cbi8vIEByZXR1cm5zIC0gT2JqZWN0OiB0cmVlIHJlcHJlc2VudGVkIGFzIGEgc2V0IG9mIG5lc3RlZCBvYmplY3RzXG5leHBvcnQgZnVuY3Rpb24gcGF0aHNUb1RyZWUocGF0aHMsIG5ld0xlYWZGbiwgY29uZmxpY3RGbiwgcm9vdCA9IHt9KSB7XG4gIHBhdGhzLmZvckVhY2gocGF0aCA9PiB7XG4gICAgY29uc3QgcGF0aEFycmF5ID0gcGF0aC5zcGxpdCgnLicpO1xuICAgIGxldCB0cmVlID0gcm9vdDtcblxuICAgIC8vIHVzZSAuZXZlcnkganVzdCBmb3IgaXRlcmF0aW9uIHdpdGggYnJlYWtcbiAgICBjb25zdCBzdWNjZXNzID0gcGF0aEFycmF5LnNsaWNlKDAsIC0xKS5ldmVyeSgoa2V5LCBpKSA9PiB7XG4gICAgICBpZiAoIWhhc093bi5jYWxsKHRyZWUsIGtleSkpIHtcbiAgICAgICAgdHJlZVtrZXldID0ge307XG4gICAgICB9IGVsc2UgaWYgKHRyZWVba2V5XSAhPT0gT2JqZWN0KHRyZWVba2V5XSkpIHtcbiAgICAgICAgdHJlZVtrZXldID0gY29uZmxpY3RGbihcbiAgICAgICAgICB0cmVlW2tleV0sXG4gICAgICAgICAgcGF0aEFycmF5LnNsaWNlKDAsIGkgKyAxKS5qb2luKCcuJyksXG4gICAgICAgICAgcGF0aFxuICAgICAgICApO1xuXG4gICAgICAgIC8vIGJyZWFrIG91dCBvZiBsb29wIGlmIHdlIGFyZSBmYWlsaW5nIGZvciB0aGlzIHBhdGhcbiAgICAgICAgaWYgKHRyZWVba2V5XSAhPT0gT2JqZWN0KHRyZWVba2V5XSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdHJlZSA9IHRyZWVba2V5XTtcblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG5cbiAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgY29uc3QgbGFzdEtleSA9IHBhdGhBcnJheVtwYXRoQXJyYXkubGVuZ3RoIC0gMV07XG4gICAgICBpZiAoaGFzT3duLmNhbGwodHJlZSwgbGFzdEtleSkpIHtcbiAgICAgICAgdHJlZVtsYXN0S2V5XSA9IGNvbmZsaWN0Rm4odHJlZVtsYXN0S2V5XSwgcGF0aCwgcGF0aCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0cmVlW2xhc3RLZXldID0gbmV3TGVhZkZuKHBhdGgpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHJvb3Q7XG59XG5cbi8vIE1ha2VzIHN1cmUgd2UgZ2V0IDIgZWxlbWVudHMgYXJyYXkgYW5kIGFzc3VtZSB0aGUgZmlyc3Qgb25lIHRvIGJlIHggYW5kXG4vLyB0aGUgc2Vjb25kIG9uZSB0byB5IG5vIG1hdHRlciB3aGF0IHVzZXIgcGFzc2VzLlxuLy8gSW4gY2FzZSB1c2VyIHBhc3NlcyB7IGxvbjogeCwgbGF0OiB5IH0gcmV0dXJucyBbeCwgeV1cbmZ1bmN0aW9uIHBvaW50VG9BcnJheShwb2ludCkge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShwb2ludCkgPyBwb2ludC5zbGljZSgpIDogW3BvaW50LngsIHBvaW50LnldO1xufVxuXG4vLyBDcmVhdGluZyBhIGRvY3VtZW50IGZyb20gYW4gdXBzZXJ0IGlzIHF1aXRlIHRyaWNreS5cbi8vIEUuZy4gdGhpcyBzZWxlY3Rvcjoge1wiJG9yXCI6IFt7XCJiLmZvb1wiOiB7XCIkYWxsXCI6IFtcImJhclwiXX19XX0sIHNob3VsZCByZXN1bHRcbi8vIGluOiB7XCJiLmZvb1wiOiBcImJhclwifVxuLy8gQnV0IHRoaXMgc2VsZWN0b3I6IHtcIiRvclwiOiBbe1wiYlwiOiB7XCJmb29cIjoge1wiJGFsbFwiOiBbXCJiYXJcIl19fX1dfSBzaG91bGQgdGhyb3dcbi8vIGFuIGVycm9yXG5cbi8vIFNvbWUgcnVsZXMgKGZvdW5kIG1haW5seSB3aXRoIHRyaWFsICYgZXJyb3IsIHNvIHRoZXJlIG1pZ2h0IGJlIG1vcmUpOlxuLy8gLSBoYW5kbGUgYWxsIGNoaWxkcyBvZiAkYW5kIChvciBpbXBsaWNpdCAkYW5kKVxuLy8gLSBoYW5kbGUgJG9yIG5vZGVzIHdpdGggZXhhY3RseSAxIGNoaWxkXG4vLyAtIGlnbm9yZSAkb3Igbm9kZXMgd2l0aCBtb3JlIHRoYW4gMSBjaGlsZFxuLy8gLSBpZ25vcmUgJG5vciBhbmQgJG5vdCBub2Rlc1xuLy8gLSB0aHJvdyB3aGVuIGEgdmFsdWUgY2FuIG5vdCBiZSBzZXQgdW5hbWJpZ3VvdXNseVxuLy8gLSBldmVyeSB2YWx1ZSBmb3IgJGFsbCBzaG91bGQgYmUgZGVhbHQgd2l0aCBhcyBzZXBhcmF0ZSAkZXEtc1xuLy8gLSB0aHJlYXQgYWxsIGNoaWxkcmVuIG9mICRhbGwgYXMgJGVxIHNldHRlcnMgKD0+IHNldCBpZiAkYWxsLmxlbmd0aCA9PT0gMSxcbi8vICAgb3RoZXJ3aXNlIHRocm93IGVycm9yKVxuLy8gLSB5b3UgY2FuIG5vdCBtaXggJyQnLXByZWZpeGVkIGtleXMgYW5kIG5vbi0nJCctcHJlZml4ZWQga2V5c1xuLy8gLSB5b3UgY2FuIG9ubHkgaGF2ZSBkb3R0ZWQga2V5cyBvbiBhIHJvb3QtbGV2ZWxcbi8vIC0geW91IGNhbiBub3QgaGF2ZSAnJCctcHJlZml4ZWQga2V5cyBtb3JlIHRoYW4gb25lLWxldmVsIGRlZXAgaW4gYW4gb2JqZWN0XG5cbi8vIEhhbmRsZXMgb25lIGtleS92YWx1ZSBwYWlyIHRvIHB1dCBpbiB0aGUgc2VsZWN0b3IgZG9jdW1lbnRcbmZ1bmN0aW9uIHBvcHVsYXRlRG9jdW1lbnRXaXRoS2V5VmFsdWUoZG9jdW1lbnQsIGtleSwgdmFsdWUpIHtcbiAgaWYgKHZhbHVlICYmIE9iamVjdC5nZXRQcm90b3R5cGVPZih2YWx1ZSkgPT09IE9iamVjdC5wcm90b3R5cGUpIHtcbiAgICBwb3B1bGF0ZURvY3VtZW50V2l0aE9iamVjdChkb2N1bWVudCwga2V5LCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoISh2YWx1ZSBpbnN0YW5jZW9mIFJlZ0V4cCkpIHtcbiAgICBpbnNlcnRJbnRvRG9jdW1lbnQoZG9jdW1lbnQsIGtleSwgdmFsdWUpO1xuICB9XG59XG5cbi8vIEhhbmRsZXMgYSBrZXksIHZhbHVlIHBhaXIgdG8gcHV0IGluIHRoZSBzZWxlY3RvciBkb2N1bWVudFxuLy8gaWYgdGhlIHZhbHVlIGlzIGFuIG9iamVjdFxuZnVuY3Rpb24gcG9wdWxhdGVEb2N1bWVudFdpdGhPYmplY3QoZG9jdW1lbnQsIGtleSwgdmFsdWUpIHtcbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHZhbHVlKTtcbiAgY29uc3QgdW5wcmVmaXhlZEtleXMgPSBrZXlzLmZpbHRlcihvcCA9PiBvcFswXSAhPT0gJyQnKTtcblxuICBpZiAodW5wcmVmaXhlZEtleXMubGVuZ3RoID4gMCB8fCAha2V5cy5sZW5ndGgpIHtcbiAgICAvLyBMaXRlcmFsIChwb3NzaWJseSBlbXB0eSkgb2JqZWN0ICggb3IgZW1wdHkgb2JqZWN0IClcbiAgICAvLyBEb24ndCBhbGxvdyBtaXhpbmcgJyQnLXByZWZpeGVkIHdpdGggbm9uLSckJy1wcmVmaXhlZCBmaWVsZHNcbiAgICBpZiAoa2V5cy5sZW5ndGggIT09IHVucHJlZml4ZWRLZXlzLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGB1bmtub3duIG9wZXJhdG9yOiAke3VucHJlZml4ZWRLZXlzWzBdfWApO1xuICAgIH1cblxuICAgIHZhbGlkYXRlT2JqZWN0KHZhbHVlLCBrZXkpO1xuICAgIGluc2VydEludG9Eb2N1bWVudChkb2N1bWVudCwga2V5LCB2YWx1ZSk7XG4gIH0gZWxzZSB7XG4gICAgT2JqZWN0LmtleXModmFsdWUpLmZvckVhY2gob3AgPT4ge1xuICAgICAgY29uc3Qgb2JqZWN0ID0gdmFsdWVbb3BdO1xuXG4gICAgICBpZiAob3AgPT09ICckZXEnKSB7XG4gICAgICAgIHBvcHVsYXRlRG9jdW1lbnRXaXRoS2V5VmFsdWUoZG9jdW1lbnQsIGtleSwgb2JqZWN0KTtcbiAgICAgIH0gZWxzZSBpZiAob3AgPT09ICckYWxsJykge1xuICAgICAgICAvLyBldmVyeSB2YWx1ZSBmb3IgJGFsbCBzaG91bGQgYmUgZGVhbHQgd2l0aCBhcyBzZXBhcmF0ZSAkZXEtc1xuICAgICAgICBvYmplY3QuZm9yRWFjaChlbGVtZW50ID0+XG4gICAgICAgICAgcG9wdWxhdGVEb2N1bWVudFdpdGhLZXlWYWx1ZShkb2N1bWVudCwga2V5LCBlbGVtZW50KVxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbi8vIEZpbGxzIGEgZG9jdW1lbnQgd2l0aCBjZXJ0YWluIGZpZWxkcyBmcm9tIGFuIHVwc2VydCBzZWxlY3RvclxuZXhwb3J0IGZ1bmN0aW9uIHBvcHVsYXRlRG9jdW1lbnRXaXRoUXVlcnlGaWVsZHMocXVlcnksIGRvY3VtZW50ID0ge30pIHtcbiAgaWYgKE9iamVjdC5nZXRQcm90b3R5cGVPZihxdWVyeSkgPT09IE9iamVjdC5wcm90b3R5cGUpIHtcbiAgICAvLyBoYW5kbGUgaW1wbGljaXQgJGFuZFxuICAgIE9iamVjdC5rZXlzKHF1ZXJ5KS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHF1ZXJ5W2tleV07XG5cbiAgICAgIGlmIChrZXkgPT09ICckYW5kJykge1xuICAgICAgICAvLyBoYW5kbGUgZXhwbGljaXQgJGFuZFxuICAgICAgICB2YWx1ZS5mb3JFYWNoKGVsZW1lbnQgPT5cbiAgICAgICAgICBwb3B1bGF0ZURvY3VtZW50V2l0aFF1ZXJ5RmllbGRzKGVsZW1lbnQsIGRvY3VtZW50KVxuICAgICAgICApO1xuICAgICAgfSBlbHNlIGlmIChrZXkgPT09ICckb3InKSB7XG4gICAgICAgIC8vIGhhbmRsZSAkb3Igbm9kZXMgd2l0aCBleGFjdGx5IDEgY2hpbGRcbiAgICAgICAgaWYgKHZhbHVlLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIHBvcHVsYXRlRG9jdW1lbnRXaXRoUXVlcnlGaWVsZHModmFsdWVbMF0sIGRvY3VtZW50KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChrZXlbMF0gIT09ICckJykge1xuICAgICAgICAvLyBJZ25vcmUgb3RoZXIgJyQnLXByZWZpeGVkIGxvZ2ljYWwgc2VsZWN0b3JzXG4gICAgICAgIHBvcHVsYXRlRG9jdW1lbnRXaXRoS2V5VmFsdWUoZG9jdW1lbnQsIGtleSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIC8vIEhhbmRsZSBtZXRlb3Itc3BlY2lmaWMgc2hvcnRjdXQgZm9yIHNlbGVjdGluZyBfaWRcbiAgICBpZiAoTG9jYWxDb2xsZWN0aW9uLl9zZWxlY3RvcklzSWQocXVlcnkpKSB7XG4gICAgICBpbnNlcnRJbnRvRG9jdW1lbnQoZG9jdW1lbnQsICdfaWQnLCBxdWVyeSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGRvY3VtZW50O1xufVxuXG4vLyBUcmF2ZXJzZXMgdGhlIGtleXMgb2YgcGFzc2VkIHByb2plY3Rpb24gYW5kIGNvbnN0cnVjdHMgYSB0cmVlIHdoZXJlIGFsbFxuLy8gbGVhdmVzIGFyZSBlaXRoZXIgYWxsIFRydWUgb3IgYWxsIEZhbHNlXG4vLyBAcmV0dXJucyBPYmplY3Q6XG4vLyAgLSB0cmVlIC0gT2JqZWN0IC0gdHJlZSByZXByZXNlbnRhdGlvbiBvZiBrZXlzIGludm9sdmVkIGluIHByb2plY3Rpb25cbi8vICAoZXhjZXB0aW9uIGZvciAnX2lkJyBhcyBpdCBpcyBhIHNwZWNpYWwgY2FzZSBoYW5kbGVkIHNlcGFyYXRlbHkpXG4vLyAgLSBpbmNsdWRpbmcgLSBCb29sZWFuIC0gXCJ0YWtlIG9ubHkgY2VydGFpbiBmaWVsZHNcIiB0eXBlIG9mIHByb2plY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBwcm9qZWN0aW9uRGV0YWlscyhmaWVsZHMpIHtcbiAgLy8gRmluZCB0aGUgbm9uLV9pZCBrZXlzIChfaWQgaXMgaGFuZGxlZCBzcGVjaWFsbHkgYmVjYXVzZSBpdCBpcyBpbmNsdWRlZFxuICAvLyB1bmxlc3MgZXhwbGljaXRseSBleGNsdWRlZCkuIFNvcnQgdGhlIGtleXMsIHNvIHRoYXQgb3VyIGNvZGUgdG8gZGV0ZWN0XG4gIC8vIG92ZXJsYXBzIGxpa2UgJ2ZvbycgYW5kICdmb28uYmFyJyBjYW4gYXNzdW1lIHRoYXQgJ2ZvbycgY29tZXMgZmlyc3QuXG4gIGxldCBmaWVsZHNLZXlzID0gT2JqZWN0LmtleXMoZmllbGRzKS5zb3J0KCk7XG5cbiAgLy8gSWYgX2lkIGlzIHRoZSBvbmx5IGZpZWxkIGluIHRoZSBwcm9qZWN0aW9uLCBkbyBub3QgcmVtb3ZlIGl0LCBzaW5jZSBpdCBpc1xuICAvLyByZXF1aXJlZCB0byBkZXRlcm1pbmUgaWYgdGhpcyBpcyBhbiBleGNsdXNpb24gb3IgZXhjbHVzaW9uLiBBbHNvIGtlZXAgYW5cbiAgLy8gaW5jbHVzaXZlIF9pZCwgc2luY2UgaW5jbHVzaXZlIF9pZCBmb2xsb3dzIHRoZSBub3JtYWwgcnVsZXMgYWJvdXQgbWl4aW5nXG4gIC8vIGluY2x1c2l2ZSBhbmQgZXhjbHVzaXZlIGZpZWxkcy4gSWYgX2lkIGlzIG5vdCB0aGUgb25seSBmaWVsZCBpbiB0aGVcbiAgLy8gcHJvamVjdGlvbiBhbmQgaXMgZXhjbHVzaXZlLCByZW1vdmUgaXQgc28gaXQgY2FuIGJlIGhhbmRsZWQgbGF0ZXIgYnkgYVxuICAvLyBzcGVjaWFsIGNhc2UsIHNpbmNlIGV4Y2x1c2l2ZSBfaWQgaXMgYWx3YXlzIGFsbG93ZWQuXG4gIGlmICghKGZpZWxkc0tleXMubGVuZ3RoID09PSAxICYmIGZpZWxkc0tleXNbMF0gPT09ICdfaWQnKSAmJlxuICAgICAgIShmaWVsZHNLZXlzLmluY2x1ZGVzKCdfaWQnKSAmJiBmaWVsZHMuX2lkKSkge1xuICAgIGZpZWxkc0tleXMgPSBmaWVsZHNLZXlzLmZpbHRlcihrZXkgPT4ga2V5ICE9PSAnX2lkJyk7XG4gIH1cblxuICBsZXQgaW5jbHVkaW5nID0gbnVsbDsgLy8gVW5rbm93blxuXG4gIGZpZWxkc0tleXMuZm9yRWFjaChrZXlQYXRoID0+IHtcbiAgICBjb25zdCBydWxlID0gISFmaWVsZHNba2V5UGF0aF07XG5cbiAgICBpZiAoaW5jbHVkaW5nID09PSBudWxsKSB7XG4gICAgICBpbmNsdWRpbmcgPSBydWxlO1xuICAgIH1cblxuICAgIC8vIFRoaXMgZXJyb3IgbWVzc2FnZSBpcyBjb3BpZWQgZnJvbSBNb25nb0RCIHNoZWxsXG4gICAgaWYgKGluY2x1ZGluZyAhPT0gcnVsZSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICdZb3UgY2Fubm90IGN1cnJlbnRseSBtaXggaW5jbHVkaW5nIGFuZCBleGNsdWRpbmcgZmllbGRzLidcbiAgICAgICk7XG4gICAgfVxuICB9KTtcblxuICBjb25zdCBwcm9qZWN0aW9uUnVsZXNUcmVlID0gcGF0aHNUb1RyZWUoXG4gICAgZmllbGRzS2V5cyxcbiAgICBwYXRoID0+IGluY2x1ZGluZyxcbiAgICAobm9kZSwgcGF0aCwgZnVsbFBhdGgpID0+IHtcbiAgICAgIC8vIENoZWNrIHBhc3NlZCBwcm9qZWN0aW9uIGZpZWxkcycga2V5czogSWYgeW91IGhhdmUgdHdvIHJ1bGVzIHN1Y2ggYXNcbiAgICAgIC8vICdmb28uYmFyJyBhbmQgJ2Zvby5iYXIuYmF6JywgdGhlbiB0aGUgcmVzdWx0IGJlY29tZXMgYW1iaWd1b3VzLiBJZlxuICAgICAgLy8gdGhhdCBoYXBwZW5zLCB0aGVyZSBpcyBhIHByb2JhYmlsaXR5IHlvdSBhcmUgZG9pbmcgc29tZXRoaW5nIHdyb25nLFxuICAgICAgLy8gZnJhbWV3b3JrIHNob3VsZCBub3RpZnkgeW91IGFib3V0IHN1Y2ggbWlzdGFrZSBlYXJsaWVyIG9uIGN1cnNvclxuICAgICAgLy8gY29tcGlsYXRpb24gc3RlcCB0aGFuIGxhdGVyIGR1cmluZyBydW50aW1lLiAgTm90ZSwgdGhhdCByZWFsIG1vbmdvXG4gICAgICAvLyBkb2Vzbid0IGRvIGFueXRoaW5nIGFib3V0IGl0IGFuZCB0aGUgbGF0ZXIgcnVsZSBhcHBlYXJzIGluIHByb2plY3Rpb25cbiAgICAgIC8vIHByb2plY3QsIG1vcmUgcHJpb3JpdHkgaXQgdGFrZXMuXG4gICAgICAvL1xuICAgICAgLy8gRXhhbXBsZSwgYXNzdW1lIGZvbGxvd2luZyBpbiBtb25nbyBzaGVsbDpcbiAgICAgIC8vID4gZGIuY29sbC5pbnNlcnQoeyBhOiB7IGI6IDIzLCBjOiA0NCB9IH0pXG4gICAgICAvLyA+IGRiLmNvbGwuZmluZCh7fSwgeyAnYSc6IDEsICdhLmInOiAxIH0pXG4gICAgICAvLyB7XCJfaWRcIjogT2JqZWN0SWQoXCI1MjBiZmU0NTYwMjQ2MDhlOGVmMjRhZjNcIiksIFwiYVwiOiB7XCJiXCI6IDIzfX1cbiAgICAgIC8vID4gZGIuY29sbC5maW5kKHt9LCB7ICdhLmInOiAxLCAnYSc6IDEgfSlcbiAgICAgIC8vIHtcIl9pZFwiOiBPYmplY3RJZChcIjUyMGJmZTQ1NjAyNDYwOGU4ZWYyNGFmM1wiKSwgXCJhXCI6IHtcImJcIjogMjMsIFwiY1wiOiA0NH19XG4gICAgICAvL1xuICAgICAgLy8gTm90ZSwgaG93IHNlY29uZCB0aW1lIHRoZSByZXR1cm4gc2V0IG9mIGtleXMgaXMgZGlmZmVyZW50LlxuICAgICAgY29uc3QgY3VycmVudFBhdGggPSBmdWxsUGF0aDtcbiAgICAgIGNvbnN0IGFub3RoZXJQYXRoID0gcGF0aDtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICBgYm90aCAke2N1cnJlbnRQYXRofSBhbmQgJHthbm90aGVyUGF0aH0gZm91bmQgaW4gZmllbGRzIG9wdGlvbiwgYCArXG4gICAgICAgICd1c2luZyBib3RoIG9mIHRoZW0gbWF5IHRyaWdnZXIgdW5leHBlY3RlZCBiZWhhdmlvci4gRGlkIHlvdSBtZWFuIHRvICcgK1xuICAgICAgICAndXNlIG9ubHkgb25lIG9mIHRoZW0/J1xuICAgICAgKTtcbiAgICB9KTtcblxuICByZXR1cm4ge2luY2x1ZGluZywgdHJlZTogcHJvamVjdGlvblJ1bGVzVHJlZX07XG59XG5cbi8vIFRha2VzIGEgUmVnRXhwIG9iamVjdCBhbmQgcmV0dXJucyBhbiBlbGVtZW50IG1hdGNoZXIuXG5leHBvcnQgZnVuY3Rpb24gcmVnZXhwRWxlbWVudE1hdGNoZXIocmVnZXhwKSB7XG4gIHJldHVybiB2YWx1ZSA9PiB7XG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICByZXR1cm4gdmFsdWUudG9TdHJpbmcoKSA9PT0gcmVnZXhwLnRvU3RyaW5nKCk7XG4gICAgfVxuXG4gICAgLy8gUmVnZXhwcyBvbmx5IHdvcmsgYWdhaW5zdCBzdHJpbmdzLlxuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gUmVzZXQgcmVnZXhwJ3Mgc3RhdGUgdG8gYXZvaWQgaW5jb25zaXN0ZW50IG1hdGNoaW5nIGZvciBvYmplY3RzIHdpdGggdGhlXG4gICAgLy8gc2FtZSB2YWx1ZSBvbiBjb25zZWN1dGl2ZSBjYWxscyBvZiByZWdleHAudGVzdC4gVGhpcyBoYXBwZW5zIG9ubHkgaWYgdGhlXG4gICAgLy8gcmVnZXhwIGhhcyB0aGUgJ2cnIGZsYWcuIEFsc28gbm90ZSB0aGF0IEVTNiBpbnRyb2R1Y2VzIGEgbmV3IGZsYWcgJ3knIGZvclxuICAgIC8vIHdoaWNoIHdlIHNob3VsZCAqbm90KiBjaGFuZ2UgdGhlIGxhc3RJbmRleCBidXQgTW9uZ29EQiBkb2Vzbid0IHN1cHBvcnRcbiAgICAvLyBlaXRoZXIgb2YgdGhlc2UgZmxhZ3MuXG4gICAgcmVnZXhwLmxhc3RJbmRleCA9IDA7XG5cbiAgICByZXR1cm4gcmVnZXhwLnRlc3QodmFsdWUpO1xuICB9O1xufVxuXG4vLyBWYWxpZGF0ZXMgdGhlIGtleSBpbiBhIHBhdGguXG4vLyBPYmplY3RzIHRoYXQgYXJlIG5lc3RlZCBtb3JlIHRoZW4gMSBsZXZlbCBjYW5ub3QgaGF2ZSBkb3R0ZWQgZmllbGRzXG4vLyBvciBmaWVsZHMgc3RhcnRpbmcgd2l0aCAnJCdcbmZ1bmN0aW9uIHZhbGlkYXRlS2V5SW5QYXRoKGtleSwgcGF0aCkge1xuICBpZiAoa2V5LmluY2x1ZGVzKCcuJykpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgVGhlIGRvdHRlZCBmaWVsZCAnJHtrZXl9JyBpbiAnJHtwYXRofS4ke2tleX0gaXMgbm90IHZhbGlkIGZvciBzdG9yYWdlLmBcbiAgICApO1xuICB9XG5cbiAgaWYgKGtleVswXSA9PT0gJyQnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYFRoZSBkb2xsYXIgKCQpIHByZWZpeGVkIGZpZWxkICAnJHtwYXRofS4ke2tleX0gaXMgbm90IHZhbGlkIGZvciBzdG9yYWdlLmBcbiAgICApO1xuICB9XG59XG5cbi8vIFJlY3Vyc2l2ZWx5IHZhbGlkYXRlcyBhbiBvYmplY3QgdGhhdCBpcyBuZXN0ZWQgbW9yZSB0aGFuIG9uZSBsZXZlbCBkZWVwXG5mdW5jdGlvbiB2YWxpZGF0ZU9iamVjdChvYmplY3QsIHBhdGgpIHtcbiAgaWYgKG9iamVjdCAmJiBPYmplY3QuZ2V0UHJvdG90eXBlT2Yob2JqZWN0KSA9PT0gT2JqZWN0LnByb3RvdHlwZSkge1xuICAgIE9iamVjdC5rZXlzKG9iamVjdCkuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgdmFsaWRhdGVLZXlJblBhdGgoa2V5LCBwYXRoKTtcbiAgICAgIHZhbGlkYXRlT2JqZWN0KG9iamVjdFtrZXldLCBwYXRoICsgJy4nICsga2V5KTtcbiAgICB9KTtcbiAgfVxufVxuIiwiLyoqIEV4cG9ydGVkIHZhbHVlcyBhcmUgYWxzbyB1c2VkIGluIHRoZSBtb25nbyBwYWNrYWdlLiAqL1xuXG4vKiogQHBhcmFtIHtzdHJpbmd9IG1ldGhvZCAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEFzeW5jTWV0aG9kTmFtZShtZXRob2QpIHtcbiAgcmV0dXJuIGAke21ldGhvZC5yZXBsYWNlKCdfJywgJycpfUFzeW5jYDtcbn1cblxuZXhwb3J0IGNvbnN0IEFTWU5DX0NPTExFQ1RJT05fTUVUSE9EUyA9IFtcbiAgJ19jcmVhdGVDYXBwZWRDb2xsZWN0aW9uJyxcbiAgJ2Ryb3BDb2xsZWN0aW9uJyxcbiAgJ2Ryb3BJbmRleCcsXG4gICdjcmVhdGVJbmRleCcsXG4gICdmaW5kT25lJyxcbiAgJ2luc2VydCcsXG4gICdyZW1vdmUnLFxuICAndXBkYXRlJyxcbiAgJ3Vwc2VydCcsXG5dO1xuXG5leHBvcnQgY29uc3QgQVNZTkNfQ1VSU09SX01FVEhPRFMgPSBbJ2NvdW50JywgJ2ZldGNoJywgJ2ZvckVhY2gnLCAnbWFwJ107XG4iLCJpbXBvcnQgTG9jYWxDb2xsZWN0aW9uIGZyb20gJy4vbG9jYWxfY29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBoYXNPd24gfSBmcm9tICcuL2NvbW1vbi5qcyc7XG5pbXBvcnQgeyBBU1lOQ19DVVJTT1JfTUVUSE9EUywgZ2V0QXN5bmNNZXRob2ROYW1lIH0gZnJvbSBcIi4vY29uc3RhbnRzXCI7XG5cbi8vIEN1cnNvcjogYSBzcGVjaWZpY2F0aW9uIGZvciBhIHBhcnRpY3VsYXIgc3Vic2V0IG9mIGRvY3VtZW50cywgdy8gYSBkZWZpbmVkXG4vLyBvcmRlciwgbGltaXQsIGFuZCBvZmZzZXQuICBjcmVhdGluZyBhIEN1cnNvciB3aXRoIExvY2FsQ29sbGVjdGlvbi5maW5kKCksXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDdXJzb3Ige1xuICAvLyBkb24ndCBjYWxsIHRoaXMgY3RvciBkaXJlY3RseS4gIHVzZSBMb2NhbENvbGxlY3Rpb24uZmluZCgpLlxuICBjb25zdHJ1Y3Rvcihjb2xsZWN0aW9uLCBzZWxlY3Rvciwgb3B0aW9ucyA9IHt9KSB7XG4gICAgdGhpcy5jb2xsZWN0aW9uID0gY29sbGVjdGlvbjtcbiAgICB0aGlzLnNvcnRlciA9IG51bGw7XG4gICAgdGhpcy5tYXRjaGVyID0gbmV3IE1pbmltb25nby5NYXRjaGVyKHNlbGVjdG9yKTtcblxuICAgIGlmIChMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZFBlcmhhcHNBc09iamVjdChzZWxlY3RvcikpIHtcbiAgICAgIC8vIHN0YXNoIGZvciBmYXN0IF9pZCBhbmQgeyBfaWQgfVxuICAgICAgdGhpcy5fc2VsZWN0b3JJZCA9IGhhc093bi5jYWxsKHNlbGVjdG9yLCAnX2lkJylcbiAgICAgICAgPyBzZWxlY3Rvci5faWRcbiAgICAgICAgOiBzZWxlY3RvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc2VsZWN0b3JJZCA9IHVuZGVmaW5lZDtcblxuICAgICAgaWYgKHRoaXMubWF0Y2hlci5oYXNHZW9RdWVyeSgpIHx8IG9wdGlvbnMuc29ydCkge1xuICAgICAgICB0aGlzLnNvcnRlciA9IG5ldyBNaW5pbW9uZ28uU29ydGVyKG9wdGlvbnMuc29ydCB8fCBbXSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5za2lwID0gb3B0aW9ucy5za2lwIHx8IDA7XG4gICAgdGhpcy5saW1pdCA9IG9wdGlvbnMubGltaXQ7XG4gICAgdGhpcy5maWVsZHMgPSBvcHRpb25zLnByb2plY3Rpb24gfHwgb3B0aW9ucy5maWVsZHM7XG5cbiAgICB0aGlzLl9wcm9qZWN0aW9uRm4gPSBMb2NhbENvbGxlY3Rpb24uX2NvbXBpbGVQcm9qZWN0aW9uKHRoaXMuZmllbGRzIHx8IHt9KTtcblxuICAgIHRoaXMuX3RyYW5zZm9ybSA9IExvY2FsQ29sbGVjdGlvbi53cmFwVHJhbnNmb3JtKG9wdGlvbnMudHJhbnNmb3JtKTtcblxuICAgIC8vIGJ5IGRlZmF1bHQsIHF1ZXJpZXMgcmVnaXN0ZXIgdy8gVHJhY2tlciB3aGVuIGl0IGlzIGF2YWlsYWJsZS5cbiAgICBpZiAodHlwZW9mIFRyYWNrZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aGlzLnJlYWN0aXZlID0gb3B0aW9ucy5yZWFjdGl2ZSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IG9wdGlvbnMucmVhY3RpdmU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIGluIDIuOVxuICAgKiBAc3VtbWFyeSBSZXR1cm5zIHRoZSBudW1iZXIgb2YgZG9jdW1lbnRzIHRoYXQgbWF0Y2ggYSBxdWVyeS4gVGhpcyBtZXRob2QgaXNcbiAgICogICAgICAgICAgW2RlcHJlY2F0ZWQgc2luY2UgTW9uZ29EQiA0LjBdKGh0dHBzOi8vd3d3Lm1vbmdvZGIuY29tL2RvY3MvdjQuNC9yZWZlcmVuY2UvY29tbWFuZC9jb3VudC8pO1xuICAgKiAgICAgICAgICBzZWUgYENvbGxlY3Rpb24uY291bnREb2N1bWVudHNgIGFuZFxuICAgKiAgICAgICAgICBgQ29sbGVjdGlvbi5lc3RpbWF0ZWREb2N1bWVudENvdW50YCBmb3IgYSByZXBsYWNlbWVudC5cbiAgICogQG1lbWJlck9mIE1vbmdvLkN1cnNvclxuICAgKiBAbWV0aG9kICBjb3VudFxuICAgKiBAaW5zdGFuY2VcbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gICAqL1xuICBjb3VudCgpIHtcbiAgICBpZiAodGhpcy5yZWFjdGl2ZSkge1xuICAgICAgLy8gYWxsb3cgdGhlIG9ic2VydmUgdG8gYmUgdW5vcmRlcmVkXG4gICAgICB0aGlzLl9kZXBlbmQoe2FkZGVkOiB0cnVlLCByZW1vdmVkOiB0cnVlfSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX2dldFJhd09iamVjdHMoe1xuICAgICAgb3JkZXJlZDogdHJ1ZSxcbiAgICB9KS5sZW5ndGg7XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgUmV0dXJuIGFsbCBtYXRjaGluZyBkb2N1bWVudHMgYXMgYW4gQXJyYXkuXG4gICAqIEBtZW1iZXJPZiBNb25nby5DdXJzb3JcbiAgICogQG1ldGhvZCAgZmV0Y2hcbiAgICogQGluc3RhbmNlXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcmV0dXJucyB7T2JqZWN0W119XG4gICAqL1xuICBmZXRjaCgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBbXTtcblxuICAgIHRoaXMuZm9yRWFjaChkb2MgPT4ge1xuICAgICAgcmVzdWx0LnB1c2goZG9jKTtcbiAgICB9KTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbiAgICBpZiAodGhpcy5yZWFjdGl2ZSkge1xuICAgICAgdGhpcy5fZGVwZW5kKHtcbiAgICAgICAgYWRkZWRCZWZvcmU6IHRydWUsXG4gICAgICAgIHJlbW92ZWQ6IHRydWUsXG4gICAgICAgIGNoYW5nZWQ6IHRydWUsXG4gICAgICAgIG1vdmVkQmVmb3JlOiB0cnVlfSk7XG4gICAgfVxuXG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBvYmplY3RzID0gdGhpcy5fZ2V0UmF3T2JqZWN0cyh7b3JkZXJlZDogdHJ1ZX0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIG5leHQ6ICgpID0+IHtcbiAgICAgICAgaWYgKGluZGV4IDwgb2JqZWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICAvLyBUaGlzIGRvdWJsZXMgYXMgYSBjbG9uZSBvcGVyYXRpb24uXG4gICAgICAgICAgbGV0IGVsZW1lbnQgPSB0aGlzLl9wcm9qZWN0aW9uRm4ob2JqZWN0c1tpbmRleCsrXSk7XG5cbiAgICAgICAgICBpZiAodGhpcy5fdHJhbnNmb3JtKVxuICAgICAgICAgICAgZWxlbWVudCA9IHRoaXMuX3RyYW5zZm9ybShlbGVtZW50KTtcblxuICAgICAgICAgIHJldHVybiB7dmFsdWU6IGVsZW1lbnR9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtkb25lOiB0cnVlfTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICBjb25zdCBzeW5jUmVzdWx0ID0gdGhpc1tTeW1ib2wuaXRlcmF0b3JdKCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIGFzeW5jIG5leHQoKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoc3luY1Jlc3VsdC5uZXh0KCkpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQGNhbGxiYWNrIEl0ZXJhdGlvbkNhbGxiYWNrXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBkb2NcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGluZGV4XG4gICAqL1xuICAvKipcbiAgICogQHN1bW1hcnkgQ2FsbCBgY2FsbGJhY2tgIG9uY2UgZm9yIGVhY2ggbWF0Y2hpbmcgZG9jdW1lbnQsIHNlcXVlbnRpYWxseSBhbmRcbiAgICogICAgICAgICAgc3luY2hyb25vdXNseS5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgIGZvckVhY2hcbiAgICogQGluc3RhbmNlXG4gICAqIEBtZW1iZXJPZiBNb25nby5DdXJzb3JcbiAgICogQHBhcmFtIHtJdGVyYXRpb25DYWxsYmFja30gY2FsbGJhY2sgRnVuY3Rpb24gdG8gY2FsbC4gSXQgd2lsbCBiZSBjYWxsZWRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2l0aCB0aHJlZSBhcmd1bWVudHM6IHRoZSBkb2N1bWVudCwgYVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLWJhc2VkIGluZGV4LCBhbmQgPGVtPmN1cnNvcjwvZW0+XG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0c2VsZi5cbiAgICogQHBhcmFtIHtBbnl9IFt0aGlzQXJnXSBBbiBvYmplY3Qgd2hpY2ggd2lsbCBiZSB0aGUgdmFsdWUgb2YgYHRoaXNgIGluc2lkZVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgIGBjYWxsYmFja2AuXG4gICAqL1xuICBmb3JFYWNoKGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgaWYgKHRoaXMucmVhY3RpdmUpIHtcbiAgICAgIHRoaXMuX2RlcGVuZCh7XG4gICAgICAgIGFkZGVkQmVmb3JlOiB0cnVlLFxuICAgICAgICByZW1vdmVkOiB0cnVlLFxuICAgICAgICBjaGFuZ2VkOiB0cnVlLFxuICAgICAgICBtb3ZlZEJlZm9yZTogdHJ1ZX0pO1xuICAgIH1cblxuICAgIHRoaXMuX2dldFJhd09iamVjdHMoe29yZGVyZWQ6IHRydWV9KS5mb3JFYWNoKChlbGVtZW50LCBpKSA9PiB7XG4gICAgICAvLyBUaGlzIGRvdWJsZXMgYXMgYSBjbG9uZSBvcGVyYXRpb24uXG4gICAgICBlbGVtZW50ID0gdGhpcy5fcHJvamVjdGlvbkZuKGVsZW1lbnQpO1xuXG4gICAgICBpZiAodGhpcy5fdHJhbnNmb3JtKSB7XG4gICAgICAgIGVsZW1lbnQgPSB0aGlzLl90cmFuc2Zvcm0oZWxlbWVudCk7XG4gICAgICB9XG5cbiAgICAgIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgZWxlbWVudCwgaSwgdGhpcyk7XG4gICAgfSk7XG4gIH1cblxuICBnZXRUcmFuc2Zvcm0oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3RyYW5zZm9ybTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBNYXAgY2FsbGJhY2sgb3ZlciBhbGwgbWF0Y2hpbmcgZG9jdW1lbnRzLiAgUmV0dXJucyBhbiBBcnJheS5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgbWFwXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbWVtYmVyT2YgTW9uZ28uQ3Vyc29yXG4gICAqIEBwYXJhbSB7SXRlcmF0aW9uQ2FsbGJhY2t9IGNhbGxiYWNrIEZ1bmN0aW9uIHRvIGNhbGwuIEl0IHdpbGwgYmUgY2FsbGVkXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpdGggdGhyZWUgYXJndW1lbnRzOiB0aGUgZG9jdW1lbnQsIGFcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMC1iYXNlZCBpbmRleCwgYW5kIDxlbT5jdXJzb3I8L2VtPlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdHNlbGYuXG4gICAqIEBwYXJhbSB7QW55fSBbdGhpc0FyZ10gQW4gb2JqZWN0IHdoaWNoIHdpbGwgYmUgdGhlIHZhbHVlIG9mIGB0aGlzYCBpbnNpZGVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICBgY2FsbGJhY2tgLlxuICAgKi9cbiAgbWFwKGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICB0aGlzLmZvckVhY2goKGRvYywgaSkgPT4ge1xuICAgICAgcmVzdWx0LnB1c2goY2FsbGJhY2suY2FsbCh0aGlzQXJnLCBkb2MsIGksIHRoaXMpKTtcbiAgICB9KTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBvcHRpb25zIHRvIGNvbnRhaW46XG4gIC8vICAqIGNhbGxiYWNrcyBmb3Igb2JzZXJ2ZSgpOlxuICAvLyAgICAtIGFkZGVkQXQgKGRvY3VtZW50LCBhdEluZGV4KVxuICAvLyAgICAtIGFkZGVkIChkb2N1bWVudClcbiAgLy8gICAgLSBjaGFuZ2VkQXQgKG5ld0RvY3VtZW50LCBvbGREb2N1bWVudCwgYXRJbmRleClcbiAgLy8gICAgLSBjaGFuZ2VkIChuZXdEb2N1bWVudCwgb2xkRG9jdW1lbnQpXG4gIC8vICAgIC0gcmVtb3ZlZEF0IChkb2N1bWVudCwgYXRJbmRleClcbiAgLy8gICAgLSByZW1vdmVkIChkb2N1bWVudClcbiAgLy8gICAgLSBtb3ZlZFRvIChkb2N1bWVudCwgb2xkSW5kZXgsIG5ld0luZGV4KVxuICAvL1xuICAvLyBhdHRyaWJ1dGVzIGF2YWlsYWJsZSBvbiByZXR1cm5lZCBxdWVyeSBoYW5kbGU6XG4gIC8vICAqIHN0b3AoKTogZW5kIHVwZGF0ZXNcbiAgLy8gICogY29sbGVjdGlvbjogdGhlIGNvbGxlY3Rpb24gdGhpcyBxdWVyeSBpcyBxdWVyeWluZ1xuICAvL1xuICAvLyBpZmYgeCBpcyBhIHJldHVybmVkIHF1ZXJ5IGhhbmRsZSwgKHggaW5zdGFuY2VvZlxuICAvLyBMb2NhbENvbGxlY3Rpb24uT2JzZXJ2ZUhhbmRsZSkgaXMgdHJ1ZVxuICAvL1xuICAvLyBpbml0aWFsIHJlc3VsdHMgZGVsaXZlcmVkIHRocm91Z2ggYWRkZWQgY2FsbGJhY2tcbiAgLy8gWFhYIG1heWJlIGNhbGxiYWNrcyBzaG91bGQgdGFrZSBhIGxpc3Qgb2Ygb2JqZWN0cywgdG8gZXhwb3NlIHRyYW5zYWN0aW9ucz9cbiAgLy8gWFhYIG1heWJlIHN1cHBvcnQgZmllbGQgbGltaXRpbmcgKHRvIGxpbWl0IHdoYXQgeW91J3JlIG5vdGlmaWVkIG9uKVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBXYXRjaCBhIHF1ZXJ5LiAgUmVjZWl2ZSBjYWxsYmFja3MgYXMgdGhlIHJlc3VsdCBzZXQgY2hhbmdlcy5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZW1iZXJPZiBNb25nby5DdXJzb3JcbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBjYWxsYmFja3MgRnVuY3Rpb25zIHRvIGNhbGwgdG8gZGVsaXZlciB0aGUgcmVzdWx0IHNldCBhcyBpdFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZXNcbiAgICovXG4gIG9ic2VydmUob3B0aW9ucykge1xuICAgIHJldHVybiBMb2NhbENvbGxlY3Rpb24uX29ic2VydmVGcm9tT2JzZXJ2ZUNoYW5nZXModGhpcywgb3B0aW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgV2F0Y2ggYSBxdWVyeS4gUmVjZWl2ZSBjYWxsYmFja3MgYXMgdGhlIHJlc3VsdCBzZXQgY2hhbmdlcy4gT25seVxuICAgKiAgICAgICAgICB0aGUgZGlmZmVyZW5jZXMgYmV0d2VlbiB0aGUgb2xkIGFuZCBuZXcgZG9jdW1lbnRzIGFyZSBwYXNzZWQgdG9cbiAgICogICAgICAgICAgdGhlIGNhbGxiYWNrcy5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZW1iZXJPZiBNb25nby5DdXJzb3JcbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBjYWxsYmFja3MgRnVuY3Rpb25zIHRvIGNhbGwgdG8gZGVsaXZlciB0aGUgcmVzdWx0IHNldCBhcyBpdFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZXNcbiAgICovXG4gIG9ic2VydmVDaGFuZ2VzKG9wdGlvbnMpIHtcbiAgICBjb25zdCBvcmRlcmVkID0gTG9jYWxDb2xsZWN0aW9uLl9vYnNlcnZlQ2hhbmdlc0NhbGxiYWNrc0FyZU9yZGVyZWQob3B0aW9ucyk7XG5cbiAgICAvLyB0aGVyZSBhcmUgc2V2ZXJhbCBwbGFjZXMgdGhhdCBhc3N1bWUgeW91IGFyZW4ndCBjb21iaW5pbmcgc2tpcC9saW1pdCB3aXRoXG4gICAgLy8gdW5vcmRlcmVkIG9ic2VydmUuICBlZywgdXBkYXRlJ3MgRUpTT04uY2xvbmUsIGFuZCB0aGUgXCJ0aGVyZSBhcmUgc2V2ZXJhbFwiXG4gICAgLy8gY29tbWVudCBpbiBfbW9kaWZ5QW5kTm90aWZ5XG4gICAgLy8gWFhYIGFsbG93IHNraXAvbGltaXQgd2l0aCB1bm9yZGVyZWQgb2JzZXJ2ZVxuICAgIGlmICghb3B0aW9ucy5fYWxsb3dfdW5vcmRlcmVkICYmICFvcmRlcmVkICYmICh0aGlzLnNraXAgfHwgdGhpcy5saW1pdCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgXCJNdXN0IHVzZSBhbiBvcmRlcmVkIG9ic2VydmUgd2l0aCBza2lwIG9yIGxpbWl0IChpLmUuICdhZGRlZEJlZm9yZScgXCIgK1xuICAgICAgICAgIFwiZm9yIG9ic2VydmVDaGFuZ2VzIG9yICdhZGRlZEF0JyBmb3Igb2JzZXJ2ZSwgaW5zdGVhZCBvZiAnYWRkZWQnKS5cIlxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5maWVsZHMgJiYgKHRoaXMuZmllbGRzLl9pZCA9PT0gMCB8fCB0aGlzLmZpZWxkcy5faWQgPT09IGZhbHNlKSkge1xuICAgICAgdGhyb3cgRXJyb3IoXCJZb3UgbWF5IG5vdCBvYnNlcnZlIGEgY3Vyc29yIHdpdGgge2ZpZWxkczoge19pZDogMH19XCIpO1xuICAgIH1cblxuICAgIGNvbnN0IGRpc3RhbmNlcyA9XG4gICAgICB0aGlzLm1hdGNoZXIuaGFzR2VvUXVlcnkoKSAmJiBvcmRlcmVkICYmIG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwKCk7XG5cbiAgICBjb25zdCBxdWVyeSA9IHtcbiAgICAgIGN1cnNvcjogdGhpcyxcbiAgICAgIGRpcnR5OiBmYWxzZSxcbiAgICAgIGRpc3RhbmNlcyxcbiAgICAgIG1hdGNoZXI6IHRoaXMubWF0Y2hlciwgLy8gbm90IGZhc3QgcGF0aGVkXG4gICAgICBvcmRlcmVkLFxuICAgICAgcHJvamVjdGlvbkZuOiB0aGlzLl9wcm9qZWN0aW9uRm4sXG4gICAgICByZXN1bHRzU25hcHNob3Q6IG51bGwsXG4gICAgICBzb3J0ZXI6IG9yZGVyZWQgJiYgdGhpcy5zb3J0ZXIsXG4gICAgfTtcblxuICAgIGxldCBxaWQ7XG5cbiAgICAvLyBOb24tcmVhY3RpdmUgcXVlcmllcyBjYWxsIGFkZGVkW0JlZm9yZV0gYW5kIHRoZW4gbmV2ZXIgY2FsbCBhbnl0aGluZ1xuICAgIC8vIGVsc2UuXG4gICAgaWYgKHRoaXMucmVhY3RpdmUpIHtcbiAgICAgIHFpZCA9IHRoaXMuY29sbGVjdGlvbi5uZXh0X3FpZCsrO1xuICAgICAgdGhpcy5jb2xsZWN0aW9uLnF1ZXJpZXNbcWlkXSA9IHF1ZXJ5O1xuICAgIH1cblxuICAgIHF1ZXJ5LnJlc3VsdHMgPSB0aGlzLl9nZXRSYXdPYmplY3RzKHtcbiAgICAgIG9yZGVyZWQsXG4gICAgICBkaXN0YW5jZXM6IHF1ZXJ5LmRpc3RhbmNlcyxcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmNvbGxlY3Rpb24ucGF1c2VkKSB7XG4gICAgICBxdWVyeS5yZXN1bHRzU25hcHNob3QgPSBvcmRlcmVkID8gW10gOiBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcCgpO1xuICAgIH1cblxuICAgIC8vIHdyYXAgY2FsbGJhY2tzIHdlIHdlcmUgcGFzc2VkLiBjYWxsYmFja3Mgb25seSBmaXJlIHdoZW4gbm90IHBhdXNlZCBhbmRcbiAgICAvLyBhcmUgbmV2ZXIgdW5kZWZpbmVkXG4gICAgLy8gRmlsdGVycyBvdXQgYmxhY2tsaXN0ZWQgZmllbGRzIGFjY29yZGluZyB0byBjdXJzb3IncyBwcm9qZWN0aW9uLlxuICAgIC8vIFhYWCB3cm9uZyBwbGFjZSBmb3IgdGhpcz9cblxuICAgIC8vIGZ1cnRoZXJtb3JlLCBjYWxsYmFja3MgZW5xdWV1ZSB1bnRpbCB0aGUgb3BlcmF0aW9uIHdlJ3JlIHdvcmtpbmcgb24gaXNcbiAgICAvLyBkb25lLlxuICAgIGNvbnN0IHdyYXBDYWxsYmFjayA9IChmbikgPT4ge1xuICAgICAgaWYgKCFmbikge1xuICAgICAgICByZXR1cm4gKCkgPT4ge307XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgICByZXR1cm4gZnVuY3Rpb24gKC8qIGFyZ3MqLykge1xuICAgICAgICBpZiAoc2VsZi5jb2xsZWN0aW9uLnBhdXNlZCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFyZ3MgPSBhcmd1bWVudHM7XG5cbiAgICAgICAgc2VsZi5jb2xsZWN0aW9uLl9vYnNlcnZlUXVldWUucXVldWVUYXNrKCgpID0+IHtcbiAgICAgICAgICBmbi5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgIH07XG5cbiAgICBxdWVyeS5hZGRlZCA9IHdyYXBDYWxsYmFjayhvcHRpb25zLmFkZGVkKTtcbiAgICBxdWVyeS5jaGFuZ2VkID0gd3JhcENhbGxiYWNrKG9wdGlvbnMuY2hhbmdlZCk7XG4gICAgcXVlcnkucmVtb3ZlZCA9IHdyYXBDYWxsYmFjayhvcHRpb25zLnJlbW92ZWQpO1xuXG4gICAgaWYgKG9yZGVyZWQpIHtcbiAgICAgIHF1ZXJ5LmFkZGVkQmVmb3JlID0gd3JhcENhbGxiYWNrKG9wdGlvbnMuYWRkZWRCZWZvcmUpO1xuICAgICAgcXVlcnkubW92ZWRCZWZvcmUgPSB3cmFwQ2FsbGJhY2sob3B0aW9ucy5tb3ZlZEJlZm9yZSk7XG4gICAgfVxuXG4gICAgaWYgKCFvcHRpb25zLl9zdXBwcmVzc19pbml0aWFsICYmICF0aGlzLmNvbGxlY3Rpb24ucGF1c2VkKSB7XG4gICAgICBjb25zdCBoYW5kbGVyID0gKGRvYykgPT4ge1xuICAgICAgICBjb25zdCBmaWVsZHMgPSBFSlNPTi5jbG9uZShkb2MpO1xuXG4gICAgICAgIGRlbGV0ZSBmaWVsZHMuX2lkO1xuXG4gICAgICAgIGlmIChvcmRlcmVkKSB7XG4gICAgICAgICAgcXVlcnkuYWRkZWRCZWZvcmUoZG9jLl9pZCwgdGhpcy5fcHJvamVjdGlvbkZuKGZpZWxkcyksIG51bGwpO1xuICAgICAgICB9XG5cbiAgICAgICAgcXVlcnkuYWRkZWQoZG9jLl9pZCwgdGhpcy5fcHJvamVjdGlvbkZuKGZpZWxkcykpO1xuICAgICAgfTtcbiAgICAgIC8vIGl0IG1lYW5zIGl0J3MganVzdCBhbiBhcnJheVxuICAgICAgaWYgKHF1ZXJ5LnJlc3VsdHMubGVuZ3RoKSB7XG4gICAgICAgIGZvciAoY29uc3QgZG9jIG9mIHF1ZXJ5LnJlc3VsdHMpIHtcbiAgICAgICAgICBoYW5kbGVyKGRvYyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIGl0IG1lYW5zIGl0J3MgYW4gaWQgbWFwXG4gICAgICBpZiAocXVlcnkucmVzdWx0cz8uc2l6ZT8uKCkpIHtcbiAgICAgICAgcXVlcnkucmVzdWx0cy5mb3JFYWNoKGhhbmRsZXIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGhhbmRsZSA9IE9iamVjdC5hc3NpZ24obmV3IExvY2FsQ29sbGVjdGlvbi5PYnNlcnZlSGFuZGxlKCksIHtcbiAgICAgIGNvbGxlY3Rpb246IHRoaXMuY29sbGVjdGlvbixcbiAgICAgIHN0b3A6ICgpID0+IHtcbiAgICAgICAgaWYgKHRoaXMucmVhY3RpdmUpIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5jb2xsZWN0aW9uLnF1ZXJpZXNbcWlkXTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGlzUmVhZHk6IGZhbHNlLFxuICAgICAgaXNSZWFkeVByb21pc2U6IG51bGwsXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5yZWFjdGl2ZSAmJiBUcmFja2VyLmFjdGl2ZSkge1xuICAgICAgLy8gWFhYIGluIG1hbnkgY2FzZXMsIHRoZSBzYW1lIG9ic2VydmUgd2lsbCBiZSByZWNyZWF0ZWQgd2hlblxuICAgICAgLy8gdGhlIGN1cnJlbnQgYXV0b3J1biBpcyByZXJ1bi4gIHdlIGNvdWxkIHNhdmUgd29yayBieVxuICAgICAgLy8gbGV0dGluZyBpdCBsaW5nZXIgYWNyb3NzIHJlcnVuIGFuZCBwb3RlbnRpYWxseSBnZXRcbiAgICAgIC8vIHJlcHVycG9zZWQgaWYgdGhlIHNhbWUgb2JzZXJ2ZSBpcyBwZXJmb3JtZWQsIHVzaW5nIGxvZ2ljXG4gICAgICAvLyBzaW1pbGFyIHRvIHRoYXQgb2YgTWV0ZW9yLnN1YnNjcmliZS5cbiAgICAgIFRyYWNrZXIub25JbnZhbGlkYXRlKCgpID0+IHtcbiAgICAgICAgaGFuZGxlLnN0b3AoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIHJ1biB0aGUgb2JzZXJ2ZSBjYWxsYmFja3MgcmVzdWx0aW5nIGZyb20gdGhlIGluaXRpYWwgY29udGVudHNcbiAgICAvLyBiZWZvcmUgd2UgbGVhdmUgdGhlIG9ic2VydmUuXG4gICAgY29uc3QgZHJhaW5SZXN1bHQgPSB0aGlzLmNvbGxlY3Rpb24uX29ic2VydmVRdWV1ZS5kcmFpbigpO1xuXG4gICAgaWYgKGRyYWluUmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgaGFuZGxlLmlzUmVhZHlQcm9taXNlID0gZHJhaW5SZXN1bHQ7XG4gICAgICBkcmFpblJlc3VsdC50aGVuKCgpID0+IChoYW5kbGUuaXNSZWFkeSA9IHRydWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGFuZGxlLmlzUmVhZHkgPSB0cnVlO1xuICAgICAgaGFuZGxlLmlzUmVhZHlQcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGhhbmRsZTtcbiAgfVxuXG4gIC8vIFhYWCBNYXliZSB3ZSBuZWVkIGEgdmVyc2lvbiBvZiBvYnNlcnZlIHRoYXQganVzdCBjYWxscyBhIGNhbGxiYWNrIGlmXG4gIC8vIGFueXRoaW5nIGNoYW5nZWQuXG4gIF9kZXBlbmQoY2hhbmdlcnMsIF9hbGxvd191bm9yZGVyZWQpIHtcbiAgICBpZiAoVHJhY2tlci5hY3RpdmUpIHtcbiAgICAgIGNvbnN0IGRlcGVuZGVuY3kgPSBuZXcgVHJhY2tlci5EZXBlbmRlbmN5O1xuICAgICAgY29uc3Qgbm90aWZ5ID0gZGVwZW5kZW5jeS5jaGFuZ2VkLmJpbmQoZGVwZW5kZW5jeSk7XG5cbiAgICAgIGRlcGVuZGVuY3kuZGVwZW5kKCk7XG5cbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7X2FsbG93X3Vub3JkZXJlZCwgX3N1cHByZXNzX2luaXRpYWw6IHRydWV9O1xuXG4gICAgICBbJ2FkZGVkJywgJ2FkZGVkQmVmb3JlJywgJ2NoYW5nZWQnLCAnbW92ZWRCZWZvcmUnLCAncmVtb3ZlZCddXG4gICAgICAgIC5mb3JFYWNoKGZuID0+IHtcbiAgICAgICAgICBpZiAoY2hhbmdlcnNbZm5dKSB7XG4gICAgICAgICAgICBvcHRpb25zW2ZuXSA9IG5vdGlmeTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAvLyBvYnNlcnZlQ2hhbmdlcyB3aWxsIHN0b3AoKSB3aGVuIHRoaXMgY29tcHV0YXRpb24gaXMgaW52YWxpZGF0ZWRcbiAgICAgIHRoaXMub2JzZXJ2ZUNoYW5nZXMob3B0aW9ucyk7XG4gICAgfVxuICB9XG5cbiAgX2dldENvbGxlY3Rpb25OYW1lKCkge1xuICAgIHJldHVybiB0aGlzLmNvbGxlY3Rpb24ubmFtZTtcbiAgfVxuXG4gIC8vIFJldHVybnMgYSBjb2xsZWN0aW9uIG9mIG1hdGNoaW5nIG9iamVjdHMsIGJ1dCBkb2Vzbid0IGRlZXAgY29weSB0aGVtLlxuICAvL1xuICAvLyBJZiBvcmRlcmVkIGlzIHNldCwgcmV0dXJucyBhIHNvcnRlZCBhcnJheSwgcmVzcGVjdGluZyBzb3J0ZXIsIHNraXAsIGFuZFxuICAvLyBsaW1pdCBwcm9wZXJ0aWVzIG9mIHRoZSBxdWVyeSBwcm92aWRlZCB0aGF0IG9wdGlvbnMuYXBwbHlTa2lwTGltaXQgaXNcbiAgLy8gbm90IHNldCB0byBmYWxzZSAoIzEyMDEpLiBJZiBzb3J0ZXIgaXMgZmFsc2V5LCBubyBzb3J0IC0tIHlvdSBnZXQgdGhlXG4gIC8vIG5hdHVyYWwgb3JkZXIuXG4gIC8vXG4gIC8vIElmIG9yZGVyZWQgaXMgbm90IHNldCwgcmV0dXJucyBhbiBvYmplY3QgbWFwcGluZyBmcm9tIElEIHRvIGRvYyAoc29ydGVyLFxuICAvLyBza2lwIGFuZCBsaW1pdCBzaG91bGQgbm90IGJlIHNldCkuXG4gIC8vXG4gIC8vIElmIG9yZGVyZWQgaXMgc2V0IGFuZCB0aGlzIGN1cnNvciBpcyBhICRuZWFyIGdlb3F1ZXJ5LCB0aGVuIHRoaXMgZnVuY3Rpb25cbiAgLy8gd2lsbCB1c2UgYW4gX0lkTWFwIHRvIHRyYWNrIGVhY2ggZGlzdGFuY2UgZnJvbSB0aGUgJG5lYXIgYXJndW1lbnQgcG9pbnQgaW5cbiAgLy8gb3JkZXIgdG8gdXNlIGl0IGFzIGEgc29ydCBrZXkuIElmIGFuIF9JZE1hcCBpcyBwYXNzZWQgaW4gdGhlICdkaXN0YW5jZXMnXG4gIC8vIGFyZ3VtZW50LCB0aGlzIGZ1bmN0aW9uIHdpbGwgY2xlYXIgaXQgYW5kIHVzZSBpdCBmb3IgdGhpcyBwdXJwb3NlXG4gIC8vIChvdGhlcndpc2UgaXQgd2lsbCBqdXN0IGNyZWF0ZSBpdHMgb3duIF9JZE1hcCkuIFRoZSBvYnNlcnZlQ2hhbmdlc1xuICAvLyBpbXBsZW1lbnRhdGlvbiB1c2VzIHRoaXMgdG8gcmVtZW1iZXIgdGhlIGRpc3RhbmNlcyBhZnRlciB0aGlzIGZ1bmN0aW9uXG4gIC8vIHJldHVybnMuXG4gIF9nZXRSYXdPYmplY3RzKG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIEJ5IGRlZmF1bHQgdGhpcyBtZXRob2Qgd2lsbCByZXNwZWN0IHNraXAgYW5kIGxpbWl0IGJlY2F1c2UgLmZldGNoKCksXG4gICAgLy8gLmZvckVhY2goKSBldGMuLi4gZXhwZWN0IHRoaXMgYmVoYXZpb3VyLiBJdCBjYW4gYmUgZm9yY2VkIHRvIGlnbm9yZVxuICAgIC8vIHNraXAgYW5kIGxpbWl0IGJ5IHNldHRpbmcgYXBwbHlTa2lwTGltaXQgdG8gZmFsc2UgKC5jb3VudCgpIGRvZXMgdGhpcyxcbiAgICAvLyBmb3IgZXhhbXBsZSlcbiAgICBjb25zdCBhcHBseVNraXBMaW1pdCA9IG9wdGlvbnMuYXBwbHlTa2lwTGltaXQgIT09IGZhbHNlO1xuXG4gICAgLy8gWFhYIHVzZSBPcmRlcmVkRGljdCBpbnN0ZWFkIG9mIGFycmF5LCBhbmQgbWFrZSBJZE1hcCBhbmQgT3JkZXJlZERpY3RcbiAgICAvLyBjb21wYXRpYmxlXG4gICAgY29uc3QgcmVzdWx0cyA9IG9wdGlvbnMub3JkZXJlZCA/IFtdIDogbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG5cbiAgICAvLyBmYXN0IHBhdGggZm9yIHNpbmdsZSBJRCB2YWx1ZVxuICAgIGlmICh0aGlzLl9zZWxlY3RvcklkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIElmIHlvdSBoYXZlIG5vbi16ZXJvIHNraXAgYW5kIGFzayBmb3IgYSBzaW5nbGUgaWQsIHlvdSBnZXQgbm90aGluZy5cbiAgICAgIC8vIFRoaXMgaXMgc28gaXQgbWF0Y2hlcyB0aGUgYmVoYXZpb3Igb2YgdGhlICd7X2lkOiBmb299JyBwYXRoLlxuICAgICAgaWYgKGFwcGx5U2tpcExpbWl0ICYmIHRoaXMuc2tpcCkge1xuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc2VsZWN0ZWREb2MgPSB0aGlzLmNvbGxlY3Rpb24uX2RvY3MuZ2V0KHRoaXMuX3NlbGVjdG9ySWQpO1xuICAgICAgaWYgKHNlbGVjdGVkRG9jKSB7XG4gICAgICAgIGlmIChvcHRpb25zLm9yZGVyZWQpIHtcbiAgICAgICAgICByZXN1bHRzLnB1c2goc2VsZWN0ZWREb2MpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3VsdHMuc2V0KHRoaXMuX3NlbGVjdG9ySWQsIHNlbGVjdGVkRG9jKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgLy8gc2xvdyBwYXRoIGZvciBhcmJpdHJhcnkgc2VsZWN0b3IsIHNvcnQsIHNraXAsIGxpbWl0XG5cbiAgICAvLyBpbiB0aGUgb2JzZXJ2ZUNoYW5nZXMgY2FzZSwgZGlzdGFuY2VzIGlzIGFjdHVhbGx5IHBhcnQgb2YgdGhlIFwicXVlcnlcIlxuICAgIC8vIChpZSwgbGl2ZSByZXN1bHRzIHNldCkgb2JqZWN0LiAgaW4gb3RoZXIgY2FzZXMsIGRpc3RhbmNlcyBpcyBvbmx5IHVzZWRcbiAgICAvLyBpbnNpZGUgdGhpcyBmdW5jdGlvbi5cbiAgICBsZXQgZGlzdGFuY2VzO1xuICAgIGlmICh0aGlzLm1hdGNoZXIuaGFzR2VvUXVlcnkoKSAmJiBvcHRpb25zLm9yZGVyZWQpIHtcbiAgICAgIGlmIChvcHRpb25zLmRpc3RhbmNlcykge1xuICAgICAgICBkaXN0YW5jZXMgPSBvcHRpb25zLmRpc3RhbmNlcztcbiAgICAgICAgZGlzdGFuY2VzLmNsZWFyKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkaXN0YW5jZXMgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcCgpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbGxlY3Rpb24uX2RvY3MuZm9yRWFjaCgoZG9jLCBpZCkgPT4ge1xuICAgICAgY29uc3QgbWF0Y2hSZXN1bHQgPSB0aGlzLm1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKGRvYyk7XG4gICAgICBpZiAobWF0Y2hSZXN1bHQucmVzdWx0KSB7XG4gICAgICAgIGlmIChvcHRpb25zLm9yZGVyZWQpIHtcbiAgICAgICAgICByZXN1bHRzLnB1c2goZG9jKTtcblxuICAgICAgICAgIGlmIChkaXN0YW5jZXMgJiYgbWF0Y2hSZXN1bHQuZGlzdGFuY2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGlzdGFuY2VzLnNldChpZCwgbWF0Y2hSZXN1bHQuZGlzdGFuY2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHRzLnNldChpZCwgZG9jKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBPdmVycmlkZSB0byBlbnN1cmUgYWxsIGRvY3MgYXJlIG1hdGNoZWQgaWYgaWdub3Jpbmcgc2tpcCAmIGxpbWl0XG4gICAgICBpZiAoIWFwcGx5U2tpcExpbWl0KSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBGYXN0IHBhdGggZm9yIGxpbWl0ZWQgdW5zb3J0ZWQgcXVlcmllcy5cbiAgICAgIC8vIFhYWCAnbGVuZ3RoJyBjaGVjayBoZXJlIHNlZW1zIHdyb25nIGZvciBvcmRlcmVkXG4gICAgICByZXR1cm4gKFxuICAgICAgICAhdGhpcy5saW1pdCB8fFxuICAgICAgICB0aGlzLnNraXAgfHxcbiAgICAgICAgdGhpcy5zb3J0ZXIgfHxcbiAgICAgICAgcmVzdWx0cy5sZW5ndGggIT09IHRoaXMubGltaXRcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICBpZiAoIW9wdGlvbnMub3JkZXJlZCkge1xuICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc29ydGVyKSB7XG4gICAgICByZXN1bHRzLnNvcnQodGhpcy5zb3J0ZXIuZ2V0Q29tcGFyYXRvcih7ZGlzdGFuY2VzfSkpO1xuICAgIH1cblxuICAgIC8vIFJldHVybiB0aGUgZnVsbCBzZXQgb2YgcmVzdWx0cyBpZiB0aGVyZSBpcyBubyBza2lwIG9yIGxpbWl0IG9yIGlmIHdlJ3JlXG4gICAgLy8gaWdub3JpbmcgdGhlbVxuICAgIGlmICghYXBwbHlTa2lwTGltaXQgfHwgKCF0aGlzLmxpbWl0ICYmICF0aGlzLnNraXApKSB7XG4gICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0cy5zbGljZShcbiAgICAgIHRoaXMuc2tpcCxcbiAgICAgIHRoaXMubGltaXQgPyB0aGlzLmxpbWl0ICsgdGhpcy5za2lwIDogcmVzdWx0cy5sZW5ndGhcbiAgICApO1xuICB9XG5cbiAgX3B1Ymxpc2hDdXJzb3Ioc3Vic2NyaXB0aW9uKSB7XG4gICAgLy8gWFhYIG1pbmltb25nbyBzaG91bGQgbm90IGRlcGVuZCBvbiBtb25nby1saXZlZGF0YSFcbiAgICBpZiAoIVBhY2thZ2UubW9uZ28pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ0NhblxcJ3QgcHVibGlzaCBmcm9tIE1pbmltb25nbyB3aXRob3V0IHRoZSBgbW9uZ29gIHBhY2thZ2UuJ1xuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuY29sbGVjdGlvbi5uYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdDYW5cXCd0IHB1Ymxpc2ggYSBjdXJzb3IgZnJvbSBhIGNvbGxlY3Rpb24gd2l0aG91dCBhIG5hbWUuJ1xuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gUGFja2FnZS5tb25nby5Nb25nby5Db2xsZWN0aW9uLl9wdWJsaXNoQ3Vyc29yKFxuICAgICAgdGhpcyxcbiAgICAgIHN1YnNjcmlwdGlvbixcbiAgICAgIHRoaXMuY29sbGVjdGlvbi5uYW1lXG4gICAgKTtcbiAgfVxufVxuXG4vLyBJbXBsZW1lbnRzIGFzeW5jIHZlcnNpb24gb2YgY3Vyc29yIG1ldGhvZHMgdG8ga2VlcCBjb2xsZWN0aW9ucyBpc29tb3JwaGljXG5BU1lOQ19DVVJTT1JfTUVUSE9EUy5mb3JFYWNoKG1ldGhvZCA9PiB7XG4gIGNvbnN0IGFzeW5jTmFtZSA9IGdldEFzeW5jTWV0aG9kTmFtZShtZXRob2QpO1xuICBDdXJzb3IucHJvdG90eXBlW2FzeW5jTmFtZV0gPSBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpc1ttZXRob2RdLmFwcGx5KHRoaXMsIGFyZ3MpKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICB9XG4gIH07XG59KTtcbiIsImltcG9ydCBDdXJzb3IgZnJvbSAnLi9jdXJzb3IuanMnO1xuaW1wb3J0IE9ic2VydmVIYW5kbGUgZnJvbSAnLi9vYnNlcnZlX2hhbmRsZS5qcyc7XG5pbXBvcnQge1xuICBoYXNPd24sXG4gIGlzSW5kZXhhYmxlLFxuICBpc051bWVyaWNLZXksXG4gIGlzT3BlcmF0b3JPYmplY3QsXG4gIHBvcHVsYXRlRG9jdW1lbnRXaXRoUXVlcnlGaWVsZHMsXG4gIHByb2plY3Rpb25EZXRhaWxzLFxufSBmcm9tICcuL2NvbW1vbi5qcyc7XG5cbmltcG9ydCB7IGdldEFzeW5jTWV0aG9kTmFtZSB9IGZyb20gJy4vY29uc3RhbnRzJztcblxuLy8gWFhYIHR5cGUgY2hlY2tpbmcgb24gc2VsZWN0b3JzIChncmFjZWZ1bCBlcnJvciBpZiBtYWxmb3JtZWQpXG5cbi8vIExvY2FsQ29sbGVjdGlvbjogYSBzZXQgb2YgZG9jdW1lbnRzIHRoYXQgc3VwcG9ydHMgcXVlcmllcyBhbmQgbW9kaWZpZXJzLlxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTG9jYWxDb2xsZWN0aW9uIHtcbiAgY29uc3RydWN0b3IobmFtZSkge1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgLy8gX2lkIC0+IGRvY3VtZW50IChhbHNvIGNvbnRhaW5pbmcgaWQpXG4gICAgdGhpcy5fZG9jcyA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuXG4gICAgdGhpcy5fb2JzZXJ2ZVF1ZXVlID0gTWV0ZW9yLmlzQ2xpZW50XG4gICAgICA/IG5ldyBNZXRlb3IuX1N5bmNocm9ub3VzUXVldWUoKVxuICAgICAgOiBuZXcgTWV0ZW9yLl9Bc3luY2hyb25vdXNRdWV1ZSgpO1xuXG4gICAgdGhpcy5uZXh0X3FpZCA9IDE7IC8vIGxpdmUgcXVlcnkgaWQgZ2VuZXJhdG9yXG5cbiAgICAvLyBxaWQgLT4gbGl2ZSBxdWVyeSBvYmplY3QuIGtleXM6XG4gICAgLy8gIG9yZGVyZWQ6IGJvb2wuIG9yZGVyZWQgcXVlcmllcyBoYXZlIGFkZGVkQmVmb3JlL21vdmVkQmVmb3JlIGNhbGxiYWNrcy5cbiAgICAvLyAgcmVzdWx0czogYXJyYXkgKG9yZGVyZWQpIG9yIG9iamVjdCAodW5vcmRlcmVkKSBvZiBjdXJyZW50IHJlc3VsdHNcbiAgICAvLyAgICAoYWxpYXNlZCB3aXRoIHRoaXMuX2RvY3MhKVxuICAgIC8vICByZXN1bHRzU25hcHNob3Q6IHNuYXBzaG90IG9mIHJlc3VsdHMuIG51bGwgaWYgbm90IHBhdXNlZC5cbiAgICAvLyAgY3Vyc29yOiBDdXJzb3Igb2JqZWN0IGZvciB0aGUgcXVlcnkuXG4gICAgLy8gIHNlbGVjdG9yLCBzb3J0ZXIsIChjYWxsYmFja3MpOiBmdW5jdGlvbnNcbiAgICB0aGlzLnF1ZXJpZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgLy8gbnVsbCBpZiBub3Qgc2F2aW5nIG9yaWdpbmFsczsgYW4gSWRNYXAgZnJvbSBpZCB0byBvcmlnaW5hbCBkb2N1bWVudCB2YWx1ZVxuICAgIC8vIGlmIHNhdmluZyBvcmlnaW5hbHMuIFNlZSBjb21tZW50cyBiZWZvcmUgc2F2ZU9yaWdpbmFscygpLlxuICAgIHRoaXMuX3NhdmVkT3JpZ2luYWxzID0gbnVsbDtcblxuICAgIC8vIFRydWUgd2hlbiBvYnNlcnZlcnMgYXJlIHBhdXNlZCBhbmQgd2Ugc2hvdWxkIG5vdCBzZW5kIGNhbGxiYWNrcy5cbiAgICB0aGlzLnBhdXNlZCA9IGZhbHNlO1xuICB9XG5cbiAgY291bnREb2N1bWVudHMoc2VsZWN0b3IsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gdGhpcy5maW5kKHNlbGVjdG9yID8/IHt9LCBvcHRpb25zKS5jb3VudEFzeW5jKCk7XG4gIH1cblxuICBlc3RpbWF0ZWREb2N1bWVudENvdW50KG9wdGlvbnMpIHtcbiAgICByZXR1cm4gdGhpcy5maW5kKHt9LCBvcHRpb25zKS5jb3VudEFzeW5jKCk7XG4gIH1cblxuICAvLyBvcHRpb25zIG1heSBpbmNsdWRlIHNvcnQsIHNraXAsIGxpbWl0LCByZWFjdGl2ZVxuICAvLyBzb3J0IG1heSBiZSBhbnkgb2YgdGhlc2UgZm9ybXM6XG4gIC8vICAgICB7YTogMSwgYjogLTF9XG4gIC8vICAgICBbW1wiYVwiLCBcImFzY1wiXSwgW1wiYlwiLCBcImRlc2NcIl1dXG4gIC8vICAgICBbXCJhXCIsIFtcImJcIiwgXCJkZXNjXCJdXVxuICAvLyAgIChpbiB0aGUgZmlyc3QgZm9ybSB5b3UncmUgYmVob2xkZW4gdG8ga2V5IGVudW1lcmF0aW9uIG9yZGVyIGluXG4gIC8vICAgeW91ciBqYXZhc2NyaXB0IFZNKVxuICAvL1xuICAvLyByZWFjdGl2ZTogaWYgZ2l2ZW4sIGFuZCBmYWxzZSwgZG9uJ3QgcmVnaXN0ZXIgd2l0aCBUcmFja2VyIChkZWZhdWx0XG4gIC8vIGlzIHRydWUpXG4gIC8vXG4gIC8vIFhYWCBwb3NzaWJseSBzaG91bGQgc3VwcG9ydCByZXRyaWV2aW5nIGEgc3Vic2V0IG9mIGZpZWxkcz8gYW5kXG4gIC8vIGhhdmUgaXQgYmUgYSBoaW50IChpZ25vcmVkIG9uIHRoZSBjbGllbnQsIHdoZW4gbm90IGNvcHlpbmcgdGhlXG4gIC8vIGRvYz8pXG4gIC8vXG4gIC8vIFhYWCBzb3J0IGRvZXMgbm90IHlldCBzdXBwb3J0IHN1YmtleXMgKCdhLmInKSAuLiBmaXggdGhhdCFcbiAgLy8gWFhYIGFkZCBvbmUgbW9yZSBzb3J0IGZvcm06IFwia2V5XCJcbiAgLy8gWFhYIHRlc3RzXG4gIGZpbmQoc2VsZWN0b3IsIG9wdGlvbnMpIHtcbiAgICAvLyBkZWZhdWx0IHN5bnRheCBmb3IgZXZlcnl0aGluZyBpcyB0byBvbWl0IHRoZSBzZWxlY3RvciBhcmd1bWVudC5cbiAgICAvLyBidXQgaWYgc2VsZWN0b3IgaXMgZXhwbGljaXRseSBwYXNzZWQgaW4gYXMgZmFsc2Ugb3IgdW5kZWZpbmVkLCB3ZVxuICAgIC8vIHdhbnQgYSBzZWxlY3RvciB0aGF0IG1hdGNoZXMgbm90aGluZy5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgc2VsZWN0b3IgPSB7fTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IExvY2FsQ29sbGVjdGlvbi5DdXJzb3IodGhpcywgc2VsZWN0b3IsIG9wdGlvbnMpO1xuICB9XG5cbiAgZmluZE9uZShzZWxlY3Rvciwgb3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHNlbGVjdG9yID0ge307XG4gICAgfVxuXG4gICAgLy8gTk9URTogYnkgc2V0dGluZyBsaW1pdCAxIGhlcmUsIHdlIGVuZCB1cCB1c2luZyB2ZXJ5IGluZWZmaWNpZW50XG4gICAgLy8gY29kZSB0aGF0IHJlY29tcHV0ZXMgdGhlIHdob2xlIHF1ZXJ5IG9uIGVhY2ggdXBkYXRlLiBUaGUgdXBzaWRlIGlzXG4gICAgLy8gdGhhdCB3aGVuIHlvdSByZWFjdGl2ZWx5IGRlcGVuZCBvbiBhIGZpbmRPbmUgeW91IG9ubHkgZ2V0XG4gICAgLy8gaW52YWxpZGF0ZWQgd2hlbiB0aGUgZm91bmQgb2JqZWN0IGNoYW5nZXMsIG5vdCBhbnkgb2JqZWN0IGluIHRoZVxuICAgIC8vIGNvbGxlY3Rpb24uIE1vc3QgZmluZE9uZSB3aWxsIGJlIGJ5IGlkLCB3aGljaCBoYXMgYSBmYXN0IHBhdGgsIHNvXG4gICAgLy8gdGhpcyBtaWdodCBub3QgYmUgYSBiaWcgZGVhbC4gSW4gbW9zdCBjYXNlcywgaW52YWxpZGF0aW9uIGNhdXNlc1xuICAgIC8vIHRoZSBjYWxsZWQgdG8gcmUtcXVlcnkgYW55d2F5LCBzbyB0aGlzIHNob3VsZCBiZSBhIG5ldCBwZXJmb3JtYW5jZVxuICAgIC8vIGltcHJvdmVtZW50LlxuICAgIG9wdGlvbnMubGltaXQgPSAxO1xuXG4gICAgcmV0dXJuIHRoaXMuZmluZChzZWxlY3Rvciwgb3B0aW9ucykuZmV0Y2goKVswXTtcbiAgfVxuICBhc3luYyBmaW5kT25lQXN5bmMoc2VsZWN0b3IsIG9wdGlvbnMgPSB7fSkge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBzZWxlY3RvciA9IHt9O1xuICAgIH1cbiAgICBvcHRpb25zLmxpbWl0ID0gMTtcbiAgICByZXR1cm4gKGF3YWl0IHRoaXMuZmluZChzZWxlY3Rvciwgb3B0aW9ucykuZmV0Y2hBc3luYygpKVswXTtcbiAgfVxuICBwcmVwYXJlSW5zZXJ0KGRvYykge1xuICAgIGFzc2VydEhhc1ZhbGlkRmllbGROYW1lcyhkb2MpO1xuXG4gICAgLy8gaWYgeW91IHJlYWxseSB3YW50IHRvIHVzZSBPYmplY3RJRHMsIHNldCB0aGlzIGdsb2JhbC5cbiAgICAvLyBNb25nby5Db2xsZWN0aW9uIHNwZWNpZmllcyBpdHMgb3duIGlkcyBhbmQgZG9lcyBub3QgdXNlIHRoaXMgY29kZS5cbiAgICBpZiAoIWhhc093bi5jYWxsKGRvYywgJ19pZCcpKSB7XG4gICAgICBkb2MuX2lkID0gTG9jYWxDb2xsZWN0aW9uLl91c2VPSUQgPyBuZXcgTW9uZ29JRC5PYmplY3RJRCgpIDogUmFuZG9tLmlkKCk7XG4gICAgfVxuXG4gICAgY29uc3QgaWQgPSBkb2MuX2lkO1xuXG4gICAgaWYgKHRoaXMuX2RvY3MuaGFzKGlkKSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoYER1cGxpY2F0ZSBfaWQgJyR7aWR9J2ApO1xuICAgIH1cblxuICAgIHRoaXMuX3NhdmVPcmlnaW5hbChpZCwgdW5kZWZpbmVkKTtcbiAgICB0aGlzLl9kb2NzLnNldChpZCwgZG9jKTtcblxuICAgIHJldHVybiBpZDtcbiAgfVxuXG4gIC8vIFhYWCBwb3NzaWJseSBlbmZvcmNlIHRoYXQgJ3VuZGVmaW5lZCcgZG9lcyBub3QgYXBwZWFyICh3ZSBhc3N1bWVcbiAgLy8gdGhpcyBpbiBvdXIgaGFuZGxpbmcgb2YgbnVsbCBhbmQgJGV4aXN0cylcbiAgaW5zZXJ0KGRvYywgY2FsbGJhY2spIHtcbiAgICBkb2MgPSBFSlNPTi5jbG9uZShkb2MpO1xuICAgIGNvbnN0IGlkID0gdGhpcy5wcmVwYXJlSW5zZXJ0KGRvYyk7XG4gICAgY29uc3QgcXVlcmllc1RvUmVjb21wdXRlID0gW107XG5cbiAgICAvLyB0cmlnZ2VyIGxpdmUgcXVlcmllcyB0aGF0IG1hdGNoXG4gICAgZm9yIChjb25zdCBxaWQgb2YgT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKSkge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcWlkXTtcblxuICAgICAgaWYgKHF1ZXJ5LmRpcnR5KSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBtYXRjaFJlc3VsdCA9IHF1ZXJ5Lm1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKGRvYyk7XG5cbiAgICAgIGlmIChtYXRjaFJlc3VsdC5yZXN1bHQpIHtcbiAgICAgICAgaWYgKHF1ZXJ5LmRpc3RhbmNlcyAmJiBtYXRjaFJlc3VsdC5kaXN0YW5jZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcXVlcnkuZGlzdGFuY2VzLnNldChpZCwgbWF0Y2hSZXN1bHQuZGlzdGFuY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHF1ZXJ5LmN1cnNvci5za2lwIHx8IHF1ZXJ5LmN1cnNvci5saW1pdCkge1xuICAgICAgICAgIHF1ZXJpZXNUb1JlY29tcHV0ZS5wdXNoKHFpZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgTG9jYWxDb2xsZWN0aW9uLl9pbnNlcnRJblJlc3VsdHNTeW5jKHF1ZXJ5LCBkb2MpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcXVlcmllc1RvUmVjb21wdXRlLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGlmICh0aGlzLnF1ZXJpZXNbcWlkXSkge1xuICAgICAgICB0aGlzLl9yZWNvbXB1dGVSZXN1bHRzKHRoaXMucXVlcmllc1txaWRdKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuX29ic2VydmVRdWV1ZS5kcmFpbigpO1xuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgTWV0ZW9yLmRlZmVyKCgpID0+IHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgaWQpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIGFzeW5jIGluc2VydEFzeW5jKGRvYywgY2FsbGJhY2spIHtcbiAgICBkb2MgPSBFSlNPTi5jbG9uZShkb2MpO1xuICAgIGNvbnN0IGlkID0gdGhpcy5wcmVwYXJlSW5zZXJ0KGRvYyk7XG4gICAgY29uc3QgcXVlcmllc1RvUmVjb21wdXRlID0gW107XG5cbiAgICAvLyB0cmlnZ2VyIGxpdmUgcXVlcmllcyB0aGF0IG1hdGNoXG4gICAgZm9yIChjb25zdCBxaWQgb2YgT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKSkge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcWlkXTtcblxuICAgICAgaWYgKHF1ZXJ5LmRpcnR5KSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBtYXRjaFJlc3VsdCA9IHF1ZXJ5Lm1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKGRvYyk7XG5cbiAgICAgIGlmIChtYXRjaFJlc3VsdC5yZXN1bHQpIHtcbiAgICAgICAgaWYgKHF1ZXJ5LmRpc3RhbmNlcyAmJiBtYXRjaFJlc3VsdC5kaXN0YW5jZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcXVlcnkuZGlzdGFuY2VzLnNldChpZCwgbWF0Y2hSZXN1bHQuZGlzdGFuY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHF1ZXJ5LmN1cnNvci5za2lwIHx8IHF1ZXJ5LmN1cnNvci5saW1pdCkge1xuICAgICAgICAgIHF1ZXJpZXNUb1JlY29tcHV0ZS5wdXNoKHFpZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYXdhaXQgTG9jYWxDb2xsZWN0aW9uLl9pbnNlcnRJblJlc3VsdHNBc3luYyhxdWVyeSwgZG9jKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHF1ZXJpZXNUb1JlY29tcHV0ZS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICBpZiAodGhpcy5xdWVyaWVzW3FpZF0pIHtcbiAgICAgICAgdGhpcy5fcmVjb21wdXRlUmVzdWx0cyh0aGlzLnF1ZXJpZXNbcWlkXSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLl9vYnNlcnZlUXVldWUuZHJhaW4oKTtcbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIE1ldGVvci5kZWZlcigoKSA9PiB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIGlkKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBpZDtcbiAgfVxuXG4gIC8vIFBhdXNlIHRoZSBvYnNlcnZlcnMuIE5vIGNhbGxiYWNrcyBmcm9tIG9ic2VydmVycyB3aWxsIGZpcmUgdW50aWxcbiAgLy8gJ3Jlc3VtZU9ic2VydmVycycgaXMgY2FsbGVkLlxuICBwYXVzZU9ic2VydmVycygpIHtcbiAgICAvLyBOby1vcCBpZiBhbHJlYWR5IHBhdXNlZC5cbiAgICBpZiAodGhpcy5wYXVzZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBTZXQgdGhlICdwYXVzZWQnIGZsYWcgc3VjaCB0aGF0IG5ldyBvYnNlcnZlciBtZXNzYWdlcyBkb24ndCBmaXJlLlxuICAgIHRoaXMucGF1c2VkID0gdHJ1ZTtcblxuICAgIC8vIFRha2UgYSBzbmFwc2hvdCBvZiB0aGUgcXVlcnkgcmVzdWx0cyBmb3IgZWFjaCBxdWVyeS5cbiAgICBPYmplY3Qua2V5cyh0aGlzLnF1ZXJpZXMpLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG4gICAgICBxdWVyeS5yZXN1bHRzU25hcHNob3QgPSBFSlNPTi5jbG9uZShxdWVyeS5yZXN1bHRzKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNsZWFyUmVzdWx0UXVlcmllcyhjYWxsYmFjaykge1xuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX2RvY3Muc2l6ZSgpO1xuXG4gICAgdGhpcy5fZG9jcy5jbGVhcigpO1xuXG4gICAgT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1txaWRdO1xuXG4gICAgICBpZiAocXVlcnkub3JkZXJlZCkge1xuICAgICAgICBxdWVyeS5yZXN1bHRzID0gW107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBxdWVyeS5yZXN1bHRzLmNsZWFyKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIE1ldGVvci5kZWZlcigoKSA9PiB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cblxuICBwcmVwYXJlUmVtb3ZlKHNlbGVjdG9yKSB7XG4gICAgY29uc3QgbWF0Y2hlciA9IG5ldyBNaW5pbW9uZ28uTWF0Y2hlcihzZWxlY3Rvcik7XG4gICAgY29uc3QgcmVtb3ZlID0gW107XG5cbiAgICB0aGlzLl9lYWNoUG9zc2libHlNYXRjaGluZ0RvY1N5bmMoc2VsZWN0b3IsIChkb2MsIGlkKSA9PiB7XG4gICAgICBpZiAobWF0Y2hlci5kb2N1bWVudE1hdGNoZXMoZG9jKS5yZXN1bHQpIHtcbiAgICAgICAgcmVtb3ZlLnB1c2goaWQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgcXVlcmllc1RvUmVjb21wdXRlID0gW107XG4gICAgY29uc3QgcXVlcnlSZW1vdmUgPSBbXTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVtb3ZlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCByZW1vdmVJZCA9IHJlbW92ZVtpXTtcbiAgICAgIGNvbnN0IHJlbW92ZURvYyA9IHRoaXMuX2RvY3MuZ2V0KHJlbW92ZUlkKTtcblxuICAgICAgT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgICAgaWYgKHF1ZXJ5LmRpcnR5KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHF1ZXJ5Lm1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKHJlbW92ZURvYykucmVzdWx0KSB7XG4gICAgICAgICAgaWYgKHF1ZXJ5LmN1cnNvci5za2lwIHx8IHF1ZXJ5LmN1cnNvci5saW1pdCkge1xuICAgICAgICAgICAgcXVlcmllc1RvUmVjb21wdXRlLnB1c2gocWlkKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcXVlcnlSZW1vdmUucHVzaCh7cWlkLCBkb2M6IHJlbW92ZURvY30pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuX3NhdmVPcmlnaW5hbChyZW1vdmVJZCwgcmVtb3ZlRG9jKTtcbiAgICAgIHRoaXMuX2RvY3MucmVtb3ZlKHJlbW92ZUlkKTtcbiAgICB9XG5cbiAgICByZXR1cm4geyBxdWVyaWVzVG9SZWNvbXB1dGUsIHF1ZXJ5UmVtb3ZlLCByZW1vdmUgfTtcbiAgfVxuXG4gIHJlbW92ZShzZWxlY3RvciwgY2FsbGJhY2spIHtcbiAgICAvLyBFYXN5IHNwZWNpYWwgY2FzZTogaWYgd2UncmUgbm90IGNhbGxpbmcgb2JzZXJ2ZUNoYW5nZXMgY2FsbGJhY2tzIGFuZFxuICAgIC8vIHdlJ3JlIG5vdCBzYXZpbmcgb3JpZ2luYWxzIGFuZCB3ZSBnb3QgYXNrZWQgdG8gcmVtb3ZlIGV2ZXJ5dGhpbmcsIHRoZW5cbiAgICAvLyBqdXN0IGVtcHR5IGV2ZXJ5dGhpbmcgZGlyZWN0bHkuXG4gICAgaWYgKHRoaXMucGF1c2VkICYmICF0aGlzLl9zYXZlZE9yaWdpbmFscyAmJiBFSlNPTi5lcXVhbHMoc2VsZWN0b3IsIHt9KSkge1xuICAgICAgcmV0dXJuIHRoaXMuY2xlYXJSZXN1bHRRdWVyaWVzKGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICBjb25zdCB7IHF1ZXJpZXNUb1JlY29tcHV0ZSwgcXVlcnlSZW1vdmUsIHJlbW92ZSB9ID0gdGhpcy5wcmVwYXJlUmVtb3ZlKHNlbGVjdG9yKTtcblxuICAgIC8vIHJ1biBsaXZlIHF1ZXJ5IGNhbGxiYWNrcyBfYWZ0ZXJfIHdlJ3ZlIHJlbW92ZWQgdGhlIGRvY3VtZW50cy5cbiAgICBxdWVyeVJlbW92ZS5mb3JFYWNoKHJlbW92ZSA9PiB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1tyZW1vdmUucWlkXTtcblxuICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgIHF1ZXJ5LmRpc3RhbmNlcyAmJiBxdWVyeS5kaXN0YW5jZXMucmVtb3ZlKHJlbW92ZS5kb2MuX2lkKTtcbiAgICAgICAgTG9jYWxDb2xsZWN0aW9uLl9yZW1vdmVGcm9tUmVzdWx0c1N5bmMocXVlcnksIHJlbW92ZS5kb2MpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcXVlcmllc1RvUmVjb21wdXRlLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgIGlmIChxdWVyeSkge1xuICAgICAgICB0aGlzLl9yZWNvbXB1dGVSZXN1bHRzKHF1ZXJ5KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuX29ic2VydmVRdWV1ZS5kcmFpbigpO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gcmVtb3ZlLmxlbmd0aDtcblxuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgTWV0ZW9yLmRlZmVyKCgpID0+IHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBhc3luYyByZW1vdmVBc3luYyhzZWxlY3RvciwgY2FsbGJhY2spIHtcbiAgICAvLyBFYXN5IHNwZWNpYWwgY2FzZTogaWYgd2UncmUgbm90IGNhbGxpbmcgb2JzZXJ2ZUNoYW5nZXMgY2FsbGJhY2tzIGFuZFxuICAgIC8vIHdlJ3JlIG5vdCBzYXZpbmcgb3JpZ2luYWxzIGFuZCB3ZSBnb3QgYXNrZWQgdG8gcmVtb3ZlIGV2ZXJ5dGhpbmcsIHRoZW5cbiAgICAvLyBqdXN0IGVtcHR5IGV2ZXJ5dGhpbmcgZGlyZWN0bHkuXG4gICAgaWYgKHRoaXMucGF1c2VkICYmICF0aGlzLl9zYXZlZE9yaWdpbmFscyAmJiBFSlNPTi5lcXVhbHMoc2VsZWN0b3IsIHt9KSkge1xuICAgICAgcmV0dXJuIHRoaXMuY2xlYXJSZXN1bHRRdWVyaWVzKGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICBjb25zdCB7IHF1ZXJpZXNUb1JlY29tcHV0ZSwgcXVlcnlSZW1vdmUsIHJlbW92ZSB9ID0gdGhpcy5wcmVwYXJlUmVtb3ZlKHNlbGVjdG9yKTtcblxuICAgIC8vIHJ1biBsaXZlIHF1ZXJ5IGNhbGxiYWNrcyBfYWZ0ZXJfIHdlJ3ZlIHJlbW92ZWQgdGhlIGRvY3VtZW50cy5cbiAgICBmb3IgKGNvbnN0IHJlbW92ZSBvZiBxdWVyeVJlbW92ZSkge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcmVtb3ZlLnFpZF07XG5cbiAgICAgIGlmIChxdWVyeSkge1xuICAgICAgICBxdWVyeS5kaXN0YW5jZXMgJiYgcXVlcnkuZGlzdGFuY2VzLnJlbW92ZShyZW1vdmUuZG9jLl9pZCk7XG4gICAgICAgIGF3YWl0IExvY2FsQ29sbGVjdGlvbi5fcmVtb3ZlRnJvbVJlc3VsdHNBc3luYyhxdWVyeSwgcmVtb3ZlLmRvYyk7XG4gICAgICB9XG4gICAgfVxuICAgIHF1ZXJpZXNUb1JlY29tcHV0ZS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1txaWRdO1xuXG4gICAgICBpZiAocXVlcnkpIHtcbiAgICAgICAgdGhpcy5fcmVjb21wdXRlUmVzdWx0cyhxdWVyeSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLl9vYnNlcnZlUXVldWUuZHJhaW4oKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IHJlbW92ZS5sZW5ndGg7XG5cbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIE1ldGVvci5kZWZlcigoKSA9PiB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gUmVzdW1lIHRoZSBvYnNlcnZlcnMuIE9ic2VydmVycyBpbW1lZGlhdGVseSByZWNlaXZlIGNoYW5nZVxuICAvLyBub3RpZmljYXRpb25zIHRvIGJyaW5nIHRoZW0gdG8gdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlXG4gIC8vIGRhdGFiYXNlLiBOb3RlIHRoYXQgdGhpcyBpcyBub3QganVzdCByZXBsYXlpbmcgYWxsIHRoZSBjaGFuZ2VzIHRoYXRcbiAgLy8gaGFwcGVuZWQgZHVyaW5nIHRoZSBwYXVzZSwgaXQgaXMgYSBzbWFydGVyICdjb2FsZXNjZWQnIGRpZmYuXG4gIF9yZXN1bWVPYnNlcnZlcnMoKSB7XG4gICAgLy8gTm8tb3AgaWYgbm90IHBhdXNlZC5cbiAgICBpZiAoIXRoaXMucGF1c2VkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gVW5zZXQgdGhlICdwYXVzZWQnIGZsYWcuIE1ha2Ugc3VyZSB0byBkbyB0aGlzIGZpcnN0LCBvdGhlcndpc2VcbiAgICAvLyBvYnNlcnZlciBtZXRob2RzIHdvbid0IGFjdHVhbGx5IGZpcmUgd2hlbiB3ZSB0cmlnZ2VyIHRoZW0uXG4gICAgdGhpcy5wYXVzZWQgPSBmYWxzZTtcblxuICAgIE9iamVjdC5rZXlzKHRoaXMucXVlcmllcykuZm9yRWFjaChxaWQgPT4ge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcWlkXTtcblxuICAgICAgaWYgKHF1ZXJ5LmRpcnR5KSB7XG4gICAgICAgIHF1ZXJ5LmRpcnR5ID0gZmFsc2U7XG5cbiAgICAgICAgLy8gcmUtY29tcHV0ZSByZXN1bHRzIHdpbGwgcGVyZm9ybSBgTG9jYWxDb2xsZWN0aW9uLl9kaWZmUXVlcnlDaGFuZ2VzYFxuICAgICAgICAvLyBhdXRvbWF0aWNhbGx5LlxuICAgICAgICB0aGlzLl9yZWNvbXB1dGVSZXN1bHRzKHF1ZXJ5LCBxdWVyeS5yZXN1bHRzU25hcHNob3QpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRGlmZiB0aGUgY3VycmVudCByZXN1bHRzIGFnYWluc3QgdGhlIHNuYXBzaG90IGFuZCBzZW5kIHRvIG9ic2VydmVycy5cbiAgICAgICAgLy8gcGFzcyB0aGUgcXVlcnkgb2JqZWN0IGZvciBpdHMgb2JzZXJ2ZXIgY2FsbGJhY2tzLlxuICAgICAgICBMb2NhbENvbGxlY3Rpb24uX2RpZmZRdWVyeUNoYW5nZXMoXG4gICAgICAgICAgcXVlcnkub3JkZXJlZCxcbiAgICAgICAgICBxdWVyeS5yZXN1bHRzU25hcHNob3QsXG4gICAgICAgICAgcXVlcnkucmVzdWx0cyxcbiAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICB7cHJvamVjdGlvbkZuOiBxdWVyeS5wcm9qZWN0aW9uRm59XG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHF1ZXJ5LnJlc3VsdHNTbmFwc2hvdCA9IG51bGw7XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyByZXN1bWVPYnNlcnZlcnNTZXJ2ZXIoKSB7XG4gICAgdGhpcy5fcmVzdW1lT2JzZXJ2ZXJzKCk7XG4gICAgYXdhaXQgdGhpcy5fb2JzZXJ2ZVF1ZXVlLmRyYWluKCk7XG4gIH1cbiAgcmVzdW1lT2JzZXJ2ZXJzQ2xpZW50KCkge1xuICAgIHRoaXMuX3Jlc3VtZU9ic2VydmVycygpO1xuICAgIHRoaXMuX29ic2VydmVRdWV1ZS5kcmFpbigpO1xuICB9XG5cbiAgcmV0cmlldmVPcmlnaW5hbHMoKSB7XG4gICAgaWYgKCF0aGlzLl9zYXZlZE9yaWdpbmFscykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYWxsZWQgcmV0cmlldmVPcmlnaW5hbHMgd2l0aG91dCBzYXZlT3JpZ2luYWxzJyk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3JpZ2luYWxzID0gdGhpcy5fc2F2ZWRPcmlnaW5hbHM7XG5cbiAgICB0aGlzLl9zYXZlZE9yaWdpbmFscyA9IG51bGw7XG5cbiAgICByZXR1cm4gb3JpZ2luYWxzO1xuICB9XG5cbiAgLy8gVG8gdHJhY2sgd2hhdCBkb2N1bWVudHMgYXJlIGFmZmVjdGVkIGJ5IGEgcGllY2Ugb2YgY29kZSwgY2FsbFxuICAvLyBzYXZlT3JpZ2luYWxzKCkgYmVmb3JlIGl0IGFuZCByZXRyaWV2ZU9yaWdpbmFscygpIGFmdGVyIGl0LlxuICAvLyByZXRyaWV2ZU9yaWdpbmFscyByZXR1cm5zIGFuIG9iamVjdCB3aG9zZSBrZXlzIGFyZSB0aGUgaWRzIG9mIHRoZSBkb2N1bWVudHNcbiAgLy8gdGhhdCB3ZXJlIGFmZmVjdGVkIHNpbmNlIHRoZSBjYWxsIHRvIHNhdmVPcmlnaW5hbHMoKSwgYW5kIHRoZSB2YWx1ZXMgYXJlXG4gIC8vIGVxdWFsIHRvIHRoZSBkb2N1bWVudCdzIGNvbnRlbnRzIGF0IHRoZSB0aW1lIG9mIHNhdmVPcmlnaW5hbHMuIChJbiB0aGUgY2FzZVxuICAvLyBvZiBhbiBpbnNlcnRlZCBkb2N1bWVudCwgdW5kZWZpbmVkIGlzIHRoZSB2YWx1ZS4pIFlvdSBtdXN0IGFsdGVybmF0ZVxuICAvLyBiZXR3ZWVuIGNhbGxzIHRvIHNhdmVPcmlnaW5hbHMoKSBhbmQgcmV0cmlldmVPcmlnaW5hbHMoKS5cbiAgc2F2ZU9yaWdpbmFscygpIHtcbiAgICBpZiAodGhpcy5fc2F2ZWRPcmlnaW5hbHMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2FsbGVkIHNhdmVPcmlnaW5hbHMgdHdpY2Ugd2l0aG91dCByZXRyaWV2ZU9yaWdpbmFscycpO1xuICAgIH1cblxuICAgIHRoaXMuX3NhdmVkT3JpZ2luYWxzID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gIH1cblxuICBwcmVwYXJlVXBkYXRlKHNlbGVjdG9yKSB7XG4gICAgLy8gU2F2ZSB0aGUgb3JpZ2luYWwgcmVzdWx0cyBvZiBhbnkgcXVlcnkgdGhhdCB3ZSBtaWdodCBuZWVkIHRvXG4gICAgLy8gX3JlY29tcHV0ZVJlc3VsdHMgb24sIGJlY2F1c2UgX21vZGlmeUFuZE5vdGlmeSB3aWxsIG11dGF0ZSB0aGUgb2JqZWN0cyBpblxuICAgIC8vIGl0LiAoV2UgZG9uJ3QgbmVlZCB0byBzYXZlIHRoZSBvcmlnaW5hbCByZXN1bHRzIG9mIHBhdXNlZCBxdWVyaWVzIGJlY2F1c2VcbiAgICAvLyB0aGV5IGFscmVhZHkgaGF2ZSBhIHJlc3VsdHNTbmFwc2hvdCBhbmQgd2Ugd29uJ3QgYmUgZGlmZmluZyBpblxuICAgIC8vIF9yZWNvbXB1dGVSZXN1bHRzLilcbiAgICBjb25zdCBxaWRUb09yaWdpbmFsUmVzdWx0cyA9IHt9O1xuXG4gICAgLy8gV2Ugc2hvdWxkIG9ubHkgY2xvbmUgZWFjaCBkb2N1bWVudCBvbmNlLCBldmVuIGlmIGl0IGFwcGVhcnMgaW4gbXVsdGlwbGVcbiAgICAvLyBxdWVyaWVzXG4gICAgY29uc3QgZG9jTWFwID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gICAgY29uc3QgaWRzTWF0Y2hlZCA9IExvY2FsQ29sbGVjdGlvbi5faWRzTWF0Y2hlZEJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuXG4gICAgT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1txaWRdO1xuXG4gICAgICBpZiAoKHF1ZXJ5LmN1cnNvci5za2lwIHx8IHF1ZXJ5LmN1cnNvci5saW1pdCkgJiYgISB0aGlzLnBhdXNlZCkge1xuICAgICAgICAvLyBDYXRjaCB0aGUgY2FzZSBvZiBhIHJlYWN0aXZlIGBjb3VudCgpYCBvbiBhIGN1cnNvciB3aXRoIHNraXBcbiAgICAgICAgLy8gb3IgbGltaXQsIHdoaWNoIHJlZ2lzdGVycyBhbiB1bm9yZGVyZWQgb2JzZXJ2ZS4gVGhpcyBpcyBhXG4gICAgICAgIC8vIHByZXR0eSByYXJlIGNhc2UsIHNvIHdlIGp1c3QgY2xvbmUgdGhlIGVudGlyZSByZXN1bHQgc2V0IHdpdGhcbiAgICAgICAgLy8gbm8gb3B0aW1pemF0aW9ucyBmb3IgZG9jdW1lbnRzIHRoYXQgYXBwZWFyIGluIHRoZXNlIHJlc3VsdFxuICAgICAgICAvLyBzZXRzIGFuZCBvdGhlciBxdWVyaWVzLlxuICAgICAgICBpZiAocXVlcnkucmVzdWx0cyBpbnN0YW5jZW9mIExvY2FsQ29sbGVjdGlvbi5fSWRNYXApIHtcbiAgICAgICAgICBxaWRUb09yaWdpbmFsUmVzdWx0c1txaWRdID0gcXVlcnkucmVzdWx0cy5jbG9uZSgpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghKHF1ZXJ5LnJlc3VsdHMgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fzc2VydGlvbiBmYWlsZWQ6IHF1ZXJ5LnJlc3VsdHMgbm90IGFuIGFycmF5Jyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDbG9uZXMgYSBkb2N1bWVudCB0byBiZSBzdG9yZWQgaW4gYHFpZFRvT3JpZ2luYWxSZXN1bHRzYFxuICAgICAgICAvLyBiZWNhdXNlIGl0IG1heSBiZSBtb2RpZmllZCBiZWZvcmUgdGhlIG5ldyBhbmQgb2xkIHJlc3VsdCBzZXRzXG4gICAgICAgIC8vIGFyZSBkaWZmZWQuIEJ1dCBpZiB3ZSBrbm93IGV4YWN0bHkgd2hpY2ggZG9jdW1lbnQgSURzIHdlJ3JlXG4gICAgICAgIC8vIGdvaW5nIHRvIG1vZGlmeSwgdGhlbiB3ZSBvbmx5IG5lZWQgdG8gY2xvbmUgdGhvc2UuXG4gICAgICAgIGNvbnN0IG1lbW9pemVkQ2xvbmVJZk5lZWRlZCA9IGRvYyA9PiB7XG4gICAgICAgICAgaWYgKGRvY01hcC5oYXMoZG9jLl9pZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBkb2NNYXAuZ2V0KGRvYy5faWQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGRvY1RvTWVtb2l6ZSA9IChcbiAgICAgICAgICAgIGlkc01hdGNoZWQgJiZcbiAgICAgICAgICAgICFpZHNNYXRjaGVkLnNvbWUoaWQgPT4gRUpTT04uZXF1YWxzKGlkLCBkb2MuX2lkKSlcbiAgICAgICAgICApID8gZG9jIDogRUpTT04uY2xvbmUoZG9jKTtcblxuICAgICAgICAgIGRvY01hcC5zZXQoZG9jLl9pZCwgZG9jVG9NZW1vaXplKTtcblxuICAgICAgICAgIHJldHVybiBkb2NUb01lbW9pemU7XG4gICAgICAgIH07XG5cbiAgICAgICAgcWlkVG9PcmlnaW5hbFJlc3VsdHNbcWlkXSA9IHF1ZXJ5LnJlc3VsdHMubWFwKG1lbW9pemVkQ2xvbmVJZk5lZWRlZCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcWlkVG9PcmlnaW5hbFJlc3VsdHM7XG4gIH1cblxuICBmaW5pc2hVcGRhdGUoeyBvcHRpb25zLCB1cGRhdGVDb3VudCwgY2FsbGJhY2ssIGluc2VydGVkSWQgfSkge1xuXG5cbiAgICAvLyBSZXR1cm4gdGhlIG51bWJlciBvZiBhZmZlY3RlZCBkb2N1bWVudHMsIG9yIGluIHRoZSB1cHNlcnQgY2FzZSwgYW4gb2JqZWN0XG4gICAgLy8gY29udGFpbmluZyB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIGRvY3MgYW5kIHRoZSBpZCBvZiB0aGUgZG9jIHRoYXQgd2FzXG4gICAgLy8gaW5zZXJ0ZWQsIGlmIGFueS5cbiAgICBsZXQgcmVzdWx0O1xuICAgIGlmIChvcHRpb25zLl9yZXR1cm5PYmplY3QpIHtcbiAgICAgIHJlc3VsdCA9IHsgbnVtYmVyQWZmZWN0ZWQ6IHVwZGF0ZUNvdW50IH07XG5cbiAgICAgIGlmIChpbnNlcnRlZElkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmVzdWx0Lmluc2VydGVkSWQgPSBpbnNlcnRlZElkO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSB1cGRhdGVDb3VudDtcbiAgICB9XG5cbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIE1ldGVvci5kZWZlcigoKSA9PiB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gWFhYIGF0b21pY2l0eTogaWYgbXVsdGkgaXMgdHJ1ZSwgYW5kIG9uZSBtb2RpZmljYXRpb24gZmFpbHMsIGRvXG4gIC8vIHdlIHJvbGxiYWNrIHRoZSB3aG9sZSBvcGVyYXRpb24sIG9yIHdoYXQ/XG4gIGFzeW5jIHVwZGF0ZUFzeW5jKHNlbGVjdG9yLCBtb2QsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCEgY2FsbGJhY2sgJiYgb3B0aW9ucyBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgICBvcHRpb25zID0gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoIW9wdGlvbnMpIHtcbiAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICB9XG5cbiAgICBjb25zdCBtYXRjaGVyID0gbmV3IE1pbmltb25nby5NYXRjaGVyKHNlbGVjdG9yLCB0cnVlKTtcblxuICAgIGNvbnN0IHFpZFRvT3JpZ2luYWxSZXN1bHRzID0gdGhpcy5wcmVwYXJlVXBkYXRlKHNlbGVjdG9yKTtcblxuICAgIGxldCByZWNvbXB1dGVRaWRzID0ge307XG5cbiAgICBsZXQgdXBkYXRlQ291bnQgPSAwO1xuXG4gICAgYXdhaXQgdGhpcy5fZWFjaFBvc3NpYmx5TWF0Y2hpbmdEb2NBc3luYyhzZWxlY3RvciwgYXN5bmMgKGRvYywgaWQpID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5UmVzdWx0ID0gbWF0Y2hlci5kb2N1bWVudE1hdGNoZXMoZG9jKTtcblxuICAgICAgaWYgKHF1ZXJ5UmVzdWx0LnJlc3VsdCkge1xuICAgICAgICAvLyBYWFggU2hvdWxkIHdlIHNhdmUgdGhlIG9yaWdpbmFsIGV2ZW4gaWYgbW9kIGVuZHMgdXAgYmVpbmcgYSBuby1vcD9cbiAgICAgICAgdGhpcy5fc2F2ZU9yaWdpbmFsKGlkLCBkb2MpO1xuICAgICAgICByZWNvbXB1dGVRaWRzID0gYXdhaXQgdGhpcy5fbW9kaWZ5QW5kTm90aWZ5QXN5bmMoXG4gICAgICAgICAgZG9jLFxuICAgICAgICAgIG1vZCxcbiAgICAgICAgICBxdWVyeVJlc3VsdC5hcnJheUluZGljZXNcbiAgICAgICAgKTtcblxuICAgICAgICArK3VwZGF0ZUNvdW50O1xuXG4gICAgICAgIGlmICghb3B0aW9ucy5tdWx0aSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gYnJlYWtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcblxuICAgIE9iamVjdC5rZXlzKHJlY29tcHV0ZVFpZHMpLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgIGlmIChxdWVyeSkge1xuICAgICAgICB0aGlzLl9yZWNvbXB1dGVSZXN1bHRzKHF1ZXJ5LCBxaWRUb09yaWdpbmFsUmVzdWx0c1txaWRdKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGF3YWl0IHRoaXMuX29ic2VydmVRdWV1ZS5kcmFpbigpO1xuXG4gICAgLy8gSWYgd2UgYXJlIGRvaW5nIGFuIHVwc2VydCwgYW5kIHdlIGRpZG4ndCBtb2RpZnkgYW55IGRvY3VtZW50cyB5ZXQsIHRoZW5cbiAgICAvLyBpdCdzIHRpbWUgdG8gZG8gYW4gaW5zZXJ0LiBGaWd1cmUgb3V0IHdoYXQgZG9jdW1lbnQgd2UgYXJlIGluc2VydGluZywgYW5kXG4gICAgLy8gZ2VuZXJhdGUgYW4gaWQgZm9yIGl0LlxuICAgIGxldCBpbnNlcnRlZElkO1xuICAgIGlmICh1cGRhdGVDb3VudCA9PT0gMCAmJiBvcHRpb25zLnVwc2VydCkge1xuICAgICAgY29uc3QgZG9jID0gTG9jYWxDb2xsZWN0aW9uLl9jcmVhdGVVcHNlcnREb2N1bWVudChzZWxlY3RvciwgbW9kKTtcbiAgICAgIGlmICghZG9jLl9pZCAmJiBvcHRpb25zLmluc2VydGVkSWQpIHtcbiAgICAgICAgZG9jLl9pZCA9IG9wdGlvbnMuaW5zZXJ0ZWRJZDtcbiAgICAgIH1cblxuICAgICAgaW5zZXJ0ZWRJZCA9IGF3YWl0IHRoaXMuaW5zZXJ0QXN5bmMoZG9jKTtcbiAgICAgIHVwZGF0ZUNvdW50ID0gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5maW5pc2hVcGRhdGUoe1xuICAgICAgb3B0aW9ucyxcbiAgICAgIGluc2VydGVkSWQsXG4gICAgICB1cGRhdGVDb3VudCxcbiAgICAgIGNhbGxiYWNrLFxuICAgIH0pO1xuICB9XG4gIC8vIFhYWCBhdG9taWNpdHk6IGlmIG11bHRpIGlzIHRydWUsIGFuZCBvbmUgbW9kaWZpY2F0aW9uIGZhaWxzLCBkb1xuICAvLyB3ZSByb2xsYmFjayB0aGUgd2hvbGUgb3BlcmF0aW9uLCBvciB3aGF0P1xuICB1cGRhdGUoc2VsZWN0b3IsIG1vZCwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAoISBjYWxsYmFjayAmJiBvcHRpb25zIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSBudWxsO1xuICAgIH1cblxuICAgIGlmICghb3B0aW9ucykge1xuICAgICAgb3B0aW9ucyA9IHt9O1xuICAgIH1cblxuICAgIGNvbnN0IG1hdGNoZXIgPSBuZXcgTWluaW1vbmdvLk1hdGNoZXIoc2VsZWN0b3IsIHRydWUpO1xuXG4gICAgY29uc3QgcWlkVG9PcmlnaW5hbFJlc3VsdHMgPSB0aGlzLnByZXBhcmVVcGRhdGUoc2VsZWN0b3IpO1xuXG4gICAgbGV0IHJlY29tcHV0ZVFpZHMgPSB7fTtcblxuICAgIGxldCB1cGRhdGVDb3VudCA9IDA7XG5cbiAgICB0aGlzLl9lYWNoUG9zc2libHlNYXRjaGluZ0RvY1N5bmMoc2VsZWN0b3IsIChkb2MsIGlkKSA9PiB7XG4gICAgICBjb25zdCBxdWVyeVJlc3VsdCA9IG1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKGRvYyk7XG5cbiAgICAgIGlmIChxdWVyeVJlc3VsdC5yZXN1bHQpIHtcbiAgICAgICAgLy8gWFhYIFNob3VsZCB3ZSBzYXZlIHRoZSBvcmlnaW5hbCBldmVuIGlmIG1vZCBlbmRzIHVwIGJlaW5nIGEgbm8tb3A/XG4gICAgICAgIHRoaXMuX3NhdmVPcmlnaW5hbChpZCwgZG9jKTtcbiAgICAgICAgcmVjb21wdXRlUWlkcyA9IHRoaXMuX21vZGlmeUFuZE5vdGlmeVN5bmMoXG4gICAgICAgICAgZG9jLFxuICAgICAgICAgIG1vZCxcbiAgICAgICAgICBxdWVyeVJlc3VsdC5hcnJheUluZGljZXNcbiAgICAgICAgKTtcblxuICAgICAgICArK3VwZGF0ZUNvdW50O1xuXG4gICAgICAgIGlmICghb3B0aW9ucy5tdWx0aSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gYnJlYWtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcblxuICAgIE9iamVjdC5rZXlzKHJlY29tcHV0ZVFpZHMpLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG4gICAgICBpZiAocXVlcnkpIHtcbiAgICAgICAgdGhpcy5fcmVjb21wdXRlUmVzdWx0cyhxdWVyeSwgcWlkVG9PcmlnaW5hbFJlc3VsdHNbcWlkXSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLl9vYnNlcnZlUXVldWUuZHJhaW4oKTtcblxuICAgIHJldHVybiB0aGlzLmZpbmlzaFVwZGF0ZSh7XG4gICAgICBvcHRpb25zLFxuICAgICAgdXBkYXRlQ291bnQsXG4gICAgICBjYWxsYmFjayxcbiAgICAgIHNlbGVjdG9yLFxuICAgICAgbW9kLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gQSBjb252ZW5pZW5jZSB3cmFwcGVyIG9uIHVwZGF0ZS4gTG9jYWxDb2xsZWN0aW9uLnVwc2VydChzZWwsIG1vZCkgaXNcbiAgLy8gZXF1aXZhbGVudCB0byBMb2NhbENvbGxlY3Rpb24udXBkYXRlKHNlbCwgbW9kLCB7dXBzZXJ0OiB0cnVlLFxuICAvLyBfcmV0dXJuT2JqZWN0OiB0cnVlfSkuXG4gIHVwc2VydChzZWxlY3RvciwgbW9kLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGlmICghY2FsbGJhY2sgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy51cGRhdGUoXG4gICAgICBzZWxlY3RvcixcbiAgICAgIG1vZCxcbiAgICAgIE9iamVjdC5hc3NpZ24oe30sIG9wdGlvbnMsIHt1cHNlcnQ6IHRydWUsIF9yZXR1cm5PYmplY3Q6IHRydWV9KSxcbiAgICAgIGNhbGxiYWNrXG4gICAgKTtcbiAgfVxuXG4gIHVwc2VydEFzeW5jKHNlbGVjdG9yLCBtb2QsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCFjYWxsYmFjayAmJiB0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgICAgb3B0aW9ucyA9IHt9O1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnVwZGF0ZUFzeW5jKFxuICAgICAgc2VsZWN0b3IsXG4gICAgICBtb2QsXG4gICAgICBPYmplY3QuYXNzaWduKHt9LCBvcHRpb25zLCB7dXBzZXJ0OiB0cnVlLCBfcmV0dXJuT2JqZWN0OiB0cnVlfSksXG4gICAgICBjYWxsYmFja1xuICAgICk7XG4gIH1cblxuICAvLyBJdGVyYXRlcyBvdmVyIGEgc3Vic2V0IG9mIGRvY3VtZW50cyB0aGF0IGNvdWxkIG1hdGNoIHNlbGVjdG9yOyBjYWxsc1xuICAvLyBmbihkb2MsIGlkKSBvbiBlYWNoIG9mIHRoZW0uICBTcGVjaWZpY2FsbHksIGlmIHNlbGVjdG9yIHNwZWNpZmllc1xuICAvLyBzcGVjaWZpYyBfaWQncywgaXQgb25seSBsb29rcyBhdCB0aG9zZS4gIGRvYyBpcyAqbm90KiBjbG9uZWQ6IGl0IGlzIHRoZVxuICAvLyBzYW1lIG9iamVjdCB0aGF0IGlzIGluIF9kb2NzLlxuICBhc3luYyBfZWFjaFBvc3NpYmx5TWF0Y2hpbmdEb2NBc3luYyhzZWxlY3RvciwgZm4pIHtcbiAgICBjb25zdCBzcGVjaWZpY0lkcyA9IExvY2FsQ29sbGVjdGlvbi5faWRzTWF0Y2hlZEJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuXG4gICAgaWYgKHNwZWNpZmljSWRzKSB7XG4gICAgICBmb3IgKGNvbnN0IGlkIG9mIHNwZWNpZmljSWRzKSB7XG4gICAgICAgIGNvbnN0IGRvYyA9IHRoaXMuX2RvY3MuZ2V0KGlkKTtcblxuICAgICAgICBpZiAoZG9jICYmICEgKGF3YWl0IGZuKGRvYywgaWQpKSkge1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgYXdhaXQgdGhpcy5fZG9jcy5mb3JFYWNoQXN5bmMoZm4pO1xuICAgIH1cbiAgfVxuICBfZWFjaFBvc3NpYmx5TWF0Y2hpbmdEb2NTeW5jKHNlbGVjdG9yLCBmbikge1xuICAgIGNvbnN0IHNwZWNpZmljSWRzID0gTG9jYWxDb2xsZWN0aW9uLl9pZHNNYXRjaGVkQnlTZWxlY3RvcihzZWxlY3Rvcik7XG5cbiAgICBpZiAoc3BlY2lmaWNJZHMpIHtcbiAgICAgIGZvciAoY29uc3QgaWQgb2Ygc3BlY2lmaWNJZHMpIHtcbiAgICAgICAgY29uc3QgZG9jID0gdGhpcy5fZG9jcy5nZXQoaWQpO1xuXG4gICAgICAgIGlmIChkb2MgJiYgIWZuKGRvYywgaWQpKSB7XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9kb2NzLmZvckVhY2goZm4pO1xuICAgIH1cbiAgfVxuXG4gIF9nZXRNYXRjaGVkRG9jQW5kTW9kaWZ5KGRvYywgbW9kLCBhcnJheUluZGljZXMpIHtcbiAgICBjb25zdCBtYXRjaGVkX2JlZm9yZSA9IHt9O1xuXG4gICAgT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1txaWRdO1xuXG4gICAgICBpZiAocXVlcnkuZGlydHkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAocXVlcnkub3JkZXJlZCkge1xuICAgICAgICBtYXRjaGVkX2JlZm9yZVtxaWRdID0gcXVlcnkubWF0Y2hlci5kb2N1bWVudE1hdGNoZXMoZG9jKS5yZXN1bHQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBCZWNhdXNlIHdlIGRvbid0IHN1cHBvcnQgc2tpcCBvciBsaW1pdCAoeWV0KSBpbiB1bm9yZGVyZWQgcXVlcmllcywgd2VcbiAgICAgICAgLy8gY2FuIGp1c3QgZG8gYSBkaXJlY3QgbG9va3VwLlxuICAgICAgICBtYXRjaGVkX2JlZm9yZVtxaWRdID0gcXVlcnkucmVzdWx0cy5oYXMoZG9jLl9pZCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbWF0Y2hlZF9iZWZvcmU7XG4gIH1cblxuICBfbW9kaWZ5QW5kTm90aWZ5U3luYyhkb2MsIG1vZCwgYXJyYXlJbmRpY2VzKSB7XG5cbiAgICBjb25zdCBtYXRjaGVkX2JlZm9yZSA9IHRoaXMuX2dldE1hdGNoZWREb2NBbmRNb2RpZnkoZG9jLCBtb2QsIGFycmF5SW5kaWNlcyk7XG5cbiAgICBjb25zdCBvbGRfZG9jID0gRUpTT04uY2xvbmUoZG9jKTtcbiAgICBMb2NhbENvbGxlY3Rpb24uX21vZGlmeShkb2MsIG1vZCwge2FycmF5SW5kaWNlc30pO1xuXG4gICAgY29uc3QgcmVjb21wdXRlUWlkcyA9IHt9O1xuXG4gICAgZm9yIChjb25zdCBxaWQgb2YgT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKSkge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcWlkXTtcblxuICAgICAgaWYgKHF1ZXJ5LmRpcnR5KSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBhZnRlck1hdGNoID0gcXVlcnkubWF0Y2hlci5kb2N1bWVudE1hdGNoZXMoZG9jKTtcbiAgICAgIGNvbnN0IGFmdGVyID0gYWZ0ZXJNYXRjaC5yZXN1bHQ7XG4gICAgICBjb25zdCBiZWZvcmUgPSBtYXRjaGVkX2JlZm9yZVtxaWRdO1xuXG4gICAgICBpZiAoYWZ0ZXIgJiYgcXVlcnkuZGlzdGFuY2VzICYmIGFmdGVyTWF0Y2guZGlzdGFuY2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBxdWVyeS5kaXN0YW5jZXMuc2V0KGRvYy5faWQsIGFmdGVyTWF0Y2guZGlzdGFuY2UpO1xuICAgICAgfVxuXG4gICAgICBpZiAocXVlcnkuY3Vyc29yLnNraXAgfHwgcXVlcnkuY3Vyc29yLmxpbWl0KSB7XG4gICAgICAgIC8vIFdlIG5lZWQgdG8gcmVjb21wdXRlIGFueSBxdWVyeSB3aGVyZSB0aGUgZG9jIG1heSBoYXZlIGJlZW4gaW4gdGhlXG4gICAgICAgIC8vIGN1cnNvcidzIHdpbmRvdyBlaXRoZXIgYmVmb3JlIG9yIGFmdGVyIHRoZSB1cGRhdGUuIChOb3RlIHRoYXQgaWYgc2tpcFxuICAgICAgICAvLyBvciBsaW1pdCBpcyBzZXQsIFwiYmVmb3JlXCIgYW5kIFwiYWZ0ZXJcIiBiZWluZyB0cnVlIGRvIG5vdCBuZWNlc3NhcmlseVxuICAgICAgICAvLyBtZWFuIHRoYXQgdGhlIGRvY3VtZW50IGlzIGluIHRoZSBjdXJzb3IncyBvdXRwdXQgYWZ0ZXIgc2tpcC9saW1pdCBpc1xuICAgICAgICAvLyBhcHBsaWVkLi4uIGJ1dCBpZiB0aGV5IGFyZSBmYWxzZSwgdGhlbiB0aGUgZG9jdW1lbnQgZGVmaW5pdGVseSBpcyBOT1RcbiAgICAgICAgLy8gaW4gdGhlIG91dHB1dC4gU28gaXQncyBzYWZlIHRvIHNraXAgcmVjb21wdXRlIGlmIG5laXRoZXIgYmVmb3JlIG9yXG4gICAgICAgIC8vIGFmdGVyIGFyZSB0cnVlLilcbiAgICAgICAgaWYgKGJlZm9yZSB8fCBhZnRlcikge1xuICAgICAgICAgIHJlY29tcHV0ZVFpZHNbcWlkXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoYmVmb3JlICYmICFhZnRlcikge1xuICAgICAgICBMb2NhbENvbGxlY3Rpb24uX3JlbW92ZUZyb21SZXN1bHRzU3luYyhxdWVyeSwgZG9jKTtcbiAgICAgIH0gZWxzZSBpZiAoIWJlZm9yZSAmJiBhZnRlcikge1xuICAgICAgICBMb2NhbENvbGxlY3Rpb24uX2luc2VydEluUmVzdWx0c1N5bmMocXVlcnksIGRvYyk7XG4gICAgICB9IGVsc2UgaWYgKGJlZm9yZSAmJiBhZnRlcikge1xuICAgICAgICBMb2NhbENvbGxlY3Rpb24uX3VwZGF0ZUluUmVzdWx0c1N5bmMocXVlcnksIGRvYywgb2xkX2RvYyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZWNvbXB1dGVRaWRzO1xuICB9XG5cbiAgYXN5bmMgX21vZGlmeUFuZE5vdGlmeUFzeW5jKGRvYywgbW9kLCBhcnJheUluZGljZXMpIHtcblxuICAgIGNvbnN0IG1hdGNoZWRfYmVmb3JlID0gdGhpcy5fZ2V0TWF0Y2hlZERvY0FuZE1vZGlmeShkb2MsIG1vZCwgYXJyYXlJbmRpY2VzKTtcblxuICAgIGNvbnN0IG9sZF9kb2MgPSBFSlNPTi5jbG9uZShkb2MpO1xuICAgIExvY2FsQ29sbGVjdGlvbi5fbW9kaWZ5KGRvYywgbW9kLCB7YXJyYXlJbmRpY2VzfSk7XG5cbiAgICBjb25zdCByZWNvbXB1dGVRaWRzID0ge307XG4gICAgZm9yIChjb25zdCBxaWQgb2YgT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKSkge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcWlkXTtcblxuICAgICAgaWYgKHF1ZXJ5LmRpcnR5KSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBhZnRlck1hdGNoID0gcXVlcnkubWF0Y2hlci5kb2N1bWVudE1hdGNoZXMoZG9jKTtcbiAgICAgIGNvbnN0IGFmdGVyID0gYWZ0ZXJNYXRjaC5yZXN1bHQ7XG4gICAgICBjb25zdCBiZWZvcmUgPSBtYXRjaGVkX2JlZm9yZVtxaWRdO1xuXG4gICAgICBpZiAoYWZ0ZXIgJiYgcXVlcnkuZGlzdGFuY2VzICYmIGFmdGVyTWF0Y2guZGlzdGFuY2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBxdWVyeS5kaXN0YW5jZXMuc2V0KGRvYy5faWQsIGFmdGVyTWF0Y2guZGlzdGFuY2UpO1xuICAgICAgfVxuXG4gICAgICBpZiAocXVlcnkuY3Vyc29yLnNraXAgfHwgcXVlcnkuY3Vyc29yLmxpbWl0KSB7XG4gICAgICAgIC8vIFdlIG5lZWQgdG8gcmVjb21wdXRlIGFueSBxdWVyeSB3aGVyZSB0aGUgZG9jIG1heSBoYXZlIGJlZW4gaW4gdGhlXG4gICAgICAgIC8vIGN1cnNvcidzIHdpbmRvdyBlaXRoZXIgYmVmb3JlIG9yIGFmdGVyIHRoZSB1cGRhdGUuIChOb3RlIHRoYXQgaWYgc2tpcFxuICAgICAgICAvLyBvciBsaW1pdCBpcyBzZXQsIFwiYmVmb3JlXCIgYW5kIFwiYWZ0ZXJcIiBiZWluZyB0cnVlIGRvIG5vdCBuZWNlc3NhcmlseVxuICAgICAgICAvLyBtZWFuIHRoYXQgdGhlIGRvY3VtZW50IGlzIGluIHRoZSBjdXJzb3IncyBvdXRwdXQgYWZ0ZXIgc2tpcC9saW1pdCBpc1xuICAgICAgICAvLyBhcHBsaWVkLi4uIGJ1dCBpZiB0aGV5IGFyZSBmYWxzZSwgdGhlbiB0aGUgZG9jdW1lbnQgZGVmaW5pdGVseSBpcyBOT1RcbiAgICAgICAgLy8gaW4gdGhlIG91dHB1dC4gU28gaXQncyBzYWZlIHRvIHNraXAgcmVjb21wdXRlIGlmIG5laXRoZXIgYmVmb3JlIG9yXG4gICAgICAgIC8vIGFmdGVyIGFyZSB0cnVlLilcbiAgICAgICAgaWYgKGJlZm9yZSB8fCBhZnRlcikge1xuICAgICAgICAgIHJlY29tcHV0ZVFpZHNbcWlkXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoYmVmb3JlICYmICFhZnRlcikge1xuICAgICAgICBhd2FpdCBMb2NhbENvbGxlY3Rpb24uX3JlbW92ZUZyb21SZXN1bHRzQXN5bmMocXVlcnksIGRvYyk7XG4gICAgICB9IGVsc2UgaWYgKCFiZWZvcmUgJiYgYWZ0ZXIpIHtcbiAgICAgICAgYXdhaXQgTG9jYWxDb2xsZWN0aW9uLl9pbnNlcnRJblJlc3VsdHNBc3luYyhxdWVyeSwgZG9jKTtcbiAgICAgIH0gZWxzZSBpZiAoYmVmb3JlICYmIGFmdGVyKSB7XG4gICAgICAgIGF3YWl0IExvY2FsQ29sbGVjdGlvbi5fdXBkYXRlSW5SZXN1bHRzQXN5bmMocXVlcnksIGRvYywgb2xkX2RvYyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZWNvbXB1dGVRaWRzO1xuICB9XG5cbiAgLy8gUmVjb21wdXRlcyB0aGUgcmVzdWx0cyBvZiBhIHF1ZXJ5IGFuZCBydW5zIG9ic2VydmUgY2FsbGJhY2tzIGZvciB0aGVcbiAgLy8gZGlmZmVyZW5jZSBiZXR3ZWVuIHRoZSBwcmV2aW91cyByZXN1bHRzIGFuZCB0aGUgY3VycmVudCByZXN1bHRzICh1bmxlc3NcbiAgLy8gcGF1c2VkKS4gVXNlZCBmb3Igc2tpcC9saW1pdCBxdWVyaWVzLlxuICAvL1xuICAvLyBXaGVuIHRoaXMgaXMgdXNlZCBieSBpbnNlcnQgb3IgcmVtb3ZlLCBpdCBjYW4ganVzdCB1c2UgcXVlcnkucmVzdWx0cyBmb3JcbiAgLy8gdGhlIG9sZCByZXN1bHRzIChhbmQgdGhlcmUncyBubyBuZWVkIHRvIHBhc3MgaW4gb2xkUmVzdWx0cyksIGJlY2F1c2UgdGhlc2VcbiAgLy8gb3BlcmF0aW9ucyBkb24ndCBtdXRhdGUgdGhlIGRvY3VtZW50cyBpbiB0aGUgY29sbGVjdGlvbi4gVXBkYXRlIG5lZWRzIHRvXG4gIC8vIHBhc3MgaW4gYW4gb2xkUmVzdWx0cyB3aGljaCB3YXMgZGVlcC1jb3BpZWQgYmVmb3JlIHRoZSBtb2RpZmllciB3YXNcbiAgLy8gYXBwbGllZC5cbiAgLy9cbiAgLy8gb2xkUmVzdWx0cyBpcyBndWFyYW50ZWVkIHRvIGJlIGlnbm9yZWQgaWYgdGhlIHF1ZXJ5IGlzIG5vdCBwYXVzZWQuXG4gIF9yZWNvbXB1dGVSZXN1bHRzKHF1ZXJ5LCBvbGRSZXN1bHRzKSB7XG4gICAgaWYgKHRoaXMucGF1c2VkKSB7XG4gICAgICAvLyBUaGVyZSdzIG5vIHJlYXNvbiB0byByZWNvbXB1dGUgdGhlIHJlc3VsdHMgbm93IGFzIHdlJ3JlIHN0aWxsIHBhdXNlZC5cbiAgICAgIC8vIEJ5IGZsYWdnaW5nIHRoZSBxdWVyeSBhcyBcImRpcnR5XCIsIHRoZSByZWNvbXB1dGUgd2lsbCBiZSBwZXJmb3JtZWRcbiAgICAgIC8vIHdoZW4gcmVzdW1lT2JzZXJ2ZXJzIGlzIGNhbGxlZC5cbiAgICAgIHF1ZXJ5LmRpcnR5ID0gdHJ1ZTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMucGF1c2VkICYmICFvbGRSZXN1bHRzKSB7XG4gICAgICBvbGRSZXN1bHRzID0gcXVlcnkucmVzdWx0cztcbiAgICB9XG5cbiAgICBpZiAocXVlcnkuZGlzdGFuY2VzKSB7XG4gICAgICBxdWVyeS5kaXN0YW5jZXMuY2xlYXIoKTtcbiAgICB9XG5cbiAgICBxdWVyeS5yZXN1bHRzID0gcXVlcnkuY3Vyc29yLl9nZXRSYXdPYmplY3RzKHtcbiAgICAgIGRpc3RhbmNlczogcXVlcnkuZGlzdGFuY2VzLFxuICAgICAgb3JkZXJlZDogcXVlcnkub3JkZXJlZFxuICAgIH0pO1xuXG4gICAgaWYgKCF0aGlzLnBhdXNlZCkge1xuICAgICAgTG9jYWxDb2xsZWN0aW9uLl9kaWZmUXVlcnlDaGFuZ2VzKFxuICAgICAgICBxdWVyeS5vcmRlcmVkLFxuICAgICAgICBvbGRSZXN1bHRzLFxuICAgICAgICBxdWVyeS5yZXN1bHRzLFxuICAgICAgICBxdWVyeSxcbiAgICAgICAge3Byb2plY3Rpb25GbjogcXVlcnkucHJvamVjdGlvbkZufVxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBfc2F2ZU9yaWdpbmFsKGlkLCBkb2MpIHtcbiAgICAvLyBBcmUgd2UgZXZlbiB0cnlpbmcgdG8gc2F2ZSBvcmlnaW5hbHM/XG4gICAgaWYgKCF0aGlzLl9zYXZlZE9yaWdpbmFscykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEhhdmUgd2UgcHJldmlvdXNseSBtdXRhdGVkIHRoZSBvcmlnaW5hbCAoYW5kIHNvICdkb2MnIGlzIG5vdCBhY3R1YWxseVxuICAgIC8vIG9yaWdpbmFsKT8gIChOb3RlIHRoZSAnaGFzJyBjaGVjayByYXRoZXIgdGhhbiB0cnV0aDogd2Ugc3RvcmUgdW5kZWZpbmVkXG4gICAgLy8gaGVyZSBmb3IgaW5zZXJ0ZWQgZG9jcyEpXG4gICAgaWYgKHRoaXMuX3NhdmVkT3JpZ2luYWxzLmhhcyhpZCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLl9zYXZlZE9yaWdpbmFscy5zZXQoaWQsIEVKU09OLmNsb25lKGRvYykpO1xuICB9XG59XG5cbkxvY2FsQ29sbGVjdGlvbi5DdXJzb3IgPSBDdXJzb3I7XG5cbkxvY2FsQ29sbGVjdGlvbi5PYnNlcnZlSGFuZGxlID0gT2JzZXJ2ZUhhbmRsZTtcblxuLy8gWFhYIG1heWJlIG1vdmUgdGhlc2UgaW50byBhbm90aGVyIE9ic2VydmVIZWxwZXJzIHBhY2thZ2Ugb3Igc29tZXRoaW5nXG5cbi8vIF9DYWNoaW5nQ2hhbmdlT2JzZXJ2ZXIgaXMgYW4gb2JqZWN0IHdoaWNoIHJlY2VpdmVzIG9ic2VydmVDaGFuZ2VzIGNhbGxiYWNrc1xuLy8gYW5kIGtlZXBzIGEgY2FjaGUgb2YgdGhlIGN1cnJlbnQgY3Vyc29yIHN0YXRlIHVwIHRvIGRhdGUgaW4gdGhpcy5kb2NzLiBVc2Vyc1xuLy8gb2YgdGhpcyBjbGFzcyBzaG91bGQgcmVhZCB0aGUgZG9jcyBmaWVsZCBidXQgbm90IG1vZGlmeSBpdC4gWW91IHNob3VsZCBwYXNzXG4vLyB0aGUgXCJhcHBseUNoYW5nZVwiIGZpZWxkIGFzIHRoZSBjYWxsYmFja3MgdG8gdGhlIHVuZGVybHlpbmcgb2JzZXJ2ZUNoYW5nZXNcbi8vIGNhbGwuIE9wdGlvbmFsbHksIHlvdSBjYW4gc3BlY2lmeSB5b3VyIG93biBvYnNlcnZlQ2hhbmdlcyBjYWxsYmFja3Mgd2hpY2ggYXJlXG4vLyBpbnZva2VkIGltbWVkaWF0ZWx5IGJlZm9yZSB0aGUgZG9jcyBmaWVsZCBpcyB1cGRhdGVkOyB0aGlzIG9iamVjdCBpcyBtYWRlXG4vLyBhdmFpbGFibGUgYXMgYHRoaXNgIHRvIHRob3NlIGNhbGxiYWNrcy5cbkxvY2FsQ29sbGVjdGlvbi5fQ2FjaGluZ0NoYW5nZU9ic2VydmVyID0gY2xhc3MgX0NhY2hpbmdDaGFuZ2VPYnNlcnZlciB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IG9yZGVyZWRGcm9tQ2FsbGJhY2tzID0gKFxuICAgICAgb3B0aW9ucy5jYWxsYmFja3MgJiZcbiAgICAgIExvY2FsQ29sbGVjdGlvbi5fb2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3NBcmVPcmRlcmVkKG9wdGlvbnMuY2FsbGJhY2tzKVxuICAgICk7XG5cbiAgICBpZiAoaGFzT3duLmNhbGwob3B0aW9ucywgJ29yZGVyZWQnKSkge1xuICAgICAgdGhpcy5vcmRlcmVkID0gb3B0aW9ucy5vcmRlcmVkO1xuXG4gICAgICBpZiAob3B0aW9ucy5jYWxsYmFja3MgJiYgb3B0aW9ucy5vcmRlcmVkICE9PSBvcmRlcmVkRnJvbUNhbGxiYWNrcykge1xuICAgICAgICB0aHJvdyBFcnJvcignb3JkZXJlZCBvcHRpb24gZG9lc25cXCd0IG1hdGNoIGNhbGxiYWNrcycpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAob3B0aW9ucy5jYWxsYmFja3MpIHtcbiAgICAgIHRoaXMub3JkZXJlZCA9IG9yZGVyZWRGcm9tQ2FsbGJhY2tzO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBFcnJvcignbXVzdCBwcm92aWRlIG9yZGVyZWQgb3IgY2FsbGJhY2tzJyk7XG4gICAgfVxuXG4gICAgY29uc3QgY2FsbGJhY2tzID0gb3B0aW9ucy5jYWxsYmFja3MgfHwge307XG5cbiAgICBpZiAodGhpcy5vcmRlcmVkKSB7XG4gICAgICB0aGlzLmRvY3MgPSBuZXcgT3JkZXJlZERpY3QoTW9uZ29JRC5pZFN0cmluZ2lmeSk7XG4gICAgICB0aGlzLmFwcGx5Q2hhbmdlID0ge1xuICAgICAgICBhZGRlZEJlZm9yZTogKGlkLCBmaWVsZHMsIGJlZm9yZSkgPT4ge1xuICAgICAgICAgIC8vIFRha2UgYSBzaGFsbG93IGNvcHkgc2luY2UgdGhlIHRvcC1sZXZlbCBwcm9wZXJ0aWVzIGNhbiBiZSBjaGFuZ2VkXG4gICAgICAgICAgY29uc3QgZG9jID0geyAuLi5maWVsZHMgfTtcblxuICAgICAgICAgIGRvYy5faWQgPSBpZDtcblxuICAgICAgICAgIGlmIChjYWxsYmFja3MuYWRkZWRCZWZvcmUpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5hZGRlZEJlZm9yZS5jYWxsKHRoaXMsIGlkLCBFSlNPTi5jbG9uZShmaWVsZHMpLCBiZWZvcmUpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFRoaXMgbGluZSB0cmlnZ2VycyBpZiB3ZSBwcm92aWRlIGFkZGVkIHdpdGggbW92ZWRCZWZvcmUuXG4gICAgICAgICAgaWYgKGNhbGxiYWNrcy5hZGRlZCkge1xuICAgICAgICAgICAgY2FsbGJhY2tzLmFkZGVkLmNhbGwodGhpcywgaWQsIEVKU09OLmNsb25lKGZpZWxkcykpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFhYWCBjb3VsZCBgYmVmb3JlYCBiZSBhIGZhbHN5IElEPyAgVGVjaG5pY2FsbHlcbiAgICAgICAgICAvLyBpZFN0cmluZ2lmeSBzZWVtcyB0byBhbGxvdyBmb3IgdGhlbSAtLSB0aG91Z2hcbiAgICAgICAgICAvLyBPcmRlcmVkRGljdCB3b24ndCBjYWxsIHN0cmluZ2lmeSBvbiBhIGZhbHN5IGFyZy5cbiAgICAgICAgICB0aGlzLmRvY3MucHV0QmVmb3JlKGlkLCBkb2MsIGJlZm9yZSB8fCBudWxsKTtcbiAgICAgICAgfSxcbiAgICAgICAgbW92ZWRCZWZvcmU6IChpZCwgYmVmb3JlKSA9PiB7XG4gICAgICAgICAgaWYgKGNhbGxiYWNrcy5tb3ZlZEJlZm9yZSkge1xuICAgICAgICAgICAgY2FsbGJhY2tzLm1vdmVkQmVmb3JlLmNhbGwodGhpcywgaWQsIGJlZm9yZSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5kb2NzLm1vdmVCZWZvcmUoaWQsIGJlZm9yZSB8fCBudWxsKTtcbiAgICAgICAgfSxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZG9jcyA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuICAgICAgdGhpcy5hcHBseUNoYW5nZSA9IHtcbiAgICAgICAgYWRkZWQ6IChpZCwgZmllbGRzKSA9PiB7XG4gICAgICAgICAgLy8gVGFrZSBhIHNoYWxsb3cgY29weSBzaW5jZSB0aGUgdG9wLWxldmVsIHByb3BlcnRpZXMgY2FuIGJlIGNoYW5nZWRcbiAgICAgICAgICBjb25zdCBkb2MgPSB7IC4uLmZpZWxkcyB9O1xuXG4gICAgICAgICAgaWYgKGNhbGxiYWNrcy5hZGRlZCkge1xuICAgICAgICAgICAgY2FsbGJhY2tzLmFkZGVkLmNhbGwodGhpcywgaWQsIEVKU09OLmNsb25lKGZpZWxkcykpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGRvYy5faWQgPSBpZDtcblxuICAgICAgICAgIHRoaXMuZG9jcy5zZXQoaWQsICBkb2MpO1xuICAgICAgICB9LFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBUaGUgbWV0aG9kcyBpbiBfSWRNYXAgYW5kIE9yZGVyZWREaWN0IHVzZWQgYnkgdGhlc2UgY2FsbGJhY2tzIGFyZVxuICAgIC8vIGlkZW50aWNhbC5cbiAgICB0aGlzLmFwcGx5Q2hhbmdlLmNoYW5nZWQgPSAoaWQsIGZpZWxkcykgPT4ge1xuICAgICAgY29uc3QgZG9jID0gdGhpcy5kb2NzLmdldChpZCk7XG5cbiAgICAgIGlmICghZG9jKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBpZCBmb3IgY2hhbmdlZDogJHtpZH1gKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNhbGxiYWNrcy5jaGFuZ2VkKSB7XG4gICAgICAgIGNhbGxiYWNrcy5jaGFuZ2VkLmNhbGwodGhpcywgaWQsIEVKU09OLmNsb25lKGZpZWxkcykpO1xuICAgICAgfVxuXG4gICAgICBEaWZmU2VxdWVuY2UuYXBwbHlDaGFuZ2VzKGRvYywgZmllbGRzKTtcbiAgICB9O1xuXG4gICAgdGhpcy5hcHBseUNoYW5nZS5yZW1vdmVkID0gaWQgPT4ge1xuICAgICAgaWYgKGNhbGxiYWNrcy5yZW1vdmVkKSB7XG4gICAgICAgIGNhbGxiYWNrcy5yZW1vdmVkLmNhbGwodGhpcywgaWQpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmRvY3MucmVtb3ZlKGlkKTtcbiAgICB9O1xuICB9XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX0lkTWFwID0gY2xhc3MgX0lkTWFwIGV4dGVuZHMgSWRNYXAge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihNb25nb0lELmlkU3RyaW5naWZ5LCBNb25nb0lELmlkUGFyc2UpO1xuICB9XG59O1xuXG4vLyBXcmFwIGEgdHJhbnNmb3JtIGZ1bmN0aW9uIHRvIHJldHVybiBvYmplY3RzIHRoYXQgaGF2ZSB0aGUgX2lkIGZpZWxkXG4vLyBvZiB0aGUgdW50cmFuc2Zvcm1lZCBkb2N1bWVudC4gVGhpcyBlbnN1cmVzIHRoYXQgc3Vic3lzdGVtcyBzdWNoIGFzXG4vLyB0aGUgb2JzZXJ2ZS1zZXF1ZW5jZSBwYWNrYWdlIHRoYXQgY2FsbCBgb2JzZXJ2ZWAgY2FuIGtlZXAgdHJhY2sgb2Zcbi8vIHRoZSBkb2N1bWVudHMgaWRlbnRpdGllcy5cbi8vXG4vLyAtIFJlcXVpcmUgdGhhdCBpdCByZXR1cm5zIG9iamVjdHNcbi8vIC0gSWYgdGhlIHJldHVybiB2YWx1ZSBoYXMgYW4gX2lkIGZpZWxkLCB2ZXJpZnkgdGhhdCBpdCBtYXRjaGVzIHRoZVxuLy8gICBvcmlnaW5hbCBfaWQgZmllbGRcbi8vIC0gSWYgdGhlIHJldHVybiB2YWx1ZSBkb2Vzbid0IGhhdmUgYW4gX2lkIGZpZWxkLCBhZGQgaXQgYmFjay5cbkxvY2FsQ29sbGVjdGlvbi53cmFwVHJhbnNmb3JtID0gdHJhbnNmb3JtID0+IHtcbiAgaWYgKCF0cmFuc2Zvcm0pIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIE5vIG5lZWQgdG8gZG91Ymx5LXdyYXAgdHJhbnNmb3Jtcy5cbiAgaWYgKHRyYW5zZm9ybS5fX3dyYXBwZWRUcmFuc2Zvcm1fXykge1xuICAgIHJldHVybiB0cmFuc2Zvcm07XG4gIH1cblxuICBjb25zdCB3cmFwcGVkID0gZG9jID0+IHtcbiAgICBpZiAoIWhhc093bi5jYWxsKGRvYywgJ19pZCcpKSB7XG4gICAgICAvLyBYWFggZG8gd2UgZXZlciBoYXZlIGEgdHJhbnNmb3JtIG9uIHRoZSBvcGxvZydzIGNvbGxlY3Rpb24/IGJlY2F1c2UgdGhhdFxuICAgICAgLy8gY29sbGVjdGlvbiBoYXMgbm8gX2lkLlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdjYW4gb25seSB0cmFuc2Zvcm0gZG9jdW1lbnRzIHdpdGggX2lkJyk7XG4gICAgfVxuXG4gICAgY29uc3QgaWQgPSBkb2MuX2lkO1xuXG4gICAgLy8gWFhYIGNvbnNpZGVyIG1ha2luZyB0cmFja2VyIGEgd2VhayBkZXBlbmRlbmN5IGFuZCBjaGVja2luZ1xuICAgIC8vIFBhY2thZ2UudHJhY2tlciBoZXJlXG4gICAgY29uc3QgdHJhbnNmb3JtZWQgPSBUcmFja2VyLm5vbnJlYWN0aXZlKCgpID0+IHRyYW5zZm9ybShkb2MpKTtcblxuICAgIGlmICghTG9jYWxDb2xsZWN0aW9uLl9pc1BsYWluT2JqZWN0KHRyYW5zZm9ybWVkKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd0cmFuc2Zvcm0gbXVzdCByZXR1cm4gb2JqZWN0Jyk7XG4gICAgfVxuXG4gICAgaWYgKGhhc093bi5jYWxsKHRyYW5zZm9ybWVkLCAnX2lkJykpIHtcbiAgICAgIGlmICghRUpTT04uZXF1YWxzKHRyYW5zZm9ybWVkLl9pZCwgaWQpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigndHJhbnNmb3JtZWQgZG9jdW1lbnQgY2FuXFwndCBoYXZlIGRpZmZlcmVudCBfaWQnKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdHJhbnNmb3JtZWQuX2lkID0gaWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRyYW5zZm9ybWVkO1xuICB9O1xuXG4gIHdyYXBwZWQuX193cmFwcGVkVHJhbnNmb3JtX18gPSB0cnVlO1xuXG4gIHJldHVybiB3cmFwcGVkO1xufTtcblxuLy8gWFhYIHRoZSBzb3J0ZWQtcXVlcnkgbG9naWMgYmVsb3cgaXMgbGF1Z2hhYmx5IGluZWZmaWNpZW50LiB3ZSdsbFxuLy8gbmVlZCB0byBjb21lIHVwIHdpdGggYSBiZXR0ZXIgZGF0YXN0cnVjdHVyZSBmb3IgdGhpcy5cbi8vXG4vLyBYWFggdGhlIGxvZ2ljIGZvciBvYnNlcnZpbmcgd2l0aCBhIHNraXAgb3IgYSBsaW1pdCBpcyBldmVuIG1vcmVcbi8vIGxhdWdoYWJseSBpbmVmZmljaWVudC4gd2UgcmVjb21wdXRlIHRoZSB3aG9sZSByZXN1bHRzIGV2ZXJ5IHRpbWUhXG5cbi8vIFRoaXMgYmluYXJ5IHNlYXJjaCBwdXRzIGEgdmFsdWUgYmV0d2VlbiBhbnkgZXF1YWwgdmFsdWVzLCBhbmQgdGhlIGZpcnN0XG4vLyBsZXNzZXIgdmFsdWUuXG5Mb2NhbENvbGxlY3Rpb24uX2JpbmFyeVNlYXJjaCA9IChjbXAsIGFycmF5LCB2YWx1ZSkgPT4ge1xuICBsZXQgZmlyc3QgPSAwO1xuICBsZXQgcmFuZ2UgPSBhcnJheS5sZW5ndGg7XG5cbiAgd2hpbGUgKHJhbmdlID4gMCkge1xuICAgIGNvbnN0IGhhbGZSYW5nZSA9IE1hdGguZmxvb3IocmFuZ2UgLyAyKTtcblxuICAgIGlmIChjbXAodmFsdWUsIGFycmF5W2ZpcnN0ICsgaGFsZlJhbmdlXSkgPj0gMCkge1xuICAgICAgZmlyc3QgKz0gaGFsZlJhbmdlICsgMTtcbiAgICAgIHJhbmdlIC09IGhhbGZSYW5nZSArIDE7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJhbmdlID0gaGFsZlJhbmdlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmaXJzdDtcbn07XG5cbkxvY2FsQ29sbGVjdGlvbi5fY2hlY2tTdXBwb3J0ZWRQcm9qZWN0aW9uID0gZmllbGRzID0+IHtcbiAgaWYgKGZpZWxkcyAhPT0gT2JqZWN0KGZpZWxkcykgfHwgQXJyYXkuaXNBcnJheShmaWVsZHMpKSB7XG4gICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJ2ZpZWxkcyBvcHRpb24gbXVzdCBiZSBhbiBvYmplY3QnKTtcbiAgfVxuXG4gIE9iamVjdC5rZXlzKGZpZWxkcykuZm9yRWFjaChrZXlQYXRoID0+IHtcbiAgICBpZiAoa2V5UGF0aC5zcGxpdCgnLicpLmluY2x1ZGVzKCckJykpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAnTWluaW1vbmdvIGRvZXNuXFwndCBzdXBwb3J0ICQgb3BlcmF0b3IgaW4gcHJvamVjdGlvbnMgeWV0LidcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgdmFsdWUgPSBmaWVsZHNba2V5UGF0aF07XG5cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJlxuICAgICAgICBbJyRlbGVtTWF0Y2gnLCAnJG1ldGEnLCAnJHNsaWNlJ10uc29tZShrZXkgPT5cbiAgICAgICAgICBoYXNPd24uY2FsbCh2YWx1ZSwga2V5KVxuICAgICAgICApKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgJ01pbmltb25nbyBkb2VzblxcJ3Qgc3VwcG9ydCBvcGVyYXRvcnMgaW4gcHJvamVjdGlvbnMgeWV0LidcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKCFbMSwgMCwgdHJ1ZSwgZmFsc2VdLmluY2x1ZGVzKHZhbHVlKSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICdQcm9qZWN0aW9uIHZhbHVlcyBzaG91bGQgYmUgb25lIG9mIDEsIDAsIHRydWUsIG9yIGZhbHNlJ1xuICAgICAgKTtcbiAgICB9XG4gIH0pO1xufTtcblxuLy8gS25vd3MgaG93IHRvIGNvbXBpbGUgYSBmaWVsZHMgcHJvamVjdGlvbiB0byBhIHByZWRpY2F0ZSBmdW5jdGlvbi5cbi8vIEByZXR1cm5zIC0gRnVuY3Rpb246IGEgY2xvc3VyZSB0aGF0IGZpbHRlcnMgb3V0IGFuIG9iamVjdCBhY2NvcmRpbmcgdG8gdGhlXG4vLyAgICAgICAgICAgIGZpZWxkcyBwcm9qZWN0aW9uIHJ1bGVzOlxuLy8gICAgICAgICAgICBAcGFyYW0gb2JqIC0gT2JqZWN0OiBNb25nb0RCLXN0eWxlZCBkb2N1bWVudFxuLy8gICAgICAgICAgICBAcmV0dXJucyAtIE9iamVjdDogYSBkb2N1bWVudCB3aXRoIHRoZSBmaWVsZHMgZmlsdGVyZWQgb3V0XG4vLyAgICAgICAgICAgICAgICAgICAgICAgYWNjb3JkaW5nIHRvIHByb2plY3Rpb24gcnVsZXMuIERvZXNuJ3QgcmV0YWluIHN1YmZpZWxkc1xuLy8gICAgICAgICAgICAgICAgICAgICAgIG9mIHBhc3NlZCBhcmd1bWVudC5cbkxvY2FsQ29sbGVjdGlvbi5fY29tcGlsZVByb2plY3Rpb24gPSBmaWVsZHMgPT4ge1xuICBMb2NhbENvbGxlY3Rpb24uX2NoZWNrU3VwcG9ydGVkUHJvamVjdGlvbihmaWVsZHMpO1xuXG4gIGNvbnN0IF9pZFByb2plY3Rpb24gPSBmaWVsZHMuX2lkID09PSB1bmRlZmluZWQgPyB0cnVlIDogZmllbGRzLl9pZDtcbiAgY29uc3QgZGV0YWlscyA9IHByb2plY3Rpb25EZXRhaWxzKGZpZWxkcyk7XG5cbiAgLy8gcmV0dXJucyB0cmFuc2Zvcm1lZCBkb2MgYWNjb3JkaW5nIHRvIHJ1bGVUcmVlXG4gIGNvbnN0IHRyYW5zZm9ybSA9IChkb2MsIHJ1bGVUcmVlKSA9PiB7XG4gICAgLy8gU3BlY2lhbCBjYXNlIGZvciBcInNldHNcIlxuICAgIGlmIChBcnJheS5pc0FycmF5KGRvYykpIHtcbiAgICAgIHJldHVybiBkb2MubWFwKHN1YmRvYyA9PiB0cmFuc2Zvcm0oc3ViZG9jLCBydWxlVHJlZSkpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IGRldGFpbHMuaW5jbHVkaW5nID8ge30gOiBFSlNPTi5jbG9uZShkb2MpO1xuXG4gICAgT2JqZWN0LmtleXMocnVsZVRyZWUpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIGlmIChkb2MgPT0gbnVsbCB8fCAhaGFzT3duLmNhbGwoZG9jLCBrZXkpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcnVsZSA9IHJ1bGVUcmVlW2tleV07XG5cbiAgICAgIGlmIChydWxlID09PSBPYmplY3QocnVsZSkpIHtcbiAgICAgICAgLy8gRm9yIHN1Yi1vYmplY3RzL3N1YnNldHMgd2UgYnJhbmNoXG4gICAgICAgIGlmIChkb2Nba2V5XSA9PT0gT2JqZWN0KGRvY1trZXldKSkge1xuICAgICAgICAgIHJlc3VsdFtrZXldID0gdHJhbnNmb3JtKGRvY1trZXldLCBydWxlKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChkZXRhaWxzLmluY2x1ZGluZykge1xuICAgICAgICAvLyBPdGhlcndpc2Ugd2UgZG9uJ3QgZXZlbiB0b3VjaCB0aGlzIHN1YmZpZWxkXG4gICAgICAgIHJlc3VsdFtrZXldID0gRUpTT04uY2xvbmUoZG9jW2tleV0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVsZXRlIHJlc3VsdFtrZXldO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGRvYyAhPSBudWxsID8gcmVzdWx0IDogZG9jO1xuICB9O1xuXG4gIHJldHVybiBkb2MgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IHRyYW5zZm9ybShkb2MsIGRldGFpbHMudHJlZSk7XG5cbiAgICBpZiAoX2lkUHJvamVjdGlvbiAmJiBoYXNPd24uY2FsbChkb2MsICdfaWQnKSkge1xuICAgICAgcmVzdWx0Ll9pZCA9IGRvYy5faWQ7XG4gICAgfVxuXG4gICAgaWYgKCFfaWRQcm9qZWN0aW9uICYmIGhhc093bi5jYWxsKHJlc3VsdCwgJ19pZCcpKSB7XG4gICAgICBkZWxldGUgcmVzdWx0Ll9pZDtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xufTtcblxuLy8gQ2FsY3VsYXRlcyB0aGUgZG9jdW1lbnQgdG8gaW5zZXJ0IGluIGNhc2Ugd2UncmUgZG9pbmcgYW4gdXBzZXJ0IGFuZCB0aGVcbi8vIHNlbGVjdG9yIGRvZXMgbm90IG1hdGNoIGFueSBlbGVtZW50c1xuTG9jYWxDb2xsZWN0aW9uLl9jcmVhdGVVcHNlcnREb2N1bWVudCA9IChzZWxlY3RvciwgbW9kaWZpZXIpID0+IHtcbiAgY29uc3Qgc2VsZWN0b3JEb2N1bWVudCA9IHBvcHVsYXRlRG9jdW1lbnRXaXRoUXVlcnlGaWVsZHMoc2VsZWN0b3IpO1xuICBjb25zdCBpc01vZGlmeSA9IExvY2FsQ29sbGVjdGlvbi5faXNNb2RpZmljYXRpb25Nb2QobW9kaWZpZXIpO1xuXG4gIGNvbnN0IG5ld0RvYyA9IHt9O1xuXG4gIGlmIChzZWxlY3RvckRvY3VtZW50Ll9pZCkge1xuICAgIG5ld0RvYy5faWQgPSBzZWxlY3RvckRvY3VtZW50Ll9pZDtcbiAgICBkZWxldGUgc2VsZWN0b3JEb2N1bWVudC5faWQ7XG4gIH1cblxuICAvLyBUaGlzIGRvdWJsZSBfbW9kaWZ5IGNhbGwgaXMgbWFkZSB0byBoZWxwIHdpdGggbmVzdGVkIHByb3BlcnRpZXMgKHNlZSBpc3N1ZVxuICAvLyAjODYzMSkuIFdlIGRvIHRoaXMgZXZlbiBpZiBpdCdzIGEgcmVwbGFjZW1lbnQgZm9yIHZhbGlkYXRpb24gcHVycG9zZXMgKGUuZy5cbiAgLy8gYW1iaWd1b3VzIGlkJ3MpXG4gIExvY2FsQ29sbGVjdGlvbi5fbW9kaWZ5KG5ld0RvYywgeyRzZXQ6IHNlbGVjdG9yRG9jdW1lbnR9KTtcbiAgTG9jYWxDb2xsZWN0aW9uLl9tb2RpZnkobmV3RG9jLCBtb2RpZmllciwge2lzSW5zZXJ0OiB0cnVlfSk7XG5cbiAgaWYgKGlzTW9kaWZ5KSB7XG4gICAgcmV0dXJuIG5ld0RvYztcbiAgfVxuXG4gIC8vIFJlcGxhY2VtZW50IGNhbiB0YWtlIF9pZCBmcm9tIHF1ZXJ5IGRvY3VtZW50XG4gIGNvbnN0IHJlcGxhY2VtZW50ID0gT2JqZWN0LmFzc2lnbih7fSwgbW9kaWZpZXIpO1xuICBpZiAobmV3RG9jLl9pZCkge1xuICAgIHJlcGxhY2VtZW50Ll9pZCA9IG5ld0RvYy5faWQ7XG4gIH1cblxuICByZXR1cm4gcmVwbGFjZW1lbnQ7XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX2RpZmZPYmplY3RzID0gKGxlZnQsIHJpZ2h0LCBjYWxsYmFja3MpID0+IHtcbiAgcmV0dXJuIERpZmZTZXF1ZW5jZS5kaWZmT2JqZWN0cyhsZWZ0LCByaWdodCwgY2FsbGJhY2tzKTtcbn07XG5cbi8vIG9yZGVyZWQ6IGJvb2wuXG4vLyBvbGRfcmVzdWx0cyBhbmQgbmV3X3Jlc3VsdHM6IGNvbGxlY3Rpb25zIG9mIGRvY3VtZW50cy5cbi8vICAgIGlmIG9yZGVyZWQsIHRoZXkgYXJlIGFycmF5cy5cbi8vICAgIGlmIHVub3JkZXJlZCwgdGhleSBhcmUgSWRNYXBzXG5Mb2NhbENvbGxlY3Rpb24uX2RpZmZRdWVyeUNoYW5nZXMgPSAob3JkZXJlZCwgb2xkUmVzdWx0cywgbmV3UmVzdWx0cywgb2JzZXJ2ZXIsIG9wdGlvbnMpID0+XG4gIERpZmZTZXF1ZW5jZS5kaWZmUXVlcnlDaGFuZ2VzKG9yZGVyZWQsIG9sZFJlc3VsdHMsIG5ld1Jlc3VsdHMsIG9ic2VydmVyLCBvcHRpb25zKVxuO1xuXG5Mb2NhbENvbGxlY3Rpb24uX2RpZmZRdWVyeU9yZGVyZWRDaGFuZ2VzID0gKG9sZFJlc3VsdHMsIG5ld1Jlc3VsdHMsIG9ic2VydmVyLCBvcHRpb25zKSA9PlxuICBEaWZmU2VxdWVuY2UuZGlmZlF1ZXJ5T3JkZXJlZENoYW5nZXMob2xkUmVzdWx0cywgbmV3UmVzdWx0cywgb2JzZXJ2ZXIsIG9wdGlvbnMpXG47XG5cbkxvY2FsQ29sbGVjdGlvbi5fZGlmZlF1ZXJ5VW5vcmRlcmVkQ2hhbmdlcyA9IChvbGRSZXN1bHRzLCBuZXdSZXN1bHRzLCBvYnNlcnZlciwgb3B0aW9ucykgPT5cbiAgRGlmZlNlcXVlbmNlLmRpZmZRdWVyeVVub3JkZXJlZENoYW5nZXMob2xkUmVzdWx0cywgbmV3UmVzdWx0cywgb2JzZXJ2ZXIsIG9wdGlvbnMpXG47XG5cbkxvY2FsQ29sbGVjdGlvbi5fZmluZEluT3JkZXJlZFJlc3VsdHMgPSAocXVlcnksIGRvYykgPT4ge1xuICBpZiAoIXF1ZXJ5Lm9yZGVyZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhblxcJ3QgY2FsbCBfZmluZEluT3JkZXJlZFJlc3VsdHMgb24gdW5vcmRlcmVkIHF1ZXJ5Jyk7XG4gIH1cblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXJ5LnJlc3VsdHMubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAocXVlcnkucmVzdWx0c1tpXSA9PT0gZG9jKSB7XG4gICAgICByZXR1cm4gaTtcbiAgICB9XG4gIH1cblxuICB0aHJvdyBFcnJvcignb2JqZWN0IG1pc3NpbmcgZnJvbSBxdWVyeScpO1xufTtcblxuLy8gSWYgdGhpcyBpcyBhIHNlbGVjdG9yIHdoaWNoIGV4cGxpY2l0bHkgY29uc3RyYWlucyB0aGUgbWF0Y2ggYnkgSUQgdG8gYSBmaW5pdGVcbi8vIG51bWJlciBvZiBkb2N1bWVudHMsIHJldHVybnMgYSBsaXN0IG9mIHRoZWlyIElEcy4gIE90aGVyd2lzZSByZXR1cm5zXG4vLyBudWxsLiBOb3RlIHRoYXQgdGhlIHNlbGVjdG9yIG1heSBoYXZlIG90aGVyIHJlc3RyaWN0aW9ucyBzbyBpdCBtYXkgbm90IGV2ZW5cbi8vIG1hdGNoIHRob3NlIGRvY3VtZW50ISAgV2UgY2FyZSBhYm91dCAkaW4gYW5kICRhbmQgc2luY2UgdGhvc2UgYXJlIGdlbmVyYXRlZFxuLy8gYWNjZXNzLWNvbnRyb2xsZWQgdXBkYXRlIGFuZCByZW1vdmUuXG5Mb2NhbENvbGxlY3Rpb24uX2lkc01hdGNoZWRCeVNlbGVjdG9yID0gc2VsZWN0b3IgPT4ge1xuICAvLyBJcyB0aGUgc2VsZWN0b3IganVzdCBhbiBJRD9cbiAgaWYgKExvY2FsQ29sbGVjdGlvbi5fc2VsZWN0b3JJc0lkKHNlbGVjdG9yKSkge1xuICAgIHJldHVybiBbc2VsZWN0b3JdO1xuICB9XG5cbiAgaWYgKCFzZWxlY3Rvcikge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gRG8gd2UgaGF2ZSBhbiBfaWQgY2xhdXNlP1xuICBpZiAoaGFzT3duLmNhbGwoc2VsZWN0b3IsICdfaWQnKSkge1xuICAgIC8vIElzIHRoZSBfaWQgY2xhdXNlIGp1c3QgYW4gSUQ/XG4gICAgaWYgKExvY2FsQ29sbGVjdGlvbi5fc2VsZWN0b3JJc0lkKHNlbGVjdG9yLl9pZCkpIHtcbiAgICAgIHJldHVybiBbc2VsZWN0b3IuX2lkXTtcbiAgICB9XG5cbiAgICAvLyBJcyB0aGUgX2lkIGNsYXVzZSB7X2lkOiB7JGluOiBbXCJ4XCIsIFwieVwiLCBcInpcIl19fT9cbiAgICBpZiAoc2VsZWN0b3IuX2lkXG4gICAgICAgICYmIEFycmF5LmlzQXJyYXkoc2VsZWN0b3IuX2lkLiRpbilcbiAgICAgICAgJiYgc2VsZWN0b3IuX2lkLiRpbi5sZW5ndGhcbiAgICAgICAgJiYgc2VsZWN0b3IuX2lkLiRpbi5ldmVyeShMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZCkpIHtcbiAgICAgIHJldHVybiBzZWxlY3Rvci5faWQuJGluO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gSWYgdGhpcyBpcyBhIHRvcC1sZXZlbCAkYW5kLCBhbmQgYW55IG9mIHRoZSBjbGF1c2VzIGNvbnN0cmFpbiB0aGVpclxuICAvLyBkb2N1bWVudHMsIHRoZW4gdGhlIHdob2xlIHNlbGVjdG9yIGlzIGNvbnN0cmFpbmVkIGJ5IGFueSBvbmUgY2xhdXNlJ3NcbiAgLy8gY29uc3RyYWludC4gKFdlbGwsIGJ5IHRoZWlyIGludGVyc2VjdGlvbiwgYnV0IHRoYXQgc2VlbXMgdW5saWtlbHkuKVxuICBpZiAoQXJyYXkuaXNBcnJheShzZWxlY3Rvci4kYW5kKSkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VsZWN0b3IuJGFuZC5sZW5ndGg7ICsraSkge1xuICAgICAgY29uc3Qgc3ViSWRzID0gTG9jYWxDb2xsZWN0aW9uLl9pZHNNYXRjaGVkQnlTZWxlY3RvcihzZWxlY3Rvci4kYW5kW2ldKTtcblxuICAgICAgaWYgKHN1Yklkcykge1xuICAgICAgICByZXR1cm4gc3ViSWRzO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBudWxsO1xufTtcblxuTG9jYWxDb2xsZWN0aW9uLl9pbnNlcnRJblJlc3VsdHNTeW5jID0gKHF1ZXJ5LCBkb2MpID0+IHtcbiAgY29uc3QgZmllbGRzID0gRUpTT04uY2xvbmUoZG9jKTtcblxuICBkZWxldGUgZmllbGRzLl9pZDtcblxuICBpZiAocXVlcnkub3JkZXJlZCkge1xuICAgIGlmICghcXVlcnkuc29ydGVyKSB7XG4gICAgICBxdWVyeS5hZGRlZEJlZm9yZShkb2MuX2lkLCBxdWVyeS5wcm9qZWN0aW9uRm4oZmllbGRzKSwgbnVsbCk7XG4gICAgICBxdWVyeS5yZXN1bHRzLnB1c2goZG9jKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgaSA9IExvY2FsQ29sbGVjdGlvbi5faW5zZXJ0SW5Tb3J0ZWRMaXN0KFxuICAgICAgICBxdWVyeS5zb3J0ZXIuZ2V0Q29tcGFyYXRvcih7ZGlzdGFuY2VzOiBxdWVyeS5kaXN0YW5jZXN9KSxcbiAgICAgICAgcXVlcnkucmVzdWx0cyxcbiAgICAgICAgZG9jXG4gICAgICApO1xuXG4gICAgICBsZXQgbmV4dCA9IHF1ZXJ5LnJlc3VsdHNbaSArIDFdO1xuICAgICAgaWYgKG5leHQpIHtcbiAgICAgICAgbmV4dCA9IG5leHQuX2lkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV4dCA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIHF1ZXJ5LmFkZGVkQmVmb3JlKGRvYy5faWQsIHF1ZXJ5LnByb2plY3Rpb25GbihmaWVsZHMpLCBuZXh0KTtcbiAgICB9XG5cbiAgICBxdWVyeS5hZGRlZChkb2MuX2lkLCBxdWVyeS5wcm9qZWN0aW9uRm4oZmllbGRzKSk7XG4gIH0gZWxzZSB7XG4gICAgcXVlcnkuYWRkZWQoZG9jLl9pZCwgcXVlcnkucHJvamVjdGlvbkZuKGZpZWxkcykpO1xuICAgIHF1ZXJ5LnJlc3VsdHMuc2V0KGRvYy5faWQsIGRvYyk7XG4gIH1cbn07XG5cbkxvY2FsQ29sbGVjdGlvbi5faW5zZXJ0SW5SZXN1bHRzQXN5bmMgPSBhc3luYyAocXVlcnksIGRvYykgPT4ge1xuICBjb25zdCBmaWVsZHMgPSBFSlNPTi5jbG9uZShkb2MpO1xuXG4gIGRlbGV0ZSBmaWVsZHMuX2lkO1xuXG4gIGlmIChxdWVyeS5vcmRlcmVkKSB7XG4gICAgaWYgKCFxdWVyeS5zb3J0ZXIpIHtcbiAgICAgIGF3YWl0IHF1ZXJ5LmFkZGVkQmVmb3JlKGRvYy5faWQsIHF1ZXJ5LnByb2plY3Rpb25GbihmaWVsZHMpLCBudWxsKTtcbiAgICAgIHF1ZXJ5LnJlc3VsdHMucHVzaChkb2MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBpID0gTG9jYWxDb2xsZWN0aW9uLl9pbnNlcnRJblNvcnRlZExpc3QoXG4gICAgICAgIHF1ZXJ5LnNvcnRlci5nZXRDb21wYXJhdG9yKHtkaXN0YW5jZXM6IHF1ZXJ5LmRpc3RhbmNlc30pLFxuICAgICAgICBxdWVyeS5yZXN1bHRzLFxuICAgICAgICBkb2NcbiAgICAgICk7XG5cbiAgICAgIGxldCBuZXh0ID0gcXVlcnkucmVzdWx0c1tpICsgMV07XG4gICAgICBpZiAobmV4dCkge1xuICAgICAgICBuZXh0ID0gbmV4dC5faWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXh0ID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgcXVlcnkuYWRkZWRCZWZvcmUoZG9jLl9pZCwgcXVlcnkucHJvamVjdGlvbkZuKGZpZWxkcyksIG5leHQpO1xuICAgIH1cblxuICAgIGF3YWl0IHF1ZXJ5LmFkZGVkKGRvYy5faWQsIHF1ZXJ5LnByb2plY3Rpb25GbihmaWVsZHMpKTtcbiAgfSBlbHNlIHtcbiAgICBhd2FpdCBxdWVyeS5hZGRlZChkb2MuX2lkLCBxdWVyeS5wcm9qZWN0aW9uRm4oZmllbGRzKSk7XG4gICAgcXVlcnkucmVzdWx0cy5zZXQoZG9jLl9pZCwgZG9jKTtcbiAgfVxufTtcblxuTG9jYWxDb2xsZWN0aW9uLl9pbnNlcnRJblNvcnRlZExpc3QgPSAoY21wLCBhcnJheSwgdmFsdWUpID0+IHtcbiAgaWYgKGFycmF5Lmxlbmd0aCA9PT0gMCkge1xuICAgIGFycmF5LnB1c2godmFsdWUpO1xuICAgIHJldHVybiAwO1xuICB9XG5cbiAgY29uc3QgaSA9IExvY2FsQ29sbGVjdGlvbi5fYmluYXJ5U2VhcmNoKGNtcCwgYXJyYXksIHZhbHVlKTtcblxuICBhcnJheS5zcGxpY2UoaSwgMCwgdmFsdWUpO1xuXG4gIHJldHVybiBpO1xufTtcblxuTG9jYWxDb2xsZWN0aW9uLl9pc01vZGlmaWNhdGlvbk1vZCA9IG1vZCA9PiB7XG4gIGxldCBpc01vZGlmeSA9IGZhbHNlO1xuICBsZXQgaXNSZXBsYWNlID0gZmFsc2U7XG5cbiAgT2JqZWN0LmtleXMobW9kKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgaWYgKGtleS5zdWJzdHIoMCwgMSkgPT09ICckJykge1xuICAgICAgaXNNb2RpZnkgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBpc1JlcGxhY2UgPSB0cnVlO1xuICAgIH1cbiAgfSk7XG5cbiAgaWYgKGlzTW9kaWZ5ICYmIGlzUmVwbGFjZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdVcGRhdGUgcGFyYW1ldGVyIGNhbm5vdCBoYXZlIGJvdGggbW9kaWZpZXIgYW5kIG5vbi1tb2RpZmllciBmaWVsZHMuJ1xuICAgICk7XG4gIH1cblxuICByZXR1cm4gaXNNb2RpZnk7XG59O1xuXG4vLyBYWFggbWF5YmUgdGhpcyBzaG91bGQgYmUgRUpTT04uaXNPYmplY3QsIHRob3VnaCBFSlNPTiBkb2Vzbid0IGtub3cgYWJvdXRcbi8vIFJlZ0V4cFxuLy8gWFhYIG5vdGUgdGhhdCBfdHlwZSh1bmRlZmluZWQpID09PSAzISEhIVxuTG9jYWxDb2xsZWN0aW9uLl9pc1BsYWluT2JqZWN0ID0geCA9PiB7XG4gIHJldHVybiB4ICYmIExvY2FsQ29sbGVjdGlvbi5fZi5fdHlwZSh4KSA9PT0gMztcbn07XG5cbi8vIFhYWCBuZWVkIGEgc3RyYXRlZ3kgZm9yIHBhc3NpbmcgdGhlIGJpbmRpbmcgb2YgJCBpbnRvIHRoaXNcbi8vIGZ1bmN0aW9uLCBmcm9tIHRoZSBjb21waWxlZCBzZWxlY3RvclxuLy9cbi8vIG1heWJlIGp1c3Qge2tleS51cC50by5qdXN0LmJlZm9yZS5kb2xsYXJzaWduOiBhcnJheV9pbmRleH1cbi8vXG4vLyBYWFggYXRvbWljaXR5OiBpZiBvbmUgbW9kaWZpY2F0aW9uIGZhaWxzLCBkbyB3ZSByb2xsIGJhY2sgdGhlIHdob2xlXG4vLyBjaGFuZ2U/XG4vL1xuLy8gb3B0aW9uczpcbi8vICAgLSBpc0luc2VydCBpcyBzZXQgd2hlbiBfbW9kaWZ5IGlzIGJlaW5nIGNhbGxlZCB0byBjb21wdXRlIHRoZSBkb2N1bWVudCB0b1xuLy8gICAgIGluc2VydCBhcyBwYXJ0IG9mIGFuIHVwc2VydCBvcGVyYXRpb24uIFdlIHVzZSB0aGlzIHByaW1hcmlseSB0byBmaWd1cmVcbi8vICAgICBvdXQgd2hlbiB0byBzZXQgdGhlIGZpZWxkcyBpbiAkc2V0T25JbnNlcnQsIGlmIHByZXNlbnQuXG5Mb2NhbENvbGxlY3Rpb24uX21vZGlmeSA9IChkb2MsIG1vZGlmaWVyLCBvcHRpb25zID0ge30pID0+IHtcbiAgaWYgKCFMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3QobW9kaWZpZXIpKSB7XG4gICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJ01vZGlmaWVyIG11c3QgYmUgYW4gb2JqZWN0Jyk7XG4gIH1cblxuICAvLyBNYWtlIHN1cmUgdGhlIGNhbGxlciBjYW4ndCBtdXRhdGUgb3VyIGRhdGEgc3RydWN0dXJlcy5cbiAgbW9kaWZpZXIgPSBFSlNPTi5jbG9uZShtb2RpZmllcik7XG5cbiAgY29uc3QgaXNNb2RpZmllciA9IGlzT3BlcmF0b3JPYmplY3QobW9kaWZpZXIpO1xuICBjb25zdCBuZXdEb2MgPSBpc01vZGlmaWVyID8gRUpTT04uY2xvbmUoZG9jKSA6IG1vZGlmaWVyO1xuXG4gIGlmIChpc01vZGlmaWVyKSB7XG4gICAgLy8gYXBwbHkgbW9kaWZpZXJzIHRvIHRoZSBkb2MuXG4gICAgT2JqZWN0LmtleXMobW9kaWZpZXIpLmZvckVhY2gob3BlcmF0b3IgPT4ge1xuICAgICAgLy8gVHJlYXQgJHNldE9uSW5zZXJ0IGFzICRzZXQgaWYgdGhpcyBpcyBhbiBpbnNlcnQuXG4gICAgICBjb25zdCBzZXRPbkluc2VydCA9IG9wdGlvbnMuaXNJbnNlcnQgJiYgb3BlcmF0b3IgPT09ICckc2V0T25JbnNlcnQnO1xuICAgICAgY29uc3QgbW9kRnVuYyA9IE1PRElGSUVSU1tzZXRPbkluc2VydCA/ICckc2V0JyA6IG9wZXJhdG9yXTtcbiAgICAgIGNvbnN0IG9wZXJhbmQgPSBtb2RpZmllcltvcGVyYXRvcl07XG5cbiAgICAgIGlmICghbW9kRnVuYykge1xuICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihgSW52YWxpZCBtb2RpZmllciBzcGVjaWZpZWQgJHtvcGVyYXRvcn1gKTtcbiAgICAgIH1cblxuICAgICAgT2JqZWN0LmtleXMob3BlcmFuZCkuZm9yRWFjaChrZXlwYXRoID0+IHtcbiAgICAgICAgY29uc3QgYXJnID0gb3BlcmFuZFtrZXlwYXRoXTtcblxuICAgICAgICBpZiAoa2V5cGF0aCA9PT0gJycpIHtcbiAgICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignQW4gZW1wdHkgdXBkYXRlIHBhdGggaXMgbm90IHZhbGlkLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qga2V5cGFydHMgPSBrZXlwYXRoLnNwbGl0KCcuJyk7XG5cbiAgICAgICAgaWYgKCFrZXlwYXJ0cy5ldmVyeShCb29sZWFuKSkge1xuICAgICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAgICAgYFRoZSB1cGRhdGUgcGF0aCAnJHtrZXlwYXRofScgY29udGFpbnMgYW4gZW1wdHkgZmllbGQgbmFtZSwgYCArXG4gICAgICAgICAgICAnd2hpY2ggaXMgbm90IGFsbG93ZWQuJ1xuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0YXJnZXQgPSBmaW5kTW9kVGFyZ2V0KG5ld0RvYywga2V5cGFydHMsIHtcbiAgICAgICAgICBhcnJheUluZGljZXM6IG9wdGlvbnMuYXJyYXlJbmRpY2VzLFxuICAgICAgICAgIGZvcmJpZEFycmF5OiBvcGVyYXRvciA9PT0gJyRyZW5hbWUnLFxuICAgICAgICAgIG5vQ3JlYXRlOiBOT19DUkVBVEVfTU9ESUZJRVJTW29wZXJhdG9yXVxuICAgICAgICB9KTtcblxuICAgICAgICBtb2RGdW5jKHRhcmdldCwga2V5cGFydHMucG9wKCksIGFyZywga2V5cGF0aCwgbmV3RG9jKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgaWYgKGRvYy5faWQgJiYgIUVKU09OLmVxdWFscyhkb2MuX2lkLCBuZXdEb2MuX2lkKSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgIGBBZnRlciBhcHBseWluZyB0aGUgdXBkYXRlIHRvIHRoZSBkb2N1bWVudCB7X2lkOiBcIiR7ZG9jLl9pZH1cIiwgLi4ufSxgICtcbiAgICAgICAgJyB0aGUgKGltbXV0YWJsZSkgZmllbGQgXFwnX2lkXFwnIHdhcyBmb3VuZCB0byBoYXZlIGJlZW4gYWx0ZXJlZCB0byAnICtcbiAgICAgICAgYF9pZDogXCIke25ld0RvYy5faWR9XCJgXG4gICAgICApO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoZG9jLl9pZCAmJiBtb2RpZmllci5faWQgJiYgIUVKU09OLmVxdWFscyhkb2MuX2lkLCBtb2RpZmllci5faWQpKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgYFRoZSBfaWQgZmllbGQgY2Fubm90IGJlIGNoYW5nZWQgZnJvbSB7X2lkOiBcIiR7ZG9jLl9pZH1cIn0gdG8gYCArXG4gICAgICAgIGB7X2lkOiBcIiR7bW9kaWZpZXIuX2lkfVwifWBcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gcmVwbGFjZSB0aGUgd2hvbGUgZG9jdW1lbnRcbiAgICBhc3NlcnRIYXNWYWxpZEZpZWxkTmFtZXMobW9kaWZpZXIpO1xuICB9XG5cbiAgLy8gbW92ZSBuZXcgZG9jdW1lbnQgaW50byBwbGFjZS5cbiAgT2JqZWN0LmtleXMoZG9jKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgLy8gTm90ZTogdGhpcyB1c2VkIHRvIGJlIGZvciAodmFyIGtleSBpbiBkb2MpIGhvd2V2ZXIsIHRoaXMgZG9lcyBub3RcbiAgICAvLyB3b3JrIHJpZ2h0IGluIE9wZXJhLiBEZWxldGluZyBmcm9tIGEgZG9jIHdoaWxlIGl0ZXJhdGluZyBvdmVyIGl0XG4gICAgLy8gd291bGQgc29tZXRpbWVzIGNhdXNlIG9wZXJhIHRvIHNraXAgc29tZSBrZXlzLlxuICAgIGlmIChrZXkgIT09ICdfaWQnKSB7XG4gICAgICBkZWxldGUgZG9jW2tleV07XG4gICAgfVxuICB9KTtcblxuICBPYmplY3Qua2V5cyhuZXdEb2MpLmZvckVhY2goa2V5ID0+IHtcbiAgICBkb2Nba2V5XSA9IG5ld0RvY1trZXldO1xuICB9KTtcbn07XG5cbkxvY2FsQ29sbGVjdGlvbi5fb2JzZXJ2ZUZyb21PYnNlcnZlQ2hhbmdlcyA9IChjdXJzb3IsIG9ic2VydmVDYWxsYmFja3MpID0+IHtcbiAgY29uc3QgdHJhbnNmb3JtID0gY3Vyc29yLmdldFRyYW5zZm9ybSgpIHx8IChkb2MgPT4gZG9jKTtcbiAgbGV0IHN1cHByZXNzZWQgPSAhIW9ic2VydmVDYWxsYmFja3MuX3N1cHByZXNzX2luaXRpYWw7XG5cbiAgbGV0IG9ic2VydmVDaGFuZ2VzQ2FsbGJhY2tzO1xuICBpZiAoTG9jYWxDb2xsZWN0aW9uLl9vYnNlcnZlQ2FsbGJhY2tzQXJlT3JkZXJlZChvYnNlcnZlQ2FsbGJhY2tzKSkge1xuICAgIC8vIFRoZSBcIl9ub19pbmRpY2VzXCIgb3B0aW9uIHNldHMgYWxsIGluZGV4IGFyZ3VtZW50cyB0byAtMSBhbmQgc2tpcHMgdGhlXG4gICAgLy8gbGluZWFyIHNjYW5zIHJlcXVpcmVkIHRvIGdlbmVyYXRlIHRoZW0uICBUaGlzIGxldHMgb2JzZXJ2ZXJzIHRoYXQgZG9uJ3RcbiAgICAvLyBuZWVkIGFic29sdXRlIGluZGljZXMgYmVuZWZpdCBmcm9tIHRoZSBvdGhlciBmZWF0dXJlcyBvZiB0aGlzIEFQSSAtLVxuICAgIC8vIHJlbGF0aXZlIG9yZGVyLCB0cmFuc2Zvcm1zLCBhbmQgYXBwbHlDaGFuZ2VzIC0tIHdpdGhvdXQgdGhlIHNwZWVkIGhpdC5cbiAgICBjb25zdCBpbmRpY2VzID0gIW9ic2VydmVDYWxsYmFja3MuX25vX2luZGljZXM7XG5cbiAgICBvYnNlcnZlQ2hhbmdlc0NhbGxiYWNrcyA9IHtcbiAgICAgIGFkZGVkQmVmb3JlKGlkLCBmaWVsZHMsIGJlZm9yZSkge1xuICAgICAgICBjb25zdCBjaGVjayA9IHN1cHByZXNzZWQgfHwgIShvYnNlcnZlQ2FsbGJhY2tzLmFkZGVkQXQgfHwgb2JzZXJ2ZUNhbGxiYWNrcy5hZGRlZClcbiAgICAgICAgaWYgKGNoZWNrKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZG9jID0gdHJhbnNmb3JtKE9iamVjdC5hc3NpZ24oZmllbGRzLCB7X2lkOiBpZH0pKTtcblxuICAgICAgICBpZiAob2JzZXJ2ZUNhbGxiYWNrcy5hZGRlZEF0KSB7XG4gICAgICAgICAgb2JzZXJ2ZUNhbGxiYWNrcy5hZGRlZEF0KFxuICAgICAgICAgICAgICBkb2MsXG4gICAgICAgICAgICAgIGluZGljZXNcbiAgICAgICAgICAgICAgICAgID8gYmVmb3JlXG4gICAgICAgICAgICAgICAgICAgICAgPyB0aGlzLmRvY3MuaW5kZXhPZihiZWZvcmUpXG4gICAgICAgICAgICAgICAgICAgICAgOiB0aGlzLmRvY3Muc2l6ZSgpXG4gICAgICAgICAgICAgICAgICA6IC0xLFxuICAgICAgICAgICAgICBiZWZvcmVcbiAgICAgICAgICApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9ic2VydmVDYWxsYmFja3MuYWRkZWQoZG9jKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGNoYW5nZWQoaWQsIGZpZWxkcykge1xuXG4gICAgICAgIGlmICghKG9ic2VydmVDYWxsYmFja3MuY2hhbmdlZEF0IHx8IG9ic2VydmVDYWxsYmFja3MuY2hhbmdlZCkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZG9jID0gRUpTT04uY2xvbmUodGhpcy5kb2NzLmdldChpZCkpO1xuICAgICAgICBpZiAoIWRvYykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBpZCBmb3IgY2hhbmdlZDogJHtpZH1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG9sZERvYyA9IHRyYW5zZm9ybShFSlNPTi5jbG9uZShkb2MpKTtcblxuICAgICAgICBEaWZmU2VxdWVuY2UuYXBwbHlDaGFuZ2VzKGRvYywgZmllbGRzKTtcblxuICAgICAgICBpZiAob2JzZXJ2ZUNhbGxiYWNrcy5jaGFuZ2VkQXQpIHtcbiAgICAgICAgICBvYnNlcnZlQ2FsbGJhY2tzLmNoYW5nZWRBdChcbiAgICAgICAgICAgICAgdHJhbnNmb3JtKGRvYyksXG4gICAgICAgICAgICAgIG9sZERvYyxcbiAgICAgICAgICAgICAgaW5kaWNlcyA/IHRoaXMuZG9jcy5pbmRleE9mKGlkKSA6IC0xXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvYnNlcnZlQ2FsbGJhY2tzLmNoYW5nZWQodHJhbnNmb3JtKGRvYyksIG9sZERvYyk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBtb3ZlZEJlZm9yZShpZCwgYmVmb3JlKSB7XG4gICAgICAgIGlmICghb2JzZXJ2ZUNhbGxiYWNrcy5tb3ZlZFRvKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZnJvbSA9IGluZGljZXMgPyB0aGlzLmRvY3MuaW5kZXhPZihpZCkgOiAtMTtcbiAgICAgICAgbGV0IHRvID0gaW5kaWNlc1xuICAgICAgICAgICAgPyBiZWZvcmVcbiAgICAgICAgICAgICAgICA/IHRoaXMuZG9jcy5pbmRleE9mKGJlZm9yZSlcbiAgICAgICAgICAgICAgICA6IHRoaXMuZG9jcy5zaXplKClcbiAgICAgICAgICAgIDogLTE7XG5cbiAgICAgICAgLy8gV2hlbiBub3QgbW92aW5nIGJhY2t3YXJkcywgYWRqdXN0IGZvciB0aGUgZmFjdCB0aGF0IHJlbW92aW5nIHRoZVxuICAgICAgICAvLyBkb2N1bWVudCBzbGlkZXMgZXZlcnl0aGluZyBiYWNrIG9uZSBzbG90LlxuICAgICAgICBpZiAodG8gPiBmcm9tKSB7XG4gICAgICAgICAgLS10bztcbiAgICAgICAgfVxuXG4gICAgICAgIG9ic2VydmVDYWxsYmFja3MubW92ZWRUbyhcbiAgICAgICAgICAgIHRyYW5zZm9ybShFSlNPTi5jbG9uZSh0aGlzLmRvY3MuZ2V0KGlkKSkpLFxuICAgICAgICAgICAgZnJvbSxcbiAgICAgICAgICAgIHRvLFxuICAgICAgICAgICAgYmVmb3JlIHx8IG51bGxcbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgICByZW1vdmVkKGlkKSB7XG4gICAgICAgIGlmICghKG9ic2VydmVDYWxsYmFja3MucmVtb3ZlZEF0IHx8IG9ic2VydmVDYWxsYmFja3MucmVtb3ZlZCkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0ZWNobmljYWxseSBtYXliZSB0aGVyZSBzaG91bGQgYmUgYW4gRUpTT04uY2xvbmUgaGVyZSwgYnV0IGl0J3MgYWJvdXRcbiAgICAgICAgLy8gdG8gYmUgcmVtb3ZlZCBmcm9tIHRoaXMuZG9jcyFcbiAgICAgICAgY29uc3QgZG9jID0gdHJhbnNmb3JtKHRoaXMuZG9jcy5nZXQoaWQpKTtcblxuICAgICAgICBpZiAob2JzZXJ2ZUNhbGxiYWNrcy5yZW1vdmVkQXQpIHtcbiAgICAgICAgICBvYnNlcnZlQ2FsbGJhY2tzLnJlbW92ZWRBdChkb2MsIGluZGljZXMgPyB0aGlzLmRvY3MuaW5kZXhPZihpZCkgOiAtMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2JzZXJ2ZUNhbGxiYWNrcy5yZW1vdmVkKGRvYyk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBvYnNlcnZlQ2hhbmdlc0NhbGxiYWNrcyA9IHtcbiAgICAgIGFkZGVkKGlkLCBmaWVsZHMpIHtcbiAgICAgICAgaWYgKCFzdXBwcmVzc2VkICYmIG9ic2VydmVDYWxsYmFja3MuYWRkZWQpIHtcbiAgICAgICAgICBvYnNlcnZlQ2FsbGJhY2tzLmFkZGVkKHRyYW5zZm9ybShPYmplY3QuYXNzaWduKGZpZWxkcywge19pZDogaWR9KSkpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgY2hhbmdlZChpZCwgZmllbGRzKSB7XG4gICAgICAgIGlmIChvYnNlcnZlQ2FsbGJhY2tzLmNoYW5nZWQpIHtcbiAgICAgICAgICBjb25zdCBvbGREb2MgPSB0aGlzLmRvY3MuZ2V0KGlkKTtcbiAgICAgICAgICBjb25zdCBkb2MgPSBFSlNPTi5jbG9uZShvbGREb2MpO1xuXG4gICAgICAgICAgRGlmZlNlcXVlbmNlLmFwcGx5Q2hhbmdlcyhkb2MsIGZpZWxkcyk7XG5cbiAgICAgICAgICBvYnNlcnZlQ2FsbGJhY2tzLmNoYW5nZWQoXG4gICAgICAgICAgICAgIHRyYW5zZm9ybShkb2MpLFxuICAgICAgICAgICAgICB0cmFuc2Zvcm0oRUpTT04uY2xvbmUob2xkRG9jKSlcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgcmVtb3ZlZChpZCkge1xuICAgICAgICBpZiAob2JzZXJ2ZUNhbGxiYWNrcy5yZW1vdmVkKSB7XG4gICAgICAgICAgb2JzZXJ2ZUNhbGxiYWNrcy5yZW1vdmVkKHRyYW5zZm9ybSh0aGlzLmRvY3MuZ2V0KGlkKSkpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICBjb25zdCBjaGFuZ2VPYnNlcnZlciA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0NhY2hpbmdDaGFuZ2VPYnNlcnZlcih7XG4gICAgY2FsbGJhY2tzOiBvYnNlcnZlQ2hhbmdlc0NhbGxiYWNrc1xuICB9KTtcblxuICAvLyBDYWNoaW5nQ2hhbmdlT2JzZXJ2ZXIgY2xvbmVzIGFsbCByZWNlaXZlZCBpbnB1dCBvbiBpdHMgY2FsbGJhY2tzXG4gIC8vIFNvIHdlIGNhbiBtYXJrIGl0IGFzIHNhZmUgdG8gcmVkdWNlIHRoZSBlanNvbiBjbG9uZXMuXG4gIC8vIFRoaXMgaXMgdGVzdGVkIGJ5IHRoZSBgbW9uZ28tbGl2ZWRhdGEgLSAoZXh0ZW5kZWQpIHNjcmliYmxpbmdgIHRlc3RzXG4gIGNoYW5nZU9ic2VydmVyLmFwcGx5Q2hhbmdlLl9mcm9tT2JzZXJ2ZSA9IHRydWU7XG4gIGNvbnN0IGhhbmRsZSA9IGN1cnNvci5vYnNlcnZlQ2hhbmdlcyhjaGFuZ2VPYnNlcnZlci5hcHBseUNoYW5nZSxcbiAgICAgIHsgbm9uTXV0YXRpbmdDYWxsYmFja3M6IHRydWUgfSk7XG5cbiAgLy8gSWYgbmVlZGVkLCByZS1lbmFibGUgY2FsbGJhY2tzIGFzIHNvb24gYXMgdGhlIGluaXRpYWwgYmF0Y2ggaXMgcmVhZHkuXG4gIGNvbnN0IHNldFN1cHByZXNzZWQgPSAoaCkgPT4ge1xuICAgIGlmIChoLmlzUmVhZHkpIHN1cHByZXNzZWQgPSBmYWxzZTtcbiAgICBlbHNlIGguaXNSZWFkeVByb21pc2U/LnRoZW4oKCkgPT4gKHN1cHByZXNzZWQgPSBmYWxzZSkpO1xuICB9O1xuICAvLyBXaGVuIHdlIGNhbGwgY3Vyc29yLm9ic2VydmVDaGFuZ2VzKCkgaXQgY2FuIGJlIHRoZSBvbiBmcm9tXG4gIC8vIHRoZSBtb25nbyBwYWNrYWdlIChpbnN0ZWFkIG9mIHRoZSBtaW5pbW9uZ28gb25lKSBhbmQgaXQgZG9lc24ndCBoYXZlIGlzUmVhZHkgYW5kIGlzUmVhZHlQcm9taXNlXG4gIGlmIChNZXRlb3IuX2lzUHJvbWlzZShoYW5kbGUpKSB7XG4gICAgaGFuZGxlLnRoZW4oc2V0U3VwcHJlc3NlZCk7XG4gIH0gZWxzZSB7XG4gICAgc2V0U3VwcHJlc3NlZChoYW5kbGUpO1xuICB9XG4gIHJldHVybiBoYW5kbGU7XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX29ic2VydmVDYWxsYmFja3NBcmVPcmRlcmVkID0gY2FsbGJhY2tzID0+IHtcbiAgaWYgKGNhbGxiYWNrcy5hZGRlZCAmJiBjYWxsYmFja3MuYWRkZWRBdCkge1xuICAgIHRocm93IG5ldyBFcnJvcignUGxlYXNlIHNwZWNpZnkgb25seSBvbmUgb2YgYWRkZWQoKSBhbmQgYWRkZWRBdCgpJyk7XG4gIH1cblxuICBpZiAoY2FsbGJhY2tzLmNoYW5nZWQgJiYgY2FsbGJhY2tzLmNoYW5nZWRBdCkge1xuICAgIHRocm93IG5ldyBFcnJvcignUGxlYXNlIHNwZWNpZnkgb25seSBvbmUgb2YgY2hhbmdlZCgpIGFuZCBjaGFuZ2VkQXQoKScpO1xuICB9XG5cbiAgaWYgKGNhbGxiYWNrcy5yZW1vdmVkICYmIGNhbGxiYWNrcy5yZW1vdmVkQXQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1BsZWFzZSBzcGVjaWZ5IG9ubHkgb25lIG9mIHJlbW92ZWQoKSBhbmQgcmVtb3ZlZEF0KCknKTtcbiAgfVxuXG4gIHJldHVybiAhIShcbiAgICBjYWxsYmFja3MuYWRkZWRBdCB8fFxuICAgIGNhbGxiYWNrcy5jaGFuZ2VkQXQgfHxcbiAgICBjYWxsYmFja3MubW92ZWRUbyB8fFxuICAgIGNhbGxiYWNrcy5yZW1vdmVkQXRcbiAgKTtcbn07XG5cbkxvY2FsQ29sbGVjdGlvbi5fb2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3NBcmVPcmRlcmVkID0gY2FsbGJhY2tzID0+IHtcbiAgaWYgKGNhbGxiYWNrcy5hZGRlZCAmJiBjYWxsYmFja3MuYWRkZWRCZWZvcmUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1BsZWFzZSBzcGVjaWZ5IG9ubHkgb25lIG9mIGFkZGVkKCkgYW5kIGFkZGVkQmVmb3JlKCknKTtcbiAgfVxuXG4gIHJldHVybiAhIShjYWxsYmFja3MuYWRkZWRCZWZvcmUgfHwgY2FsbGJhY2tzLm1vdmVkQmVmb3JlKTtcbn07XG5cbkxvY2FsQ29sbGVjdGlvbi5fcmVtb3ZlRnJvbVJlc3VsdHNTeW5jID0gKHF1ZXJ5LCBkb2MpID0+IHtcbiAgaWYgKHF1ZXJ5Lm9yZGVyZWQpIHtcbiAgICBjb25zdCBpID0gTG9jYWxDb2xsZWN0aW9uLl9maW5kSW5PcmRlcmVkUmVzdWx0cyhxdWVyeSwgZG9jKTtcblxuICAgIHF1ZXJ5LnJlbW92ZWQoZG9jLl9pZCk7XG4gICAgcXVlcnkucmVzdWx0cy5zcGxpY2UoaSwgMSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgaWQgPSBkb2MuX2lkOyAgLy8gaW4gY2FzZSBjYWxsYmFjayBtdXRhdGVzIGRvY1xuXG4gICAgcXVlcnkucmVtb3ZlZChkb2MuX2lkKTtcbiAgICBxdWVyeS5yZXN1bHRzLnJlbW92ZShpZCk7XG4gIH1cbn07XG5cbkxvY2FsQ29sbGVjdGlvbi5fcmVtb3ZlRnJvbVJlc3VsdHNBc3luYyA9IGFzeW5jIChxdWVyeSwgZG9jKSA9PiB7XG4gIGlmIChxdWVyeS5vcmRlcmVkKSB7XG4gICAgY29uc3QgaSA9IExvY2FsQ29sbGVjdGlvbi5fZmluZEluT3JkZXJlZFJlc3VsdHMocXVlcnksIGRvYyk7XG5cbiAgICBhd2FpdCBxdWVyeS5yZW1vdmVkKGRvYy5faWQpO1xuICAgIHF1ZXJ5LnJlc3VsdHMuc3BsaWNlKGksIDEpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGlkID0gZG9jLl9pZDsgIC8vIGluIGNhc2UgY2FsbGJhY2sgbXV0YXRlcyBkb2NcblxuICAgIGF3YWl0IHF1ZXJ5LnJlbW92ZWQoZG9jLl9pZCk7XG4gICAgcXVlcnkucmVzdWx0cy5yZW1vdmUoaWQpO1xuICB9XG59O1xuXG4vLyBJcyB0aGlzIHNlbGVjdG9yIGp1c3Qgc2hvcnRoYW5kIGZvciBsb29rdXAgYnkgX2lkP1xuTG9jYWxDb2xsZWN0aW9uLl9zZWxlY3RvcklzSWQgPSBzZWxlY3RvciA9PlxuICB0eXBlb2Ygc2VsZWN0b3IgPT09ICdudW1iZXInIHx8XG4gIHR5cGVvZiBzZWxlY3RvciA9PT0gJ3N0cmluZycgfHxcbiAgc2VsZWN0b3IgaW5zdGFuY2VvZiBNb25nb0lELk9iamVjdElEXG47XG5cbi8vIElzIHRoZSBzZWxlY3RvciBqdXN0IGxvb2t1cCBieSBfaWQgKHNob3J0aGFuZCBvciBub3QpP1xuTG9jYWxDb2xsZWN0aW9uLl9zZWxlY3RvcklzSWRQZXJoYXBzQXNPYmplY3QgPSBzZWxlY3RvciA9PlxuICBMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZChzZWxlY3RvcikgfHxcbiAgTG9jYWxDb2xsZWN0aW9uLl9zZWxlY3RvcklzSWQoc2VsZWN0b3IgJiYgc2VsZWN0b3IuX2lkKSAmJlxuICBPYmplY3Qua2V5cyhzZWxlY3RvcikubGVuZ3RoID09PSAxXG47XG5cbkxvY2FsQ29sbGVjdGlvbi5fdXBkYXRlSW5SZXN1bHRzU3luYyA9IChxdWVyeSwgZG9jLCBvbGRfZG9jKSA9PiB7XG4gIGlmICghRUpTT04uZXF1YWxzKGRvYy5faWQsIG9sZF9kb2MuX2lkKSkge1xuICAgIHRocm93IG5ldyBFcnJvcignQ2FuXFwndCBjaGFuZ2UgYSBkb2NcXCdzIF9pZCB3aGlsZSB1cGRhdGluZycpO1xuICB9XG5cbiAgY29uc3QgcHJvamVjdGlvbkZuID0gcXVlcnkucHJvamVjdGlvbkZuO1xuICBjb25zdCBjaGFuZ2VkRmllbGRzID0gRGlmZlNlcXVlbmNlLm1ha2VDaGFuZ2VkRmllbGRzKFxuICAgIHByb2plY3Rpb25Gbihkb2MpLFxuICAgIHByb2plY3Rpb25GbihvbGRfZG9jKVxuICApO1xuXG4gIGlmICghcXVlcnkub3JkZXJlZCkge1xuICAgIGlmIChPYmplY3Qua2V5cyhjaGFuZ2VkRmllbGRzKS5sZW5ndGgpIHtcbiAgICAgIHF1ZXJ5LmNoYW5nZWQoZG9jLl9pZCwgY2hhbmdlZEZpZWxkcyk7XG4gICAgICBxdWVyeS5yZXN1bHRzLnNldChkb2MuX2lkLCBkb2MpO1xuICAgIH1cblxuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IG9sZF9pZHggPSBMb2NhbENvbGxlY3Rpb24uX2ZpbmRJbk9yZGVyZWRSZXN1bHRzKHF1ZXJ5LCBkb2MpO1xuXG4gIGlmIChPYmplY3Qua2V5cyhjaGFuZ2VkRmllbGRzKS5sZW5ndGgpIHtcbiAgICBxdWVyeS5jaGFuZ2VkKGRvYy5faWQsIGNoYW5nZWRGaWVsZHMpO1xuICB9XG5cbiAgaWYgKCFxdWVyeS5zb3J0ZXIpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBqdXN0IHRha2UgaXQgb3V0IGFuZCBwdXQgaXQgYmFjayBpbiBhZ2FpbiwgYW5kIHNlZSBpZiB0aGUgaW5kZXggY2hhbmdlc1xuICBxdWVyeS5yZXN1bHRzLnNwbGljZShvbGRfaWR4LCAxKTtcblxuICBjb25zdCBuZXdfaWR4ID0gTG9jYWxDb2xsZWN0aW9uLl9pbnNlcnRJblNvcnRlZExpc3QoXG4gICAgcXVlcnkuc29ydGVyLmdldENvbXBhcmF0b3Ioe2Rpc3RhbmNlczogcXVlcnkuZGlzdGFuY2VzfSksXG4gICAgcXVlcnkucmVzdWx0cyxcbiAgICBkb2NcbiAgKTtcblxuICBpZiAob2xkX2lkeCAhPT0gbmV3X2lkeCkge1xuICAgIGxldCBuZXh0ID0gcXVlcnkucmVzdWx0c1tuZXdfaWR4ICsgMV07XG4gICAgaWYgKG5leHQpIHtcbiAgICAgIG5leHQgPSBuZXh0Ll9pZDtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV4dCA9IG51bGw7XG4gICAgfVxuXG4gICAgcXVlcnkubW92ZWRCZWZvcmUgJiYgcXVlcnkubW92ZWRCZWZvcmUoZG9jLl9pZCwgbmV4dCk7XG4gIH1cbn07XG5cbkxvY2FsQ29sbGVjdGlvbi5fdXBkYXRlSW5SZXN1bHRzQXN5bmMgPSBhc3luYyAocXVlcnksIGRvYywgb2xkX2RvYykgPT4ge1xuICBpZiAoIUVKU09OLmVxdWFscyhkb2MuX2lkLCBvbGRfZG9jLl9pZCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhblxcJ3QgY2hhbmdlIGEgZG9jXFwncyBfaWQgd2hpbGUgdXBkYXRpbmcnKTtcbiAgfVxuXG4gIGNvbnN0IHByb2plY3Rpb25GbiA9IHF1ZXJ5LnByb2plY3Rpb25GbjtcbiAgY29uc3QgY2hhbmdlZEZpZWxkcyA9IERpZmZTZXF1ZW5jZS5tYWtlQ2hhbmdlZEZpZWxkcyhcbiAgICBwcm9qZWN0aW9uRm4oZG9jKSxcbiAgICBwcm9qZWN0aW9uRm4ob2xkX2RvYylcbiAgKTtcblxuICBpZiAoIXF1ZXJ5Lm9yZGVyZWQpIHtcbiAgICBpZiAoT2JqZWN0LmtleXMoY2hhbmdlZEZpZWxkcykubGVuZ3RoKSB7XG4gICAgICBhd2FpdCBxdWVyeS5jaGFuZ2VkKGRvYy5faWQsIGNoYW5nZWRGaWVsZHMpO1xuICAgICAgcXVlcnkucmVzdWx0cy5zZXQoZG9jLl9pZCwgZG9jKTtcbiAgICB9XG5cbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBvbGRfaWR4ID0gTG9jYWxDb2xsZWN0aW9uLl9maW5kSW5PcmRlcmVkUmVzdWx0cyhxdWVyeSwgZG9jKTtcblxuICBpZiAoT2JqZWN0LmtleXMoY2hhbmdlZEZpZWxkcykubGVuZ3RoKSB7XG4gICAgYXdhaXQgcXVlcnkuY2hhbmdlZChkb2MuX2lkLCBjaGFuZ2VkRmllbGRzKTtcbiAgfVxuXG4gIGlmICghcXVlcnkuc29ydGVyKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8ganVzdCB0YWtlIGl0IG91dCBhbmQgcHV0IGl0IGJhY2sgaW4gYWdhaW4sIGFuZCBzZWUgaWYgdGhlIGluZGV4IGNoYW5nZXNcbiAgcXVlcnkucmVzdWx0cy5zcGxpY2Uob2xkX2lkeCwgMSk7XG5cbiAgY29uc3QgbmV3X2lkeCA9IExvY2FsQ29sbGVjdGlvbi5faW5zZXJ0SW5Tb3J0ZWRMaXN0KFxuICAgIHF1ZXJ5LnNvcnRlci5nZXRDb21wYXJhdG9yKHtkaXN0YW5jZXM6IHF1ZXJ5LmRpc3RhbmNlc30pLFxuICAgIHF1ZXJ5LnJlc3VsdHMsXG4gICAgZG9jXG4gICk7XG5cbiAgaWYgKG9sZF9pZHggIT09IG5ld19pZHgpIHtcbiAgICBsZXQgbmV4dCA9IHF1ZXJ5LnJlc3VsdHNbbmV3X2lkeCArIDFdO1xuICAgIGlmIChuZXh0KSB7XG4gICAgICBuZXh0ID0gbmV4dC5faWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHQgPSBudWxsO1xuICAgIH1cblxuICAgIHF1ZXJ5Lm1vdmVkQmVmb3JlICYmIGF3YWl0IHF1ZXJ5Lm1vdmVkQmVmb3JlKGRvYy5faWQsIG5leHQpO1xuICB9XG59O1xuXG5jb25zdCBNT0RJRklFUlMgPSB7XG4gICRjdXJyZW50RGF0ZSh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICBpZiAodHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgaGFzT3duLmNhbGwoYXJnLCAnJHR5cGUnKSkge1xuICAgICAgaWYgKGFyZy4kdHlwZSAhPT0gJ2RhdGUnKSB7XG4gICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAgICdNaW5pbW9uZ28gZG9lcyBjdXJyZW50bHkgb25seSBzdXBwb3J0IHRoZSBkYXRlIHR5cGUgaW4gJyArXG4gICAgICAgICAgJyRjdXJyZW50RGF0ZSBtb2RpZmllcnMnLFxuICAgICAgICAgIHtmaWVsZH1cbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGFyZyAhPT0gdHJ1ZSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJ0ludmFsaWQgJGN1cnJlbnREYXRlIG1vZGlmaWVyJywge2ZpZWxkfSk7XG4gICAgfVxuXG4gICAgdGFyZ2V0W2ZpZWxkXSA9IG5ldyBEYXRlKCk7XG4gIH0sXG4gICRpbmModGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgaWYgKHR5cGVvZiBhcmcgIT09ICdudW1iZXInKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignTW9kaWZpZXIgJGluYyBhbGxvd2VkIGZvciBudW1iZXJzIG9ubHknLCB7ZmllbGR9KTtcbiAgICB9XG5cbiAgICBpZiAoZmllbGQgaW4gdGFyZ2V0KSB7XG4gICAgICBpZiAodHlwZW9mIHRhcmdldFtmaWVsZF0gIT09ICdudW1iZXInKSB7XG4gICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAgICdDYW5ub3QgYXBwbHkgJGluYyBtb2RpZmllciB0byBub24tbnVtYmVyJyxcbiAgICAgICAgICB7ZmllbGR9XG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHRhcmdldFtmaWVsZF0gKz0gYXJnO1xuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXRbZmllbGRdID0gYXJnO1xuICAgIH1cbiAgfSxcbiAgJG1pbih0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICBpZiAodHlwZW9mIGFyZyAhPT0gJ251bWJlcicpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCdNb2RpZmllciAkbWluIGFsbG93ZWQgZm9yIG51bWJlcnMgb25seScsIHtmaWVsZH0pO1xuICAgIH1cblxuICAgIGlmIChmaWVsZCBpbiB0YXJnZXQpIHtcbiAgICAgIGlmICh0eXBlb2YgdGFyZ2V0W2ZpZWxkXSAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICAgJ0Nhbm5vdCBhcHBseSAkbWluIG1vZGlmaWVyIHRvIG5vbi1udW1iZXInLFxuICAgICAgICAgIHtmaWVsZH1cbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRhcmdldFtmaWVsZF0gPiBhcmcpIHtcbiAgICAgICAgdGFyZ2V0W2ZpZWxkXSA9IGFyZztcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGFyZ2V0W2ZpZWxkXSA9IGFyZztcbiAgICB9XG4gIH0sXG4gICRtYXgodGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgaWYgKHR5cGVvZiBhcmcgIT09ICdudW1iZXInKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignTW9kaWZpZXIgJG1heCBhbGxvd2VkIGZvciBudW1iZXJzIG9ubHknLCB7ZmllbGR9KTtcbiAgICB9XG5cbiAgICBpZiAoZmllbGQgaW4gdGFyZ2V0KSB7XG4gICAgICBpZiAodHlwZW9mIHRhcmdldFtmaWVsZF0gIT09ICdudW1iZXInKSB7XG4gICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAgICdDYW5ub3QgYXBwbHkgJG1heCBtb2RpZmllciB0byBub24tbnVtYmVyJyxcbiAgICAgICAgICB7ZmllbGR9XG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0YXJnZXRbZmllbGRdIDwgYXJnKSB7XG4gICAgICAgIHRhcmdldFtmaWVsZF0gPSBhcmc7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRhcmdldFtmaWVsZF0gPSBhcmc7XG4gICAgfVxuICB9LFxuICAkbXVsKHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIGlmICh0eXBlb2YgYXJnICE9PSAnbnVtYmVyJykge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJ01vZGlmaWVyICRtdWwgYWxsb3dlZCBmb3IgbnVtYmVycyBvbmx5Jywge2ZpZWxkfSk7XG4gICAgfVxuXG4gICAgaWYgKGZpZWxkIGluIHRhcmdldCkge1xuICAgICAgaWYgKHR5cGVvZiB0YXJnZXRbZmllbGRdICE9PSAnbnVtYmVyJykge1xuICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICAnQ2Fubm90IGFwcGx5ICRtdWwgbW9kaWZpZXIgdG8gbm9uLW51bWJlcicsXG4gICAgICAgICAge2ZpZWxkfVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICB0YXJnZXRbZmllbGRdICo9IGFyZztcbiAgICB9IGVsc2Uge1xuICAgICAgdGFyZ2V0W2ZpZWxkXSA9IDA7XG4gICAgfVxuICB9LFxuICAkcmVuYW1lKHRhcmdldCwgZmllbGQsIGFyZywga2V5cGF0aCwgZG9jKSB7XG4gICAgLy8gbm8gaWRlYSB3aHkgbW9uZ28gaGFzIHRoaXMgcmVzdHJpY3Rpb24uLlxuICAgIGlmIChrZXlwYXRoID09PSBhcmcpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCckcmVuYW1lIHNvdXJjZSBtdXN0IGRpZmZlciBmcm9tIHRhcmdldCcsIHtmaWVsZH0pO1xuICAgIH1cblxuICAgIGlmICh0YXJnZXQgPT09IG51bGwpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCckcmVuYW1lIHNvdXJjZSBmaWVsZCBpbnZhbGlkJywge2ZpZWxkfSk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBhcmcgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignJHJlbmFtZSB0YXJnZXQgbXVzdCBiZSBhIHN0cmluZycsIHtmaWVsZH0pO1xuICAgIH1cblxuICAgIGlmIChhcmcuaW5jbHVkZXMoJ1xcMCcpKSB7XG4gICAgICAvLyBOdWxsIGJ5dGVzIGFyZSBub3QgYWxsb3dlZCBpbiBNb25nbyBmaWVsZCBuYW1lc1xuICAgICAgLy8gaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9yZWZlcmVuY2UvbGltaXRzLyNSZXN0cmljdGlvbnMtb24tRmllbGQtTmFtZXNcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAnVGhlIFxcJ3RvXFwnIGZpZWxkIGZvciAkcmVuYW1lIGNhbm5vdCBjb250YWluIGFuIGVtYmVkZGVkIG51bGwgYnl0ZScsXG4gICAgICAgIHtmaWVsZH1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKHRhcmdldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgb2JqZWN0ID0gdGFyZ2V0W2ZpZWxkXTtcblxuICAgIGRlbGV0ZSB0YXJnZXRbZmllbGRdO1xuXG4gICAgY29uc3Qga2V5cGFydHMgPSBhcmcuc3BsaXQoJy4nKTtcbiAgICBjb25zdCB0YXJnZXQyID0gZmluZE1vZFRhcmdldChkb2MsIGtleXBhcnRzLCB7Zm9yYmlkQXJyYXk6IHRydWV9KTtcblxuICAgIGlmICh0YXJnZXQyID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignJHJlbmFtZSB0YXJnZXQgZmllbGQgaW52YWxpZCcsIHtmaWVsZH0pO1xuICAgIH1cblxuICAgIHRhcmdldDJba2V5cGFydHMucG9wKCldID0gb2JqZWN0O1xuICB9LFxuICAkc2V0KHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIGlmICh0YXJnZXQgIT09IE9iamVjdCh0YXJnZXQpKSB7IC8vIG5vdCBhbiBhcnJheSBvciBhbiBvYmplY3RcbiAgICAgIGNvbnN0IGVycm9yID0gTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICdDYW5ub3Qgc2V0IHByb3BlcnR5IG9uIG5vbi1vYmplY3QgZmllbGQnLFxuICAgICAgICB7ZmllbGR9XG4gICAgICApO1xuICAgICAgZXJyb3Iuc2V0UHJvcGVydHlFcnJvciA9IHRydWU7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG5cbiAgICBpZiAodGFyZ2V0ID09PSBudWxsKSB7XG4gICAgICBjb25zdCBlcnJvciA9IE1pbmltb25nb0Vycm9yKCdDYW5ub3Qgc2V0IHByb3BlcnR5IG9uIG51bGwnLCB7ZmllbGR9KTtcbiAgICAgIGVycm9yLnNldFByb3BlcnR5RXJyb3IgPSB0cnVlO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuXG4gICAgYXNzZXJ0SGFzVmFsaWRGaWVsZE5hbWVzKGFyZyk7XG5cbiAgICB0YXJnZXRbZmllbGRdID0gYXJnO1xuICB9LFxuICAkc2V0T25JbnNlcnQodGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgLy8gY29udmVydGVkIHRvIGAkc2V0YCBpbiBgX21vZGlmeWBcbiAgfSxcbiAgJHVuc2V0KHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIGlmICh0YXJnZXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgIGlmIChmaWVsZCBpbiB0YXJnZXQpIHtcbiAgICAgICAgICB0YXJnZXRbZmllbGRdID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVsZXRlIHRhcmdldFtmaWVsZF07XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAkcHVzaCh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICBpZiAodGFyZ2V0W2ZpZWxkXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0YXJnZXRbZmllbGRdID0gW107XG4gICAgfVxuXG4gICAgaWYgKCEodGFyZ2V0W2ZpZWxkXSBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJ0Nhbm5vdCBhcHBseSAkcHVzaCBtb2RpZmllciB0byBub24tYXJyYXknLCB7ZmllbGR9KTtcbiAgICB9XG5cbiAgICBpZiAoIShhcmcgJiYgYXJnLiRlYWNoKSkge1xuICAgICAgLy8gU2ltcGxlIG1vZGU6IG5vdCAkZWFjaFxuICAgICAgYXNzZXJ0SGFzVmFsaWRGaWVsZE5hbWVzKGFyZyk7XG5cbiAgICAgIHRhcmdldFtmaWVsZF0ucHVzaChhcmcpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gRmFuY3kgbW9kZTogJGVhY2ggKGFuZCBtYXliZSAkc2xpY2UgYW5kICRzb3J0IGFuZCAkcG9zaXRpb24pXG4gICAgY29uc3QgdG9QdXNoID0gYXJnLiRlYWNoO1xuICAgIGlmICghKHRvUHVzaCBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJyRlYWNoIG11c3QgYmUgYW4gYXJyYXknLCB7ZmllbGR9KTtcbiAgICB9XG5cbiAgICBhc3NlcnRIYXNWYWxpZEZpZWxkTmFtZXModG9QdXNoKTtcblxuICAgIC8vIFBhcnNlICRwb3NpdGlvblxuICAgIGxldCBwb3NpdGlvbiA9IHVuZGVmaW5lZDtcbiAgICBpZiAoJyRwb3NpdGlvbicgaW4gYXJnKSB7XG4gICAgICBpZiAodHlwZW9mIGFyZy4kcG9zaXRpb24gIT09ICdudW1iZXInKSB7XG4gICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCckcG9zaXRpb24gbXVzdCBiZSBhIG51bWVyaWMgdmFsdWUnLCB7ZmllbGR9KTtcbiAgICAgIH1cblxuICAgICAgLy8gWFhYIHNob3VsZCBjaGVjayB0byBtYWtlIHN1cmUgaW50ZWdlclxuICAgICAgaWYgKGFyZy4kcG9zaXRpb24gPCAwKSB7XG4gICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAgICckcG9zaXRpb24gaW4gJHB1c2ggbXVzdCBiZSB6ZXJvIG9yIHBvc2l0aXZlJyxcbiAgICAgICAgICB7ZmllbGR9XG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHBvc2l0aW9uID0gYXJnLiRwb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSAkc2xpY2UuXG4gICAgbGV0IHNsaWNlID0gdW5kZWZpbmVkO1xuICAgIGlmICgnJHNsaWNlJyBpbiBhcmcpIHtcbiAgICAgIGlmICh0eXBlb2YgYXJnLiRzbGljZSAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJyRzbGljZSBtdXN0IGJlIGEgbnVtZXJpYyB2YWx1ZScsIHtmaWVsZH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBYWFggc2hvdWxkIGNoZWNrIHRvIG1ha2Ugc3VyZSBpbnRlZ2VyXG4gICAgICBzbGljZSA9IGFyZy4kc2xpY2U7XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgJHNvcnQuXG4gICAgbGV0IHNvcnRGdW5jdGlvbiA9IHVuZGVmaW5lZDtcbiAgICBpZiAoYXJnLiRzb3J0KSB7XG4gICAgICBpZiAoc2xpY2UgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignJHNvcnQgcmVxdWlyZXMgJHNsaWNlIHRvIGJlIHByZXNlbnQnLCB7ZmllbGR9KTtcbiAgICAgIH1cblxuICAgICAgLy8gWFhYIHRoaXMgYWxsb3dzIHVzIHRvIHVzZSBhICRzb3J0IHdob3NlIHZhbHVlIGlzIGFuIGFycmF5LCBidXQgdGhhdCdzXG4gICAgICAvLyBhY3R1YWxseSBhbiBleHRlbnNpb24gb2YgdGhlIE5vZGUgZHJpdmVyLCBzbyBpdCB3b24ndCB3b3JrXG4gICAgICAvLyBzZXJ2ZXItc2lkZS4gQ291bGQgYmUgY29uZnVzaW5nIVxuICAgICAgLy8gWFhYIGlzIGl0IGNvcnJlY3QgdGhhdCB3ZSBkb24ndCBkbyBnZW8tc3R1ZmYgaGVyZT9cbiAgICAgIHNvcnRGdW5jdGlvbiA9IG5ldyBNaW5pbW9uZ28uU29ydGVyKGFyZy4kc29ydCkuZ2V0Q29tcGFyYXRvcigpO1xuXG4gICAgICB0b1B1c2guZm9yRWFjaChlbGVtZW50ID0+IHtcbiAgICAgICAgaWYgKExvY2FsQ29sbGVjdGlvbi5fZi5fdHlwZShlbGVtZW50KSAhPT0gMykge1xuICAgICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAgICAgJyRwdXNoIGxpa2UgbW9kaWZpZXJzIHVzaW5nICRzb3J0IHJlcXVpcmUgYWxsIGVsZW1lbnRzIHRvIGJlICcgK1xuICAgICAgICAgICAgJ29iamVjdHMnLFxuICAgICAgICAgICAge2ZpZWxkfVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEFjdHVhbGx5IHB1c2guXG4gICAgaWYgKHBvc2l0aW9uID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRvUHVzaC5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuICAgICAgICB0YXJnZXRbZmllbGRdLnB1c2goZWxlbWVudCk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qgc3BsaWNlQXJndW1lbnRzID0gW3Bvc2l0aW9uLCAwXTtcblxuICAgICAgdG9QdXNoLmZvckVhY2goZWxlbWVudCA9PiB7XG4gICAgICAgIHNwbGljZUFyZ3VtZW50cy5wdXNoKGVsZW1lbnQpO1xuICAgICAgfSk7XG5cbiAgICAgIHRhcmdldFtmaWVsZF0uc3BsaWNlKC4uLnNwbGljZUFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgLy8gQWN0dWFsbHkgc29ydC5cbiAgICBpZiAoc29ydEZ1bmN0aW9uKSB7XG4gICAgICB0YXJnZXRbZmllbGRdLnNvcnQoc29ydEZ1bmN0aW9uKTtcbiAgICB9XG5cbiAgICAvLyBBY3R1YWxseSBzbGljZS5cbiAgICBpZiAoc2xpY2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKHNsaWNlID09PSAwKSB7XG4gICAgICAgIHRhcmdldFtmaWVsZF0gPSBbXTsgLy8gZGlmZmVycyBmcm9tIEFycmF5LnNsaWNlIVxuICAgICAgfSBlbHNlIGlmIChzbGljZSA8IDApIHtcbiAgICAgICAgdGFyZ2V0W2ZpZWxkXSA9IHRhcmdldFtmaWVsZF0uc2xpY2Uoc2xpY2UpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGFyZ2V0W2ZpZWxkXSA9IHRhcmdldFtmaWVsZF0uc2xpY2UoMCwgc2xpY2UpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJHB1c2hBbGwodGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgaWYgKCEodHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignTW9kaWZpZXIgJHB1c2hBbGwvcHVsbEFsbCBhbGxvd2VkIGZvciBhcnJheXMgb25seScpO1xuICAgIH1cblxuICAgIGFzc2VydEhhc1ZhbGlkRmllbGROYW1lcyhhcmcpO1xuXG4gICAgY29uc3QgdG9QdXNoID0gdGFyZ2V0W2ZpZWxkXTtcblxuICAgIGlmICh0b1B1c2ggPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGFyZ2V0W2ZpZWxkXSA9IGFyZztcbiAgICB9IGVsc2UgaWYgKCEodG9QdXNoIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgJ0Nhbm5vdCBhcHBseSAkcHVzaEFsbCBtb2RpZmllciB0byBub24tYXJyYXknLFxuICAgICAgICB7ZmllbGR9XG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0b1B1c2gucHVzaCguLi5hcmcpO1xuICAgIH1cbiAgfSxcbiAgJGFkZFRvU2V0KHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIGxldCBpc0VhY2ggPSBmYWxzZTtcblxuICAgIGlmICh0eXBlb2YgYXJnID09PSAnb2JqZWN0Jykge1xuICAgICAgLy8gY2hlY2sgaWYgZmlyc3Qga2V5IGlzICckZWFjaCdcbiAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhhcmcpO1xuICAgICAgaWYgKGtleXNbMF0gPT09ICckZWFjaCcpIHtcbiAgICAgICAgaXNFYWNoID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB2YWx1ZXMgPSBpc0VhY2ggPyBhcmcuJGVhY2ggOiBbYXJnXTtcblxuICAgIGFzc2VydEhhc1ZhbGlkRmllbGROYW1lcyh2YWx1ZXMpO1xuXG4gICAgY29uc3QgdG9BZGQgPSB0YXJnZXRbZmllbGRdO1xuICAgIGlmICh0b0FkZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0YXJnZXRbZmllbGRdID0gdmFsdWVzO1xuICAgIH0gZWxzZSBpZiAoISh0b0FkZCBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICdDYW5ub3QgYXBwbHkgJGFkZFRvU2V0IG1vZGlmaWVyIHRvIG5vbi1hcnJheScsXG4gICAgICAgIHtmaWVsZH1cbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlcy5mb3JFYWNoKHZhbHVlID0+IHtcbiAgICAgICAgaWYgKHRvQWRkLnNvbWUoZWxlbWVudCA9PiBMb2NhbENvbGxlY3Rpb24uX2YuX2VxdWFsKHZhbHVlLCBlbGVtZW50KSkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0b0FkZC5wdXNoKHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJHBvcCh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICBpZiAodGFyZ2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0b1BvcCA9IHRhcmdldFtmaWVsZF07XG5cbiAgICBpZiAodG9Qb3AgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghKHRvUG9wIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignQ2Fubm90IGFwcGx5ICRwb3AgbW9kaWZpZXIgdG8gbm9uLWFycmF5Jywge2ZpZWxkfSk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBhcmcgPT09ICdudW1iZXInICYmIGFyZyA8IDApIHtcbiAgICAgIHRvUG9wLnNwbGljZSgwLCAxKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdG9Qb3AucG9wKCk7XG4gICAgfVxuICB9LFxuICAkcHVsbCh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICBpZiAodGFyZ2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0b1B1bGwgPSB0YXJnZXRbZmllbGRdO1xuICAgIGlmICh0b1B1bGwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghKHRvUHVsbCBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICdDYW5ub3QgYXBwbHkgJHB1bGwvcHVsbEFsbCBtb2RpZmllciB0byBub24tYXJyYXknLFxuICAgICAgICB7ZmllbGR9XG4gICAgICApO1xuICAgIH1cblxuICAgIGxldCBvdXQ7XG4gICAgaWYgKGFyZyAhPSBudWxsICYmIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmICEoYXJnIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICAvLyBYWFggd291bGQgYmUgbXVjaCBuaWNlciB0byBjb21waWxlIHRoaXMgb25jZSwgcmF0aGVyIHRoYW5cbiAgICAgIC8vIGZvciBlYWNoIGRvY3VtZW50IHdlIG1vZGlmeS4uIGJ1dCB1c3VhbGx5IHdlJ3JlIG5vdFxuICAgICAgLy8gbW9kaWZ5aW5nIHRoYXQgbWFueSBkb2N1bWVudHMsIHNvIHdlJ2xsIGxldCBpdCBzbGlkZSBmb3JcbiAgICAgIC8vIG5vd1xuXG4gICAgICAvLyBYWFggTWluaW1vbmdvLk1hdGNoZXIgaXNuJ3QgdXAgZm9yIHRoZSBqb2IsIGJlY2F1c2Ugd2UgbmVlZFxuICAgICAgLy8gdG8gcGVybWl0IHN0dWZmIGxpa2UgeyRwdWxsOiB7YTogeyRndDogNH19fS4uIHNvbWV0aGluZ1xuICAgICAgLy8gbGlrZSB7JGd0OiA0fSBpcyBub3Qgbm9ybWFsbHkgYSBjb21wbGV0ZSBzZWxlY3Rvci5cbiAgICAgIC8vIHNhbWUgaXNzdWUgYXMgJGVsZW1NYXRjaCBwb3NzaWJseT9cbiAgICAgIGNvbnN0IG1hdGNoZXIgPSBuZXcgTWluaW1vbmdvLk1hdGNoZXIoYXJnKTtcblxuICAgICAgb3V0ID0gdG9QdWxsLmZpbHRlcihlbGVtZW50ID0+ICFtYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyhlbGVtZW50KS5yZXN1bHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdXQgPSB0b1B1bGwuZmlsdGVyKGVsZW1lbnQgPT4gIUxvY2FsQ29sbGVjdGlvbi5fZi5fZXF1YWwoZWxlbWVudCwgYXJnKSk7XG4gICAgfVxuXG4gICAgdGFyZ2V0W2ZpZWxkXSA9IG91dDtcbiAgfSxcbiAgJHB1bGxBbGwodGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgaWYgKCEodHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgJ01vZGlmaWVyICRwdXNoQWxsL3B1bGxBbGwgYWxsb3dlZCBmb3IgYXJyYXlzIG9ubHknLFxuICAgICAgICB7ZmllbGR9XG4gICAgICApO1xuICAgIH1cblxuICAgIGlmICh0YXJnZXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRvUHVsbCA9IHRhcmdldFtmaWVsZF07XG5cbiAgICBpZiAodG9QdWxsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoISh0b1B1bGwgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAnQ2Fubm90IGFwcGx5ICRwdWxsL3B1bGxBbGwgbW9kaWZpZXIgdG8gbm9uLWFycmF5JyxcbiAgICAgICAge2ZpZWxkfVxuICAgICAgKTtcbiAgICB9XG5cbiAgICB0YXJnZXRbZmllbGRdID0gdG9QdWxsLmZpbHRlcihvYmplY3QgPT5cbiAgICAgICFhcmcuc29tZShlbGVtZW50ID0+IExvY2FsQ29sbGVjdGlvbi5fZi5fZXF1YWwob2JqZWN0LCBlbGVtZW50KSlcbiAgICApO1xuICB9LFxuICAkYml0KHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIC8vIFhYWCBtb25nbyBvbmx5IHN1cHBvcnRzICRiaXQgb24gaW50ZWdlcnMsIGFuZCB3ZSBvbmx5IHN1cHBvcnRcbiAgICAvLyBuYXRpdmUgamF2YXNjcmlwdCBudW1iZXJzIChkb3VibGVzKSBzbyBmYXIsIHNvIHdlIGNhbid0IHN1cHBvcnQgJGJpdFxuICAgIHRocm93IE1pbmltb25nb0Vycm9yKCckYml0IGlzIG5vdCBzdXBwb3J0ZWQnLCB7ZmllbGR9KTtcbiAgfSxcbiAgJHYoKSB7XG4gICAgLy8gQXMgZGlzY3Vzc2VkIGluIGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL2lzc3Vlcy85NjIzLFxuICAgIC8vIHRoZSBgJHZgIG9wZXJhdG9yIGlzIG5vdCBuZWVkZWQgYnkgTWV0ZW9yLCBidXQgcHJvYmxlbXMgY2FuIG9jY3VyIGlmXG4gICAgLy8gaXQncyBub3QgYXQgbGVhc3QgY2FsbGFibGUgKGFzIG9mIE1vbmdvID49IDMuNikuIEl0J3MgZGVmaW5lZCBoZXJlIGFzXG4gICAgLy8gYSBuby1vcCB0byB3b3JrIGFyb3VuZCB0aGVzZSBwcm9ibGVtcy5cbiAgfVxufTtcblxuY29uc3QgTk9fQ1JFQVRFX01PRElGSUVSUyA9IHtcbiAgJHBvcDogdHJ1ZSxcbiAgJHB1bGw6IHRydWUsXG4gICRwdWxsQWxsOiB0cnVlLFxuICAkcmVuYW1lOiB0cnVlLFxuICAkdW5zZXQ6IHRydWVcbn07XG5cbi8vIE1ha2Ugc3VyZSBmaWVsZCBuYW1lcyBkbyBub3QgY29udGFpbiBNb25nbyByZXN0cmljdGVkXG4vLyBjaGFyYWN0ZXJzICgnLicsICckJywgJ1xcMCcpLlxuLy8gaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9yZWZlcmVuY2UvbGltaXRzLyNSZXN0cmljdGlvbnMtb24tRmllbGQtTmFtZXNcbmNvbnN0IGludmFsaWRDaGFyTXNnID0ge1xuICAkOiAnc3RhcnQgd2l0aCBcXCckXFwnJyxcbiAgJy4nOiAnY29udGFpbiBcXCcuXFwnJyxcbiAgJ1xcMCc6ICdjb250YWluIG51bGwgYnl0ZXMnXG59O1xuXG4vLyBjaGVja3MgaWYgYWxsIGZpZWxkIG5hbWVzIGluIGFuIG9iamVjdCBhcmUgdmFsaWRcbmZ1bmN0aW9uIGFzc2VydEhhc1ZhbGlkRmllbGROYW1lcyhkb2MpIHtcbiAgaWYgKGRvYyAmJiB0eXBlb2YgZG9jID09PSAnb2JqZWN0Jykge1xuICAgIEpTT04uc3RyaW5naWZ5KGRvYywgKGtleSwgdmFsdWUpID0+IHtcbiAgICAgIGFzc2VydElzVmFsaWRGaWVsZE5hbWUoa2V5KTtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhc3NlcnRJc1ZhbGlkRmllbGROYW1lKGtleSkge1xuICBsZXQgbWF0Y2g7XG4gIGlmICh0eXBlb2Yga2V5ID09PSAnc3RyaW5nJyAmJiAobWF0Y2ggPSBrZXkubWF0Y2goL15cXCR8XFwufFxcMC8pKSkge1xuICAgIHRocm93IE1pbmltb25nb0Vycm9yKGBLZXkgJHtrZXl9IG11c3Qgbm90ICR7aW52YWxpZENoYXJNc2dbbWF0Y2hbMF1dfWApO1xuICB9XG59XG5cbi8vIGZvciBhLmIuYy4yLmQuZSwga2V5cGFydHMgc2hvdWxkIGJlIFsnYScsICdiJywgJ2MnLCAnMicsICdkJywgJ2UnXSxcbi8vIGFuZCB0aGVuIHlvdSB3b3VsZCBvcGVyYXRlIG9uIHRoZSAnZScgcHJvcGVydHkgb2YgdGhlIHJldHVybmVkXG4vLyBvYmplY3QuXG4vL1xuLy8gaWYgb3B0aW9ucy5ub0NyZWF0ZSBpcyBmYWxzZXksIGNyZWF0ZXMgaW50ZXJtZWRpYXRlIGxldmVscyBvZlxuLy8gc3RydWN0dXJlIGFzIG5lY2Vzc2FyeSwgbGlrZSBta2RpciAtcCAoYW5kIHJhaXNlcyBhbiBleGNlcHRpb24gaWZcbi8vIHRoYXQgd291bGQgbWVhbiBnaXZpbmcgYSBub24tbnVtZXJpYyBwcm9wZXJ0eSB0byBhbiBhcnJheS4pIGlmXG4vLyBvcHRpb25zLm5vQ3JlYXRlIGlzIHRydWUsIHJldHVybiB1bmRlZmluZWQgaW5zdGVhZC5cbi8vXG4vLyBtYXkgbW9kaWZ5IHRoZSBsYXN0IGVsZW1lbnQgb2Yga2V5cGFydHMgdG8gc2lnbmFsIHRvIHRoZSBjYWxsZXIgdGhhdCBpdCBuZWVkc1xuLy8gdG8gdXNlIGEgZGlmZmVyZW50IHZhbHVlIHRvIGluZGV4IGludG8gdGhlIHJldHVybmVkIG9iamVjdCAoZm9yIGV4YW1wbGUsXG4vLyBbJ2EnLCAnMDEnXSAtPiBbJ2EnLCAxXSkuXG4vL1xuLy8gaWYgZm9yYmlkQXJyYXkgaXMgdHJ1ZSwgcmV0dXJuIG51bGwgaWYgdGhlIGtleXBhdGggZ29lcyB0aHJvdWdoIGFuIGFycmF5LlxuLy9cbi8vIGlmIG9wdGlvbnMuYXJyYXlJbmRpY2VzIGlzIHNldCwgdXNlIGl0cyBmaXJzdCBlbGVtZW50IGZvciB0aGUgKGZpcnN0KSAnJCcgaW5cbi8vIHRoZSBwYXRoLlxuZnVuY3Rpb24gZmluZE1vZFRhcmdldChkb2MsIGtleXBhcnRzLCBvcHRpb25zID0ge30pIHtcbiAgbGV0IHVzZWRBcnJheUluZGV4ID0gZmFsc2U7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXlwYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGxhc3QgPSBpID09PSBrZXlwYXJ0cy5sZW5ndGggLSAxO1xuICAgIGxldCBrZXlwYXJ0ID0ga2V5cGFydHNbaV07XG5cbiAgICBpZiAoIWlzSW5kZXhhYmxlKGRvYykpIHtcbiAgICAgIGlmIChvcHRpb25zLm5vQ3JlYXRlKSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGVycm9yID0gTWluaW1vbmdvRXJyb3IoXG4gICAgICAgIGBjYW5ub3QgdXNlIHRoZSBwYXJ0ICcke2tleXBhcnR9JyB0byB0cmF2ZXJzZSAke2RvY31gXG4gICAgICApO1xuICAgICAgZXJyb3Iuc2V0UHJvcGVydHlFcnJvciA9IHRydWU7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG5cbiAgICBpZiAoZG9jIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgIGlmIChvcHRpb25zLmZvcmJpZEFycmF5KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBpZiAoa2V5cGFydCA9PT0gJyQnKSB7XG4gICAgICAgIGlmICh1c2VkQXJyYXlJbmRleCkge1xuICAgICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCdUb28gbWFueSBwb3NpdGlvbmFsIChpLmUuIFxcJyRcXCcpIGVsZW1lbnRzJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW9wdGlvbnMuYXJyYXlJbmRpY2VzIHx8ICFvcHRpb25zLmFycmF5SW5kaWNlcy5sZW5ndGgpIHtcbiAgICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICAgICdUaGUgcG9zaXRpb25hbCBvcGVyYXRvciBkaWQgbm90IGZpbmQgdGhlIG1hdGNoIG5lZWRlZCBmcm9tIHRoZSAnICtcbiAgICAgICAgICAgICdxdWVyeSdcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAga2V5cGFydCA9IG9wdGlvbnMuYXJyYXlJbmRpY2VzWzBdO1xuICAgICAgICB1c2VkQXJyYXlJbmRleCA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKGlzTnVtZXJpY0tleShrZXlwYXJ0KSkge1xuICAgICAgICBrZXlwYXJ0ID0gcGFyc2VJbnQoa2V5cGFydCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAob3B0aW9ucy5ub0NyZWF0ZSkge1xuICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICBgY2FuJ3QgYXBwZW5kIHRvIGFycmF5IHVzaW5nIHN0cmluZyBmaWVsZCBuYW1lIFske2tleXBhcnR9XWBcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGxhc3QpIHtcbiAgICAgICAga2V5cGFydHNbaV0gPSBrZXlwYXJ0OyAvLyBoYW5kbGUgJ2EuMDEnXG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLm5vQ3JlYXRlICYmIGtleXBhcnQgPj0gZG9jLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfVxuXG4gICAgICB3aGlsZSAoZG9jLmxlbmd0aCA8IGtleXBhcnQpIHtcbiAgICAgICAgZG9jLnB1c2gobnVsbCk7XG4gICAgICB9XG5cbiAgICAgIGlmICghbGFzdCkge1xuICAgICAgICBpZiAoZG9jLmxlbmd0aCA9PT0ga2V5cGFydCkge1xuICAgICAgICAgIGRvYy5wdXNoKHt9KTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZG9jW2tleXBhcnRdICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAgICAgYGNhbid0IG1vZGlmeSBmaWVsZCAnJHtrZXlwYXJ0c1tpICsgMV19JyBvZiBsaXN0IHZhbHVlIGAgK1xuICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoZG9jW2tleXBhcnRdKVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgYXNzZXJ0SXNWYWxpZEZpZWxkTmFtZShrZXlwYXJ0KTtcblxuICAgICAgaWYgKCEoa2V5cGFydCBpbiBkb2MpKSB7XG4gICAgICAgIGlmIChvcHRpb25zLm5vQ3JlYXRlKSB7XG4gICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghbGFzdCkge1xuICAgICAgICAgIGRvY1trZXlwYXJ0XSA9IHt9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGxhc3QpIHtcbiAgICAgIHJldHVybiBkb2M7XG4gICAgfVxuXG4gICAgZG9jID0gZG9jW2tleXBhcnRdO1xuICB9XG5cbiAgLy8gbm90cmVhY2hlZFxufVxuXG4iLCJpbXBvcnQgTG9jYWxDb2xsZWN0aW9uIGZyb20gJy4vbG9jYWxfY29sbGVjdGlvbi5qcyc7XG5pbXBvcnQge1xuICBjb21waWxlRG9jdW1lbnRTZWxlY3RvcixcbiAgaGFzT3duLFxuICBub3RoaW5nTWF0Y2hlcixcbn0gZnJvbSAnLi9jb21tb24uanMnO1xuXG5jb25zdCBEZWNpbWFsID0gUGFja2FnZVsnbW9uZ28tZGVjaW1hbCddPy5EZWNpbWFsIHx8IGNsYXNzIERlY2ltYWxTdHViIHt9XG5cbi8vIFRoZSBtaW5pbW9uZ28gc2VsZWN0b3IgY29tcGlsZXIhXG5cbi8vIFRlcm1pbm9sb2d5OlxuLy8gIC0gYSAnc2VsZWN0b3InIGlzIHRoZSBFSlNPTiBvYmplY3QgcmVwcmVzZW50aW5nIGEgc2VsZWN0b3Jcbi8vICAtIGEgJ21hdGNoZXInIGlzIGl0cyBjb21waWxlZCBmb3JtICh3aGV0aGVyIGEgZnVsbCBNaW5pbW9uZ28uTWF0Y2hlclxuLy8gICAgb2JqZWN0IG9yIG9uZSBvZiB0aGUgY29tcG9uZW50IGxhbWJkYXMgdGhhdCBtYXRjaGVzIHBhcnRzIG9mIGl0KVxuLy8gIC0gYSAncmVzdWx0IG9iamVjdCcgaXMgYW4gb2JqZWN0IHdpdGggYSAncmVzdWx0JyBmaWVsZCBhbmQgbWF5YmVcbi8vICAgIGRpc3RhbmNlIGFuZCBhcnJheUluZGljZXMuXG4vLyAgLSBhICdicmFuY2hlZCB2YWx1ZScgaXMgYW4gb2JqZWN0IHdpdGggYSAndmFsdWUnIGZpZWxkIGFuZCBtYXliZVxuLy8gICAgJ2RvbnRJdGVyYXRlJyBhbmQgJ2FycmF5SW5kaWNlcycuXG4vLyAgLSBhICdkb2N1bWVudCcgaXMgYSB0b3AtbGV2ZWwgb2JqZWN0IHRoYXQgY2FuIGJlIHN0b3JlZCBpbiBhIGNvbGxlY3Rpb24uXG4vLyAgLSBhICdsb29rdXAgZnVuY3Rpb24nIGlzIGEgZnVuY3Rpb24gdGhhdCB0YWtlcyBpbiBhIGRvY3VtZW50IGFuZCByZXR1cm5zXG4vLyAgICBhbiBhcnJheSBvZiAnYnJhbmNoZWQgdmFsdWVzJy5cbi8vICAtIGEgJ2JyYW5jaGVkIG1hdGNoZXInIG1hcHMgZnJvbSBhbiBhcnJheSBvZiBicmFuY2hlZCB2YWx1ZXMgdG8gYSByZXN1bHRcbi8vICAgIG9iamVjdC5cbi8vICAtIGFuICdlbGVtZW50IG1hdGNoZXInIG1hcHMgZnJvbSBhIHNpbmdsZSB2YWx1ZSB0byBhIGJvb2wuXG5cbi8vIE1haW4gZW50cnkgcG9pbnQuXG4vLyAgIHZhciBtYXRjaGVyID0gbmV3IE1pbmltb25nby5NYXRjaGVyKHthOiB7JGd0OiA1fX0pO1xuLy8gICBpZiAobWF0Y2hlci5kb2N1bWVudE1hdGNoZXMoe2E6IDd9KSkgLi4uXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNYXRjaGVyIHtcbiAgY29uc3RydWN0b3Ioc2VsZWN0b3IsIGlzVXBkYXRlKSB7XG4gICAgLy8gQSBzZXQgKG9iamVjdCBtYXBwaW5nIHN0cmluZyAtPiAqKSBvZiBhbGwgb2YgdGhlIGRvY3VtZW50IHBhdGhzIGxvb2tlZFxuICAgIC8vIGF0IGJ5IHRoZSBzZWxlY3Rvci4gQWxzbyBpbmNsdWRlcyB0aGUgZW1wdHkgc3RyaW5nIGlmIGl0IG1heSBsb29rIGF0IGFueVxuICAgIC8vIHBhdGggKGVnLCAkd2hlcmUpLlxuICAgIHRoaXMuX3BhdGhzID0ge307XG4gICAgLy8gU2V0IHRvIHRydWUgaWYgY29tcGlsYXRpb24gZmluZHMgYSAkbmVhci5cbiAgICB0aGlzLl9oYXNHZW9RdWVyeSA9IGZhbHNlO1xuICAgIC8vIFNldCB0byB0cnVlIGlmIGNvbXBpbGF0aW9uIGZpbmRzIGEgJHdoZXJlLlxuICAgIHRoaXMuX2hhc1doZXJlID0gZmFsc2U7XG4gICAgLy8gU2V0IHRvIGZhbHNlIGlmIGNvbXBpbGF0aW9uIGZpbmRzIGFueXRoaW5nIG90aGVyIHRoYW4gYSBzaW1wbGUgZXF1YWxpdHlcbiAgICAvLyBvciBvbmUgb3IgbW9yZSBvZiAnJGd0JywgJyRndGUnLCAnJGx0JywgJyRsdGUnLCAnJG5lJywgJyRpbicsICckbmluJyB1c2VkXG4gICAgLy8gd2l0aCBzY2FsYXJzIGFzIG9wZXJhbmRzLlxuICAgIHRoaXMuX2lzU2ltcGxlID0gdHJ1ZTtcbiAgICAvLyBTZXQgdG8gYSBkdW1teSBkb2N1bWVudCB3aGljaCBhbHdheXMgbWF0Y2hlcyB0aGlzIE1hdGNoZXIuIE9yIHNldCB0byBudWxsXG4gICAgLy8gaWYgc3VjaCBkb2N1bWVudCBpcyB0b28gaGFyZCB0byBmaW5kLlxuICAgIHRoaXMuX21hdGNoaW5nRG9jdW1lbnQgPSB1bmRlZmluZWQ7XG4gICAgLy8gQSBjbG9uZSBvZiB0aGUgb3JpZ2luYWwgc2VsZWN0b3IuIEl0IG1heSBqdXN0IGJlIGEgZnVuY3Rpb24gaWYgdGhlIHVzZXJcbiAgICAvLyBwYXNzZWQgaW4gYSBmdW5jdGlvbjsgb3RoZXJ3aXNlIGlzIGRlZmluaXRlbHkgYW4gb2JqZWN0IChlZywgSURzIGFyZVxuICAgIC8vIHRyYW5zbGF0ZWQgaW50byB7X2lkOiBJRH0gZmlyc3QuIFVzZWQgYnkgY2FuQmVjb21lVHJ1ZUJ5TW9kaWZpZXIgYW5kXG4gICAgLy8gU29ydGVyLl91c2VXaXRoTWF0Y2hlci5cbiAgICB0aGlzLl9zZWxlY3RvciA9IG51bGw7XG4gICAgdGhpcy5fZG9jTWF0Y2hlciA9IHRoaXMuX2NvbXBpbGVTZWxlY3RvcihzZWxlY3Rvcik7XG4gICAgLy8gU2V0IHRvIHRydWUgaWYgc2VsZWN0aW9uIGlzIGRvbmUgZm9yIGFuIHVwZGF0ZSBvcGVyYXRpb25cbiAgICAvLyBEZWZhdWx0IGlzIGZhbHNlXG4gICAgLy8gVXNlZCBmb3IgJG5lYXIgYXJyYXkgdXBkYXRlIChpc3N1ZSAjMzU5OSlcbiAgICB0aGlzLl9pc1VwZGF0ZSA9IGlzVXBkYXRlO1xuICB9XG5cbiAgZG9jdW1lbnRNYXRjaGVzKGRvYykge1xuICAgIGlmIChkb2MgIT09IE9iamVjdChkb2MpKSB7XG4gICAgICB0aHJvdyBFcnJvcignZG9jdW1lbnRNYXRjaGVzIG5lZWRzIGEgZG9jdW1lbnQnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fZG9jTWF0Y2hlcihkb2MpO1xuICB9XG5cbiAgaGFzR2VvUXVlcnkoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2hhc0dlb1F1ZXJ5O1xuICB9XG5cbiAgaGFzV2hlcmUoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2hhc1doZXJlO1xuICB9XG5cbiAgaXNTaW1wbGUoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2lzU2ltcGxlO1xuICB9XG5cbiAgLy8gR2l2ZW4gYSBzZWxlY3RvciwgcmV0dXJuIGEgZnVuY3Rpb24gdGhhdCB0YWtlcyBvbmUgYXJndW1lbnQsIGFcbiAgLy8gZG9jdW1lbnQuIEl0IHJldHVybnMgYSByZXN1bHQgb2JqZWN0LlxuICBfY29tcGlsZVNlbGVjdG9yKHNlbGVjdG9yKSB7XG4gICAgLy8geW91IGNhbiBwYXNzIGEgbGl0ZXJhbCBmdW5jdGlvbiBpbnN0ZWFkIG9mIGEgc2VsZWN0b3JcbiAgICBpZiAoc2VsZWN0b3IgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgdGhpcy5faXNTaW1wbGUgPSBmYWxzZTtcbiAgICAgIHRoaXMuX3NlbGVjdG9yID0gc2VsZWN0b3I7XG4gICAgICB0aGlzLl9yZWNvcmRQYXRoVXNlZCgnJyk7XG5cbiAgICAgIHJldHVybiBkb2MgPT4gKHtyZXN1bHQ6ICEhc2VsZWN0b3IuY2FsbChkb2MpfSk7XG4gICAgfVxuXG4gICAgLy8gc2hvcnRoYW5kIC0tIHNjYWxhciBfaWRcbiAgICBpZiAoTG9jYWxDb2xsZWN0aW9uLl9zZWxlY3RvcklzSWQoc2VsZWN0b3IpKSB7XG4gICAgICB0aGlzLl9zZWxlY3RvciA9IHtfaWQ6IHNlbGVjdG9yfTtcbiAgICAgIHRoaXMuX3JlY29yZFBhdGhVc2VkKCdfaWQnKTtcblxuICAgICAgcmV0dXJuIGRvYyA9PiAoe3Jlc3VsdDogRUpTT04uZXF1YWxzKGRvYy5faWQsIHNlbGVjdG9yKX0pO1xuICAgIH1cblxuICAgIC8vIHByb3RlY3QgYWdhaW5zdCBkYW5nZXJvdXMgc2VsZWN0b3JzLiAgZmFsc2V5IGFuZCB7X2lkOiBmYWxzZXl9IGFyZSBib3RoXG4gICAgLy8gbGlrZWx5IHByb2dyYW1tZXIgZXJyb3IsIGFuZCBub3Qgd2hhdCB5b3Ugd2FudCwgcGFydGljdWxhcmx5IGZvclxuICAgIC8vIGRlc3RydWN0aXZlIG9wZXJhdGlvbnMuXG4gICAgaWYgKCFzZWxlY3RvciB8fCBoYXNPd24uY2FsbChzZWxlY3RvciwgJ19pZCcpICYmICFzZWxlY3Rvci5faWQpIHtcbiAgICAgIHRoaXMuX2lzU2ltcGxlID0gZmFsc2U7XG4gICAgICByZXR1cm4gbm90aGluZ01hdGNoZXI7XG4gICAgfVxuXG4gICAgLy8gVG9wIGxldmVsIGNhbid0IGJlIGFuIGFycmF5IG9yIHRydWUgb3IgYmluYXJ5LlxuICAgIGlmIChBcnJheS5pc0FycmF5KHNlbGVjdG9yKSB8fFxuICAgICAgICBFSlNPTi5pc0JpbmFyeShzZWxlY3RvcikgfHxcbiAgICAgICAgdHlwZW9mIHNlbGVjdG9yID09PSAnYm9vbGVhbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBzZWxlY3RvcjogJHtzZWxlY3Rvcn1gKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zZWxlY3RvciA9IEVKU09OLmNsb25lKHNlbGVjdG9yKTtcblxuICAgIHJldHVybiBjb21waWxlRG9jdW1lbnRTZWxlY3RvcihzZWxlY3RvciwgdGhpcywge2lzUm9vdDogdHJ1ZX0pO1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIGxpc3Qgb2Yga2V5IHBhdGhzIHRoZSBnaXZlbiBzZWxlY3RvciBpcyBsb29raW5nIGZvci4gSXQgaW5jbHVkZXNcbiAgLy8gdGhlIGVtcHR5IHN0cmluZyBpZiB0aGVyZSBpcyBhICR3aGVyZS5cbiAgX2dldFBhdGhzKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9wYXRocyk7XG4gIH1cblxuICBfcmVjb3JkUGF0aFVzZWQocGF0aCkge1xuICAgIHRoaXMuX3BhdGhzW3BhdGhdID0gdHJ1ZTtcbiAgfVxufVxuXG4vLyBoZWxwZXJzIHVzZWQgYnkgY29tcGlsZWQgc2VsZWN0b3IgY29kZVxuTG9jYWxDb2xsZWN0aW9uLl9mID0ge1xuICAvLyBYWFggZm9yIF9hbGwgYW5kIF9pbiwgY29uc2lkZXIgYnVpbGRpbmcgJ2lucXVlcnknIGF0IGNvbXBpbGUgdGltZS4uXG4gIF90eXBlKHYpIHtcbiAgICBpZiAodHlwZW9mIHYgPT09ICdudW1iZXInKSB7XG4gICAgICByZXR1cm4gMTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHYgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gMjtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHYgPT09ICdib29sZWFuJykge1xuICAgICAgcmV0dXJuIDg7XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkodikpIHtcbiAgICAgIHJldHVybiA0O1xuICAgIH1cblxuICAgIGlmICh2ID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gMTA7XG4gICAgfVxuXG4gICAgLy8gbm90ZSB0aGF0IHR5cGVvZigveC8pID09PSBcIm9iamVjdFwiXG4gICAgaWYgKHYgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgIHJldHVybiAxMTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHYgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiAxMztcbiAgICB9XG5cbiAgICBpZiAodiBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgIHJldHVybiA5O1xuICAgIH1cblxuICAgIGlmIChFSlNPTi5pc0JpbmFyeSh2KSkge1xuICAgICAgcmV0dXJuIDU7XG4gICAgfVxuXG4gICAgaWYgKHYgaW5zdGFuY2VvZiBNb25nb0lELk9iamVjdElEKSB7XG4gICAgICByZXR1cm4gNztcbiAgICB9XG5cbiAgICBpZiAodiBpbnN0YW5jZW9mIERlY2ltYWwpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIC8vIG9iamVjdFxuICAgIHJldHVybiAzO1xuXG4gICAgLy8gWFhYIHN1cHBvcnQgc29tZS9hbGwgb2YgdGhlc2U6XG4gICAgLy8gMTQsIHN5bWJvbFxuICAgIC8vIDE1LCBqYXZhc2NyaXB0IGNvZGUgd2l0aCBzY29wZVxuICAgIC8vIDE2LCAxODogMzItYml0LzY0LWJpdCBpbnRlZ2VyXG4gICAgLy8gMTcsIHRpbWVzdGFtcFxuICAgIC8vIDI1NSwgbWlua2V5XG4gICAgLy8gMTI3LCBtYXhrZXlcbiAgfSxcblxuICAvLyBkZWVwIGVxdWFsaXR5IHRlc3Q6IHVzZSBmb3IgbGl0ZXJhbCBkb2N1bWVudCBhbmQgYXJyYXkgbWF0Y2hlc1xuICBfZXF1YWwoYSwgYikge1xuICAgIHJldHVybiBFSlNPTi5lcXVhbHMoYSwgYiwge2tleU9yZGVyU2Vuc2l0aXZlOiB0cnVlfSk7XG4gIH0sXG5cbiAgLy8gbWFwcyBhIHR5cGUgY29kZSB0byBhIHZhbHVlIHRoYXQgY2FuIGJlIHVzZWQgdG8gc29ydCB2YWx1ZXMgb2YgZGlmZmVyZW50XG4gIC8vIHR5cGVzXG4gIF90eXBlb3JkZXIodCkge1xuICAgIC8vIGh0dHA6Ly93d3cubW9uZ29kYi5vcmcvZGlzcGxheS9ET0NTL1doYXQraXMrdGhlK0NvbXBhcmUrT3JkZXIrZm9yK0JTT04rVHlwZXNcbiAgICAvLyBYWFggd2hhdCBpcyB0aGUgY29ycmVjdCBzb3J0IHBvc2l0aW9uIGZvciBKYXZhc2NyaXB0IGNvZGU/XG4gICAgLy8gKCcxMDAnIGluIHRoZSBtYXRyaXggYmVsb3cpXG4gICAgLy8gWFhYIG1pbmtleS9tYXhrZXlcbiAgICByZXR1cm4gW1xuICAgICAgLTEsICAvLyAobm90IGEgdHlwZSlcbiAgICAgIDEsICAgLy8gbnVtYmVyXG4gICAgICAyLCAgIC8vIHN0cmluZ1xuICAgICAgMywgICAvLyBvYmplY3RcbiAgICAgIDQsICAgLy8gYXJyYXlcbiAgICAgIDUsICAgLy8gYmluYXJ5XG4gICAgICAtMSwgIC8vIGRlcHJlY2F0ZWRcbiAgICAgIDYsICAgLy8gT2JqZWN0SURcbiAgICAgIDcsICAgLy8gYm9vbFxuICAgICAgOCwgICAvLyBEYXRlXG4gICAgICAwLCAgIC8vIG51bGxcbiAgICAgIDksICAgLy8gUmVnRXhwXG4gICAgICAtMSwgIC8vIGRlcHJlY2F0ZWRcbiAgICAgIDEwMCwgLy8gSlMgY29kZVxuICAgICAgMiwgICAvLyBkZXByZWNhdGVkIChzeW1ib2wpXG4gICAgICAxMDAsIC8vIEpTIGNvZGVcbiAgICAgIDEsICAgLy8gMzItYml0IGludFxuICAgICAgOCwgICAvLyBNb25nbyB0aW1lc3RhbXBcbiAgICAgIDEgICAgLy8gNjQtYml0IGludFxuICAgIF1bdF07XG4gIH0sXG5cbiAgLy8gY29tcGFyZSB0d28gdmFsdWVzIG9mIHVua25vd24gdHlwZSBhY2NvcmRpbmcgdG8gQlNPTiBvcmRlcmluZ1xuICAvLyBzZW1hbnRpY3MuIChhcyBhbiBleHRlbnNpb24sIGNvbnNpZGVyICd1bmRlZmluZWQnIHRvIGJlIGxlc3MgdGhhblxuICAvLyBhbnkgb3RoZXIgdmFsdWUuKSByZXR1cm4gbmVnYXRpdmUgaWYgYSBpcyBsZXNzLCBwb3NpdGl2ZSBpZiBiIGlzXG4gIC8vIGxlc3MsIG9yIDAgaWYgZXF1YWxcbiAgX2NtcChhLCBiKSB7XG4gICAgaWYgKGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGIgPT09IHVuZGVmaW5lZCA/IDAgOiAtMTtcbiAgICB9XG5cbiAgICBpZiAoYiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gMTtcbiAgICB9XG5cbiAgICBsZXQgdGEgPSBMb2NhbENvbGxlY3Rpb24uX2YuX3R5cGUoYSk7XG4gICAgbGV0IHRiID0gTG9jYWxDb2xsZWN0aW9uLl9mLl90eXBlKGIpO1xuXG4gICAgY29uc3Qgb2EgPSBMb2NhbENvbGxlY3Rpb24uX2YuX3R5cGVvcmRlcih0YSk7XG4gICAgY29uc3Qgb2IgPSBMb2NhbENvbGxlY3Rpb24uX2YuX3R5cGVvcmRlcih0Yik7XG5cbiAgICBpZiAob2EgIT09IG9iKSB7XG4gICAgICByZXR1cm4gb2EgPCBvYiA/IC0xIDogMTtcbiAgICB9XG5cbiAgICAvLyBYWFggbmVlZCB0byBpbXBsZW1lbnQgdGhpcyBpZiB3ZSBpbXBsZW1lbnQgU3ltYm9sIG9yIGludGVnZXJzLCBvclxuICAgIC8vIFRpbWVzdGFtcFxuICAgIGlmICh0YSAhPT0gdGIpIHtcbiAgICAgIHRocm93IEVycm9yKCdNaXNzaW5nIHR5cGUgY29lcmNpb24gbG9naWMgaW4gX2NtcCcpO1xuICAgIH1cblxuICAgIGlmICh0YSA9PT0gNykgeyAvLyBPYmplY3RJRFxuICAgICAgLy8gQ29udmVydCB0byBzdHJpbmcuXG4gICAgICB0YSA9IHRiID0gMjtcbiAgICAgIGEgPSBhLnRvSGV4U3RyaW5nKCk7XG4gICAgICBiID0gYi50b0hleFN0cmluZygpO1xuICAgIH1cblxuICAgIGlmICh0YSA9PT0gOSkgeyAvLyBEYXRlXG4gICAgICAvLyBDb252ZXJ0IHRvIG1pbGxpcy5cbiAgICAgIHRhID0gdGIgPSAxO1xuICAgICAgYSA9IGlzTmFOKGEpID8gMCA6IGEuZ2V0VGltZSgpO1xuICAgICAgYiA9IGlzTmFOKGIpID8gMCA6IGIuZ2V0VGltZSgpO1xuICAgIH1cblxuICAgIGlmICh0YSA9PT0gMSkgeyAvLyBkb3VibGVcbiAgICAgIGlmIChhIGluc3RhbmNlb2YgRGVjaW1hbCkge1xuICAgICAgICByZXR1cm4gYS5taW51cyhiKS50b051bWJlcigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGEgLSBiO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0YiA9PT0gMikgLy8gc3RyaW5nXG4gICAgICByZXR1cm4gYSA8IGIgPyAtMSA6IGEgPT09IGIgPyAwIDogMTtcblxuICAgIGlmICh0YSA9PT0gMykgeyAvLyBPYmplY3RcbiAgICAgIC8vIHRoaXMgY291bGQgYmUgbXVjaCBtb3JlIGVmZmljaWVudCBpbiB0aGUgZXhwZWN0ZWQgY2FzZSAuLi5cbiAgICAgIGNvbnN0IHRvQXJyYXkgPSBvYmplY3QgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBbXTtcblxuICAgICAgICBPYmplY3Qua2V5cyhvYmplY3QpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgICAgICByZXN1bHQucHVzaChrZXksIG9iamVjdFtrZXldKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH07XG5cbiAgICAgIHJldHVybiBMb2NhbENvbGxlY3Rpb24uX2YuX2NtcCh0b0FycmF5KGEpLCB0b0FycmF5KGIpKTtcbiAgICB9XG5cbiAgICBpZiAodGEgPT09IDQpIHsgLy8gQXJyYXlcbiAgICAgIGZvciAobGV0IGkgPSAwOyA7IGkrKykge1xuICAgICAgICBpZiAoaSA9PT0gYS5sZW5ndGgpIHtcbiAgICAgICAgICByZXR1cm4gaSA9PT0gYi5sZW5ndGggPyAwIDogLTE7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaSA9PT0gYi5sZW5ndGgpIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHMgPSBMb2NhbENvbGxlY3Rpb24uX2YuX2NtcChhW2ldLCBiW2ldKTtcbiAgICAgICAgaWYgKHMgIT09IDApIHtcbiAgICAgICAgICByZXR1cm4gcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0YSA9PT0gNSkgeyAvLyBiaW5hcnlcbiAgICAgIC8vIFN1cnByaXNpbmdseSwgYSBzbWFsbCBiaW5hcnkgYmxvYiBpcyBhbHdheXMgbGVzcyB0aGFuIGEgbGFyZ2Ugb25lIGluXG4gICAgICAvLyBNb25nby5cbiAgICAgIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGEubGVuZ3RoIC0gYi5sZW5ndGg7XG4gICAgICB9XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoYVtpXSA8IGJbaV0pIHtcbiAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYVtpXSA+IGJbaV0pIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBpZiAodGEgPT09IDgpIHsgLy8gYm9vbGVhblxuICAgICAgaWYgKGEpIHtcbiAgICAgICAgcmV0dXJuIGIgPyAwIDogMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGIgPyAtMSA6IDA7XG4gICAgfVxuXG4gICAgaWYgKHRhID09PSAxMCkgLy8gbnVsbFxuICAgICAgcmV0dXJuIDA7XG5cbiAgICBpZiAodGEgPT09IDExKSAvLyByZWdleHBcbiAgICAgIHRocm93IEVycm9yKCdTb3J0aW5nIG5vdCBzdXBwb3J0ZWQgb24gcmVndWxhciBleHByZXNzaW9uJyk7IC8vIFhYWFxuXG4gICAgLy8gMTM6IGphdmFzY3JpcHQgY29kZVxuICAgIC8vIDE0OiBzeW1ib2xcbiAgICAvLyAxNTogamF2YXNjcmlwdCBjb2RlIHdpdGggc2NvcGVcbiAgICAvLyAxNjogMzItYml0IGludGVnZXJcbiAgICAvLyAxNzogdGltZXN0YW1wXG4gICAgLy8gMTg6IDY0LWJpdCBpbnRlZ2VyXG4gICAgLy8gMjU1OiBtaW5rZXlcbiAgICAvLyAxMjc6IG1heGtleVxuICAgIGlmICh0YSA9PT0gMTMpIC8vIGphdmFzY3JpcHQgY29kZVxuICAgICAgdGhyb3cgRXJyb3IoJ1NvcnRpbmcgbm90IHN1cHBvcnRlZCBvbiBKYXZhc2NyaXB0IGNvZGUnKTsgLy8gWFhYXG5cbiAgICB0aHJvdyBFcnJvcignVW5rbm93biB0eXBlIHRvIHNvcnQnKTtcbiAgfSxcbn07XG4iLCJpbXBvcnQgTG9jYWxDb2xsZWN0aW9uXyBmcm9tICcuL2xvY2FsX2NvbGxlY3Rpb24uanMnO1xuaW1wb3J0IE1hdGNoZXIgZnJvbSAnLi9tYXRjaGVyLmpzJztcbmltcG9ydCBTb3J0ZXIgZnJvbSAnLi9zb3J0ZXIuanMnO1xuXG5Mb2NhbENvbGxlY3Rpb24gPSBMb2NhbENvbGxlY3Rpb25fO1xuTWluaW1vbmdvID0ge1xuICAgIExvY2FsQ29sbGVjdGlvbjogTG9jYWxDb2xsZWN0aW9uXyxcbiAgICBNYXRjaGVyLFxuICAgIFNvcnRlclxufTtcbiIsIi8vIE9ic2VydmVIYW5kbGU6IHRoZSByZXR1cm4gdmFsdWUgb2YgYSBsaXZlIHF1ZXJ5LlxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgT2JzZXJ2ZUhhbmRsZSB7fVxuIiwiaW1wb3J0IHtcbiAgRUxFTUVOVF9PUEVSQVRPUlMsXG4gIGVxdWFsaXR5RWxlbWVudE1hdGNoZXIsXG4gIGV4cGFuZEFycmF5c0luQnJhbmNoZXMsXG4gIGhhc093bixcbiAgaXNPcGVyYXRvck9iamVjdCxcbiAgbWFrZUxvb2t1cEZ1bmN0aW9uLFxuICByZWdleHBFbGVtZW50TWF0Y2hlcixcbn0gZnJvbSAnLi9jb21tb24uanMnO1xuXG4vLyBHaXZlIGEgc29ydCBzcGVjLCB3aGljaCBjYW4gYmUgaW4gYW55IG9mIHRoZXNlIGZvcm1zOlxuLy8gICB7XCJrZXkxXCI6IDEsIFwia2V5MlwiOiAtMX1cbi8vICAgW1tcImtleTFcIiwgXCJhc2NcIl0sIFtcImtleTJcIiwgXCJkZXNjXCJdXVxuLy8gICBbXCJrZXkxXCIsIFtcImtleTJcIiwgXCJkZXNjXCJdXVxuLy9cbi8vICguLiB3aXRoIHRoZSBmaXJzdCBmb3JtIGJlaW5nIGRlcGVuZGVudCBvbiB0aGUga2V5IGVudW1lcmF0aW9uXG4vLyBiZWhhdmlvciBvZiB5b3VyIGphdmFzY3JpcHQgVk0sIHdoaWNoIHVzdWFsbHkgZG9lcyB3aGF0IHlvdSBtZWFuIGluXG4vLyB0aGlzIGNhc2UgaWYgdGhlIGtleSBuYW1lcyBkb24ndCBsb29rIGxpa2UgaW50ZWdlcnMgLi4pXG4vL1xuLy8gcmV0dXJuIGEgZnVuY3Rpb24gdGhhdCB0YWtlcyB0d28gb2JqZWN0cywgYW5kIHJldHVybnMgLTEgaWYgdGhlXG4vLyBmaXJzdCBvYmplY3QgY29tZXMgZmlyc3QgaW4gb3JkZXIsIDEgaWYgdGhlIHNlY29uZCBvYmplY3QgY29tZXNcbi8vIGZpcnN0LCBvciAwIGlmIG5laXRoZXIgb2JqZWN0IGNvbWVzIGJlZm9yZSB0aGUgb3RoZXIuXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFNvcnRlciB7XG4gIGNvbnN0cnVjdG9yKHNwZWMpIHtcbiAgICB0aGlzLl9zb3J0U3BlY1BhcnRzID0gW107XG4gICAgdGhpcy5fc29ydEZ1bmN0aW9uID0gbnVsbDtcblxuICAgIGNvbnN0IGFkZFNwZWNQYXJ0ID0gKHBhdGgsIGFzY2VuZGluZykgPT4ge1xuICAgICAgaWYgKCFwYXRoKSB7XG4gICAgICAgIHRocm93IEVycm9yKCdzb3J0IGtleXMgbXVzdCBiZSBub24tZW1wdHknKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHBhdGguY2hhckF0KDApID09PSAnJCcpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoYHVuc3VwcG9ydGVkIHNvcnQga2V5OiAke3BhdGh9YCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX3NvcnRTcGVjUGFydHMucHVzaCh7XG4gICAgICAgIGFzY2VuZGluZyxcbiAgICAgICAgbG9va3VwOiBtYWtlTG9va3VwRnVuY3Rpb24ocGF0aCwge2ZvclNvcnQ6IHRydWV9KSxcbiAgICAgICAgcGF0aFxuICAgICAgfSk7XG4gICAgfTtcblxuICAgIGlmIChzcGVjIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgIHNwZWMuZm9yRWFjaChlbGVtZW50ID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBlbGVtZW50ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIGFkZFNwZWNQYXJ0KGVsZW1lbnQsIHRydWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGFkZFNwZWNQYXJ0KGVsZW1lbnRbMF0sIGVsZW1lbnRbMV0gIT09ICdkZXNjJyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHNwZWMgPT09ICdvYmplY3QnKSB7XG4gICAgICBPYmplY3Qua2V5cyhzcGVjKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICAgIGFkZFNwZWNQYXJ0KGtleSwgc3BlY1trZXldID49IDApO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygc3BlYyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpcy5fc29ydEZ1bmN0aW9uID0gc3BlYztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgRXJyb3IoYEJhZCBzb3J0IHNwZWNpZmljYXRpb246ICR7SlNPTi5zdHJpbmdpZnkoc3BlYyl9YCk7XG4gICAgfVxuXG4gICAgLy8gSWYgYSBmdW5jdGlvbiBpcyBzcGVjaWZpZWQgZm9yIHNvcnRpbmcsIHdlIHNraXAgdGhlIHJlc3QuXG4gICAgaWYgKHRoaXMuX3NvcnRGdW5jdGlvbikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFRvIGltcGxlbWVudCBhZmZlY3RlZEJ5TW9kaWZpZXIsIHdlIHBpZ2d5LWJhY2sgb24gdG9wIG9mIE1hdGNoZXInc1xuICAgIC8vIGFmZmVjdGVkQnlNb2RpZmllciBjb2RlOyB3ZSBjcmVhdGUgYSBzZWxlY3RvciB0aGF0IGlzIGFmZmVjdGVkIGJ5IHRoZVxuICAgIC8vIHNhbWUgbW9kaWZpZXJzIGFzIHRoaXMgc29ydCBvcmRlci4gVGhpcyBpcyBvbmx5IGltcGxlbWVudGVkIG9uIHRoZVxuICAgIC8vIHNlcnZlci5cbiAgICBpZiAodGhpcy5hZmZlY3RlZEJ5TW9kaWZpZXIpIHtcbiAgICAgIGNvbnN0IHNlbGVjdG9yID0ge307XG5cbiAgICAgIHRoaXMuX3NvcnRTcGVjUGFydHMuZm9yRWFjaChzcGVjID0+IHtcbiAgICAgICAgc2VsZWN0b3Jbc3BlYy5wYXRoXSA9IDE7XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5fc2VsZWN0b3JGb3JBZmZlY3RlZEJ5TW9kaWZpZXIgPSBuZXcgTWluaW1vbmdvLk1hdGNoZXIoc2VsZWN0b3IpO1xuICAgIH1cblxuICAgIHRoaXMuX2tleUNvbXBhcmF0b3IgPSBjb21wb3NlQ29tcGFyYXRvcnMoXG4gICAgICB0aGlzLl9zb3J0U3BlY1BhcnRzLm1hcCgoc3BlYywgaSkgPT4gdGhpcy5fa2V5RmllbGRDb21wYXJhdG9yKGkpKVxuICAgICk7XG4gIH1cblxuICBnZXRDb21wYXJhdG9yKG9wdGlvbnMpIHtcbiAgICAvLyBJZiBzb3J0IGlzIHNwZWNpZmllZCBvciBoYXZlIG5vIGRpc3RhbmNlcywganVzdCB1c2UgdGhlIGNvbXBhcmF0b3IgZnJvbVxuICAgIC8vIHRoZSBzb3VyY2Ugc3BlY2lmaWNhdGlvbiAod2hpY2ggZGVmYXVsdHMgdG8gXCJldmVyeXRoaW5nIGlzIGVxdWFsXCIuXG4gICAgLy8gaXNzdWUgIzM1OTlcbiAgICAvLyBodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL3JlZmVyZW5jZS9vcGVyYXRvci9xdWVyeS9uZWFyLyNzb3J0LW9wZXJhdGlvblxuICAgIC8vIHNvcnQgZWZmZWN0aXZlbHkgb3ZlcnJpZGVzICRuZWFyXG4gICAgaWYgKHRoaXMuX3NvcnRTcGVjUGFydHMubGVuZ3RoIHx8ICFvcHRpb25zIHx8ICFvcHRpb25zLmRpc3RhbmNlcykge1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEJhc2VDb21wYXJhdG9yKCk7XG4gICAgfVxuXG4gICAgY29uc3QgZGlzdGFuY2VzID0gb3B0aW9ucy5kaXN0YW5jZXM7XG5cbiAgICAvLyBSZXR1cm4gYSBjb21wYXJhdG9yIHdoaWNoIGNvbXBhcmVzIHVzaW5nICRuZWFyIGRpc3RhbmNlcy5cbiAgICByZXR1cm4gKGEsIGIpID0+IHtcbiAgICAgIGlmICghZGlzdGFuY2VzLmhhcyhhLl9pZCkpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoYE1pc3NpbmcgZGlzdGFuY2UgZm9yICR7YS5faWR9YCk7XG4gICAgICB9XG5cbiAgICAgIGlmICghZGlzdGFuY2VzLmhhcyhiLl9pZCkpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoYE1pc3NpbmcgZGlzdGFuY2UgZm9yICR7Yi5faWR9YCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBkaXN0YW5jZXMuZ2V0KGEuX2lkKSAtIGRpc3RhbmNlcy5nZXQoYi5faWQpO1xuICAgIH07XG4gIH1cblxuICAvLyBUYWtlcyBpbiB0d28ga2V5czogYXJyYXlzIHdob3NlIGxlbmd0aHMgbWF0Y2ggdGhlIG51bWJlciBvZiBzcGVjXG4gIC8vIHBhcnRzLiBSZXR1cm5zIG5lZ2F0aXZlLCAwLCBvciBwb3NpdGl2ZSBiYXNlZCBvbiB1c2luZyB0aGUgc29ydCBzcGVjIHRvXG4gIC8vIGNvbXBhcmUgZmllbGRzLlxuICBfY29tcGFyZUtleXMoa2V5MSwga2V5Mikge1xuICAgIGlmIChrZXkxLmxlbmd0aCAhPT0gdGhpcy5fc29ydFNwZWNQYXJ0cy5sZW5ndGggfHxcbiAgICAgICAga2V5Mi5sZW5ndGggIT09IHRoaXMuX3NvcnRTcGVjUGFydHMubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBFcnJvcignS2V5IGhhcyB3cm9uZyBsZW5ndGgnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fa2V5Q29tcGFyYXRvcihrZXkxLCBrZXkyKTtcbiAgfVxuXG4gIC8vIEl0ZXJhdGVzIG92ZXIgZWFjaCBwb3NzaWJsZSBcImtleVwiIGZyb20gZG9jIChpZSwgb3ZlciBlYWNoIGJyYW5jaCksIGNhbGxpbmdcbiAgLy8gJ2NiJyB3aXRoIHRoZSBrZXkuXG4gIF9nZW5lcmF0ZUtleXNGcm9tRG9jKGRvYywgY2IpIHtcbiAgICBpZiAodGhpcy5fc29ydFNwZWNQYXJ0cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignY2FuXFwndCBnZW5lcmF0ZSBrZXlzIHdpdGhvdXQgYSBzcGVjJyk7XG4gICAgfVxuXG4gICAgY29uc3QgcGF0aEZyb21JbmRpY2VzID0gaW5kaWNlcyA9PiBgJHtpbmRpY2VzLmpvaW4oJywnKX0sYDtcblxuICAgIGxldCBrbm93blBhdGhzID0gbnVsbDtcblxuICAgIC8vIG1hcHMgaW5kZXggLT4gKHsnJyAtPiB2YWx1ZX0gb3Ige3BhdGggLT4gdmFsdWV9KVxuICAgIGNvbnN0IHZhbHVlc0J5SW5kZXhBbmRQYXRoID0gdGhpcy5fc29ydFNwZWNQYXJ0cy5tYXAoc3BlYyA9PiB7XG4gICAgICAvLyBFeHBhbmQgYW55IGxlYWYgYXJyYXlzIHRoYXQgd2UgZmluZCwgYW5kIGlnbm9yZSB0aG9zZSBhcnJheXNcbiAgICAgIC8vIHRoZW1zZWx2ZXMuICAoV2UgbmV2ZXIgc29ydCBiYXNlZCBvbiBhbiBhcnJheSBpdHNlbGYuKVxuICAgICAgbGV0IGJyYW5jaGVzID0gZXhwYW5kQXJyYXlzSW5CcmFuY2hlcyhzcGVjLmxvb2t1cChkb2MpLCB0cnVlKTtcblxuICAgICAgLy8gSWYgdGhlcmUgYXJlIG5vIHZhbHVlcyBmb3IgYSBrZXkgKGVnLCBrZXkgZ29lcyB0byBhbiBlbXB0eSBhcnJheSksXG4gICAgICAvLyBwcmV0ZW5kIHdlIGZvdW5kIG9uZSB1bmRlZmluZWQgdmFsdWUuXG4gICAgICBpZiAoIWJyYW5jaGVzLmxlbmd0aCkge1xuICAgICAgICBicmFuY2hlcyA9IFt7IHZhbHVlOiB2b2lkIDAgfV07XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGVsZW1lbnQgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgICAgbGV0IHVzZWRQYXRocyA9IGZhbHNlO1xuXG4gICAgICBicmFuY2hlcy5mb3JFYWNoKGJyYW5jaCA9PiB7XG4gICAgICAgIGlmICghYnJhbmNoLmFycmF5SW5kaWNlcykge1xuICAgICAgICAgIC8vIElmIHRoZXJlIGFyZSBubyBhcnJheSBpbmRpY2VzIGZvciBhIGJyYW5jaCwgdGhlbiBpdCBtdXN0IGJlIHRoZVxuICAgICAgICAgIC8vIG9ubHkgYnJhbmNoLCBiZWNhdXNlIHRoZSBvbmx5IHRoaW5nIHRoYXQgcHJvZHVjZXMgbXVsdGlwbGUgYnJhbmNoZXNcbiAgICAgICAgICAvLyBpcyB0aGUgdXNlIG9mIGFycmF5cy5cbiAgICAgICAgICBpZiAoYnJhbmNoZXMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ211bHRpcGxlIGJyYW5jaGVzIGJ1dCBubyBhcnJheSB1c2VkPycpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGVsZW1lbnRbJyddID0gYnJhbmNoLnZhbHVlO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHVzZWRQYXRocyA9IHRydWU7XG5cbiAgICAgICAgY29uc3QgcGF0aCA9IHBhdGhGcm9tSW5kaWNlcyhicmFuY2guYXJyYXlJbmRpY2VzKTtcblxuICAgICAgICBpZiAoaGFzT3duLmNhbGwoZWxlbWVudCwgcGF0aCkpIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcihgZHVwbGljYXRlIHBhdGg6ICR7cGF0aH1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGVsZW1lbnRbcGF0aF0gPSBicmFuY2gudmFsdWU7XG5cbiAgICAgICAgLy8gSWYgdHdvIHNvcnQgZmllbGRzIGJvdGggZ28gaW50byBhcnJheXMsIHRoZXkgaGF2ZSB0byBnbyBpbnRvIHRoZVxuICAgICAgICAvLyBleGFjdCBzYW1lIGFycmF5cyBhbmQgd2UgaGF2ZSB0byBmaW5kIHRoZSBzYW1lIHBhdGhzLiAgVGhpcyBpc1xuICAgICAgICAvLyByb3VnaGx5IHRoZSBzYW1lIGNvbmRpdGlvbiB0aGF0IG1ha2VzIE1vbmdvREIgdGhyb3cgdGhpcyBzdHJhbmdlXG4gICAgICAgIC8vIGVycm9yIG1lc3NhZ2UuICBlZywgdGhlIG1haW4gdGhpbmcgaXMgdGhhdCBpZiBzb3J0IHNwZWMgaXMge2E6IDEsXG4gICAgICAgIC8vIGI6MX0gdGhlbiBhIGFuZCBiIGNhbm5vdCBib3RoIGJlIGFycmF5cy5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gKEluIE1vbmdvREIgaXQgc2VlbXMgdG8gYmUgT0sgdG8gaGF2ZSB7YTogMSwgJ2EueC55JzogMX0gd2hlcmUgJ2EnXG4gICAgICAgIC8vIGFuZCAnYS54LnknIGFyZSBib3RoIGFycmF5cywgYnV0IHdlIGRvbid0IGFsbG93IHRoaXMgZm9yIG5vdy5cbiAgICAgICAgLy8gI05lc3RlZEFycmF5U29ydFxuICAgICAgICAvLyBYWFggYWNoaWV2ZSBmdWxsIGNvbXBhdGliaWxpdHkgaGVyZVxuICAgICAgICBpZiAoa25vd25QYXRocyAmJiAhaGFzT3duLmNhbGwoa25vd25QYXRocywgcGF0aCkpIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcignY2Fubm90IGluZGV4IHBhcmFsbGVsIGFycmF5cycpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgaWYgKGtub3duUGF0aHMpIHtcbiAgICAgICAgLy8gU2ltaWxhcmx5IHRvIGFib3ZlLCBwYXRocyBtdXN0IG1hdGNoIGV2ZXJ5d2hlcmUsIHVubGVzcyB0aGlzIGlzIGFcbiAgICAgICAgLy8gbm9uLWFycmF5IGZpZWxkLlxuICAgICAgICBpZiAoIWhhc093bi5jYWxsKGVsZW1lbnQsICcnKSAmJlxuICAgICAgICAgICAgT2JqZWN0LmtleXMoa25vd25QYXRocykubGVuZ3RoICE9PSBPYmplY3Qua2V5cyhlbGVtZW50KS5sZW5ndGgpIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcignY2Fubm90IGluZGV4IHBhcmFsbGVsIGFycmF5cyEnKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh1c2VkUGF0aHMpIHtcbiAgICAgICAga25vd25QYXRocyA9IHt9O1xuXG4gICAgICAgIE9iamVjdC5rZXlzKGVsZW1lbnQpLmZvckVhY2gocGF0aCA9PiB7XG4gICAgICAgICAga25vd25QYXRoc1twYXRoXSA9IHRydWU7XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9KTtcblxuICAgIGlmICgha25vd25QYXRocykge1xuICAgICAgLy8gRWFzeSBjYXNlOiBubyB1c2Ugb2YgYXJyYXlzLlxuICAgICAgY29uc3Qgc29sZUtleSA9IHZhbHVlc0J5SW5kZXhBbmRQYXRoLm1hcCh2YWx1ZXMgPT4ge1xuICAgICAgICBpZiAoIWhhc093bi5jYWxsKHZhbHVlcywgJycpKSB7XG4gICAgICAgICAgdGhyb3cgRXJyb3IoJ25vIHZhbHVlIGluIHNvbGUga2V5IGNhc2U/Jyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdmFsdWVzWycnXTtcbiAgICAgIH0pO1xuXG4gICAgICBjYihzb2xlS2V5KTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIE9iamVjdC5rZXlzKGtub3duUGF0aHMpLmZvckVhY2gocGF0aCA9PiB7XG4gICAgICBjb25zdCBrZXkgPSB2YWx1ZXNCeUluZGV4QW5kUGF0aC5tYXAodmFsdWVzID0+IHtcbiAgICAgICAgaWYgKGhhc093bi5jYWxsKHZhbHVlcywgJycpKSB7XG4gICAgICAgICAgcmV0dXJuIHZhbHVlc1snJ107XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWhhc093bi5jYWxsKHZhbHVlcywgcGF0aCkpIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcignbWlzc2luZyBwYXRoPycpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHZhbHVlc1twYXRoXTtcbiAgICAgIH0pO1xuXG4gICAgICBjYihrZXkpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIGNvbXBhcmF0b3IgdGhhdCByZXByZXNlbnRzIHRoZSBzb3J0IHNwZWNpZmljYXRpb24gKGJ1dCBub3RcbiAgLy8gaW5jbHVkaW5nIGEgcG9zc2libGUgZ2VvcXVlcnkgZGlzdGFuY2UgdGllLWJyZWFrZXIpLlxuICBfZ2V0QmFzZUNvbXBhcmF0b3IoKSB7XG4gICAgaWYgKHRoaXMuX3NvcnRGdW5jdGlvbikge1xuICAgICAgcmV0dXJuIHRoaXMuX3NvcnRGdW5jdGlvbjtcbiAgICB9XG5cbiAgICAvLyBJZiB3ZSdyZSBvbmx5IHNvcnRpbmcgb24gZ2VvcXVlcnkgZGlzdGFuY2UgYW5kIG5vIHNwZWNzLCBqdXN0IHNheVxuICAgIC8vIGV2ZXJ5dGhpbmcgaXMgZXF1YWwuXG4gICAgaWYgKCF0aGlzLl9zb3J0U3BlY1BhcnRzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIChkb2MxLCBkb2MyKSA9PiAwO1xuICAgIH1cblxuICAgIHJldHVybiAoZG9jMSwgZG9jMikgPT4ge1xuICAgICAgY29uc3Qga2V5MSA9IHRoaXMuX2dldE1pbktleUZyb21Eb2MoZG9jMSk7XG4gICAgICBjb25zdCBrZXkyID0gdGhpcy5fZ2V0TWluS2V5RnJvbURvYyhkb2MyKTtcbiAgICAgIHJldHVybiB0aGlzLl9jb21wYXJlS2V5cyhrZXkxLCBrZXkyKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gRmluZHMgdGhlIG1pbmltdW0ga2V5IGZyb20gdGhlIGRvYywgYWNjb3JkaW5nIHRvIHRoZSBzb3J0IHNwZWNzLiAgKFdlIHNheVxuICAvLyBcIm1pbmltdW1cIiBoZXJlIGJ1dCB0aGlzIGlzIHdpdGggcmVzcGVjdCB0byB0aGUgc29ydCBzcGVjLCBzbyBcImRlc2NlbmRpbmdcIlxuICAvLyBzb3J0IGZpZWxkcyBtZWFuIHdlJ3JlIGZpbmRpbmcgdGhlIG1heCBmb3IgdGhhdCBmaWVsZC4pXG4gIC8vXG4gIC8vIE5vdGUgdGhhdCB0aGlzIGlzIE5PVCBcImZpbmQgdGhlIG1pbmltdW0gdmFsdWUgb2YgdGhlIGZpcnN0IGZpZWxkLCB0aGVcbiAgLy8gbWluaW11bSB2YWx1ZSBvZiB0aGUgc2Vjb25kIGZpZWxkLCBldGNcIi4uLiBpdCdzIFwiY2hvb3NlIHRoZVxuICAvLyBsZXhpY29ncmFwaGljYWxseSBtaW5pbXVtIHZhbHVlIG9mIHRoZSBrZXkgdmVjdG9yLCBhbGxvd2luZyBvbmx5IGtleXMgd2hpY2hcbiAgLy8geW91IGNhbiBmaW5kIGFsb25nIHRoZSBzYW1lIHBhdGhzXCIuICBpZSwgZm9yIGEgZG9jIHthOiBbe3g6IDAsIHk6IDV9LCB7eDpcbiAgLy8gMSwgeTogM31dfSB3aXRoIHNvcnQgc3BlYyB7J2EueCc6IDEsICdhLnknOiAxfSwgdGhlIG9ubHkga2V5cyBhcmUgWzAsNV0gYW5kXG4gIC8vIFsxLDNdLCBhbmQgdGhlIG1pbmltdW0ga2V5IGlzIFswLDVdOyBub3RhYmx5LCBbMCwzXSBpcyBOT1QgYSBrZXkuXG4gIF9nZXRNaW5LZXlGcm9tRG9jKGRvYykge1xuICAgIGxldCBtaW5LZXkgPSBudWxsO1xuXG4gICAgdGhpcy5fZ2VuZXJhdGVLZXlzRnJvbURvYyhkb2MsIGtleSA9PiB7XG4gICAgICBpZiAobWluS2V5ID09PSBudWxsKSB7XG4gICAgICAgIG1pbktleSA9IGtleTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fY29tcGFyZUtleXMoa2V5LCBtaW5LZXkpIDwgMCkge1xuICAgICAgICBtaW5LZXkgPSBrZXk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbWluS2V5O1xuICB9XG5cbiAgX2dldFBhdGhzKCkge1xuICAgIHJldHVybiB0aGlzLl9zb3J0U3BlY1BhcnRzLm1hcChwYXJ0ID0+IHBhcnQucGF0aCk7XG4gIH1cblxuICAvLyBHaXZlbiBhbiBpbmRleCAnaScsIHJldHVybnMgYSBjb21wYXJhdG9yIHRoYXQgY29tcGFyZXMgdHdvIGtleSBhcnJheXMgYmFzZWRcbiAgLy8gb24gZmllbGQgJ2knLlxuICBfa2V5RmllbGRDb21wYXJhdG9yKGkpIHtcbiAgICBjb25zdCBpbnZlcnQgPSAhdGhpcy5fc29ydFNwZWNQYXJ0c1tpXS5hc2NlbmRpbmc7XG5cbiAgICByZXR1cm4gKGtleTEsIGtleTIpID0+IHtcbiAgICAgIGNvbnN0IGNvbXBhcmUgPSBMb2NhbENvbGxlY3Rpb24uX2YuX2NtcChrZXkxW2ldLCBrZXkyW2ldKTtcbiAgICAgIHJldHVybiBpbnZlcnQgPyAtY29tcGFyZSA6IGNvbXBhcmU7XG4gICAgfTtcbiAgfVxufVxuXG4vLyBHaXZlbiBhbiBhcnJheSBvZiBjb21wYXJhdG9yc1xuLy8gKGZ1bmN0aW9ucyAoYSxiKS0+KG5lZ2F0aXZlIG9yIHBvc2l0aXZlIG9yIHplcm8pKSwgcmV0dXJucyBhIHNpbmdsZVxuLy8gY29tcGFyYXRvciB3aGljaCB1c2VzIGVhY2ggY29tcGFyYXRvciBpbiBvcmRlciBhbmQgcmV0dXJucyB0aGUgZmlyc3Rcbi8vIG5vbi16ZXJvIHZhbHVlLlxuZnVuY3Rpb24gY29tcG9zZUNvbXBhcmF0b3JzKGNvbXBhcmF0b3JBcnJheSkge1xuICByZXR1cm4gKGEsIGIpID0+IHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbXBhcmF0b3JBcnJheS5sZW5ndGg7ICsraSkge1xuICAgICAgY29uc3QgY29tcGFyZSA9IGNvbXBhcmF0b3JBcnJheVtpXShhLCBiKTtcbiAgICAgIGlmIChjb21wYXJlICE9PSAwKSB7XG4gICAgICAgIHJldHVybiBjb21wYXJlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiAwO1xuICB9O1xufVxuIl19
