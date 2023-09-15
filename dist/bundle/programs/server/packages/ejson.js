Package["core-runtime"].queue("ejson", ["meteor", "ecmascript", "base64", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var Base64 = Package.base64.Base64;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var EJSON;

var require = meteorInstall({"node_modules":{"meteor":{"ejson":{"ejson.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/ejson/ejson.js                                                                                         //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      EJSON: () => EJSON
    });
    let isFunction, isObject, keysOf, lengthOf, hasOwn, convertMapToObject, isArguments, isInfOrNaN, handleError;
    module.link("./utils", {
      isFunction(v) {
        isFunction = v;
      },
      isObject(v) {
        isObject = v;
      },
      keysOf(v) {
        keysOf = v;
      },
      lengthOf(v) {
        lengthOf = v;
      },
      hasOwn(v) {
        hasOwn = v;
      },
      convertMapToObject(v) {
        convertMapToObject = v;
      },
      isArguments(v) {
        isArguments = v;
      },
      isInfOrNaN(v) {
        isInfOrNaN = v;
      },
      handleError(v) {
        handleError = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    /**
     * @namespace
     * @summary Namespace for EJSON functions
     */
    const EJSON = {};

    // Custom type interface definition
    /**
     * @class CustomType
     * @instanceName customType
     * @memberOf EJSON
     * @summary The interface that a class must satisfy to be able to become an
     * EJSON custom type via EJSON.addType.
     */

    /**
     * @function typeName
     * @memberOf EJSON.CustomType
     * @summary Return the tag used to identify this type.  This must match the
     *          tag used to register this type with
     *          [`EJSON.addType`](#ejson_add_type).
     * @locus Anywhere
     * @instance
     */

    /**
     * @function toJSONValue
     * @memberOf EJSON.CustomType
     * @summary Serialize this instance into a JSON-compatible value.
     * @locus Anywhere
     * @instance
     */

    /**
     * @function clone
     * @memberOf EJSON.CustomType
     * @summary Return a value `r` such that `this.equals(r)` is true, and
     *          modifications to `r` do not affect `this` and vice versa.
     * @locus Anywhere
     * @instance
     */

    /**
     * @function equals
     * @memberOf EJSON.CustomType
     * @summary Return `true` if `other` has a value equal to `this`; `false`
     *          otherwise.
     * @locus Anywhere
     * @param {Object} other Another object to compare this to.
     * @instance
     */

    const customTypes = new Map();

    // Add a custom type, using a method of your choice to get to and
    // from a basic JSON-able representation.  The factory argument
    // is a function of JSON-able --> your object
    // The type you add must have:
    // - A toJSONValue() method, so that Meteor can serialize it
    // - a typeName() method, to show how to look it up in our type table.
    // It is okay if these methods are monkey-patched on.
    // EJSON.clone will use toJSONValue and the given factory to produce
    // a clone, but you may specify a method clone() that will be
    // used instead.
    // Similarly, EJSON.equals will use toJSONValue to make comparisons,
    // but you may provide a method equals() instead.
    /**
     * @summary Add a custom datatype to EJSON.
     * @locus Anywhere
     * @param {String} name A tag for your custom type; must be unique among
     *                      custom data types defined in your project, and must
     *                      match the result of your type's `typeName` method.
     * @param {Function} factory A function that deserializes a JSON-compatible
     *                           value into an instance of your type.  This should
     *                           match the serialization performed by your
     *                           type's `toJSONValue` method.
     */
    EJSON.addType = (name, factory) => {
      if (customTypes.has(name)) {
        throw new Error("Type ".concat(name, " already present"));
      }
      customTypes.set(name, factory);
    };
    const builtinConverters = [{
      // Date
      matchJSONValue(obj) {
        return hasOwn(obj, '$date') && lengthOf(obj) === 1;
      },
      matchObject(obj) {
        return obj instanceof Date;
      },
      toJSONValue(obj) {
        return {
          $date: obj.getTime()
        };
      },
      fromJSONValue(obj) {
        return new Date(obj.$date);
      }
    }, {
      // RegExp
      matchJSONValue(obj) {
        return hasOwn(obj, '$regexp') && hasOwn(obj, '$flags') && lengthOf(obj) === 2;
      },
      matchObject(obj) {
        return obj instanceof RegExp;
      },
      toJSONValue(regexp) {
        return {
          $regexp: regexp.source,
          $flags: regexp.flags
        };
      },
      fromJSONValue(obj) {
        // Replaces duplicate / invalid flags.
        return new RegExp(obj.$regexp, obj.$flags
        // Cut off flags at 50 chars to avoid abusing RegExp for DOS.
        .slice(0, 50).replace(/[^gimuy]/g, '').replace(/(.)(?=.*\1)/g, ''));
      }
    }, {
      // NaN, Inf, -Inf. (These are the only objects with typeof !== 'object'
      // which we match.)
      matchJSONValue(obj) {
        return hasOwn(obj, '$InfNaN') && lengthOf(obj) === 1;
      },
      matchObject: isInfOrNaN,
      toJSONValue(obj) {
        let sign;
        if (Number.isNaN(obj)) {
          sign = 0;
        } else if (obj === Infinity) {
          sign = 1;
        } else {
          sign = -1;
        }
        return {
          $InfNaN: sign
        };
      },
      fromJSONValue(obj) {
        return obj.$InfNaN / 0;
      }
    }, {
      // Binary
      matchJSONValue(obj) {
        return hasOwn(obj, '$binary') && lengthOf(obj) === 1;
      },
      matchObject(obj) {
        return typeof Uint8Array !== 'undefined' && obj instanceof Uint8Array || obj && hasOwn(obj, '$Uint8ArrayPolyfill');
      },
      toJSONValue(obj) {
        return {
          $binary: Base64.encode(obj)
        };
      },
      fromJSONValue(obj) {
        return Base64.decode(obj.$binary);
      }
    }, {
      // Escaping one level
      matchJSONValue(obj) {
        return hasOwn(obj, '$escape') && lengthOf(obj) === 1;
      },
      matchObject(obj) {
        let match = false;
        if (obj) {
          const keyCount = lengthOf(obj);
          if (keyCount === 1 || keyCount === 2) {
            match = builtinConverters.some(converter => converter.matchJSONValue(obj));
          }
        }
        return match;
      },
      toJSONValue(obj) {
        const newObj = {};
        keysOf(obj).forEach(key => {
          newObj[key] = EJSON.toJSONValue(obj[key]);
        });
        return {
          $escape: newObj
        };
      },
      fromJSONValue(obj) {
        const newObj = {};
        keysOf(obj.$escape).forEach(key => {
          newObj[key] = EJSON.fromJSONValue(obj.$escape[key]);
        });
        return newObj;
      }
    }, {
      // Custom
      matchJSONValue(obj) {
        return hasOwn(obj, '$type') && hasOwn(obj, '$value') && lengthOf(obj) === 2;
      },
      matchObject(obj) {
        return EJSON._isCustomType(obj);
      },
      toJSONValue(obj) {
        const jsonValue = Meteor._noYieldsAllowed(() => obj.toJSONValue());
        return {
          $type: obj.typeName(),
          $value: jsonValue
        };
      },
      fromJSONValue(obj) {
        const typeName = obj.$type;
        if (!customTypes.has(typeName)) {
          throw new Error("Custom EJSON type ".concat(typeName, " is not defined"));
        }
        const converter = customTypes.get(typeName);
        return Meteor._noYieldsAllowed(() => converter(obj.$value));
      }
    }];
    EJSON._isCustomType = obj => obj && isFunction(obj.toJSONValue) && isFunction(obj.typeName) && customTypes.has(obj.typeName());
    EJSON._getTypes = function () {
      let isOriginal = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
      return isOriginal ? customTypes : convertMapToObject(customTypes);
    };
    EJSON._getConverters = () => builtinConverters;

    // Either return the JSON-compatible version of the argument, or undefined (if
    // the item isn't itself replaceable, but maybe some fields in it are)
    const toJSONValueHelper = item => {
      for (let i = 0; i < builtinConverters.length; i++) {
        const converter = builtinConverters[i];
        if (converter.matchObject(item)) {
          return converter.toJSONValue(item);
        }
      }
      return undefined;
    };

    // for both arrays and objects, in-place modification.
    const adjustTypesToJSONValue = obj => {
      // Is it an atom that we need to adjust?
      if (obj === null) {
        return null;
      }
      const maybeChanged = toJSONValueHelper(obj);
      if (maybeChanged !== undefined) {
        return maybeChanged;
      }

      // Other atoms are unchanged.
      if (!isObject(obj)) {
        return obj;
      }

      // Iterate over array or object structure.
      keysOf(obj).forEach(key => {
        const value = obj[key];
        if (!isObject(value) && value !== undefined && !isInfOrNaN(value)) {
          return; // continue
        }

        const changed = toJSONValueHelper(value);
        if (changed) {
          obj[key] = changed;
          return; // on to the next key
        }
        // if we get here, value is an object but not adjustable
        // at this level.  recurse.
        adjustTypesToJSONValue(value);
      });
      return obj;
    };
    EJSON._adjustTypesToJSONValue = adjustTypesToJSONValue;

    /**
     * @summary Serialize an EJSON-compatible value into its plain JSON
     *          representation.
     * @locus Anywhere
     * @param {EJSON} val A value to serialize to plain JSON.
     */
    EJSON.toJSONValue = item => {
      const changed = toJSONValueHelper(item);
      if (changed !== undefined) {
        return changed;
      }
      let newItem = item;
      if (isObject(item)) {
        newItem = EJSON.clone(item);
        adjustTypesToJSONValue(newItem);
      }
      return newItem;
    };

    // Either return the argument changed to have the non-json
    // rep of itself (the Object version) or the argument itself.
    // DOES NOT RECURSE.  For actually getting the fully-changed value, use
    // EJSON.fromJSONValue
    const fromJSONValueHelper = value => {
      if (isObject(value) && value !== null) {
        const keys = keysOf(value);
        if (keys.length <= 2 && keys.every(k => typeof k === 'string' && k.substr(0, 1) === '$')) {
          for (let i = 0; i < builtinConverters.length; i++) {
            const converter = builtinConverters[i];
            if (converter.matchJSONValue(value)) {
              return converter.fromJSONValue(value);
            }
          }
        }
      }
      return value;
    };

    // for both arrays and objects. Tries its best to just
    // use the object you hand it, but may return something
    // different if the object you hand it itself needs changing.
    const adjustTypesFromJSONValue = obj => {
      if (obj === null) {
        return null;
      }
      const maybeChanged = fromJSONValueHelper(obj);
      if (maybeChanged !== obj) {
        return maybeChanged;
      }

      // Other atoms are unchanged.
      if (!isObject(obj)) {
        return obj;
      }
      keysOf(obj).forEach(key => {
        const value = obj[key];
        if (isObject(value)) {
          const changed = fromJSONValueHelper(value);
          if (value !== changed) {
            obj[key] = changed;
            return;
          }
          // if we get here, value is an object but not adjustable
          // at this level.  recurse.
          adjustTypesFromJSONValue(value);
        }
      });
      return obj;
    };
    EJSON._adjustTypesFromJSONValue = adjustTypesFromJSONValue;

    /**
     * @summary Deserialize an EJSON value from its plain JSON representation.
     * @locus Anywhere
     * @param {JSONCompatible} val A value to deserialize into EJSON.
     */
    EJSON.fromJSONValue = item => {
      let changed = fromJSONValueHelper(item);
      if (changed === item && isObject(item)) {
        changed = EJSON.clone(item);
        adjustTypesFromJSONValue(changed);
      }
      return changed;
    };

    /**
     * @summary Serialize a value to a string. For EJSON values, the serialization
     *          fully represents the value. For non-EJSON values, serializes the
     *          same way as `JSON.stringify`.
     * @locus Anywhere
     * @param {EJSON} val A value to stringify.
     * @param {Object} [options]
     * @param {Boolean | Integer | String} options.indent Indents objects and
     * arrays for easy readability.  When `true`, indents by 2 spaces; when an
     * integer, indents by that number of spaces; and when a string, uses the
     * string as the indentation pattern.
     * @param {Boolean} options.canonical When `true`, stringifies keys in an
     *                                    object in sorted order.
     */
    EJSON.stringify = handleError((item, options) => {
      let serialized;
      const json = EJSON.toJSONValue(item);
      if (options && (options.canonical || options.indent)) {
        let canonicalStringify;
        module.link("./stringify", {
          default(v) {
            canonicalStringify = v;
          }
        }, 1);
        serialized = canonicalStringify(json, options);
      } else {
        serialized = JSON.stringify(json);
      }
      return serialized;
    });

    /**
     * @summary Parse a string into an EJSON value. Throws an error if the string
     *          is not valid EJSON.
     * @locus Anywhere
     * @param {String} str A string to parse into an EJSON value.
     */
    EJSON.parse = item => {
      if (typeof item !== 'string') {
        throw new Error('EJSON.parse argument should be a string');
      }
      return EJSON.fromJSONValue(JSON.parse(item));
    };

    /**
     * @summary Returns true if `x` is a buffer of binary data, as returned from
     *          [`EJSON.newBinary`](#ejson_new_binary).
     * @param {Object} x The variable to check.
     * @locus Anywhere
     */
    EJSON.isBinary = obj => {
      return !!(typeof Uint8Array !== 'undefined' && obj instanceof Uint8Array || obj && obj.$Uint8ArrayPolyfill);
    };

    /**
     * @summary Return true if `a` and `b` are equal to each other.  Return false
     *          otherwise.  Uses the `equals` method on `a` if present, otherwise
     *          performs a deep comparison.
     * @locus Anywhere
     * @param {EJSON} a
     * @param {EJSON} b
     * @param {Object} [options]
     * @param {Boolean} options.keyOrderSensitive Compare in key sensitive order,
     * if supported by the JavaScript implementation.  For example, `{a: 1, b: 2}`
     * is equal to `{b: 2, a: 1}` only when `keyOrderSensitive` is `false`.  The
     * default is `false`.
     */
    EJSON.equals = (a, b, options) => {
      let i;
      const keyOrderSensitive = !!(options && options.keyOrderSensitive);
      if (a === b) {
        return true;
      }

      // This differs from the IEEE spec for NaN equality, b/c we don't want
      // anything ever with a NaN to be poisoned from becoming equal to anything.
      if (Number.isNaN(a) && Number.isNaN(b)) {
        return true;
      }

      // if either one is falsy, they'd have to be === to be equal
      if (!a || !b) {
        return false;
      }
      if (!(isObject(a) && isObject(b))) {
        return false;
      }
      if (a instanceof Date && b instanceof Date) {
        return a.valueOf() === b.valueOf();
      }
      if (EJSON.isBinary(a) && EJSON.isBinary(b)) {
        if (a.length !== b.length) {
          return false;
        }
        for (i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) {
            return false;
          }
        }
        return true;
      }
      if (isFunction(a.equals)) {
        return a.equals(b, options);
      }
      if (isFunction(b.equals)) {
        return b.equals(a, options);
      }

      // Array.isArray works across iframes while instanceof won't
      const aIsArray = Array.isArray(a);
      const bIsArray = Array.isArray(b);

      // if not both or none are array they are not equal
      if (aIsArray !== bIsArray) {
        return false;
      }
      if (aIsArray && bIsArray) {
        if (a.length !== b.length) {
          return false;
        }
        for (i = 0; i < a.length; i++) {
          if (!EJSON.equals(a[i], b[i], options)) {
            return false;
          }
        }
        return true;
      }

      // fallback for custom types that don't implement their own equals
      switch (EJSON._isCustomType(a) + EJSON._isCustomType(b)) {
        case 1:
          return false;
        case 2:
          return EJSON.equals(EJSON.toJSONValue(a), EJSON.toJSONValue(b));
        default: // Do nothing
      }

      // fall back to structural equality of objects
      let ret;
      const aKeys = keysOf(a);
      const bKeys = keysOf(b);
      if (keyOrderSensitive) {
        i = 0;
        ret = aKeys.every(key => {
          if (i >= bKeys.length) {
            return false;
          }
          if (key !== bKeys[i]) {
            return false;
          }
          if (!EJSON.equals(a[key], b[bKeys[i]], options)) {
            return false;
          }
          i++;
          return true;
        });
      } else {
        i = 0;
        ret = aKeys.every(key => {
          if (!hasOwn(b, key)) {
            return false;
          }
          if (!EJSON.equals(a[key], b[key], options)) {
            return false;
          }
          i++;
          return true;
        });
      }
      return ret && i === bKeys.length;
    };

    /**
     * @summary Return a deep copy of `val`.
     * @locus Anywhere
     * @param {EJSON} val A value to copy.
     */
    EJSON.clone = v => {
      let ret;
      if (!isObject(v)) {
        return v;
      }
      if (v === null) {
        return null; // null has typeof "object"
      }

      if (v instanceof Date) {
        return new Date(v.getTime());
      }

      // RegExps are not really EJSON elements (eg we don't define a serialization
      // for them), but they're immutable anyway, so we can support them in clone.
      if (v instanceof RegExp) {
        return v;
      }
      if (EJSON.isBinary(v)) {
        ret = EJSON.newBinary(v.length);
        for (let i = 0; i < v.length; i++) {
          ret[i] = v[i];
        }
        return ret;
      }
      if (Array.isArray(v)) {
        return v.map(EJSON.clone);
      }
      if (isArguments(v)) {
        return Array.from(v).map(EJSON.clone);
      }

      // handle general user-defined typed Objects if they have a clone method
      if (isFunction(v.clone)) {
        return v.clone();
      }

      // handle other custom types
      if (EJSON._isCustomType(v)) {
        return EJSON.fromJSONValue(EJSON.clone(EJSON.toJSONValue(v)), true);
      }

      // handle other objects
      ret = {};
      keysOf(v).forEach(key => {
        ret[key] = EJSON.clone(v[key]);
      });
      return ret;
    };

    /**
     * @summary Allocate a new buffer of binary data that EJSON can serialize.
     * @locus Anywhere
     * @param {Number} size The number of bytes of binary data to allocate.
     */
    // EJSON.newBinary is the public documented API for this functionality,
    // but the implementation is in the 'base64' package to avoid
    // introducing a circular dependency. (If the implementation were here,
    // then 'base64' would have to use EJSON.newBinary, and 'ejson' would
    // also have to use 'base64'.)
    EJSON.newBinary = Base64.newBinary;
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"stringify.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/ejson/stringify.js                                                                                     //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
// Based on json2.js from https://github.com/douglascrockford/JSON-js
//
//    json2.js
//    2012-10-08
//
//    Public Domain.
//
//    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

function quote(string) {
  return JSON.stringify(string);
}
const str = (key, holder, singleIndent, outerIndent, canonical) => {
  const value = holder[key];

  // What happens next depends on the value's type.
  switch (typeof value) {
    case 'string':
      return quote(value);
    case 'number':
      // JSON numbers must be finite. Encode non-finite numbers as null.
      return isFinite(value) ? String(value) : 'null';
    case 'boolean':
      return String(value);
    // If the type is 'object', we might be dealing with an object or an array or
    // null.
    case 'object':
      {
        // Due to a specification blunder in ECMAScript, typeof null is 'object',
        // so watch out for that case.
        if (!value) {
          return 'null';
        }
        // Make an array to hold the partial results of stringifying this object
        // value.
        const innerIndent = outerIndent + singleIndent;
        const partial = [];
        let v;

        // Is the value an array?
        if (Array.isArray(value) || {}.hasOwnProperty.call(value, 'callee')) {
          // The value is an array. Stringify every element. Use null as a
          // placeholder for non-JSON values.
          const length = value.length;
          for (let i = 0; i < length; i += 1) {
            partial[i] = str(i, value, singleIndent, innerIndent, canonical) || 'null';
          }

          // Join all of the elements together, separated with commas, and wrap
          // them in brackets.
          if (partial.length === 0) {
            v = '[]';
          } else if (innerIndent) {
            v = '[\n' + innerIndent + partial.join(',\n' + innerIndent) + '\n' + outerIndent + ']';
          } else {
            v = '[' + partial.join(',') + ']';
          }
          return v;
        }

        // Iterate through all of the keys in the object.
        let keys = Object.keys(value);
        if (canonical) {
          keys = keys.sort();
        }
        keys.forEach(k => {
          v = str(k, value, singleIndent, innerIndent, canonical);
          if (v) {
            partial.push(quote(k) + (innerIndent ? ': ' : ':') + v);
          }
        });

        // Join all of the member texts together, separated with commas,
        // and wrap them in braces.
        if (partial.length === 0) {
          v = '{}';
        } else if (innerIndent) {
          v = '{\n' + innerIndent + partial.join(',\n' + innerIndent) + '\n' + outerIndent + '}';
        } else {
          v = '{' + partial.join(',') + '}';
        }
        return v;
      }
    default: // Do nothing
  }
};

// If the JSON object does not yet have a stringify method, give it one.
const canonicalStringify = (value, options) => {
  // Make a fake root object containing our value under the key of ''.
  // Return the result of stringifying the value.
  const allOptions = Object.assign({
    indent: '',
    canonical: false
  }, options);
  if (allOptions.indent === true) {
    allOptions.indent = '  ';
  } else if (typeof allOptions.indent === 'number') {
    let newIndent = '';
    for (let i = 0; i < allOptions.indent; i++) {
      newIndent += ' ';
    }
    allOptions.indent = newIndent;
  }
  return str('', {
    '': value
  }, allOptions.indent, '', allOptions.canonical);
};
module.exportDefault(canonicalStringify);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"utils.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/ejson/utils.js                                                                                         //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
module.export({
  isFunction: () => isFunction,
  isObject: () => isObject,
  keysOf: () => keysOf,
  lengthOf: () => lengthOf,
  hasOwn: () => hasOwn,
  convertMapToObject: () => convertMapToObject,
  isArguments: () => isArguments,
  isInfOrNaN: () => isInfOrNaN,
  checkError: () => checkError,
  handleError: () => handleError
});
const isFunction = fn => typeof fn === 'function';
const isObject = fn => typeof fn === 'object';
const keysOf = obj => Object.keys(obj);
const lengthOf = obj => Object.keys(obj).length;
const hasOwn = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
const convertMapToObject = map => Array.from(map).reduce((acc, _ref) => {
  let [key, value] = _ref;
  // reassign to not create new object
  acc[key] = value;
  return acc;
}, {});
const isArguments = obj => obj != null && hasOwn(obj, 'callee');
const isInfOrNaN = obj => Number.isNaN(obj) || obj === Infinity || obj === -Infinity;
const checkError = {
  maxStack: msgError => new RegExp('Maximum call stack size exceeded', 'g').test(msgError)
};
const handleError = fn => function () {
  try {
    return fn.apply(this, arguments);
  } catch (error) {
    const isMaxStack = checkError.maxStack(error.message);
    if (isMaxStack) {
      throw new Error('Converting circular structure to JSON');
    }
    throw error;
  }
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      EJSON: EJSON
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/ejson/ejson.js"
  ],
  mainModulePath: "/node_modules/meteor/ejson/ejson.js"
}});

//# sourceURL=meteor://💻app/packages/ejson.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZWpzb24vZWpzb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2Vqc29uL3N0cmluZ2lmeS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZWpzb24vdXRpbHMuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiRUpTT04iLCJpc0Z1bmN0aW9uIiwiaXNPYmplY3QiLCJrZXlzT2YiLCJsZW5ndGhPZiIsImhhc093biIsImNvbnZlcnRNYXBUb09iamVjdCIsImlzQXJndW1lbnRzIiwiaXNJbmZPck5hTiIsImhhbmRsZUVycm9yIiwibGluayIsInYiLCJfX3JlaWZ5V2FpdEZvckRlcHNfXyIsImN1c3RvbVR5cGVzIiwiTWFwIiwiYWRkVHlwZSIsIm5hbWUiLCJmYWN0b3J5IiwiaGFzIiwiRXJyb3IiLCJjb25jYXQiLCJzZXQiLCJidWlsdGluQ29udmVydGVycyIsIm1hdGNoSlNPTlZhbHVlIiwib2JqIiwibWF0Y2hPYmplY3QiLCJEYXRlIiwidG9KU09OVmFsdWUiLCIkZGF0ZSIsImdldFRpbWUiLCJmcm9tSlNPTlZhbHVlIiwiUmVnRXhwIiwicmVnZXhwIiwiJHJlZ2V4cCIsInNvdXJjZSIsIiRmbGFncyIsImZsYWdzIiwic2xpY2UiLCJyZXBsYWNlIiwic2lnbiIsIk51bWJlciIsImlzTmFOIiwiSW5maW5pdHkiLCIkSW5mTmFOIiwiVWludDhBcnJheSIsIiRiaW5hcnkiLCJCYXNlNjQiLCJlbmNvZGUiLCJkZWNvZGUiLCJtYXRjaCIsImtleUNvdW50Iiwic29tZSIsImNvbnZlcnRlciIsIm5ld09iaiIsImZvckVhY2giLCJrZXkiLCIkZXNjYXBlIiwiX2lzQ3VzdG9tVHlwZSIsImpzb25WYWx1ZSIsIk1ldGVvciIsIl9ub1lpZWxkc0FsbG93ZWQiLCIkdHlwZSIsInR5cGVOYW1lIiwiJHZhbHVlIiwiZ2V0IiwiX2dldFR5cGVzIiwiaXNPcmlnaW5hbCIsImFyZ3VtZW50cyIsImxlbmd0aCIsInVuZGVmaW5lZCIsIl9nZXRDb252ZXJ0ZXJzIiwidG9KU09OVmFsdWVIZWxwZXIiLCJpdGVtIiwiaSIsImFkanVzdFR5cGVzVG9KU09OVmFsdWUiLCJtYXliZUNoYW5nZWQiLCJ2YWx1ZSIsImNoYW5nZWQiLCJfYWRqdXN0VHlwZXNUb0pTT05WYWx1ZSIsIm5ld0l0ZW0iLCJjbG9uZSIsImZyb21KU09OVmFsdWVIZWxwZXIiLCJrZXlzIiwiZXZlcnkiLCJrIiwic3Vic3RyIiwiYWRqdXN0VHlwZXNGcm9tSlNPTlZhbHVlIiwiX2FkanVzdFR5cGVzRnJvbUpTT05WYWx1ZSIsInN0cmluZ2lmeSIsIm9wdGlvbnMiLCJzZXJpYWxpemVkIiwianNvbiIsImNhbm9uaWNhbCIsImluZGVudCIsImNhbm9uaWNhbFN0cmluZ2lmeSIsImRlZmF1bHQiLCJKU09OIiwicGFyc2UiLCJpc0JpbmFyeSIsIiRVaW50OEFycmF5UG9seWZpbGwiLCJlcXVhbHMiLCJhIiwiYiIsImtleU9yZGVyU2Vuc2l0aXZlIiwidmFsdWVPZiIsImFJc0FycmF5IiwiQXJyYXkiLCJpc0FycmF5IiwiYklzQXJyYXkiLCJyZXQiLCJhS2V5cyIsImJLZXlzIiwibmV3QmluYXJ5IiwibWFwIiwiZnJvbSIsIl9fcmVpZnlfYXN5bmNfcmVzdWx0X18iLCJfcmVpZnlFcnJvciIsInNlbGYiLCJhc3luYyIsInF1b3RlIiwic3RyaW5nIiwic3RyIiwiaG9sZGVyIiwic2luZ2xlSW5kZW50Iiwib3V0ZXJJbmRlbnQiLCJpc0Zpbml0ZSIsIlN0cmluZyIsImlubmVySW5kZW50IiwicGFydGlhbCIsImhhc093blByb3BlcnR5IiwiY2FsbCIsImpvaW4iLCJPYmplY3QiLCJzb3J0IiwicHVzaCIsImFsbE9wdGlvbnMiLCJhc3NpZ24iLCJuZXdJbmRlbnQiLCJleHBvcnREZWZhdWx0IiwiY2hlY2tFcnJvciIsImZuIiwicHJvcCIsInByb3RvdHlwZSIsInJlZHVjZSIsImFjYyIsIl9yZWYiLCJtYXhTdGFjayIsIm1zZ0Vycm9yIiwidGVzdCIs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LFVBQVUsQ0FBQ08sUUFBUSxDQUFDSSxLQUFLLENBQUNFLE9BQU8sQ0FBQztJQUNyRCxJQUFJRCxVQUFVLEVBQUU7TUFDZCxNQUFNLElBQUlwSSxLQUFLLENBQUMsdUNBQXVDLENBQUM7SUFDMUQ7SUFDQSxNQUFNbUksS0FBSztFQUNiO0FBQ0YsQ0FBQyxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9lanNvbi5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIGlzRnVuY3Rpb24sXG4gIGlzT2JqZWN0LFxuICBrZXlzT2YsXG4gIGxlbmd0aE9mLFxuICBoYXNPd24sXG4gIGNvbnZlcnRNYXBUb09iamVjdCxcbiAgaXNBcmd1bWVudHMsXG4gIGlzSW5mT3JOYU4sXG4gIGhhbmRsZUVycm9yLFxufSBmcm9tICcuL3V0aWxzJztcblxuLyoqXG4gKiBAbmFtZXNwYWNlXG4gKiBAc3VtbWFyeSBOYW1lc3BhY2UgZm9yIEVKU09OIGZ1bmN0aW9uc1xuICovXG5jb25zdCBFSlNPTiA9IHt9O1xuXG4vLyBDdXN0b20gdHlwZSBpbnRlcmZhY2UgZGVmaW5pdGlvblxuLyoqXG4gKiBAY2xhc3MgQ3VzdG9tVHlwZVxuICogQGluc3RhbmNlTmFtZSBjdXN0b21UeXBlXG4gKiBAbWVtYmVyT2YgRUpTT05cbiAqIEBzdW1tYXJ5IFRoZSBpbnRlcmZhY2UgdGhhdCBhIGNsYXNzIG11c3Qgc2F0aXNmeSB0byBiZSBhYmxlIHRvIGJlY29tZSBhblxuICogRUpTT04gY3VzdG9tIHR5cGUgdmlhIEVKU09OLmFkZFR5cGUuXG4gKi9cblxuLyoqXG4gKiBAZnVuY3Rpb24gdHlwZU5hbWVcbiAqIEBtZW1iZXJPZiBFSlNPTi5DdXN0b21UeXBlXG4gKiBAc3VtbWFyeSBSZXR1cm4gdGhlIHRhZyB1c2VkIHRvIGlkZW50aWZ5IHRoaXMgdHlwZS4gIFRoaXMgbXVzdCBtYXRjaCB0aGVcbiAqICAgICAgICAgIHRhZyB1c2VkIHRvIHJlZ2lzdGVyIHRoaXMgdHlwZSB3aXRoXG4gKiAgICAgICAgICBbYEVKU09OLmFkZFR5cGVgXSgjZWpzb25fYWRkX3R5cGUpLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAaW5zdGFuY2VcbiAqL1xuXG4vKipcbiAqIEBmdW5jdGlvbiB0b0pTT05WYWx1ZVxuICogQG1lbWJlck9mIEVKU09OLkN1c3RvbVR5cGVcbiAqIEBzdW1tYXJ5IFNlcmlhbGl6ZSB0aGlzIGluc3RhbmNlIGludG8gYSBKU09OLWNvbXBhdGlibGUgdmFsdWUuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBpbnN0YW5jZVxuICovXG5cbi8qKlxuICogQGZ1bmN0aW9uIGNsb25lXG4gKiBAbWVtYmVyT2YgRUpTT04uQ3VzdG9tVHlwZVxuICogQHN1bW1hcnkgUmV0dXJuIGEgdmFsdWUgYHJgIHN1Y2ggdGhhdCBgdGhpcy5lcXVhbHMocilgIGlzIHRydWUsIGFuZFxuICogICAgICAgICAgbW9kaWZpY2F0aW9ucyB0byBgcmAgZG8gbm90IGFmZmVjdCBgdGhpc2AgYW5kIHZpY2UgdmVyc2EuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBpbnN0YW5jZVxuICovXG5cbi8qKlxuICogQGZ1bmN0aW9uIGVxdWFsc1xuICogQG1lbWJlck9mIEVKU09OLkN1c3RvbVR5cGVcbiAqIEBzdW1tYXJ5IFJldHVybiBgdHJ1ZWAgaWYgYG90aGVyYCBoYXMgYSB2YWx1ZSBlcXVhbCB0byBgdGhpc2A7IGBmYWxzZWBcbiAqICAgICAgICAgIG90aGVyd2lzZS5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtPYmplY3R9IG90aGVyIEFub3RoZXIgb2JqZWN0IHRvIGNvbXBhcmUgdGhpcyB0by5cbiAqIEBpbnN0YW5jZVxuICovXG5cbmNvbnN0IGN1c3RvbVR5cGVzID0gbmV3IE1hcCgpO1xuXG4vLyBBZGQgYSBjdXN0b20gdHlwZSwgdXNpbmcgYSBtZXRob2Qgb2YgeW91ciBjaG9pY2UgdG8gZ2V0IHRvIGFuZFxuLy8gZnJvbSBhIGJhc2ljIEpTT04tYWJsZSByZXByZXNlbnRhdGlvbi4gIFRoZSBmYWN0b3J5IGFyZ3VtZW50XG4vLyBpcyBhIGZ1bmN0aW9uIG9mIEpTT04tYWJsZSAtLT4geW91ciBvYmplY3Rcbi8vIFRoZSB0eXBlIHlvdSBhZGQgbXVzdCBoYXZlOlxuLy8gLSBBIHRvSlNPTlZhbHVlKCkgbWV0aG9kLCBzbyB0aGF0IE1ldGVvciBjYW4gc2VyaWFsaXplIGl0XG4vLyAtIGEgdHlwZU5hbWUoKSBtZXRob2QsIHRvIHNob3cgaG93IHRvIGxvb2sgaXQgdXAgaW4gb3VyIHR5cGUgdGFibGUuXG4vLyBJdCBpcyBva2F5IGlmIHRoZXNlIG1ldGhvZHMgYXJlIG1vbmtleS1wYXRjaGVkIG9uLlxuLy8gRUpTT04uY2xvbmUgd2lsbCB1c2UgdG9KU09OVmFsdWUgYW5kIHRoZSBnaXZlbiBmYWN0b3J5IHRvIHByb2R1Y2Vcbi8vIGEgY2xvbmUsIGJ1dCB5b3UgbWF5IHNwZWNpZnkgYSBtZXRob2QgY2xvbmUoKSB0aGF0IHdpbGwgYmVcbi8vIHVzZWQgaW5zdGVhZC5cbi8vIFNpbWlsYXJseSwgRUpTT04uZXF1YWxzIHdpbGwgdXNlIHRvSlNPTlZhbHVlIHRvIG1ha2UgY29tcGFyaXNvbnMsXG4vLyBidXQgeW91IG1heSBwcm92aWRlIGEgbWV0aG9kIGVxdWFscygpIGluc3RlYWQuXG4vKipcbiAqIEBzdW1tYXJ5IEFkZCBhIGN1c3RvbSBkYXRhdHlwZSB0byBFSlNPTi5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgQSB0YWcgZm9yIHlvdXIgY3VzdG9tIHR5cGU7IG11c3QgYmUgdW5pcXVlIGFtb25nXG4gKiAgICAgICAgICAgICAgICAgICAgICBjdXN0b20gZGF0YSB0eXBlcyBkZWZpbmVkIGluIHlvdXIgcHJvamVjdCwgYW5kIG11c3RcbiAqICAgICAgICAgICAgICAgICAgICAgIG1hdGNoIHRoZSByZXN1bHQgb2YgeW91ciB0eXBlJ3MgYHR5cGVOYW1lYCBtZXRob2QuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmYWN0b3J5IEEgZnVuY3Rpb24gdGhhdCBkZXNlcmlhbGl6ZXMgYSBKU09OLWNvbXBhdGlibGVcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgaW50byBhbiBpbnN0YW5jZSBvZiB5b3VyIHR5cGUuICBUaGlzIHNob3VsZFxuICogICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRjaCB0aGUgc2VyaWFsaXphdGlvbiBwZXJmb3JtZWQgYnkgeW91clxuICogICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlJ3MgYHRvSlNPTlZhbHVlYCBtZXRob2QuXG4gKi9cbkVKU09OLmFkZFR5cGUgPSAobmFtZSwgZmFjdG9yeSkgPT4ge1xuICBpZiAoY3VzdG9tVHlwZXMuaGFzKG5hbWUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUeXBlICR7bmFtZX0gYWxyZWFkeSBwcmVzZW50YCk7XG4gIH1cbiAgY3VzdG9tVHlwZXMuc2V0KG5hbWUsIGZhY3RvcnkpO1xufTtcblxuY29uc3QgYnVpbHRpbkNvbnZlcnRlcnMgPSBbXG4gIHsgLy8gRGF0ZVxuICAgIG1hdGNoSlNPTlZhbHVlKG9iaikge1xuICAgICAgcmV0dXJuIGhhc093bihvYmosICckZGF0ZScpICYmIGxlbmd0aE9mKG9iaikgPT09IDE7XG4gICAgfSxcbiAgICBtYXRjaE9iamVjdChvYmopIHtcbiAgICAgIHJldHVybiBvYmogaW5zdGFuY2VvZiBEYXRlO1xuICAgIH0sXG4gICAgdG9KU09OVmFsdWUob2JqKSB7XG4gICAgICByZXR1cm4geyRkYXRlOiBvYmouZ2V0VGltZSgpfTtcbiAgICB9LFxuICAgIGZyb21KU09OVmFsdWUob2JqKSB7XG4gICAgICByZXR1cm4gbmV3IERhdGUob2JqLiRkYXRlKTtcbiAgICB9LFxuICB9LFxuICB7IC8vIFJlZ0V4cFxuICAgIG1hdGNoSlNPTlZhbHVlKG9iaikge1xuICAgICAgcmV0dXJuIGhhc093bihvYmosICckcmVnZXhwJylcbiAgICAgICAgJiYgaGFzT3duKG9iaiwgJyRmbGFncycpXG4gICAgICAgICYmIGxlbmd0aE9mKG9iaikgPT09IDI7XG4gICAgfSxcbiAgICBtYXRjaE9iamVjdChvYmopIHtcbiAgICAgIHJldHVybiBvYmogaW5zdGFuY2VvZiBSZWdFeHA7XG4gICAgfSxcbiAgICB0b0pTT05WYWx1ZShyZWdleHApIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgICRyZWdleHA6IHJlZ2V4cC5zb3VyY2UsXG4gICAgICAgICRmbGFnczogcmVnZXhwLmZsYWdzXG4gICAgICB9O1xuICAgIH0sXG4gICAgZnJvbUpTT05WYWx1ZShvYmopIHtcbiAgICAgIC8vIFJlcGxhY2VzIGR1cGxpY2F0ZSAvIGludmFsaWQgZmxhZ3MuXG4gICAgICByZXR1cm4gbmV3IFJlZ0V4cChcbiAgICAgICAgb2JqLiRyZWdleHAsXG4gICAgICAgIG9iai4kZmxhZ3NcbiAgICAgICAgICAvLyBDdXQgb2ZmIGZsYWdzIGF0IDUwIGNoYXJzIHRvIGF2b2lkIGFidXNpbmcgUmVnRXhwIGZvciBET1MuXG4gICAgICAgICAgLnNsaWNlKDAsIDUwKVxuICAgICAgICAgIC5yZXBsYWNlKC9bXmdpbXV5XS9nLCcnKVxuICAgICAgICAgIC5yZXBsYWNlKC8oLikoPz0uKlxcMSkvZywgJycpXG4gICAgICApO1xuICAgIH0sXG4gIH0sXG4gIHsgLy8gTmFOLCBJbmYsIC1JbmYuIChUaGVzZSBhcmUgdGhlIG9ubHkgb2JqZWN0cyB3aXRoIHR5cGVvZiAhPT0gJ29iamVjdCdcbiAgICAvLyB3aGljaCB3ZSBtYXRjaC4pXG4gICAgbWF0Y2hKU09OVmFsdWUob2JqKSB7XG4gICAgICByZXR1cm4gaGFzT3duKG9iaiwgJyRJbmZOYU4nKSAmJiBsZW5ndGhPZihvYmopID09PSAxO1xuICAgIH0sXG4gICAgbWF0Y2hPYmplY3Q6IGlzSW5mT3JOYU4sXG4gICAgdG9KU09OVmFsdWUob2JqKSB7XG4gICAgICBsZXQgc2lnbjtcbiAgICAgIGlmIChOdW1iZXIuaXNOYU4ob2JqKSkge1xuICAgICAgICBzaWduID0gMDtcbiAgICAgIH0gZWxzZSBpZiAob2JqID09PSBJbmZpbml0eSkge1xuICAgICAgICBzaWduID0gMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNpZ24gPSAtMTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7JEluZk5hTjogc2lnbn07XG4gICAgfSxcbiAgICBmcm9tSlNPTlZhbHVlKG9iaikge1xuICAgICAgcmV0dXJuIG9iai4kSW5mTmFOIC8gMDtcbiAgICB9LFxuICB9LFxuICB7IC8vIEJpbmFyeVxuICAgIG1hdGNoSlNPTlZhbHVlKG9iaikge1xuICAgICAgcmV0dXJuIGhhc093bihvYmosICckYmluYXJ5JykgJiYgbGVuZ3RoT2Yob2JqKSA9PT0gMTtcbiAgICB9LFxuICAgIG1hdGNoT2JqZWN0KG9iaikge1xuICAgICAgcmV0dXJuIHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJyAmJiBvYmogaW5zdGFuY2VvZiBVaW50OEFycmF5XG4gICAgICAgIHx8IChvYmogJiYgaGFzT3duKG9iaiwgJyRVaW50OEFycmF5UG9seWZpbGwnKSk7XG4gICAgfSxcbiAgICB0b0pTT05WYWx1ZShvYmopIHtcbiAgICAgIHJldHVybiB7JGJpbmFyeTogQmFzZTY0LmVuY29kZShvYmopfTtcbiAgICB9LFxuICAgIGZyb21KU09OVmFsdWUob2JqKSB7XG4gICAgICByZXR1cm4gQmFzZTY0LmRlY29kZShvYmouJGJpbmFyeSk7XG4gICAgfSxcbiAgfSxcbiAgeyAvLyBFc2NhcGluZyBvbmUgbGV2ZWxcbiAgICBtYXRjaEpTT05WYWx1ZShvYmopIHtcbiAgICAgIHJldHVybiBoYXNPd24ob2JqLCAnJGVzY2FwZScpICYmIGxlbmd0aE9mKG9iaikgPT09IDE7XG4gICAgfSxcbiAgICBtYXRjaE9iamVjdChvYmopIHtcbiAgICAgIGxldCBtYXRjaCA9IGZhbHNlO1xuICAgICAgaWYgKG9iaikge1xuICAgICAgICBjb25zdCBrZXlDb3VudCA9IGxlbmd0aE9mKG9iaik7XG4gICAgICAgIGlmIChrZXlDb3VudCA9PT0gMSB8fCBrZXlDb3VudCA9PT0gMikge1xuICAgICAgICAgIG1hdGNoID1cbiAgICAgICAgICAgIGJ1aWx0aW5Db252ZXJ0ZXJzLnNvbWUoY29udmVydGVyID0+IGNvbnZlcnRlci5tYXRjaEpTT05WYWx1ZShvYmopKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG1hdGNoO1xuICAgIH0sXG4gICAgdG9KU09OVmFsdWUob2JqKSB7XG4gICAgICBjb25zdCBuZXdPYmogPSB7fTtcbiAgICAgIGtleXNPZihvYmopLmZvckVhY2goa2V5ID0+IHtcbiAgICAgICAgbmV3T2JqW2tleV0gPSBFSlNPTi50b0pTT05WYWx1ZShvYmpba2V5XSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB7JGVzY2FwZTogbmV3T2JqfTtcbiAgICB9LFxuICAgIGZyb21KU09OVmFsdWUob2JqKSB7XG4gICAgICBjb25zdCBuZXdPYmogPSB7fTtcbiAgICAgIGtleXNPZihvYmouJGVzY2FwZSkuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgICBuZXdPYmpba2V5XSA9IEVKU09OLmZyb21KU09OVmFsdWUob2JqLiRlc2NhcGVba2V5XSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdPYmo7XG4gICAgfSxcbiAgfSxcbiAgeyAvLyBDdXN0b21cbiAgICBtYXRjaEpTT05WYWx1ZShvYmopIHtcbiAgICAgIHJldHVybiBoYXNPd24ob2JqLCAnJHR5cGUnKVxuICAgICAgICAmJiBoYXNPd24ob2JqLCAnJHZhbHVlJykgJiYgbGVuZ3RoT2Yob2JqKSA9PT0gMjtcbiAgICB9LFxuICAgIG1hdGNoT2JqZWN0KG9iaikge1xuICAgICAgcmV0dXJuIEVKU09OLl9pc0N1c3RvbVR5cGUob2JqKTtcbiAgICB9LFxuICAgIHRvSlNPTlZhbHVlKG9iaikge1xuICAgICAgY29uc3QganNvblZhbHVlID0gTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoKCkgPT4gb2JqLnRvSlNPTlZhbHVlKCkpO1xuICAgICAgcmV0dXJuIHskdHlwZTogb2JqLnR5cGVOYW1lKCksICR2YWx1ZToganNvblZhbHVlfTtcbiAgICB9LFxuICAgIGZyb21KU09OVmFsdWUob2JqKSB7XG4gICAgICBjb25zdCB0eXBlTmFtZSA9IG9iai4kdHlwZTtcbiAgICAgIGlmICghY3VzdG9tVHlwZXMuaGFzKHR5cGVOYW1lKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEN1c3RvbSBFSlNPTiB0eXBlICR7dHlwZU5hbWV9IGlzIG5vdCBkZWZpbmVkYCk7XG4gICAgICB9XG4gICAgICBjb25zdCBjb252ZXJ0ZXIgPSBjdXN0b21UeXBlcy5nZXQodHlwZU5hbWUpO1xuICAgICAgcmV0dXJuIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKCgpID0+IGNvbnZlcnRlcihvYmouJHZhbHVlKSk7XG4gICAgfSxcbiAgfSxcbl07XG5cbkVKU09OLl9pc0N1c3RvbVR5cGUgPSAob2JqKSA9PiAoXG4gIG9iaiAmJlxuICBpc0Z1bmN0aW9uKG9iai50b0pTT05WYWx1ZSkgJiZcbiAgaXNGdW5jdGlvbihvYmoudHlwZU5hbWUpICYmXG4gIGN1c3RvbVR5cGVzLmhhcyhvYmoudHlwZU5hbWUoKSlcbik7XG5cbkVKU09OLl9nZXRUeXBlcyA9IChpc09yaWdpbmFsID0gZmFsc2UpID0+IChpc09yaWdpbmFsID8gY3VzdG9tVHlwZXMgOiBjb252ZXJ0TWFwVG9PYmplY3QoY3VzdG9tVHlwZXMpKTtcblxuRUpTT04uX2dldENvbnZlcnRlcnMgPSAoKSA9PiBidWlsdGluQ29udmVydGVycztcblxuLy8gRWl0aGVyIHJldHVybiB0aGUgSlNPTi1jb21wYXRpYmxlIHZlcnNpb24gb2YgdGhlIGFyZ3VtZW50LCBvciB1bmRlZmluZWQgKGlmXG4vLyB0aGUgaXRlbSBpc24ndCBpdHNlbGYgcmVwbGFjZWFibGUsIGJ1dCBtYXliZSBzb21lIGZpZWxkcyBpbiBpdCBhcmUpXG5jb25zdCB0b0pTT05WYWx1ZUhlbHBlciA9IGl0ZW0gPT4ge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGJ1aWx0aW5Db252ZXJ0ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY29udmVydGVyID0gYnVpbHRpbkNvbnZlcnRlcnNbaV07XG4gICAgaWYgKGNvbnZlcnRlci5tYXRjaE9iamVjdChpdGVtKSkge1xuICAgICAgcmV0dXJuIGNvbnZlcnRlci50b0pTT05WYWx1ZShpdGVtKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn07XG5cbi8vIGZvciBib3RoIGFycmF5cyBhbmQgb2JqZWN0cywgaW4tcGxhY2UgbW9kaWZpY2F0aW9uLlxuY29uc3QgYWRqdXN0VHlwZXNUb0pTT05WYWx1ZSA9IG9iaiA9PiB7XG4gIC8vIElzIGl0IGFuIGF0b20gdGhhdCB3ZSBuZWVkIHRvIGFkanVzdD9cbiAgaWYgKG9iaiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgbWF5YmVDaGFuZ2VkID0gdG9KU09OVmFsdWVIZWxwZXIob2JqKTtcbiAgaWYgKG1heWJlQ2hhbmdlZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG1heWJlQ2hhbmdlZDtcbiAgfVxuXG4gIC8vIE90aGVyIGF0b21zIGFyZSB1bmNoYW5nZWQuXG4gIGlmICghaXNPYmplY3Qob2JqKSkge1xuICAgIHJldHVybiBvYmo7XG4gIH1cblxuICAvLyBJdGVyYXRlIG92ZXIgYXJyYXkgb3Igb2JqZWN0IHN0cnVjdHVyZS5cbiAga2V5c09mKG9iaikuZm9yRWFjaChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gb2JqW2tleV07XG4gICAgaWYgKCFpc09iamVjdCh2YWx1ZSkgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAhaXNJbmZPck5hTih2YWx1ZSkpIHtcbiAgICAgIHJldHVybjsgLy8gY29udGludWVcbiAgICB9XG5cbiAgICBjb25zdCBjaGFuZ2VkID0gdG9KU09OVmFsdWVIZWxwZXIodmFsdWUpO1xuICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICBvYmpba2V5XSA9IGNoYW5nZWQ7XG4gICAgICByZXR1cm47IC8vIG9uIHRvIHRoZSBuZXh0IGtleVxuICAgIH1cbiAgICAvLyBpZiB3ZSBnZXQgaGVyZSwgdmFsdWUgaXMgYW4gb2JqZWN0IGJ1dCBub3QgYWRqdXN0YWJsZVxuICAgIC8vIGF0IHRoaXMgbGV2ZWwuICByZWN1cnNlLlxuICAgIGFkanVzdFR5cGVzVG9KU09OVmFsdWUodmFsdWUpO1xuICB9KTtcbiAgcmV0dXJuIG9iajtcbn07XG5cbkVKU09OLl9hZGp1c3RUeXBlc1RvSlNPTlZhbHVlID0gYWRqdXN0VHlwZXNUb0pTT05WYWx1ZTtcblxuLyoqXG4gKiBAc3VtbWFyeSBTZXJpYWxpemUgYW4gRUpTT04tY29tcGF0aWJsZSB2YWx1ZSBpbnRvIGl0cyBwbGFpbiBKU09OXG4gKiAgICAgICAgICByZXByZXNlbnRhdGlvbi5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtFSlNPTn0gdmFsIEEgdmFsdWUgdG8gc2VyaWFsaXplIHRvIHBsYWluIEpTT04uXG4gKi9cbkVKU09OLnRvSlNPTlZhbHVlID0gaXRlbSA9PiB7XG4gIGNvbnN0IGNoYW5nZWQgPSB0b0pTT05WYWx1ZUhlbHBlcihpdGVtKTtcbiAgaWYgKGNoYW5nZWQgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBjaGFuZ2VkO1xuICB9XG5cbiAgbGV0IG5ld0l0ZW0gPSBpdGVtO1xuICBpZiAoaXNPYmplY3QoaXRlbSkpIHtcbiAgICBuZXdJdGVtID0gRUpTT04uY2xvbmUoaXRlbSk7XG4gICAgYWRqdXN0VHlwZXNUb0pTT05WYWx1ZShuZXdJdGVtKTtcbiAgfVxuICByZXR1cm4gbmV3SXRlbTtcbn07XG5cbi8vIEVpdGhlciByZXR1cm4gdGhlIGFyZ3VtZW50IGNoYW5nZWQgdG8gaGF2ZSB0aGUgbm9uLWpzb25cbi8vIHJlcCBvZiBpdHNlbGYgKHRoZSBPYmplY3QgdmVyc2lvbikgb3IgdGhlIGFyZ3VtZW50IGl0c2VsZi5cbi8vIERPRVMgTk9UIFJFQ1VSU0UuICBGb3IgYWN0dWFsbHkgZ2V0dGluZyB0aGUgZnVsbHktY2hhbmdlZCB2YWx1ZSwgdXNlXG4vLyBFSlNPTi5mcm9tSlNPTlZhbHVlXG5jb25zdCBmcm9tSlNPTlZhbHVlSGVscGVyID0gdmFsdWUgPT4ge1xuICBpZiAoaXNPYmplY3QodmFsdWUpICYmIHZhbHVlICE9PSBudWxsKSB7XG4gICAgY29uc3Qga2V5cyA9IGtleXNPZih2YWx1ZSk7XG4gICAgaWYgKGtleXMubGVuZ3RoIDw9IDJcbiAgICAgICAgJiYga2V5cy5ldmVyeShrID0+IHR5cGVvZiBrID09PSAnc3RyaW5nJyAmJiBrLnN1YnN0cigwLCAxKSA9PT0gJyQnKSkge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBidWlsdGluQ29udmVydGVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBjb252ZXJ0ZXIgPSBidWlsdGluQ29udmVydGVyc1tpXTtcbiAgICAgICAgaWYgKGNvbnZlcnRlci5tYXRjaEpTT05WYWx1ZSh2YWx1ZSkpIHtcbiAgICAgICAgICByZXR1cm4gY29udmVydGVyLmZyb21KU09OVmFsdWUodmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cbi8vIGZvciBib3RoIGFycmF5cyBhbmQgb2JqZWN0cy4gVHJpZXMgaXRzIGJlc3QgdG8ganVzdFxuLy8gdXNlIHRoZSBvYmplY3QgeW91IGhhbmQgaXQsIGJ1dCBtYXkgcmV0dXJuIHNvbWV0aGluZ1xuLy8gZGlmZmVyZW50IGlmIHRoZSBvYmplY3QgeW91IGhhbmQgaXQgaXRzZWxmIG5lZWRzIGNoYW5naW5nLlxuY29uc3QgYWRqdXN0VHlwZXNGcm9tSlNPTlZhbHVlID0gb2JqID0+IHtcbiAgaWYgKG9iaiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgbWF5YmVDaGFuZ2VkID0gZnJvbUpTT05WYWx1ZUhlbHBlcihvYmopO1xuICBpZiAobWF5YmVDaGFuZ2VkICE9PSBvYmopIHtcbiAgICByZXR1cm4gbWF5YmVDaGFuZ2VkO1xuICB9XG5cbiAgLy8gT3RoZXIgYXRvbXMgYXJlIHVuY2hhbmdlZC5cbiAgaWYgKCFpc09iamVjdChvYmopKSB7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuXG4gIGtleXNPZihvYmopLmZvckVhY2goa2V5ID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IG9ialtrZXldO1xuICAgIGlmIChpc09iamVjdCh2YWx1ZSkpIHtcbiAgICAgIGNvbnN0IGNoYW5nZWQgPSBmcm9tSlNPTlZhbHVlSGVscGVyKHZhbHVlKTtcbiAgICAgIGlmICh2YWx1ZSAhPT0gY2hhbmdlZCkge1xuICAgICAgICBvYmpba2V5XSA9IGNoYW5nZWQ7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIC8vIGlmIHdlIGdldCBoZXJlLCB2YWx1ZSBpcyBhbiBvYmplY3QgYnV0IG5vdCBhZGp1c3RhYmxlXG4gICAgICAvLyBhdCB0aGlzIGxldmVsLiAgcmVjdXJzZS5cbiAgICAgIGFkanVzdFR5cGVzRnJvbUpTT05WYWx1ZSh2YWx1ZSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG9iajtcbn07XG5cbkVKU09OLl9hZGp1c3RUeXBlc0Zyb21KU09OVmFsdWUgPSBhZGp1c3RUeXBlc0Zyb21KU09OVmFsdWU7XG5cbi8qKlxuICogQHN1bW1hcnkgRGVzZXJpYWxpemUgYW4gRUpTT04gdmFsdWUgZnJvbSBpdHMgcGxhaW4gSlNPTiByZXByZXNlbnRhdGlvbi5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtKU09OQ29tcGF0aWJsZX0gdmFsIEEgdmFsdWUgdG8gZGVzZXJpYWxpemUgaW50byBFSlNPTi5cbiAqL1xuRUpTT04uZnJvbUpTT05WYWx1ZSA9IGl0ZW0gPT4ge1xuICBsZXQgY2hhbmdlZCA9IGZyb21KU09OVmFsdWVIZWxwZXIoaXRlbSk7XG4gIGlmIChjaGFuZ2VkID09PSBpdGVtICYmIGlzT2JqZWN0KGl0ZW0pKSB7XG4gICAgY2hhbmdlZCA9IEVKU09OLmNsb25lKGl0ZW0pO1xuICAgIGFkanVzdFR5cGVzRnJvbUpTT05WYWx1ZShjaGFuZ2VkKTtcbiAgfVxuICByZXR1cm4gY2hhbmdlZDtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgU2VyaWFsaXplIGEgdmFsdWUgdG8gYSBzdHJpbmcuIEZvciBFSlNPTiB2YWx1ZXMsIHRoZSBzZXJpYWxpemF0aW9uXG4gKiAgICAgICAgICBmdWxseSByZXByZXNlbnRzIHRoZSB2YWx1ZS4gRm9yIG5vbi1FSlNPTiB2YWx1ZXMsIHNlcmlhbGl6ZXMgdGhlXG4gKiAgICAgICAgICBzYW1lIHdheSBhcyBgSlNPTi5zdHJpbmdpZnlgLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAcGFyYW0ge0VKU09OfSB2YWwgQSB2YWx1ZSB0byBzdHJpbmdpZnkuXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAcGFyYW0ge0Jvb2xlYW4gfCBJbnRlZ2VyIHwgU3RyaW5nfSBvcHRpb25zLmluZGVudCBJbmRlbnRzIG9iamVjdHMgYW5kXG4gKiBhcnJheXMgZm9yIGVhc3kgcmVhZGFiaWxpdHkuICBXaGVuIGB0cnVlYCwgaW5kZW50cyBieSAyIHNwYWNlczsgd2hlbiBhblxuICogaW50ZWdlciwgaW5kZW50cyBieSB0aGF0IG51bWJlciBvZiBzcGFjZXM7IGFuZCB3aGVuIGEgc3RyaW5nLCB1c2VzIHRoZVxuICogc3RyaW5nIGFzIHRoZSBpbmRlbnRhdGlvbiBwYXR0ZXJuLlxuICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLmNhbm9uaWNhbCBXaGVuIGB0cnVlYCwgc3RyaW5naWZpZXMga2V5cyBpbiBhblxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3QgaW4gc29ydGVkIG9yZGVyLlxuICovXG5FSlNPTi5zdHJpbmdpZnkgPSBoYW5kbGVFcnJvcigoaXRlbSwgb3B0aW9ucykgPT4ge1xuICBsZXQgc2VyaWFsaXplZDtcbiAgY29uc3QganNvbiA9IEVKU09OLnRvSlNPTlZhbHVlKGl0ZW0pO1xuICBpZiAob3B0aW9ucyAmJiAob3B0aW9ucy5jYW5vbmljYWwgfHwgb3B0aW9ucy5pbmRlbnQpKSB7XG4gICAgaW1wb3J0IGNhbm9uaWNhbFN0cmluZ2lmeSBmcm9tICcuL3N0cmluZ2lmeSc7XG4gICAgc2VyaWFsaXplZCA9IGNhbm9uaWNhbFN0cmluZ2lmeShqc29uLCBvcHRpb25zKTtcbiAgfSBlbHNlIHtcbiAgICBzZXJpYWxpemVkID0gSlNPTi5zdHJpbmdpZnkoanNvbik7XG4gIH1cbiAgcmV0dXJuIHNlcmlhbGl6ZWQ7XG59KTtcblxuLyoqXG4gKiBAc3VtbWFyeSBQYXJzZSBhIHN0cmluZyBpbnRvIGFuIEVKU09OIHZhbHVlLiBUaHJvd3MgYW4gZXJyb3IgaWYgdGhlIHN0cmluZ1xuICogICAgICAgICAgaXMgbm90IHZhbGlkIEVKU09OLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIEEgc3RyaW5nIHRvIHBhcnNlIGludG8gYW4gRUpTT04gdmFsdWUuXG4gKi9cbkVKU09OLnBhcnNlID0gaXRlbSA9PiB7XG4gIGlmICh0eXBlb2YgaXRlbSAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0VKU09OLnBhcnNlIGFyZ3VtZW50IHNob3VsZCBiZSBhIHN0cmluZycpO1xuICB9XG4gIHJldHVybiBFSlNPTi5mcm9tSlNPTlZhbHVlKEpTT04ucGFyc2UoaXRlbSkpO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZXR1cm5zIHRydWUgaWYgYHhgIGlzIGEgYnVmZmVyIG9mIGJpbmFyeSBkYXRhLCBhcyByZXR1cm5lZCBmcm9tXG4gKiAgICAgICAgICBbYEVKU09OLm5ld0JpbmFyeWBdKCNlanNvbl9uZXdfYmluYXJ5KS5cbiAqIEBwYXJhbSB7T2JqZWN0fSB4IFRoZSB2YXJpYWJsZSB0byBjaGVjay5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICovXG5FSlNPTi5pc0JpbmFyeSA9IG9iaiA9PiB7XG4gIHJldHVybiAhISgodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnICYmIG9iaiBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHx8XG4gICAgKG9iaiAmJiBvYmouJFVpbnQ4QXJyYXlQb2x5ZmlsbCkpO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZXR1cm4gdHJ1ZSBpZiBgYWAgYW5kIGBiYCBhcmUgZXF1YWwgdG8gZWFjaCBvdGhlci4gIFJldHVybiBmYWxzZVxuICogICAgICAgICAgb3RoZXJ3aXNlLiAgVXNlcyB0aGUgYGVxdWFsc2AgbWV0aG9kIG9uIGBhYCBpZiBwcmVzZW50LCBvdGhlcndpc2VcbiAqICAgICAgICAgIHBlcmZvcm1zIGEgZGVlcCBjb21wYXJpc29uLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAcGFyYW0ge0VKU09OfSBhXG4gKiBAcGFyYW0ge0VKU09OfSBiXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMua2V5T3JkZXJTZW5zaXRpdmUgQ29tcGFyZSBpbiBrZXkgc2Vuc2l0aXZlIG9yZGVyLFxuICogaWYgc3VwcG9ydGVkIGJ5IHRoZSBKYXZhU2NyaXB0IGltcGxlbWVudGF0aW9uLiAgRm9yIGV4YW1wbGUsIGB7YTogMSwgYjogMn1gXG4gKiBpcyBlcXVhbCB0byBge2I6IDIsIGE6IDF9YCBvbmx5IHdoZW4gYGtleU9yZGVyU2Vuc2l0aXZlYCBpcyBgZmFsc2VgLiAgVGhlXG4gKiBkZWZhdWx0IGlzIGBmYWxzZWAuXG4gKi9cbkVKU09OLmVxdWFscyA9IChhLCBiLCBvcHRpb25zKSA9PiB7XG4gIGxldCBpO1xuICBjb25zdCBrZXlPcmRlclNlbnNpdGl2ZSA9ICEhKG9wdGlvbnMgJiYgb3B0aW9ucy5rZXlPcmRlclNlbnNpdGl2ZSk7XG4gIGlmIChhID09PSBiKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyBUaGlzIGRpZmZlcnMgZnJvbSB0aGUgSUVFRSBzcGVjIGZvciBOYU4gZXF1YWxpdHksIGIvYyB3ZSBkb24ndCB3YW50XG4gIC8vIGFueXRoaW5nIGV2ZXIgd2l0aCBhIE5hTiB0byBiZSBwb2lzb25lZCBmcm9tIGJlY29taW5nIGVxdWFsIHRvIGFueXRoaW5nLlxuICBpZiAoTnVtYmVyLmlzTmFOKGEpICYmIE51bWJlci5pc05hTihiKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gaWYgZWl0aGVyIG9uZSBpcyBmYWxzeSwgdGhleSdkIGhhdmUgdG8gYmUgPT09IHRvIGJlIGVxdWFsXG4gIGlmICghYSB8fCAhYikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmICghKGlzT2JqZWN0KGEpICYmIGlzT2JqZWN0KGIpKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmIChhIGluc3RhbmNlb2YgRGF0ZSAmJiBiIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgIHJldHVybiBhLnZhbHVlT2YoKSA9PT0gYi52YWx1ZU9mKCk7XG4gIH1cblxuICBpZiAoRUpTT04uaXNCaW5hcnkoYSkgJiYgRUpTT04uaXNCaW5hcnkoYikpIHtcbiAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGZvciAoaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgaWYgKGlzRnVuY3Rpb24oYS5lcXVhbHMpKSB7XG4gICAgcmV0dXJuIGEuZXF1YWxzKGIsIG9wdGlvbnMpO1xuICB9XG5cbiAgaWYgKGlzRnVuY3Rpb24oYi5lcXVhbHMpKSB7XG4gICAgcmV0dXJuIGIuZXF1YWxzKGEsIG9wdGlvbnMpO1xuICB9XG5cbiAgLy8gQXJyYXkuaXNBcnJheSB3b3JrcyBhY3Jvc3MgaWZyYW1lcyB3aGlsZSBpbnN0YW5jZW9mIHdvbid0XG4gIGNvbnN0IGFJc0FycmF5ID0gQXJyYXkuaXNBcnJheShhKTtcbiAgY29uc3QgYklzQXJyYXkgPSBBcnJheS5pc0FycmF5KGIpO1xuXG4gIC8vIGlmIG5vdCBib3RoIG9yIG5vbmUgYXJlIGFycmF5IHRoZXkgYXJlIG5vdCBlcXVhbFxuICBpZiAoYUlzQXJyYXkgIT09IGJJc0FycmF5KSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKGFJc0FycmF5ICYmIGJJc0FycmF5KSB7XG4gICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBmb3IgKGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCFFSlNPTi5lcXVhbHMoYVtpXSwgYltpXSwgb3B0aW9ucykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIGZhbGxiYWNrIGZvciBjdXN0b20gdHlwZXMgdGhhdCBkb24ndCBpbXBsZW1lbnQgdGhlaXIgb3duIGVxdWFsc1xuICBzd2l0Y2ggKEVKU09OLl9pc0N1c3RvbVR5cGUoYSkgKyBFSlNPTi5faXNDdXN0b21UeXBlKGIpKSB7XG4gICAgY2FzZSAxOiByZXR1cm4gZmFsc2U7XG4gICAgY2FzZSAyOiByZXR1cm4gRUpTT04uZXF1YWxzKEVKU09OLnRvSlNPTlZhbHVlKGEpLCBFSlNPTi50b0pTT05WYWx1ZShiKSk7XG4gICAgZGVmYXVsdDogLy8gRG8gbm90aGluZ1xuICB9XG5cbiAgLy8gZmFsbCBiYWNrIHRvIHN0cnVjdHVyYWwgZXF1YWxpdHkgb2Ygb2JqZWN0c1xuICBsZXQgcmV0O1xuICBjb25zdCBhS2V5cyA9IGtleXNPZihhKTtcbiAgY29uc3QgYktleXMgPSBrZXlzT2YoYik7XG4gIGlmIChrZXlPcmRlclNlbnNpdGl2ZSkge1xuICAgIGkgPSAwO1xuICAgIHJldCA9IGFLZXlzLmV2ZXJ5KGtleSA9PiB7XG4gICAgICBpZiAoaSA+PSBiS2V5cy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKGtleSAhPT0gYktleXNbaV0pIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKCFFSlNPTi5lcXVhbHMoYVtrZXldLCBiW2JLZXlzW2ldXSwgb3B0aW9ucykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgaSA9IDA7XG4gICAgcmV0ID0gYUtleXMuZXZlcnkoa2V5ID0+IHtcbiAgICAgIGlmICghaGFzT3duKGIsIGtleSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKCFFSlNPTi5lcXVhbHMoYVtrZXldLCBiW2tleV0sIG9wdGlvbnMpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGkrKztcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xuICB9XG4gIHJldHVybiByZXQgJiYgaSA9PT0gYktleXMubGVuZ3RoO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZXR1cm4gYSBkZWVwIGNvcHkgb2YgYHZhbGAuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7RUpTT059IHZhbCBBIHZhbHVlIHRvIGNvcHkuXG4gKi9cbkVKU09OLmNsb25lID0gdiA9PiB7XG4gIGxldCByZXQ7XG4gIGlmICghaXNPYmplY3QodikpIHtcbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIGlmICh2ID09PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7IC8vIG51bGwgaGFzIHR5cGVvZiBcIm9iamVjdFwiXG4gIH1cblxuICBpZiAodiBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICByZXR1cm4gbmV3IERhdGUodi5nZXRUaW1lKCkpO1xuICB9XG5cbiAgLy8gUmVnRXhwcyBhcmUgbm90IHJlYWxseSBFSlNPTiBlbGVtZW50cyAoZWcgd2UgZG9uJ3QgZGVmaW5lIGEgc2VyaWFsaXphdGlvblxuICAvLyBmb3IgdGhlbSksIGJ1dCB0aGV5J3JlIGltbXV0YWJsZSBhbnl3YXksIHNvIHdlIGNhbiBzdXBwb3J0IHRoZW0gaW4gY2xvbmUuXG4gIGlmICh2IGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICBpZiAoRUpTT04uaXNCaW5hcnkodikpIHtcbiAgICByZXQgPSBFSlNPTi5uZXdCaW5hcnkodi5sZW5ndGgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdi5sZW5ndGg7IGkrKykge1xuICAgICAgcmV0W2ldID0gdltpXTtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KHYpKSB7XG4gICAgcmV0dXJuIHYubWFwKEVKU09OLmNsb25lKTtcbiAgfVxuXG4gIGlmIChpc0FyZ3VtZW50cyh2KSkge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHYpLm1hcChFSlNPTi5jbG9uZSk7XG4gIH1cblxuICAvLyBoYW5kbGUgZ2VuZXJhbCB1c2VyLWRlZmluZWQgdHlwZWQgT2JqZWN0cyBpZiB0aGV5IGhhdmUgYSBjbG9uZSBtZXRob2RcbiAgaWYgKGlzRnVuY3Rpb24odi5jbG9uZSkpIHtcbiAgICByZXR1cm4gdi5jbG9uZSgpO1xuICB9XG5cbiAgLy8gaGFuZGxlIG90aGVyIGN1c3RvbSB0eXBlc1xuICBpZiAoRUpTT04uX2lzQ3VzdG9tVHlwZSh2KSkge1xuICAgIHJldHVybiBFSlNPTi5mcm9tSlNPTlZhbHVlKEVKU09OLmNsb25lKEVKU09OLnRvSlNPTlZhbHVlKHYpKSwgdHJ1ZSk7XG4gIH1cblxuICAvLyBoYW5kbGUgb3RoZXIgb2JqZWN0c1xuICByZXQgPSB7fTtcbiAga2V5c09mKHYpLmZvckVhY2goKGtleSkgPT4ge1xuICAgIHJldFtrZXldID0gRUpTT04uY2xvbmUodltrZXldKTtcbiAgfSk7XG4gIHJldHVybiByZXQ7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IEFsbG9jYXRlIGEgbmV3IGJ1ZmZlciBvZiBiaW5hcnkgZGF0YSB0aGF0IEVKU09OIGNhbiBzZXJpYWxpemUuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7TnVtYmVyfSBzaXplIFRoZSBudW1iZXIgb2YgYnl0ZXMgb2YgYmluYXJ5IGRhdGEgdG8gYWxsb2NhdGUuXG4gKi9cbi8vIEVKU09OLm5ld0JpbmFyeSBpcyB0aGUgcHVibGljIGRvY3VtZW50ZWQgQVBJIGZvciB0aGlzIGZ1bmN0aW9uYWxpdHksXG4vLyBidXQgdGhlIGltcGxlbWVudGF0aW9uIGlzIGluIHRoZSAnYmFzZTY0JyBwYWNrYWdlIHRvIGF2b2lkXG4vLyBpbnRyb2R1Y2luZyBhIGNpcmN1bGFyIGRlcGVuZGVuY3kuIChJZiB0aGUgaW1wbGVtZW50YXRpb24gd2VyZSBoZXJlLFxuLy8gdGhlbiAnYmFzZTY0JyB3b3VsZCBoYXZlIHRvIHVzZSBFSlNPTi5uZXdCaW5hcnksIGFuZCAnZWpzb24nIHdvdWxkXG4vLyBhbHNvIGhhdmUgdG8gdXNlICdiYXNlNjQnLilcbkVKU09OLm5ld0JpbmFyeSA9IEJhc2U2NC5uZXdCaW5hcnk7XG5cbmV4cG9ydCB7IEVKU09OIH07XG4iLCIvLyBCYXNlZCBvbiBqc29uMi5qcyBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9kb3VnbGFzY3JvY2tmb3JkL0pTT04tanNcbi8vXG4vLyAgICBqc29uMi5qc1xuLy8gICAgMjAxMi0xMC0wOFxuLy9cbi8vICAgIFB1YmxpYyBEb21haW4uXG4vL1xuLy8gICAgTk8gV0FSUkFOVFkgRVhQUkVTU0VEIE9SIElNUExJRUQuIFVTRSBBVCBZT1VSIE9XTiBSSVNLLlxuXG5mdW5jdGlvbiBxdW90ZShzdHJpbmcpIHtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHN0cmluZyk7XG59XG5cbmNvbnN0IHN0ciA9IChrZXksIGhvbGRlciwgc2luZ2xlSW5kZW50LCBvdXRlckluZGVudCwgY2Fub25pY2FsKSA9PiB7XG4gIGNvbnN0IHZhbHVlID0gaG9sZGVyW2tleV07XG5cbiAgLy8gV2hhdCBoYXBwZW5zIG5leHQgZGVwZW5kcyBvbiB0aGUgdmFsdWUncyB0eXBlLlxuICBzd2l0Y2ggKHR5cGVvZiB2YWx1ZSkge1xuICBjYXNlICdzdHJpbmcnOlxuICAgIHJldHVybiBxdW90ZSh2YWx1ZSk7XG4gIGNhc2UgJ251bWJlcic6XG4gICAgLy8gSlNPTiBudW1iZXJzIG11c3QgYmUgZmluaXRlLiBFbmNvZGUgbm9uLWZpbml0ZSBudW1iZXJzIGFzIG51bGwuXG4gICAgcmV0dXJuIGlzRmluaXRlKHZhbHVlKSA/IFN0cmluZyh2YWx1ZSkgOiAnbnVsbCc7XG4gIGNhc2UgJ2Jvb2xlYW4nOlxuICAgIHJldHVybiBTdHJpbmcodmFsdWUpO1xuICAvLyBJZiB0aGUgdHlwZSBpcyAnb2JqZWN0Jywgd2UgbWlnaHQgYmUgZGVhbGluZyB3aXRoIGFuIG9iamVjdCBvciBhbiBhcnJheSBvclxuICAvLyBudWxsLlxuICBjYXNlICdvYmplY3QnOiB7XG4gICAgLy8gRHVlIHRvIGEgc3BlY2lmaWNhdGlvbiBibHVuZGVyIGluIEVDTUFTY3JpcHQsIHR5cGVvZiBudWxsIGlzICdvYmplY3QnLFxuICAgIC8vIHNvIHdhdGNoIG91dCBmb3IgdGhhdCBjYXNlLlxuICAgIGlmICghdmFsdWUpIHtcbiAgICAgIHJldHVybiAnbnVsbCc7XG4gICAgfVxuICAgIC8vIE1ha2UgYW4gYXJyYXkgdG8gaG9sZCB0aGUgcGFydGlhbCByZXN1bHRzIG9mIHN0cmluZ2lmeWluZyB0aGlzIG9iamVjdFxuICAgIC8vIHZhbHVlLlxuICAgIGNvbnN0IGlubmVySW5kZW50ID0gb3V0ZXJJbmRlbnQgKyBzaW5nbGVJbmRlbnQ7XG4gICAgY29uc3QgcGFydGlhbCA9IFtdO1xuICAgIGxldCB2O1xuXG4gICAgLy8gSXMgdGhlIHZhbHVlIGFuIGFycmF5P1xuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSB8fCAoe30pLmhhc093blByb3BlcnR5LmNhbGwodmFsdWUsICdjYWxsZWUnKSkge1xuICAgICAgLy8gVGhlIHZhbHVlIGlzIGFuIGFycmF5LiBTdHJpbmdpZnkgZXZlcnkgZWxlbWVudC4gVXNlIG51bGwgYXMgYVxuICAgICAgLy8gcGxhY2Vob2xkZXIgZm9yIG5vbi1KU09OIHZhbHVlcy5cbiAgICAgIGNvbnN0IGxlbmd0aCA9IHZhbHVlLmxlbmd0aDtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgcGFydGlhbFtpXSA9XG4gICAgICAgICAgc3RyKGksIHZhbHVlLCBzaW5nbGVJbmRlbnQsIGlubmVySW5kZW50LCBjYW5vbmljYWwpIHx8ICdudWxsJztcbiAgICAgIH1cblxuICAgICAgLy8gSm9pbiBhbGwgb2YgdGhlIGVsZW1lbnRzIHRvZ2V0aGVyLCBzZXBhcmF0ZWQgd2l0aCBjb21tYXMsIGFuZCB3cmFwXG4gICAgICAvLyB0aGVtIGluIGJyYWNrZXRzLlxuICAgICAgaWYgKHBhcnRpYWwubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHYgPSAnW10nO1xuICAgICAgfSBlbHNlIGlmIChpbm5lckluZGVudCkge1xuICAgICAgICB2ID0gJ1tcXG4nICtcbiAgICAgICAgICBpbm5lckluZGVudCArXG4gICAgICAgICAgcGFydGlhbC5qb2luKCcsXFxuJyArXG4gICAgICAgICAgaW5uZXJJbmRlbnQpICtcbiAgICAgICAgICAnXFxuJyArXG4gICAgICAgICAgb3V0ZXJJbmRlbnQgK1xuICAgICAgICAgICddJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHYgPSAnWycgKyBwYXJ0aWFsLmpvaW4oJywnKSArICddJztcbiAgICAgIH1cbiAgICAgIHJldHVybiB2O1xuICAgIH1cblxuICAgIC8vIEl0ZXJhdGUgdGhyb3VnaCBhbGwgb2YgdGhlIGtleXMgaW4gdGhlIG9iamVjdC5cbiAgICBsZXQga2V5cyA9IE9iamVjdC5rZXlzKHZhbHVlKTtcbiAgICBpZiAoY2Fub25pY2FsKSB7XG4gICAgICBrZXlzID0ga2V5cy5zb3J0KCk7XG4gICAgfVxuICAgIGtleXMuZm9yRWFjaChrID0+IHtcbiAgICAgIHYgPSBzdHIoaywgdmFsdWUsIHNpbmdsZUluZGVudCwgaW5uZXJJbmRlbnQsIGNhbm9uaWNhbCk7XG4gICAgICBpZiAodikge1xuICAgICAgICBwYXJ0aWFsLnB1c2gocXVvdGUoaykgKyAoaW5uZXJJbmRlbnQgPyAnOiAnIDogJzonKSArIHYpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gSm9pbiBhbGwgb2YgdGhlIG1lbWJlciB0ZXh0cyB0b2dldGhlciwgc2VwYXJhdGVkIHdpdGggY29tbWFzLFxuICAgIC8vIGFuZCB3cmFwIHRoZW0gaW4gYnJhY2VzLlxuICAgIGlmIChwYXJ0aWFsLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdiA9ICd7fSc7XG4gICAgfSBlbHNlIGlmIChpbm5lckluZGVudCkge1xuICAgICAgdiA9ICd7XFxuJyArXG4gICAgICAgIGlubmVySW5kZW50ICtcbiAgICAgICAgcGFydGlhbC5qb2luKCcsXFxuJyArXG4gICAgICAgIGlubmVySW5kZW50KSArXG4gICAgICAgICdcXG4nICtcbiAgICAgICAgb3V0ZXJJbmRlbnQgK1xuICAgICAgICAnfSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHYgPSAneycgKyBwYXJ0aWFsLmpvaW4oJywnKSArICd9JztcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICBkZWZhdWx0OiAvLyBEbyBub3RoaW5nXG4gIH1cbn07XG5cbi8vIElmIHRoZSBKU09OIG9iamVjdCBkb2VzIG5vdCB5ZXQgaGF2ZSBhIHN0cmluZ2lmeSBtZXRob2QsIGdpdmUgaXQgb25lLlxuY29uc3QgY2Fub25pY2FsU3RyaW5naWZ5ID0gKHZhbHVlLCBvcHRpb25zKSA9PiB7XG4gIC8vIE1ha2UgYSBmYWtlIHJvb3Qgb2JqZWN0IGNvbnRhaW5pbmcgb3VyIHZhbHVlIHVuZGVyIHRoZSBrZXkgb2YgJycuXG4gIC8vIFJldHVybiB0aGUgcmVzdWx0IG9mIHN0cmluZ2lmeWluZyB0aGUgdmFsdWUuXG4gIGNvbnN0IGFsbE9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHtcbiAgICBpbmRlbnQ6ICcnLFxuICAgIGNhbm9uaWNhbDogZmFsc2UsXG4gIH0sIG9wdGlvbnMpO1xuICBpZiAoYWxsT3B0aW9ucy5pbmRlbnQgPT09IHRydWUpIHtcbiAgICBhbGxPcHRpb25zLmluZGVudCA9ICcgICc7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGFsbE9wdGlvbnMuaW5kZW50ID09PSAnbnVtYmVyJykge1xuICAgIGxldCBuZXdJbmRlbnQgPSAnJztcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbE9wdGlvbnMuaW5kZW50OyBpKyspIHtcbiAgICAgIG5ld0luZGVudCArPSAnICc7XG4gICAgfVxuICAgIGFsbE9wdGlvbnMuaW5kZW50ID0gbmV3SW5kZW50O1xuICB9XG4gIHJldHVybiBzdHIoJycsIHsnJzogdmFsdWV9LCBhbGxPcHRpb25zLmluZGVudCwgJycsIGFsbE9wdGlvbnMuY2Fub25pY2FsKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGNhbm9uaWNhbFN0cmluZ2lmeTtcbiIsImV4cG9ydCBjb25zdCBpc0Z1bmN0aW9uID0gKGZuKSA9PiB0eXBlb2YgZm4gPT09ICdmdW5jdGlvbic7XG5cbmV4cG9ydCBjb25zdCBpc09iamVjdCA9IChmbikgPT4gdHlwZW9mIGZuID09PSAnb2JqZWN0JztcblxuZXhwb3J0IGNvbnN0IGtleXNPZiA9IChvYmopID0+IE9iamVjdC5rZXlzKG9iaik7XG5cbmV4cG9ydCBjb25zdCBsZW5ndGhPZiA9IChvYmopID0+IE9iamVjdC5rZXlzKG9iaikubGVuZ3RoO1xuXG5leHBvcnQgY29uc3QgaGFzT3duID0gKG9iaiwgcHJvcCkgPT4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCk7XG5cbmV4cG9ydCBjb25zdCBjb252ZXJ0TWFwVG9PYmplY3QgPSAobWFwKSA9PiBBcnJheS5mcm9tKG1hcCkucmVkdWNlKChhY2MsIFtrZXksIHZhbHVlXSkgPT4ge1xuICAvLyByZWFzc2lnbiB0byBub3QgY3JlYXRlIG5ldyBvYmplY3RcbiAgYWNjW2tleV0gPSB2YWx1ZTtcbiAgcmV0dXJuIGFjYztcbn0sIHt9KTtcblxuZXhwb3J0IGNvbnN0IGlzQXJndW1lbnRzID0gb2JqID0+IG9iaiAhPSBudWxsICYmIGhhc093bihvYmosICdjYWxsZWUnKTtcblxuZXhwb3J0IGNvbnN0IGlzSW5mT3JOYU4gPVxuICBvYmogPT4gTnVtYmVyLmlzTmFOKG9iaikgfHwgb2JqID09PSBJbmZpbml0eSB8fCBvYmogPT09IC1JbmZpbml0eTtcblxuZXhwb3J0IGNvbnN0IGNoZWNrRXJyb3IgPSB7XG4gIG1heFN0YWNrOiAobXNnRXJyb3IpID0+IG5ldyBSZWdFeHAoJ01heGltdW0gY2FsbCBzdGFjayBzaXplIGV4Y2VlZGVkJywgJ2cnKS50ZXN0KG1zZ0Vycm9yKSxcbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVFcnJvciA9IChmbikgPT4gZnVuY3Rpb24oKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc3QgaXNNYXhTdGFjayA9IGNoZWNrRXJyb3IubWF4U3RhY2soZXJyb3IubWVzc2FnZSk7XG4gICAgaWYgKGlzTWF4U3RhY2spIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ29udmVydGluZyBjaXJjdWxhciBzdHJ1Y3R1cmUgdG8gSlNPTicpXG4gICAgfVxuICAgIHRocm93IGVycm9yO1xuICB9XG59O1xuIl19
