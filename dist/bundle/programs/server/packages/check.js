Package["core-runtime"].queue("check", ["meteor", "ecmascript", "ejson", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var EJSON = Package.ejson.EJSON;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var check, Match;

var require = meteorInstall({"node_modules":{"meteor":{"check":{"match.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/check/match.js                                                                                           //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      check: () => check,
      Match: () => Match
    });
    let isPlainObject;
    module.link("./isPlainObject", {
      isPlainObject(v) {
        isPlainObject = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // Things we explicitly do NOT support:
    //    - heterogenous arrays

    const currentArgumentChecker = new Meteor.EnvironmentVariable();
    const hasOwn = Object.prototype.hasOwnProperty;

    /**
     * @summary Check that a value matches a [pattern](#matchpatterns).
     * If the value does not match the pattern, throw a `Match.Error`.
     *
     * Particularly useful to assert that arguments to a function have the right
     * types and structure.
     * @locus Anywhere
     * @param {Any} value The value to check
     * @param {MatchPattern} pattern The pattern to match `value` against
     */
    function check(value, pattern) {
      // Record that check got called, if somebody cared.
      //
      // We use getOrNullIfOutsideFiber so that it's OK to call check()
      // from non-Fiber server contexts; the downside is that if you forget to
      // bindEnvironment on some random callback in your method/publisher,
      // it might not find the argumentChecker and you'll get an error about
      // not checking an argument that it looks like you're checking (instead
      // of just getting a "Node code must run in a Fiber" error).
      const argChecker = currentArgumentChecker.getOrNullIfOutsideFiber();
      if (argChecker) {
        argChecker.checking(value);
      }
      const result = testSubtree(value, pattern);
      if (result) {
        const err = new Match.Error(result.message);
        if (result.path) {
          err.message += " in field ".concat(result.path);
          err.path = result.path;
        }
        throw err;
      }
    }
    ;

    /**
     * @namespace Match
     * @summary The namespace for all Match types and methods.
     */
    const Match = {
      Optional: function (pattern) {
        return new Optional(pattern);
      },
      Maybe: function (pattern) {
        return new Maybe(pattern);
      },
      OneOf: function () {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        return new OneOf(args);
      },
      Any: ['__any__'],
      Where: function (condition) {
        return new Where(condition);
      },
      ObjectIncluding: function (pattern) {
        return new ObjectIncluding(pattern);
      },
      ObjectWithValues: function (pattern) {
        return new ObjectWithValues(pattern);
      },
      // Matches only signed 32-bit integers
      Integer: ['__integer__'],
      // XXX matchers should know how to describe themselves for errors
      Error: Meteor.makeErrorType('Match.Error', function (msg) {
        this.message = "Match error: ".concat(msg);

        // The path of the value that failed to match. Initially empty, this gets
        // populated by catching and rethrowing the exception as it goes back up the
        // stack.
        // E.g.: "vals[3].entity.created"
        this.path = '';

        // If this gets sent over DDP, don't give full internal details but at least
        // provide something better than 500 Internal server error.
        this.sanitizedError = new Meteor.Error(400, 'Match failed');
      }),
      // Tests to see if value matches pattern. Unlike check, it merely returns true
      // or false (unless an error other than Match.Error was thrown). It does not
      // interact with _failIfArgumentsAreNotAllChecked.
      // XXX maybe also implement a Match.match which returns more information about
      //     failures but without using exception handling or doing what check()
      //     does with _failIfArgumentsAreNotAllChecked and Meteor.Error conversion

      /**
       * @summary Returns true if the value matches the pattern.
       * @locus Anywhere
       * @param {Any} value The value to check
       * @param {MatchPattern} pattern The pattern to match `value` against
       */
      test(value, pattern) {
        return !testSubtree(value, pattern);
      },
      // Runs `f.apply(context, args)`. If check() is not called on every element of
      // `args` (either directly or in the first level of an array), throws an error
      // (using `description` in the message).
      _failIfArgumentsAreNotAllChecked(f, context, args, description) {
        const argChecker = new ArgumentChecker(args, description);
        const result = currentArgumentChecker.withValue(argChecker, () => f.apply(context, args));

        // If f didn't itself throw, make sure it checked all of its arguments.
        argChecker.throwUnlessAllArgumentsHaveBeenChecked();
        return result;
      }
    };
    class Optional {
      constructor(pattern) {
        this.pattern = pattern;
      }
    }
    class Maybe {
      constructor(pattern) {
        this.pattern = pattern;
      }
    }
    class OneOf {
      constructor(choices) {
        if (!choices || choices.length === 0) {
          throw new Error('Must provide at least one choice to Match.OneOf');
        }
        this.choices = choices;
      }
    }
    class Where {
      constructor(condition) {
        this.condition = condition;
      }
    }
    class ObjectIncluding {
      constructor(pattern) {
        this.pattern = pattern;
      }
    }
    class ObjectWithValues {
      constructor(pattern) {
        this.pattern = pattern;
      }
    }
    const stringForErrorMessage = function (value) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (value === null) {
        return 'null';
      }
      if (options.onlyShowType) {
        return typeof value;
      }

      // Your average non-object things.  Saves from doing the try/catch below for.
      if (typeof value !== 'object') {
        return EJSON.stringify(value);
      }
      try {
        // Find objects with circular references since EJSON doesn't support them yet (Issue #4778 + Unaccepted PR)
        // If the native stringify is going to choke, EJSON.stringify is going to choke too.
        JSON.stringify(value);
      } catch (stringifyError) {
        if (stringifyError.name === 'TypeError') {
          return typeof value;
        }
      }
      return EJSON.stringify(value);
    };
    const typeofChecks = [[String, 'string'], [Number, 'number'], [Boolean, 'boolean'],
    // While we don't allow undefined/function in EJSON, this is good for optional
    // arguments with OneOf.
    [Function, 'function'], [undefined, 'undefined']];

    // Return `false` if it matches. Otherwise, return an object with a `message` and a `path` field.
    const testSubtree = (value, pattern) => {
      // Match anything!
      if (pattern === Match.Any) {
        return false;
      }

      // Basic atomic types.
      // Do not match boxed objects (e.g. String, Boolean)
      for (let i = 0; i < typeofChecks.length; ++i) {
        if (pattern === typeofChecks[i][0]) {
          if (typeof value === typeofChecks[i][1]) {
            return false;
          }
          return {
            message: "Expected ".concat(typeofChecks[i][1], ", got ").concat(stringForErrorMessage(value, {
              onlyShowType: true
            })),
            path: ''
          };
        }
      }
      if (pattern === null) {
        if (value === null) {
          return false;
        }
        return {
          message: "Expected null, got ".concat(stringForErrorMessage(value)),
          path: ''
        };
      }

      // Strings, numbers, and booleans match literally. Goes well with Match.OneOf.
      if (typeof pattern === 'string' || typeof pattern === 'number' || typeof pattern === 'boolean') {
        if (value === pattern) {
          return false;
        }
        return {
          message: "Expected ".concat(pattern, ", got ").concat(stringForErrorMessage(value)),
          path: ''
        };
      }

      // Match.Integer is special type encoded with array
      if (pattern === Match.Integer) {
        // There is no consistent and reliable way to check if variable is a 64-bit
        // integer. One of the popular solutions is to get reminder of division by 1
        // but this method fails on really large floats with big precision.
        // E.g.: 1.348192308491824e+23 % 1 === 0 in V8
        // Bitwise operators work consistantly but always cast variable to 32-bit
        // signed integer according to JavaScript specs.
        if (typeof value === 'number' && (value | 0) === value) {
          return false;
        }
        return {
          message: "Expected Integer, got ".concat(stringForErrorMessage(value)),
          path: ''
        };
      }

      // 'Object' is shorthand for Match.ObjectIncluding({});
      if (pattern === Object) {
        pattern = Match.ObjectIncluding({});
      }

      // Array (checked AFTER Any, which is implemented as an Array).
      if (pattern instanceof Array) {
        if (pattern.length !== 1) {
          return {
            message: "Bad pattern: arrays must have one type element ".concat(stringForErrorMessage(pattern)),
            path: ''
          };
        }
        if (!Array.isArray(value) && !isArguments(value)) {
          return {
            message: "Expected array, got ".concat(stringForErrorMessage(value)),
            path: ''
          };
        }
        for (let i = 0, length = value.length; i < length; i++) {
          const result = testSubtree(value[i], pattern[0]);
          if (result) {
            result.path = _prependPath(i, result.path);
            return result;
          }
        }
        return false;
      }

      // Arbitrary validation checks. The condition can return false or throw a
      // Match.Error (ie, it can internally use check()) to fail.
      if (pattern instanceof Where) {
        let result;
        try {
          result = pattern.condition(value);
        } catch (err) {
          if (!(err instanceof Match.Error)) {
            throw err;
          }
          return {
            message: err.message,
            path: err.path
          };
        }
        if (result) {
          return false;
        }

        // XXX this error is terrible
        return {
          message: 'Failed Match.Where validation',
          path: ''
        };
      }
      if (pattern instanceof Maybe) {
        pattern = Match.OneOf(undefined, null, pattern.pattern);
      } else if (pattern instanceof Optional) {
        pattern = Match.OneOf(undefined, pattern.pattern);
      }
      if (pattern instanceof OneOf) {
        for (let i = 0; i < pattern.choices.length; ++i) {
          const result = testSubtree(value, pattern.choices[i]);
          if (!result) {
            // No error? Yay, return.
            return false;
          }

          // Match errors just mean try another choice.
        }

        // XXX this error is terrible
        return {
          message: 'Failed Match.OneOf, Match.Maybe or Match.Optional validation',
          path: ''
        };
      }

      // A function that isn't something we special-case is assumed to be a
      // constructor.
      if (pattern instanceof Function) {
        if (value instanceof pattern) {
          return false;
        }
        return {
          message: "Expected ".concat(pattern.name || 'particular constructor'),
          path: ''
        };
      }
      let unknownKeysAllowed = false;
      let unknownKeyPattern;
      if (pattern instanceof ObjectIncluding) {
        unknownKeysAllowed = true;
        pattern = pattern.pattern;
      }
      if (pattern instanceof ObjectWithValues) {
        unknownKeysAllowed = true;
        unknownKeyPattern = [pattern.pattern];
        pattern = {}; // no required keys
      }

      if (typeof pattern !== 'object') {
        return {
          message: 'Bad pattern: unknown pattern type',
          path: ''
        };
      }

      // An object, with required and optional keys. Note that this does NOT do
      // structural matches against objects of special types that happen to match
      // the pattern: this really needs to be a plain old {Object}!
      if (typeof value !== 'object') {
        return {
          message: "Expected object, got ".concat(typeof value),
          path: ''
        };
      }
      if (value === null) {
        return {
          message: "Expected object, got null",
          path: ''
        };
      }
      if (!isPlainObject(value)) {
        return {
          message: "Expected plain object",
          path: ''
        };
      }
      const requiredPatterns = Object.create(null);
      const optionalPatterns = Object.create(null);
      Object.keys(pattern).forEach(key => {
        const subPattern = pattern[key];
        if (subPattern instanceof Optional || subPattern instanceof Maybe) {
          optionalPatterns[key] = subPattern.pattern;
        } else {
          requiredPatterns[key] = subPattern;
        }
      });
      for (let key in Object(value)) {
        const subValue = value[key];
        if (hasOwn.call(requiredPatterns, key)) {
          const result = testSubtree(subValue, requiredPatterns[key]);
          if (result) {
            result.path = _prependPath(key, result.path);
            return result;
          }
          delete requiredPatterns[key];
        } else if (hasOwn.call(optionalPatterns, key)) {
          const result = testSubtree(subValue, optionalPatterns[key]);
          if (result) {
            result.path = _prependPath(key, result.path);
            return result;
          }
        } else {
          if (!unknownKeysAllowed) {
            return {
              message: 'Unknown key',
              path: key
            };
          }
          if (unknownKeyPattern) {
            const result = testSubtree(subValue, unknownKeyPattern[0]);
            if (result) {
              result.path = _prependPath(key, result.path);
              return result;
            }
          }
        }
      }
      const keys = Object.keys(requiredPatterns);
      if (keys.length) {
        return {
          message: "Missing key '".concat(keys[0], "'"),
          path: ''
        };
      }
    };
    class ArgumentChecker {
      constructor(args, description) {
        // Make a SHALLOW copy of the arguments. (We'll be doing identity checks
        // against its contents.)
        this.args = [...args];

        // Since the common case will be to check arguments in order, and we splice
        // out arguments when we check them, make it so we splice out from the end
        // rather than the beginning.
        this.args.reverse();
        this.description = description;
      }
      checking(value) {
        if (this._checkingOneValue(value)) {
          return;
        }

        // Allow check(arguments, [String]) or check(arguments.slice(1), [String])
        // or check([foo, bar], [String]) to count... but only if value wasn't
        // itself an argument.
        if (Array.isArray(value) || isArguments(value)) {
          Array.prototype.forEach.call(value, this._checkingOneValue.bind(this));
        }
      }
      _checkingOneValue(value) {
        for (let i = 0; i < this.args.length; ++i) {
          // Is this value one of the arguments? (This can have a false positive if
          // the argument is an interned primitive, but it's still a good enough
          // check.)
          // (NaN is not === to itself, so we have to check specially.)
          if (value === this.args[i] || Number.isNaN(value) && Number.isNaN(this.args[i])) {
            this.args.splice(i, 1);
            return true;
          }
        }
        return false;
      }
      throwUnlessAllArgumentsHaveBeenChecked() {
        if (this.args.length > 0) throw new Error("Did not check() all arguments during ".concat(this.description));
      }
    }
    const _jsKeywords = ['do', 'if', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'false', 'null', 'this', 'true', 'void', 'with', 'break', 'catch', 'class', 'const', 'super', 'throw', 'while', 'yield', 'delete', 'export', 'import', 'public', 'return', 'static', 'switch', 'typeof', 'default', 'extends', 'finally', 'package', 'private', 'continue', 'debugger', 'function', 'arguments', 'interface', 'protected', 'implements', 'instanceof'];

    // Assumes the base of path is already escaped properly
    // returns key + base
    const _prependPath = (key, base) => {
      if (typeof key === 'number' || key.match(/^[0-9]+$/)) {
        key = "[".concat(key, "]");
      } else if (!key.match(/^[a-z_$][0-9a-z_$]*$/i) || _jsKeywords.indexOf(key) >= 0) {
        key = JSON.stringify([key]);
      }
      if (base && base[0] !== '[') {
        return "".concat(key, ".").concat(base);
      }
      return key + base;
    };
    const isObject = value => typeof value === 'object' && value !== null;
    const baseIsArguments = item => isObject(item) && Object.prototype.toString.call(item) === '[object Arguments]';
    const isArguments = baseIsArguments(function () {
      return arguments;
    }()) ? baseIsArguments : value => isObject(value) && typeof value.callee === 'function';
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

},"isPlainObject.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/check/isPlainObject.js                                                                                   //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
module.export({
  isPlainObject: () => isPlainObject
});
// Copy of jQuery.isPlainObject for the server side from jQuery v3.1.1.

const class2type = {};
const toString = class2type.toString;
const hasOwn = Object.prototype.hasOwnProperty;
const fnToString = hasOwn.toString;
const ObjectFunctionString = fnToString.call(Object);
const getProto = Object.getPrototypeOf;
const isPlainObject = obj => {
  let proto;
  let Ctor;

  // Detect obvious negatives
  // Use toString instead of jQuery.type to catch host objects
  if (!obj || toString.call(obj) !== '[object Object]') {
    return false;
  }
  proto = getProto(obj);

  // Objects with no prototype (e.g., `Object.create( null )`) are plain
  if (!proto) {
    return true;
  }

  // Objects with prototype are plain iff they were constructed by a global Object function
  Ctor = hasOwn.call(proto, 'constructor') && proto.constructor;
  return typeof Ctor === 'function' && fnToString.call(Ctor) === ObjectFunctionString;
};
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
      check: check,
      Match: Match
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/check/match.js"
  ],
  mainModulePath: "/node_modules/meteor/check/match.js"
}});

//# sourceURL=meteor://💻app/packages/check.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY2hlY2svbWF0Y2guanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2NoZWNrL2lzUGxhaW5PYmplY3QuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiY2hlY2siLCJNYXRjaCIsImlzUGxhaW5PYmplY3QiLCJsaW5rIiwidiIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwiY3VycmVudEFyZ3VtZW50Q2hlY2tlciIsIk1ldGVvciIsIkVudmlyb25tZW50VmFyaWFibGUiLCJoYXNPd24iLCJPYmplY3QiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsInZhbHVlIiwicGF0dGVybiIsImFyZ0NoZWNrZXIiLCJnZXRPck51bGxJZk91dHNpZGVGaWJlciIsImNoZWNraW5nIiwicmVzdWx0IiwidGVzdFN1YnRyZWUiLCJlcnIiLCJFcnJvciIsIm1lc3NhZ2UiLCJwYXRoIiwiY29uY2F0IiwiT3B0aW9uYWwiLCJNYXliZSIsIk9uZU9mIiwiX2xlbiIsImFyZ3VtZW50cyIsImxlbmd0aCIsImFyZ3MiLCJBcnJheSIsIl9rZXkiLCJBbnkiLCJXaGVyZSIsImNvbmRpdGlvbiIsIk9iamVjdEluY2x1ZGluZyIsIk9iamVjdFdpdGhWYWx1ZXMiLCJJbnRlZ2VyIiwibWFrZUVycm9yVHlwZSIsIm1zZyIsInNhbml0aXplZEVycm9yIiwidGVzdCIsIl9mYWlsSWZBcmd1bWVudHNBcmVOb3RBbGxDaGVja2VkIiwiZiIsImNvbnRleHQiLCJkZXNjcmlwdGlvbiIsIkFyZ3VtZW50Q2hlY2tlciIsIndpdGhWYWx1ZSIsImFwcGx5IiwidGhyb3dVbmxlc3NBbGxBcmd1bWVudHNIYXZlQmVlbkNoZWNrZWQiLCJjb25zdHJ1Y3RvciIsImNob2ljZXMiLCJzdHJpbmdGb3JFcnJvck1lc3NhZ2UiLCJvcHRpb25zIiwidW5kZWZpbmVkIiwib25seVNob3dUeXBlIiwiRUpTT04iLCJzdHJpbmdpZnkiLCJKU09OIiwic3RyaW5naWZ5RXJyb3IiLCJuYW1lIiwidHlwZW9mQ2hlY2tzIiwiU3RyaW5nIiwiTnVtYmVyIiwiQm9vbGVhbiIsIkZ1bmN0aW9uIiwiaSIsImlzQXJyYXkiLCJpc0FyZ3VtZW50cyIsIl9wcmVwZW5kUGF0aCIsInVua25vd25LZXlzQWxsb3dlZCIsInVua25vd25LZXlQYXR0ZXJuIiwicmVxdWlyZWRQYXR0ZXJucyIsImNyZWF0ZSIsIm9wdGlvbmFsUGF0dGVybnMiLCJrZXlzIiwiZm9yRWFjaCIsImtleSIsInN1YlBhdHRlcm4iLCJzdWJWYWx1ZSIsImNhbGwiLCJyZXZlcnNlIiwiX2NoZWNraW5nT25lVmFsdWUiLCJiaW5kIiwiaXNOYU4iLCJzcGxpY2UiLCJfanNLZXl3b3JkcyIsImJhc2UiLCJtYXRjaCIsImluZGV4T2YiLCJpc09iamVjdCIsImJhc2VJc0FyZ3VtZW50cyIsIml0ZW0iLCJ0b1N0cmluZyIsImNhbGxlZSIsIl9fcmVpZnlfYXN5bmNfcmVzdWx0X18iLCJfcmVpZnlFcnJvciIsInNlbGYiLCJhc3luYyIsImNsYXNzMnR5cGUiLCJmblRvU3RyaW5nIiwiT2JqZWN0RnVuY3Rpb25TdHJpbmciLCJnZXRQcm90byIsImdldFByb3RvdHlwZU9mIiwib2JqIiwicHJvdG8iLCJDdG9yIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFBQUEsTUFBTSxDQUFDQyxNQUFNLENBQUM7TUFBQ0MsS0FBSyxFQUFDQSxDQUFBLEtBQUlBLEtBQUs7TUFBQ0MsS0FBSyxFQUFDQSxDQUFBLEtBQUlBO0lBQUssQ0FBQyxDQUFDO0lBQUMsSUFBSUMsYUFBYTtJQUFDSixNQUFNLENBQUNLLElBQUksQ0FBQyxpQkFBaUIsRUFBQztNQUFDRCxhQUFhQSxDQUFDRSxDQUFDLEVBQUM7UUFBQ0YsYUFBYSxHQUFDRSxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSUMsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTUEsb0JBQW9CLENBQUMsQ0FBQyxFQUFF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RTtJQUNwRCxPQUFPLEtBQUs7RUFDZDtFQUVBQyxLQUFLLEdBQUdILFFBQVEsQ0FBQ0UsR0FBRyxDQUFDOztFQUVyQjtFQUNBLElBQUksQ0FBQ0MsS0FBSyxFQUFFO0lBQ1YsT0FBTyxJQUFJO0VBQ2I7O0VBRUE7RUFDQUMsSUFBSSxHQUFHbkcsTUFBTSxDQUFDeUUsSUFBSSxDQUFDeUIsS0FBSyxFQUFFLGFBQWEsQ0FBQyxJQUFJQSxLQUFLLENBQUN2RCxXQUFXO0VBQzdELE9BQU8sT0FBT3dELElBQUksS0FBSyxVQUFVLElBQy9CTixVQUFVLENBQUNwQixJQUFJLENBQUMwQixJQUFJLENBQUMsS0FBS0wsb0JBQW9CO0FBQ2xELENBQUMsQyIsImZpbGUiOiIvcGFja2FnZXMvY2hlY2suanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBYWFggZG9jc1xuaW1wb3J0IHsgaXNQbGFpbk9iamVjdCB9IGZyb20gJy4vaXNQbGFpbk9iamVjdCc7XG5cbi8vIFRoaW5ncyB3ZSBleHBsaWNpdGx5IGRvIE5PVCBzdXBwb3J0OlxuLy8gICAgLSBoZXRlcm9nZW5vdXMgYXJyYXlzXG5cbmNvbnN0IGN1cnJlbnRBcmd1bWVudENoZWNrZXIgPSBuZXcgTWV0ZW9yLkVudmlyb25tZW50VmFyaWFibGU7XG5jb25zdCBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIEBzdW1tYXJ5IENoZWNrIHRoYXQgYSB2YWx1ZSBtYXRjaGVzIGEgW3BhdHRlcm5dKCNtYXRjaHBhdHRlcm5zKS5cbiAqIElmIHRoZSB2YWx1ZSBkb2VzIG5vdCBtYXRjaCB0aGUgcGF0dGVybiwgdGhyb3cgYSBgTWF0Y2guRXJyb3JgLlxuICpcbiAqIFBhcnRpY3VsYXJseSB1c2VmdWwgdG8gYXNzZXJ0IHRoYXQgYXJndW1lbnRzIHRvIGEgZnVuY3Rpb24gaGF2ZSB0aGUgcmlnaHRcbiAqIHR5cGVzIGFuZCBzdHJ1Y3R1cmUuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7QW55fSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2tcbiAqIEBwYXJhbSB7TWF0Y2hQYXR0ZXJufSBwYXR0ZXJuIFRoZSBwYXR0ZXJuIHRvIG1hdGNoIGB2YWx1ZWAgYWdhaW5zdFxuICovXG5leHBvcnQgZnVuY3Rpb24gY2hlY2sodmFsdWUsIHBhdHRlcm4pIHtcbiAgLy8gUmVjb3JkIHRoYXQgY2hlY2sgZ290IGNhbGxlZCwgaWYgc29tZWJvZHkgY2FyZWQuXG4gIC8vXG4gIC8vIFdlIHVzZSBnZXRPck51bGxJZk91dHNpZGVGaWJlciBzbyB0aGF0IGl0J3MgT0sgdG8gY2FsbCBjaGVjaygpXG4gIC8vIGZyb20gbm9uLUZpYmVyIHNlcnZlciBjb250ZXh0czsgdGhlIGRvd25zaWRlIGlzIHRoYXQgaWYgeW91IGZvcmdldCB0b1xuICAvLyBiaW5kRW52aXJvbm1lbnQgb24gc29tZSByYW5kb20gY2FsbGJhY2sgaW4geW91ciBtZXRob2QvcHVibGlzaGVyLFxuICAvLyBpdCBtaWdodCBub3QgZmluZCB0aGUgYXJndW1lbnRDaGVja2VyIGFuZCB5b3UnbGwgZ2V0IGFuIGVycm9yIGFib3V0XG4gIC8vIG5vdCBjaGVja2luZyBhbiBhcmd1bWVudCB0aGF0IGl0IGxvb2tzIGxpa2UgeW91J3JlIGNoZWNraW5nIChpbnN0ZWFkXG4gIC8vIG9mIGp1c3QgZ2V0dGluZyBhIFwiTm9kZSBjb2RlIG11c3QgcnVuIGluIGEgRmliZXJcIiBlcnJvcikuXG4gIGNvbnN0IGFyZ0NoZWNrZXIgPSBjdXJyZW50QXJndW1lbnRDaGVja2VyLmdldE9yTnVsbElmT3V0c2lkZUZpYmVyKCk7XG4gIGlmIChhcmdDaGVja2VyKSB7XG4gICAgYXJnQ2hlY2tlci5jaGVja2luZyh2YWx1ZSk7XG4gIH1cblxuICBjb25zdCByZXN1bHQgPSB0ZXN0U3VidHJlZSh2YWx1ZSwgcGF0dGVybik7XG4gIGlmIChyZXN1bHQpIHtcbiAgICBjb25zdCBlcnIgPSBuZXcgTWF0Y2guRXJyb3IocmVzdWx0Lm1lc3NhZ2UpO1xuICAgIGlmIChyZXN1bHQucGF0aCkge1xuICAgICAgZXJyLm1lc3NhZ2UgKz0gYCBpbiBmaWVsZCAke3Jlc3VsdC5wYXRofWA7XG4gICAgICBlcnIucGF0aCA9IHJlc3VsdC5wYXRoO1xuICAgIH1cblxuICAgIHRocm93IGVycjtcbiAgfVxufTtcblxuLyoqXG4gKiBAbmFtZXNwYWNlIE1hdGNoXG4gKiBAc3VtbWFyeSBUaGUgbmFtZXNwYWNlIGZvciBhbGwgTWF0Y2ggdHlwZXMgYW5kIG1ldGhvZHMuXG4gKi9cbmV4cG9ydCBjb25zdCBNYXRjaCA9IHtcbiAgT3B0aW9uYWw6IGZ1bmN0aW9uKHBhdHRlcm4pIHtcbiAgICByZXR1cm4gbmV3IE9wdGlvbmFsKHBhdHRlcm4pO1xuICB9LFxuXG4gIE1heWJlOiBmdW5jdGlvbihwYXR0ZXJuKSB7XG4gICAgcmV0dXJuIG5ldyBNYXliZShwYXR0ZXJuKTtcbiAgfSxcblxuICBPbmVPZjogZnVuY3Rpb24oLi4uYXJncykge1xuICAgIHJldHVybiBuZXcgT25lT2YoYXJncyk7XG4gIH0sXG5cbiAgQW55OiBbJ19fYW55X18nXSxcbiAgV2hlcmU6IGZ1bmN0aW9uKGNvbmRpdGlvbikge1xuICAgIHJldHVybiBuZXcgV2hlcmUoY29uZGl0aW9uKTtcbiAgfSxcblxuICBPYmplY3RJbmNsdWRpbmc6IGZ1bmN0aW9uKHBhdHRlcm4pIHtcbiAgICByZXR1cm4gbmV3IE9iamVjdEluY2x1ZGluZyhwYXR0ZXJuKVxuICB9LFxuXG4gIE9iamVjdFdpdGhWYWx1ZXM6IGZ1bmN0aW9uKHBhdHRlcm4pIHtcbiAgICByZXR1cm4gbmV3IE9iamVjdFdpdGhWYWx1ZXMocGF0dGVybik7XG4gIH0sXG5cbiAgLy8gTWF0Y2hlcyBvbmx5IHNpZ25lZCAzMi1iaXQgaW50ZWdlcnNcbiAgSW50ZWdlcjogWydfX2ludGVnZXJfXyddLFxuXG4gIC8vIFhYWCBtYXRjaGVycyBzaG91bGQga25vdyBob3cgdG8gZGVzY3JpYmUgdGhlbXNlbHZlcyBmb3IgZXJyb3JzXG4gIEVycm9yOiBNZXRlb3IubWFrZUVycm9yVHlwZSgnTWF0Y2guRXJyb3InLCBmdW5jdGlvbiAobXNnKSB7XG4gICAgdGhpcy5tZXNzYWdlID0gYE1hdGNoIGVycm9yOiAke21zZ31gO1xuXG4gICAgLy8gVGhlIHBhdGggb2YgdGhlIHZhbHVlIHRoYXQgZmFpbGVkIHRvIG1hdGNoLiBJbml0aWFsbHkgZW1wdHksIHRoaXMgZ2V0c1xuICAgIC8vIHBvcHVsYXRlZCBieSBjYXRjaGluZyBhbmQgcmV0aHJvd2luZyB0aGUgZXhjZXB0aW9uIGFzIGl0IGdvZXMgYmFjayB1cCB0aGVcbiAgICAvLyBzdGFjay5cbiAgICAvLyBFLmcuOiBcInZhbHNbM10uZW50aXR5LmNyZWF0ZWRcIlxuICAgIHRoaXMucGF0aCA9ICcnO1xuXG4gICAgLy8gSWYgdGhpcyBnZXRzIHNlbnQgb3ZlciBERFAsIGRvbid0IGdpdmUgZnVsbCBpbnRlcm5hbCBkZXRhaWxzIGJ1dCBhdCBsZWFzdFxuICAgIC8vIHByb3ZpZGUgc29tZXRoaW5nIGJldHRlciB0aGFuIDUwMCBJbnRlcm5hbCBzZXJ2ZXIgZXJyb3IuXG4gICAgdGhpcy5zYW5pdGl6ZWRFcnJvciA9IG5ldyBNZXRlb3IuRXJyb3IoNDAwLCAnTWF0Y2ggZmFpbGVkJyk7XG4gIH0pLFxuXG4gIC8vIFRlc3RzIHRvIHNlZSBpZiB2YWx1ZSBtYXRjaGVzIHBhdHRlcm4uIFVubGlrZSBjaGVjaywgaXQgbWVyZWx5IHJldHVybnMgdHJ1ZVxuICAvLyBvciBmYWxzZSAodW5sZXNzIGFuIGVycm9yIG90aGVyIHRoYW4gTWF0Y2guRXJyb3Igd2FzIHRocm93bikuIEl0IGRvZXMgbm90XG4gIC8vIGludGVyYWN0IHdpdGggX2ZhaWxJZkFyZ3VtZW50c0FyZU5vdEFsbENoZWNrZWQuXG4gIC8vIFhYWCBtYXliZSBhbHNvIGltcGxlbWVudCBhIE1hdGNoLm1hdGNoIHdoaWNoIHJldHVybnMgbW9yZSBpbmZvcm1hdGlvbiBhYm91dFxuICAvLyAgICAgZmFpbHVyZXMgYnV0IHdpdGhvdXQgdXNpbmcgZXhjZXB0aW9uIGhhbmRsaW5nIG9yIGRvaW5nIHdoYXQgY2hlY2soKVxuICAvLyAgICAgZG9lcyB3aXRoIF9mYWlsSWZBcmd1bWVudHNBcmVOb3RBbGxDaGVja2VkIGFuZCBNZXRlb3IuRXJyb3IgY29udmVyc2lvblxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBSZXR1cm5zIHRydWUgaWYgdGhlIHZhbHVlIG1hdGNoZXMgdGhlIHBhdHRlcm4uXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge0FueX0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrXG4gICAqIEBwYXJhbSB7TWF0Y2hQYXR0ZXJufSBwYXR0ZXJuIFRoZSBwYXR0ZXJuIHRvIG1hdGNoIGB2YWx1ZWAgYWdhaW5zdFxuICAgKi9cbiAgdGVzdCh2YWx1ZSwgcGF0dGVybikge1xuICAgIHJldHVybiAhdGVzdFN1YnRyZWUodmFsdWUsIHBhdHRlcm4pO1xuICB9LFxuXG4gIC8vIFJ1bnMgYGYuYXBwbHkoY29udGV4dCwgYXJncylgLiBJZiBjaGVjaygpIGlzIG5vdCBjYWxsZWQgb24gZXZlcnkgZWxlbWVudCBvZlxuICAvLyBgYXJnc2AgKGVpdGhlciBkaXJlY3RseSBvciBpbiB0aGUgZmlyc3QgbGV2ZWwgb2YgYW4gYXJyYXkpLCB0aHJvd3MgYW4gZXJyb3JcbiAgLy8gKHVzaW5nIGBkZXNjcmlwdGlvbmAgaW4gdGhlIG1lc3NhZ2UpLlxuICBfZmFpbElmQXJndW1lbnRzQXJlTm90QWxsQ2hlY2tlZChmLCBjb250ZXh0LCBhcmdzLCBkZXNjcmlwdGlvbikge1xuICAgIGNvbnN0IGFyZ0NoZWNrZXIgPSBuZXcgQXJndW1lbnRDaGVja2VyKGFyZ3MsIGRlc2NyaXB0aW9uKTtcbiAgICBjb25zdCByZXN1bHQgPSBjdXJyZW50QXJndW1lbnRDaGVja2VyLndpdGhWYWx1ZShcbiAgICAgIGFyZ0NoZWNrZXIsXG4gICAgICAoKSA9PiBmLmFwcGx5KGNvbnRleHQsIGFyZ3MpXG4gICAgKTtcblxuICAgIC8vIElmIGYgZGlkbid0IGl0c2VsZiB0aHJvdywgbWFrZSBzdXJlIGl0IGNoZWNrZWQgYWxsIG9mIGl0cyBhcmd1bWVudHMuXG4gICAgYXJnQ2hlY2tlci50aHJvd1VubGVzc0FsbEFyZ3VtZW50c0hhdmVCZWVuQ2hlY2tlZCgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn07XG5cbmNsYXNzIE9wdGlvbmFsIHtcbiAgY29uc3RydWN0b3IocGF0dGVybikge1xuICAgIHRoaXMucGF0dGVybiA9IHBhdHRlcm47XG4gIH1cbn1cblxuY2xhc3MgTWF5YmUge1xuICBjb25zdHJ1Y3RvcihwYXR0ZXJuKSB7XG4gICAgdGhpcy5wYXR0ZXJuID0gcGF0dGVybjtcbiAgfVxufVxuXG5jbGFzcyBPbmVPZiB7XG4gIGNvbnN0cnVjdG9yKGNob2ljZXMpIHtcbiAgICBpZiAoIWNob2ljZXMgfHwgY2hvaWNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTXVzdCBwcm92aWRlIGF0IGxlYXN0IG9uZSBjaG9pY2UgdG8gTWF0Y2guT25lT2YnKTtcbiAgICB9XG5cbiAgICB0aGlzLmNob2ljZXMgPSBjaG9pY2VzO1xuICB9XG59XG5cbmNsYXNzIFdoZXJlIHtcbiAgY29uc3RydWN0b3IoY29uZGl0aW9uKSB7XG4gICAgdGhpcy5jb25kaXRpb24gPSBjb25kaXRpb247XG4gIH1cbn1cblxuY2xhc3MgT2JqZWN0SW5jbHVkaW5nIHtcbiAgY29uc3RydWN0b3IocGF0dGVybikge1xuICAgIHRoaXMucGF0dGVybiA9IHBhdHRlcm47XG4gIH1cbn1cblxuY2xhc3MgT2JqZWN0V2l0aFZhbHVlcyB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4pIHtcbiAgICB0aGlzLnBhdHRlcm4gPSBwYXR0ZXJuO1xuICB9XG59XG5cbmNvbnN0IHN0cmluZ0ZvckVycm9yTWVzc2FnZSA9ICh2YWx1ZSwgb3B0aW9ucyA9IHt9KSA9PiB7XG4gIGlmICggdmFsdWUgPT09IG51bGwgKSB7XG4gICAgcmV0dXJuICdudWxsJztcbiAgfVxuXG4gIGlmICggb3B0aW9ucy5vbmx5U2hvd1R5cGUgKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZTtcbiAgfVxuXG4gIC8vIFlvdXIgYXZlcmFnZSBub24tb2JqZWN0IHRoaW5ncy4gIFNhdmVzIGZyb20gZG9pbmcgdGhlIHRyeS9jYXRjaCBiZWxvdyBmb3IuXG4gIGlmICggdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JyApIHtcbiAgICByZXR1cm4gRUpTT04uc3RyaW5naWZ5KHZhbHVlKVxuICB9XG5cbiAgdHJ5IHtcblxuICAgIC8vIEZpbmQgb2JqZWN0cyB3aXRoIGNpcmN1bGFyIHJlZmVyZW5jZXMgc2luY2UgRUpTT04gZG9lc24ndCBzdXBwb3J0IHRoZW0geWV0IChJc3N1ZSAjNDc3OCArIFVuYWNjZXB0ZWQgUFIpXG4gICAgLy8gSWYgdGhlIG5hdGl2ZSBzdHJpbmdpZnkgaXMgZ29pbmcgdG8gY2hva2UsIEVKU09OLnN0cmluZ2lmeSBpcyBnb2luZyB0byBjaG9rZSB0b28uXG4gICAgSlNPTi5zdHJpbmdpZnkodmFsdWUpO1xuICB9IGNhdGNoIChzdHJpbmdpZnlFcnJvcikge1xuICAgIGlmICggc3RyaW5naWZ5RXJyb3IubmFtZSA9PT0gJ1R5cGVFcnJvcicgKSB7XG4gICAgICByZXR1cm4gdHlwZW9mIHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBFSlNPTi5zdHJpbmdpZnkodmFsdWUpO1xufTtcblxuY29uc3QgdHlwZW9mQ2hlY2tzID0gW1xuICBbU3RyaW5nLCAnc3RyaW5nJ10sXG4gIFtOdW1iZXIsICdudW1iZXInXSxcbiAgW0Jvb2xlYW4sICdib29sZWFuJ10sXG5cbiAgLy8gV2hpbGUgd2UgZG9uJ3QgYWxsb3cgdW5kZWZpbmVkL2Z1bmN0aW9uIGluIEVKU09OLCB0aGlzIGlzIGdvb2QgZm9yIG9wdGlvbmFsXG4gIC8vIGFyZ3VtZW50cyB3aXRoIE9uZU9mLlxuICBbRnVuY3Rpb24sICdmdW5jdGlvbiddLFxuICBbdW5kZWZpbmVkLCAndW5kZWZpbmVkJ10sXG5dO1xuXG4vLyBSZXR1cm4gYGZhbHNlYCBpZiBpdCBtYXRjaGVzLiBPdGhlcndpc2UsIHJldHVybiBhbiBvYmplY3Qgd2l0aCBhIGBtZXNzYWdlYCBhbmQgYSBgcGF0aGAgZmllbGQuXG5jb25zdCB0ZXN0U3VidHJlZSA9ICh2YWx1ZSwgcGF0dGVybikgPT4ge1xuXG4gIC8vIE1hdGNoIGFueXRoaW5nIVxuICBpZiAocGF0dGVybiA9PT0gTWF0Y2guQW55KSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gQmFzaWMgYXRvbWljIHR5cGVzLlxuICAvLyBEbyBub3QgbWF0Y2ggYm94ZWQgb2JqZWN0cyAoZS5nLiBTdHJpbmcsIEJvb2xlYW4pXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdHlwZW9mQ2hlY2tzLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKHBhdHRlcm4gPT09IHR5cGVvZkNoZWNrc1tpXVswXSkge1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gdHlwZW9mQ2hlY2tzW2ldWzFdKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbWVzc2FnZTogYEV4cGVjdGVkICR7dHlwZW9mQ2hlY2tzW2ldWzFdfSwgZ290ICR7c3RyaW5nRm9yRXJyb3JNZXNzYWdlKHZhbHVlLCB7IG9ubHlTaG93VHlwZTogdHJ1ZSB9KX1gLFxuICAgICAgICBwYXRoOiAnJyxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgaWYgKHBhdHRlcm4gPT09IG51bGwpIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogYEV4cGVjdGVkIG51bGwsIGdvdCAke3N0cmluZ0ZvckVycm9yTWVzc2FnZSh2YWx1ZSl9YCxcbiAgICAgIHBhdGg6ICcnLFxuICAgIH07XG4gIH1cblxuICAvLyBTdHJpbmdzLCBudW1iZXJzLCBhbmQgYm9vbGVhbnMgbWF0Y2ggbGl0ZXJhbGx5LiBHb2VzIHdlbGwgd2l0aCBNYXRjaC5PbmVPZi5cbiAgaWYgKHR5cGVvZiBwYXR0ZXJuID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgcGF0dGVybiA9PT0gJ251bWJlcicgfHwgdHlwZW9mIHBhdHRlcm4gPT09ICdib29sZWFuJykge1xuICAgIGlmICh2YWx1ZSA9PT0gcGF0dGVybikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlOiBgRXhwZWN0ZWQgJHtwYXR0ZXJufSwgZ290ICR7c3RyaW5nRm9yRXJyb3JNZXNzYWdlKHZhbHVlKX1gLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIC8vIE1hdGNoLkludGVnZXIgaXMgc3BlY2lhbCB0eXBlIGVuY29kZWQgd2l0aCBhcnJheVxuICBpZiAocGF0dGVybiA9PT0gTWF0Y2guSW50ZWdlcikge1xuXG4gICAgLy8gVGhlcmUgaXMgbm8gY29uc2lzdGVudCBhbmQgcmVsaWFibGUgd2F5IHRvIGNoZWNrIGlmIHZhcmlhYmxlIGlzIGEgNjQtYml0XG4gICAgLy8gaW50ZWdlci4gT25lIG9mIHRoZSBwb3B1bGFyIHNvbHV0aW9ucyBpcyB0byBnZXQgcmVtaW5kZXIgb2YgZGl2aXNpb24gYnkgMVxuICAgIC8vIGJ1dCB0aGlzIG1ldGhvZCBmYWlscyBvbiByZWFsbHkgbGFyZ2UgZmxvYXRzIHdpdGggYmlnIHByZWNpc2lvbi5cbiAgICAvLyBFLmcuOiAxLjM0ODE5MjMwODQ5MTgyNGUrMjMgJSAxID09PSAwIGluIFY4XG4gICAgLy8gQml0d2lzZSBvcGVyYXRvcnMgd29yayBjb25zaXN0YW50bHkgYnV0IGFsd2F5cyBjYXN0IHZhcmlhYmxlIHRvIDMyLWJpdFxuICAgIC8vIHNpZ25lZCBpbnRlZ2VyIGFjY29yZGluZyB0byBKYXZhU2NyaXB0IHNwZWNzLlxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmICh2YWx1ZSB8IDApID09PSB2YWx1ZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlOiBgRXhwZWN0ZWQgSW50ZWdlciwgZ290ICR7c3RyaW5nRm9yRXJyb3JNZXNzYWdlKHZhbHVlKX1gLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIC8vICdPYmplY3QnIGlzIHNob3J0aGFuZCBmb3IgTWF0Y2guT2JqZWN0SW5jbHVkaW5nKHt9KTtcbiAgaWYgKHBhdHRlcm4gPT09IE9iamVjdCkge1xuICAgIHBhdHRlcm4gPSBNYXRjaC5PYmplY3RJbmNsdWRpbmcoe30pO1xuICB9XG5cbiAgLy8gQXJyYXkgKGNoZWNrZWQgQUZURVIgQW55LCB3aGljaCBpcyBpbXBsZW1lbnRlZCBhcyBhbiBBcnJheSkuXG4gIGlmIChwYXR0ZXJuIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICBpZiAocGF0dGVybi5sZW5ndGggIT09IDEpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG1lc3NhZ2U6IGBCYWQgcGF0dGVybjogYXJyYXlzIG11c3QgaGF2ZSBvbmUgdHlwZSBlbGVtZW50ICR7c3RyaW5nRm9yRXJyb3JNZXNzYWdlKHBhdHRlcm4pfWAsXG4gICAgICAgIHBhdGg6ICcnLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpICYmICFpc0FyZ3VtZW50cyh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG1lc3NhZ2U6IGBFeHBlY3RlZCBhcnJheSwgZ290ICR7c3RyaW5nRm9yRXJyb3JNZXNzYWdlKHZhbHVlKX1gLFxuICAgICAgICBwYXRoOiAnJyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDAsIGxlbmd0aCA9IHZhbHVlLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB0ZXN0U3VidHJlZSh2YWx1ZVtpXSwgcGF0dGVyblswXSk7XG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIHJlc3VsdC5wYXRoID0gX3ByZXBlbmRQYXRoKGksIHJlc3VsdC5wYXRoKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBBcmJpdHJhcnkgdmFsaWRhdGlvbiBjaGVja3MuIFRoZSBjb25kaXRpb24gY2FuIHJldHVybiBmYWxzZSBvciB0aHJvdyBhXG4gIC8vIE1hdGNoLkVycm9yIChpZSwgaXQgY2FuIGludGVybmFsbHkgdXNlIGNoZWNrKCkpIHRvIGZhaWwuXG4gIGlmIChwYXR0ZXJuIGluc3RhbmNlb2YgV2hlcmUpIHtcbiAgICBsZXQgcmVzdWx0O1xuICAgIHRyeSB7XG4gICAgICByZXN1bHQgPSBwYXR0ZXJuLmNvbmRpdGlvbih2YWx1ZSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoIShlcnIgaW5zdGFuY2VvZiBNYXRjaC5FcnJvcikpIHtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBtZXNzYWdlOiBlcnIubWVzc2FnZSxcbiAgICAgICAgcGF0aDogZXJyLnBhdGhcbiAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKHJlc3VsdCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFhYWCB0aGlzIGVycm9yIGlzIHRlcnJpYmxlXG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6ICdGYWlsZWQgTWF0Y2guV2hlcmUgdmFsaWRhdGlvbicsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG5cbiAgaWYgKHBhdHRlcm4gaW5zdGFuY2VvZiBNYXliZSkge1xuICAgIHBhdHRlcm4gPSBNYXRjaC5PbmVPZih1bmRlZmluZWQsIG51bGwsIHBhdHRlcm4ucGF0dGVybik7XG4gIH0gZWxzZSBpZiAocGF0dGVybiBpbnN0YW5jZW9mIE9wdGlvbmFsKSB7XG4gICAgcGF0dGVybiA9IE1hdGNoLk9uZU9mKHVuZGVmaW5lZCwgcGF0dGVybi5wYXR0ZXJuKTtcbiAgfVxuXG4gIGlmIChwYXR0ZXJuIGluc3RhbmNlb2YgT25lT2YpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdHRlcm4uY2hvaWNlcy5sZW5ndGg7ICsraSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gdGVzdFN1YnRyZWUodmFsdWUsIHBhdHRlcm4uY2hvaWNlc1tpXSk7XG4gICAgICBpZiAoIXJlc3VsdCkge1xuXG4gICAgICAgIC8vIE5vIGVycm9yPyBZYXksIHJldHVybi5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICAvLyBNYXRjaCBlcnJvcnMganVzdCBtZWFuIHRyeSBhbm90aGVyIGNob2ljZS5cbiAgICB9XG5cbiAgICAvLyBYWFggdGhpcyBlcnJvciBpcyB0ZXJyaWJsZVxuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlOiAnRmFpbGVkIE1hdGNoLk9uZU9mLCBNYXRjaC5NYXliZSBvciBNYXRjaC5PcHRpb25hbCB2YWxpZGF0aW9uJyxcbiAgICAgIHBhdGg6ICcnLFxuICAgIH07XG4gIH1cblxuICAvLyBBIGZ1bmN0aW9uIHRoYXQgaXNuJ3Qgc29tZXRoaW5nIHdlIHNwZWNpYWwtY2FzZSBpcyBhc3N1bWVkIHRvIGJlIGFcbiAgLy8gY29uc3RydWN0b3IuXG4gIGlmIChwYXR0ZXJuIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBwYXR0ZXJuKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6IGBFeHBlY3RlZCAke3BhdHRlcm4ubmFtZSB8fCAncGFydGljdWxhciBjb25zdHJ1Y3Rvcid9YCxcbiAgICAgIHBhdGg6ICcnLFxuICAgIH07XG4gIH1cblxuICBsZXQgdW5rbm93bktleXNBbGxvd2VkID0gZmFsc2U7XG4gIGxldCB1bmtub3duS2V5UGF0dGVybjtcbiAgaWYgKHBhdHRlcm4gaW5zdGFuY2VvZiBPYmplY3RJbmNsdWRpbmcpIHtcbiAgICB1bmtub3duS2V5c0FsbG93ZWQgPSB0cnVlO1xuICAgIHBhdHRlcm4gPSBwYXR0ZXJuLnBhdHRlcm47XG4gIH1cblxuICBpZiAocGF0dGVybiBpbnN0YW5jZW9mIE9iamVjdFdpdGhWYWx1ZXMpIHtcbiAgICB1bmtub3duS2V5c0FsbG93ZWQgPSB0cnVlO1xuICAgIHVua25vd25LZXlQYXR0ZXJuID0gW3BhdHRlcm4ucGF0dGVybl07XG4gICAgcGF0dGVybiA9IHt9OyAgLy8gbm8gcmVxdWlyZWQga2V5c1xuICB9XG5cbiAgaWYgKHR5cGVvZiBwYXR0ZXJuICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlOiAnQmFkIHBhdHRlcm46IHVua25vd24gcGF0dGVybiB0eXBlJyxcbiAgICAgIHBhdGg6ICcnLFxuICAgIH07XG4gIH1cblxuICAvLyBBbiBvYmplY3QsIHdpdGggcmVxdWlyZWQgYW5kIG9wdGlvbmFsIGtleXMuIE5vdGUgdGhhdCB0aGlzIGRvZXMgTk9UIGRvXG4gIC8vIHN0cnVjdHVyYWwgbWF0Y2hlcyBhZ2FpbnN0IG9iamVjdHMgb2Ygc3BlY2lhbCB0eXBlcyB0aGF0IGhhcHBlbiB0byBtYXRjaFxuICAvLyB0aGUgcGF0dGVybjogdGhpcyByZWFsbHkgbmVlZHMgdG8gYmUgYSBwbGFpbiBvbGQge09iamVjdH0hXG4gIGlmICh0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6IGBFeHBlY3RlZCBvYmplY3QsIGdvdCAke3R5cGVvZiB2YWx1ZX1gLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlOiBgRXhwZWN0ZWQgb2JqZWN0LCBnb3QgbnVsbGAsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG5cbiAgaWYgKCEgaXNQbGFpbk9iamVjdCh2YWx1ZSkpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogYEV4cGVjdGVkIHBsYWluIG9iamVjdGAsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgcmVxdWlyZWRQYXR0ZXJucyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIGNvbnN0IG9wdGlvbmFsUGF0dGVybnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gIE9iamVjdC5rZXlzKHBhdHRlcm4pLmZvckVhY2goa2V5ID0+IHtcbiAgICBjb25zdCBzdWJQYXR0ZXJuID0gcGF0dGVybltrZXldO1xuICAgIGlmIChzdWJQYXR0ZXJuIGluc3RhbmNlb2YgT3B0aW9uYWwgfHxcbiAgICAgICAgc3ViUGF0dGVybiBpbnN0YW5jZW9mIE1heWJlKSB7XG4gICAgICBvcHRpb25hbFBhdHRlcm5zW2tleV0gPSBzdWJQYXR0ZXJuLnBhdHRlcm47XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlcXVpcmVkUGF0dGVybnNba2V5XSA9IHN1YlBhdHRlcm47XG4gICAgfVxuICB9KTtcblxuICBmb3IgKGxldCBrZXkgaW4gT2JqZWN0KHZhbHVlKSkge1xuICAgIGNvbnN0IHN1YlZhbHVlID0gdmFsdWVba2V5XTtcbiAgICBpZiAoaGFzT3duLmNhbGwocmVxdWlyZWRQYXR0ZXJucywga2V5KSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gdGVzdFN1YnRyZWUoc3ViVmFsdWUsIHJlcXVpcmVkUGF0dGVybnNba2V5XSk7XG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIHJlc3VsdC5wYXRoID0gX3ByZXBlbmRQYXRoKGtleSwgcmVzdWx0LnBhdGgpO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuXG4gICAgICBkZWxldGUgcmVxdWlyZWRQYXR0ZXJuc1trZXldO1xuICAgIH0gZWxzZSBpZiAoaGFzT3duLmNhbGwob3B0aW9uYWxQYXR0ZXJucywga2V5KSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gdGVzdFN1YnRyZWUoc3ViVmFsdWUsIG9wdGlvbmFsUGF0dGVybnNba2V5XSk7XG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIHJlc3VsdC5wYXRoID0gX3ByZXBlbmRQYXRoKGtleSwgcmVzdWx0LnBhdGgpO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghdW5rbm93bktleXNBbGxvd2VkKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgbWVzc2FnZTogJ1Vua25vd24ga2V5JyxcbiAgICAgICAgICBwYXRoOiBrZXksXG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIGlmICh1bmtub3duS2V5UGF0dGVybikge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB0ZXN0U3VidHJlZShzdWJWYWx1ZSwgdW5rbm93bktleVBhdHRlcm5bMF0pO1xuICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgcmVzdWx0LnBhdGggPSBfcHJlcGVuZFBhdGgoa2V5LCByZXN1bHQucGF0aCk7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhyZXF1aXJlZFBhdHRlcm5zKTtcbiAgaWYgKGtleXMubGVuZ3RoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6IGBNaXNzaW5nIGtleSAnJHtrZXlzWzBdfSdgLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxufTtcblxuY2xhc3MgQXJndW1lbnRDaGVja2VyIHtcbiAgY29uc3RydWN0b3IgKGFyZ3MsIGRlc2NyaXB0aW9uKSB7XG5cbiAgICAvLyBNYWtlIGEgU0hBTExPVyBjb3B5IG9mIHRoZSBhcmd1bWVudHMuIChXZSdsbCBiZSBkb2luZyBpZGVudGl0eSBjaGVja3NcbiAgICAvLyBhZ2FpbnN0IGl0cyBjb250ZW50cy4pXG4gICAgdGhpcy5hcmdzID0gWy4uLmFyZ3NdO1xuXG4gICAgLy8gU2luY2UgdGhlIGNvbW1vbiBjYXNlIHdpbGwgYmUgdG8gY2hlY2sgYXJndW1lbnRzIGluIG9yZGVyLCBhbmQgd2Ugc3BsaWNlXG4gICAgLy8gb3V0IGFyZ3VtZW50cyB3aGVuIHdlIGNoZWNrIHRoZW0sIG1ha2UgaXQgc28gd2Ugc3BsaWNlIG91dCBmcm9tIHRoZSBlbmRcbiAgICAvLyByYXRoZXIgdGhhbiB0aGUgYmVnaW5uaW5nLlxuICAgIHRoaXMuYXJncy5yZXZlcnNlKCk7XG4gICAgdGhpcy5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuICB9XG5cbiAgY2hlY2tpbmcodmFsdWUpIHtcbiAgICBpZiAodGhpcy5fY2hlY2tpbmdPbmVWYWx1ZSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBBbGxvdyBjaGVjayhhcmd1bWVudHMsIFtTdHJpbmddKSBvciBjaGVjayhhcmd1bWVudHMuc2xpY2UoMSksIFtTdHJpbmddKVxuICAgIC8vIG9yIGNoZWNrKFtmb28sIGJhcl0sIFtTdHJpbmddKSB0byBjb3VudC4uLiBidXQgb25seSBpZiB2YWx1ZSB3YXNuJ3RcbiAgICAvLyBpdHNlbGYgYW4gYXJndW1lbnQuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpIHx8IGlzQXJndW1lbnRzKHZhbHVlKSkge1xuICAgICAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCh2YWx1ZSwgdGhpcy5fY2hlY2tpbmdPbmVWYWx1ZS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH1cblxuICBfY2hlY2tpbmdPbmVWYWx1ZSh2YWx1ZSkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5hcmdzLmxlbmd0aDsgKytpKSB7XG5cbiAgICAgIC8vIElzIHRoaXMgdmFsdWUgb25lIG9mIHRoZSBhcmd1bWVudHM/IChUaGlzIGNhbiBoYXZlIGEgZmFsc2UgcG9zaXRpdmUgaWZcbiAgICAgIC8vIHRoZSBhcmd1bWVudCBpcyBhbiBpbnRlcm5lZCBwcmltaXRpdmUsIGJ1dCBpdCdzIHN0aWxsIGEgZ29vZCBlbm91Z2hcbiAgICAgIC8vIGNoZWNrLilcbiAgICAgIC8vIChOYU4gaXMgbm90ID09PSB0byBpdHNlbGYsIHNvIHdlIGhhdmUgdG8gY2hlY2sgc3BlY2lhbGx5LilcbiAgICAgIGlmICh2YWx1ZSA9PT0gdGhpcy5hcmdzW2ldIHx8XG4gICAgICAgICAgKE51bWJlci5pc05hTih2YWx1ZSkgJiYgTnVtYmVyLmlzTmFOKHRoaXMuYXJnc1tpXSkpKSB7XG4gICAgICAgIHRoaXMuYXJncy5zcGxpY2UoaSwgMSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICB0aHJvd1VubGVzc0FsbEFyZ3VtZW50c0hhdmVCZWVuQ2hlY2tlZCgpIHtcbiAgICBpZiAodGhpcy5hcmdzLmxlbmd0aCA+IDApXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYERpZCBub3QgY2hlY2soKSBhbGwgYXJndW1lbnRzIGR1cmluZyAke3RoaXMuZGVzY3JpcHRpb259YCk7XG4gIH1cbn1cblxuY29uc3QgX2pzS2V5d29yZHMgPSBbJ2RvJywgJ2lmJywgJ2luJywgJ2ZvcicsICdsZXQnLCAnbmV3JywgJ3RyeScsICd2YXInLCAnY2FzZScsXG4gICdlbHNlJywgJ2VudW0nLCAnZXZhbCcsICdmYWxzZScsICdudWxsJywgJ3RoaXMnLCAndHJ1ZScsICd2b2lkJywgJ3dpdGgnLFxuICAnYnJlYWsnLCAnY2F0Y2gnLCAnY2xhc3MnLCAnY29uc3QnLCAnc3VwZXInLCAndGhyb3cnLCAnd2hpbGUnLCAneWllbGQnLFxuICAnZGVsZXRlJywgJ2V4cG9ydCcsICdpbXBvcnQnLCAncHVibGljJywgJ3JldHVybicsICdzdGF0aWMnLCAnc3dpdGNoJyxcbiAgJ3R5cGVvZicsICdkZWZhdWx0JywgJ2V4dGVuZHMnLCAnZmluYWxseScsICdwYWNrYWdlJywgJ3ByaXZhdGUnLCAnY29udGludWUnLFxuICAnZGVidWdnZXInLCAnZnVuY3Rpb24nLCAnYXJndW1lbnRzJywgJ2ludGVyZmFjZScsICdwcm90ZWN0ZWQnLCAnaW1wbGVtZW50cycsXG4gICdpbnN0YW5jZW9mJ107XG5cbi8vIEFzc3VtZXMgdGhlIGJhc2Ugb2YgcGF0aCBpcyBhbHJlYWR5IGVzY2FwZWQgcHJvcGVybHlcbi8vIHJldHVybnMga2V5ICsgYmFzZVxuY29uc3QgX3ByZXBlbmRQYXRoID0gKGtleSwgYmFzZSkgPT4ge1xuICBpZiAoKHR5cGVvZiBrZXkpID09PSAnbnVtYmVyJyB8fCBrZXkubWF0Y2goL15bMC05XSskLykpIHtcbiAgICBrZXkgPSBgWyR7a2V5fV1gO1xuICB9IGVsc2UgaWYgKCFrZXkubWF0Y2goL15bYS16XyRdWzAtOWEtel8kXSokL2kpIHx8XG4gICAgICAgICAgICAgX2pzS2V5d29yZHMuaW5kZXhPZihrZXkpID49IDApIHtcbiAgICBrZXkgPSBKU09OLnN0cmluZ2lmeShba2V5XSk7XG4gIH1cblxuICBpZiAoYmFzZSAmJiBiYXNlWzBdICE9PSAnWycpIHtcbiAgICByZXR1cm4gYCR7a2V5fS4ke2Jhc2V9YDtcbiAgfVxuXG4gIHJldHVybiBrZXkgKyBiYXNlO1xufVxuXG5jb25zdCBpc09iamVjdCA9IHZhbHVlID0+IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGw7XG5cbmNvbnN0IGJhc2VJc0FyZ3VtZW50cyA9IGl0ZW0gPT5cbiAgaXNPYmplY3QoaXRlbSkgJiZcbiAgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGl0ZW0pID09PSAnW29iamVjdCBBcmd1bWVudHNdJztcblxuY29uc3QgaXNBcmd1bWVudHMgPSBiYXNlSXNBcmd1bWVudHMoZnVuY3Rpb24oKSB7IHJldHVybiBhcmd1bWVudHM7IH0oKSkgP1xuICBiYXNlSXNBcmd1bWVudHMgOlxuICB2YWx1ZSA9PiBpc09iamVjdCh2YWx1ZSkgJiYgdHlwZW9mIHZhbHVlLmNhbGxlZSA9PT0gJ2Z1bmN0aW9uJztcbiIsIi8vIENvcHkgb2YgalF1ZXJ5LmlzUGxhaW5PYmplY3QgZm9yIHRoZSBzZXJ2ZXIgc2lkZSBmcm9tIGpRdWVyeSB2My4xLjEuXG5cbmNvbnN0IGNsYXNzMnR5cGUgPSB7fTtcblxuY29uc3QgdG9TdHJpbmcgPSBjbGFzczJ0eXBlLnRvU3RyaW5nO1xuXG5jb25zdCBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG5jb25zdCBmblRvU3RyaW5nID0gaGFzT3duLnRvU3RyaW5nO1xuXG5jb25zdCBPYmplY3RGdW5jdGlvblN0cmluZyA9IGZuVG9TdHJpbmcuY2FsbChPYmplY3QpO1xuXG5jb25zdCBnZXRQcm90byA9IE9iamVjdC5nZXRQcm90b3R5cGVPZjtcblxuZXhwb3J0IGNvbnN0IGlzUGxhaW5PYmplY3QgPSBvYmogPT4ge1xuICBsZXQgcHJvdG87XG4gIGxldCBDdG9yO1xuXG4gIC8vIERldGVjdCBvYnZpb3VzIG5lZ2F0aXZlc1xuICAvLyBVc2UgdG9TdHJpbmcgaW5zdGVhZCBvZiBqUXVlcnkudHlwZSB0byBjYXRjaCBob3N0IG9iamVjdHNcbiAgaWYgKCFvYmogfHwgdG9TdHJpbmcuY2FsbChvYmopICE9PSAnW29iamVjdCBPYmplY3RdJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByb3RvID0gZ2V0UHJvdG8ob2JqKTtcblxuICAvLyBPYmplY3RzIHdpdGggbm8gcHJvdG90eXBlIChlLmcuLCBgT2JqZWN0LmNyZWF0ZSggbnVsbCApYCkgYXJlIHBsYWluXG4gIGlmICghcHJvdG8pIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIE9iamVjdHMgd2l0aCBwcm90b3R5cGUgYXJlIHBsYWluIGlmZiB0aGV5IHdlcmUgY29uc3RydWN0ZWQgYnkgYSBnbG9iYWwgT2JqZWN0IGZ1bmN0aW9uXG4gIEN0b3IgPSBoYXNPd24uY2FsbChwcm90bywgJ2NvbnN0cnVjdG9yJykgJiYgcHJvdG8uY29uc3RydWN0b3I7XG4gIHJldHVybiB0eXBlb2YgQ3RvciA9PT0gJ2Z1bmN0aW9uJyAmJiBcbiAgICBmblRvU3RyaW5nLmNhbGwoQ3RvcikgPT09IE9iamVjdEZ1bmN0aW9uU3RyaW5nO1xufTtcbiJdfQ==
