var Prototype = {
    Version: '1.6.0.3',
    Browser: {
        IE: !!(window.attachEvent && navigator.userAgent.indexOf('Opera') === -1),
        Opera: navigator.userAgent.indexOf('Opera') > -1,
        WebKit: navigator.userAgent.indexOf('AppleWebKit/') > -1,
        Gecko: navigator.userAgent.indexOf('Gecko') > -1 && navigator.userAgent.indexOf('KHTML') === -1,
        MobileSafari: !!navigator.userAgent.match(/Apple.*Mobile.*Safari/)
    },
    BrowserFeatures: {
        XPath: !!document.evaluate,
        SelectorsAPI: !!document.querySelector,
        ElementExtensions: !!window.HTMLElement,
        SpecificElementExtensions: document.createElement('div')['__proto__'] && document.createElement('div')['__proto__'] !== document.createElement('form')['__proto__']
    },
    ScriptFragment: '<script[^>]*>([\\S\\s]*?)<\/script>',
    JSONFilter: /^\/\*-secure-([\s\S]*)\*\/\s*$/,
    emptyFunction: function () {},
    K: function (x) {
        return x
    }
};

if (Prototype.Browser.MobileSafari) Prototype.BrowserFeatures.SpecificElementExtensions = false;

var Class = {
    create: function () {
        var parent = null,
        properties = $A(arguments);
        if (Object.isFunction(properties[0])) parent = properties.shift();
        function klass() {
            this.initialize.apply(this, arguments);
        }
        Object.extend(klass, Class.Methods);
        klass.superclass = parent;
        klass.subclasses = [];
        if (parent) {
            var subclass = function () {};
            subclass.prototype = parent.prototype;
            klass.prototype = new subclass;
            parent.subclasses.push(klass);
        }
        for (var i = 0; i < properties.length; i++)
        klass.addMethods(properties[i]);
        if (!klass.prototype.initialize) klass.prototype.initialize = Prototype.emptyFunction;
        klass.prototype.constructor = klass;
        return klass;
    }
};

Class.Methods = {
    addMethods: function (source) {
        var ancestor = this.superclass && this.superclass.prototype;
        var properties = Object.keys(source);
        if (!Object.keys({
            toString: true
        }).length)
        properties.push("toString", "valueOf");
        for (var i = 0, length = properties.length; i < length; i++) {
            var property = properties[i],
            value = source[property];
            if (ancestor && Object.isFunction(value) && value.argumentNames().first() == "$super") {
                var method = value;
                value = (function (m) {
                    return function () {
                        return ancestor[m].apply(this, arguments)
                    };
                })(property).wrap(method);
                value.valueOf = method.valueOf.bind(method);
                value.toString = method.toString.bind(method);
            }
            this.prototype[property] = value;
        }
        return this;
    }
};

var Abstract = {};

Object.extend = function (destination, source) {
    for (var property in source)
    destination[property] = source[property];
    return destination;
};

Object.extend(Object, {
    inspect: function (object) {
        try {
            if (Object.isUndefined(object)) return 'undefined';
            if (object === null) return 'null';
            return object.inspect ? object.inspect() : String(object);
        } catch(e) {
            if (e instanceof RangeError) return '...';
            throw e;
        }
    },
    toJSON: function (object) {
        var type = typeof object;
        switch (type) {
        case 'undefined':
        case 'function':
        case 'unknown':
            return;
        case 'boolean':
            return object.toString();
        }
        if (object === null) return 'null';
        if (object.toJSON) return object.toJSON();
        if (Object.isElement(object)) return;
        var results = [];
        for (var property in object) {
            var value = Object.toJSON(object[property]);
            if (!Object.isUndefined(value)) results.push(property.toJSON() + ': ' + value);
        }
        return '{' + results.join(', ') + '}';
    },
    toQueryString: function (object) {
        return $H(object).toQueryString();
    },
    toHTML: function (object) {
        return object && object.toHTML ? object.toHTML() : String.interpret(object);
    },
    keys: function (object) {
        var keys = [];
        for (var property in object)
        keys.push(property);
        return keys;
    },
    values: function (object) {
        var values = [];
        for (var property in object)
        values.push(object[property]);
        return values;
    },
    clone: function (object) {
        return Object.extend({},
        object);
    },
    isElement: function (object) {
        return !! (object && object.nodeType == 1);
    },
    isArray: function (object) {
        return object != null && typeof object == "object" && 'splice' in object && 'join' in object;
    },
    isHash: function (object) {
        return object instanceof Hash;
    },
    isFunction: function (object) {
        return typeof object == "function";
    },
    isString: function (object) {
        return typeof object == "string";
    },
    isNumber: function (object) {
        return typeof object == "number";
    },
    isUndefined: function (object) {
        return typeof object == "undefined";
    }
});

Object.extend(Function.prototype, {
    argumentNames: function () {
        var names = this.toString().match(/^[\s\(]*function[^(]*\(([^\)]*)\)/)[1].replace(/\s+/g, '').split(',');
        return names.length == 1 && !names[0] ? [] : names;
    },
    bind: function () {
        if (arguments.length < 2 && Object.isUndefined(arguments[0])) return this;
        var __method = this,
        args = $A(arguments),
        object = args.shift();
        return function () {
            return __method.apply(object, args.concat($A(arguments)));
        }
    },
    bindAsEventListener: function () {
        var __method = this,
        args = $A(arguments),
        object = args.shift();
        return function (event) {
            return __method.apply(object, [event || window.event].concat(args));
        }
    },
    curry: function () {
        if (!arguments.length) return this;
        var __method = this,
        args = $A(arguments);
        return function () {
            return __method.apply(this, args.concat($A(arguments)));
        }
    },
    delay: function () {
        var __method = this,
        args = $A(arguments),
        timeout = args.shift() * 1000;
        return window.setTimeout(function () {
            return __method.apply(__method, args);
        },
        timeout);
    },
    defer: function () {
        var args = [0.01].concat($A(arguments));
        return this.delay.apply(this, args);
    },
    wrap: function (wrapper) {
        var __method = this;
        return function () {
            return wrapper.apply(this, [__method.bind(this)].concat($A(arguments)));
        }
    },
    methodize: function () {
        if (this._methodized) return this._methodized;
        var __method = this;
        return this._methodized = function () {
            return __method.apply(null, [this].concat($A(arguments)));
        };
    }
});

Date.prototype.toJSON = function () {
    return '"' + this.getUTCFullYear() + '-' + (this.getUTCMonth() + 1).toPaddedString(2) + '-' + this.getUTCDate().toPaddedString(2) + 'T' + this.getUTCHours().toPaddedString(2) + ':' + this.getUTCMinutes().toPaddedString(2) + ':' + this.getUTCSeconds().toPaddedString(2) + 'Z"';
};

var Try = {
    these: function () {
        var returnValue;
        for (var i = 0, length = arguments.length; i < length; i++) {
            var lambda = arguments[i];
            try {
                returnValue = lambda();
                break;
            } catch(e) {}
        }
        return returnValue;
    }
};

RegExp.prototype.match = RegExp.prototype.test;

RegExp.escape = function (str) {
    return String(str).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
};

var PeriodicalExecuter = Class.create({
    initialize: function (callback, frequency) {
        this.callback = callback;
        this.frequency = frequency;
        this.currentlyExecuting = false;
        this.registerCallback();
    },
    registerCallback: function () {
        this.timer = setInterval(this.onTimerEvent.bind(this), this.frequency * 1000);
    },
    execute: function () {
        this.callback(this);
    },
    stop: function () {
        if (!this.timer) return;
        clearInterval(this.timer);
        this.timer = null;
    },
    onTimerEvent: function () {
        if (!this.currentlyExecuting) {
            try {
                this.currentlyExecuting = true;
                this.execute();
            } finally {
                this.currentlyExecuting = false;
            }
        }
    }
});

Object.extend(String, {
    interpret: function (value) {
        return value == null ? '': String(value);
    },
    specialChar: {
        '\b': '\\b',
        '\t': '\\t',
        '\n': '\\n',
        '\f': '\\f',
        '\r': '\\r',
        '\\': '\\\\'
    }
});

Object.extend(String.prototype, {
    gsub: function (pattern, replacement) {
        var result = '',
        source = this,
        match;
        replacement = arguments.callee.prepareReplacement(replacement);
        while (source.length > 0) {
            if (match = source.match(pattern)) {
                result += source.slice(0, match.index);
                result += String.interpret(replacement(match));
                source = source.slice(match.index + match[0].length);
            } else {
                result += source,
                source = '';
            }
        }
        return result;
    },
    sub: function (pattern, replacement, count) {
        replacement = this.gsub.prepareReplacement(replacement);
        count = Object.isUndefined(count) ? 1 : count;
        return this.gsub(pattern, function (match) {
            if (--count < 0) return match[0];
            return replacement(match);
        });
    },
    scan: function (pattern, iterator) {
        this.gsub(pattern, iterator);
        return String(this);
    },
    truncate: function (length, truncation) {
        length = length || 30;
        truncation = Object.isUndefined(truncation) ? '...': truncation;
        return this.length > length ? this.slice(0, length - truncation.length) + truncation: String(this);
    },
    strip: function () {
        return this.replace(/^\s+/, '').replace(/\s+$/, '');
    },
    stripTags: function () {
        return this.replace(/<\/?[^>]+>/gi, '');
    },
    stripScripts: function () {
        return this.replace(new RegExp(Prototype.ScriptFragment, 'img'), '');
    },
    extractScripts: function () {
        var matchAll = new RegExp(Prototype.ScriptFragment, 'img');
        var matchOne = new RegExp(Prototype.ScriptFragment, 'im');
        return (this.match(matchAll) || []).map(function (scriptTag) {
            return (scriptTag.match(matchOne) || ['', ''])[1];
        });
    },
    evalScripts: function () {
        return this.extractScripts().map(function (script) {
            return eval(script)
        });
    },
    escapeHTML: function () {
        var self = arguments.callee;
        self.text.data = this;
        return self.div.innerHTML;
    },
    unescapeHTML: function () {
        var div = new Element('div');
        div.innerHTML = this.stripTags();
        return div.childNodes[0] ? (div.childNodes.length > 1 ? $A(div.childNodes).inject('', function (memo, node) {
            return memo + node.nodeValue
        }) : div.childNodes[0].nodeValue) : '';
    },
    toQueryParams: function (separator) {
        var match = this.strip().match(/([^?#]*)(#.*)?$/);
        if (!match) return {};
        return match[1].split(separator || '&').inject({},
        function (hash, pair) {
            if ((pair = pair.split('='))[0]) {
                var key = decodeURIComponent(pair.shift());
                var value = pair.length > 1 ? pair.join('=') : pair[0];
                if (value != undefined) value = decodeURIComponent(value);
                if (key in hash) {
                    if (!Object.isArray(hash[key])) hash[key] = [hash[key]];
                    hash[key].push(value);
                }
                else hash[key] = value;
            }
            return hash;
        });
    },
    toArray: function () {
        return this.split('');
    },
    succ: function () {
        return this.slice(0, this.length - 1) + String.fromCharCode(this.charCodeAt(this.length - 1) + 1);
    },
    times: function (count) {
        return count < 1 ? '': new Array(count + 1).join(this);
    },
    camelize: function () {
        var parts = this.split('-'),
        len = parts.length;
        if (len == 1) return parts[0];
        var camelized = this.charAt(0) == '-' ? parts[0].charAt(0).toUpperCase() + parts[0].substring(1) : parts[0];
        for (var i = 1; i < len; i++)
        camelized += parts[i].charAt(0).toUpperCase() + parts[i].substring(1);
        return camelized;
    },
    capitalize: function () {
        return this.charAt(0).toUpperCase() + this.substring(1).toLowerCase();
    },
    underscore: function () {
        return this.gsub(/::/, '/').gsub(/([A-Z]+)([A-Z][a-z])/, '#{1}_#{2}').gsub(/([a-z\d])([A-Z])/, '#{1}_#{2}').gsub(/-/, '_').toLowerCase();
    },
    dasherize: function () {
        return this.gsub(/_/, '-');
    },
    inspect: function (useDoubleQuotes) {
        var escapedString = this.gsub(/[\x00-\x1f\\]/, function (match) {
            var character = String.specialChar[match[0]];
            return character ? character: '\\u00' + match[0].charCodeAt().toPaddedString(2, 16);
        });
        if (useDoubleQuotes) return '"' + escapedString.replace(/"/g, '\\"') + '"';
        return "'" + escapedString.replace(/'/g, '\\\'') + "'";
    },
    toJSON: function () {
        return this.inspect(true);
    },
    unfilterJSON: function (filter) {
        return this.sub(filter || Prototype.JSONFilter, '#{1}');
    },
    isJSON: function () {
        var str = this;
        if (str.blank()) return false;
        str = this.replace(/\\./g, '@').replace(/"[^"\\\n\r]*"/g, '');
        return (/^[,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]*$/).test(str);
    },
    evalJSON: function (sanitize) {
        var json = this.unfilterJSON();
        try {
            if (!sanitize || json.isJSON()) return eval('(' + json + ')');
        } catch(e) {}
        throw new SyntaxError('Badly formed JSON string: ' + this.inspect());
    },
    include: function (pattern) {
        return this.indexOf(pattern) > -1;
    },
    startsWith: function (pattern) {
        return this.indexOf(pattern) === 0;
    },
    endsWith: function (pattern) {
        var d = this.length - pattern.length;
        return d >= 0 && this.lastIndexOf(pattern) === d;
    },
    empty: function () {
        return this == '';
    },
    blank: function () {
        return /^\s*$/.test(this);
    },
    interpolate: function (object, pattern) {
        return new Template(this, pattern).evaluate(object);
    }
});

if (Prototype.Browser.WebKit || Prototype.Browser.IE) Object.extend(String.prototype, {
    escapeHTML: function () {
        return this.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
    unescapeHTML: function () {
        return this.stripTags().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    }
});

String.prototype.gsub.prepareReplacement = function (replacement) {
    if (Object.isFunction(replacement)) return replacement;
    var template = new Template(replacement);
    return function (match) {
        return template.evaluate(match)
    };
};

String.prototype.parseQuery = String.prototype.toQueryParams;

Object.extend(String.prototype.escapeHTML, {
    div: document.createElement('div'),
    text: document.createTextNode('')
});

String.prototype.escapeHTML.div.appendChild(String.prototype.escapeHTML.text);

var Template = Class.create({
    initialize: function (template, pattern) {
        this.template = template.toString();
        this.pattern = pattern || Template.Pattern;
    },
    evaluate: function (object) {
        if (Object.isFunction(object.toTemplateReplacements)) object = object.toTemplateReplacements();
        return this.template.gsub(this.pattern, function (match) {
            if (object == null) return '';
            var before = match[1] || '';
            if (before == '\\') return match[2];
            var ctx = object,
            expr = match[3];
            var pattern = /^([^.[]+|\[((?:.*?[^\\])?)\])(\.|\[|$)/;
            match = pattern.exec(expr);
            if (match == null) return before;
            while (match != null) {
                var comp = match[1].startsWith('[') ? match[2].gsub('\\\\]', ']') : match[1];
                ctx = ctx[comp];
                if (null == ctx || '' == match[3]) break;
                expr = expr.substring('[' == match[3] ? match[1].length: match[0].length);
                match = pattern.exec(expr);
            }
            return before + String.interpret(ctx);
        });
    }
});

Template.Pattern = /(^|.|\r|\n)(#\{(.*?)\})/;

var $break = {};

var Enumerable = {
    each: function (iterator, context) {
        var index = 0;
        try {
            this._each(function (value) {
                iterator.call(context, value, index++);
            });
        } catch(e) {
            if (e != $break) throw e;
        }
        return this;
    },
    eachSlice: function (number, iterator, context) {
        var index = -number,
        slices = [],
        array = this.toArray();
        if (number < 1) return array;
        while ((index += number) < array.length)
        slices.push(array.slice(index, index + number));
        return slices.collect(iterator, context);
    },
    all: function (iterator, context) {
        iterator = iterator || Prototype.K;
        var result = true;
        this.each(function (value, index) {
            result = result && !!iterator.call(context, value, index);
            if (!result) throw $break;
        });
        return result;
    },
    any: function (iterator, context) {
        iterator = iterator || Prototype.K;
        var result = false;
        this.each(function (value, index) {
            if (result = !!iterator.call(context, value, index)) throw $break;
        });
        return result;
    },
    collect: function (iterator, context) {
        iterator = iterator || Prototype.K;
        var results = [];
        this.each(function (value, index) {
            results.push(iterator.call(context, value, index));
        });
        return results;
    },
    detect: function (iterator, context) {
        var result;
        this.each(function (value, index) {
            if (iterator.call(context, value, index)) {
                result = value;
                throw $break;
            }
        });
        return result;
    },
    findAll: function (iterator, context) {
        var results = [];
        this.each(function (value, index) {
            if (iterator.call(context, value, index)) results.push(value);
        });
        return results;
    },
    grep: function (filter, iterator, context) {
        iterator = iterator || Prototype.K;
        var results = [];
        if (Object.isString(filter)) filter = new RegExp(filter);
        this.each(function (value, index) {
            if (filter.match(value)) results.push(iterator.call(context, value, index));
        });
        return results;
    },
    include: function (object) {
        if (Object.isFunction(this.indexOf)) if (this.indexOf(object) != -1) return true;
        var found = false;
        this.each(function (value) {
            if (value == object) {
                found = true;
                throw $break;
            }
        });
        return found;
    },
    inGroupsOf: function (number, fillWith) {
        fillWith = Object.isUndefined(fillWith) ? null: fillWith;
        return this.eachSlice(number, function (slice) {
            while (slice.length < number) slice.push(fillWith);
            return slice;
        });
    },
    inject: function (memo, iterator, context) {
        this.each(function (value, index) {
            memo = iterator.call(context, memo, value, index);
        });
        return memo;
    },
    invoke: function (method) {
        var args = $A(arguments).slice(1);
        return this.map(function (value) {
            return value[method].apply(value, args);
        });
    },
    max: function (iterator, context) {
        iterator = iterator || Prototype.K;
        var result;
        this.each(function (value, index) {
            value = iterator.call(context, value, index);
            if (result == null || value >= result) result = value;
        });
        return result;
    },
    min: function (iterator, context) {
        iterator = iterator || Prototype.K;
        var result;
        this.each(function (value, index) {
            value = iterator.call(context, value, index);
            if (result == null || value < result) result = value;
        });
        return result;
    },
    partition: function (iterator, context) {
        iterator = iterator || Prototype.K;
        var trues = [],
        falses = [];
        this.each(function (value, index) { (iterator.call(context, value, index) ? trues: falses).push(value);
        });
        return [trues, falses];
    },
    pluck: function (property) {
        var results = [];
        this.each(function (value) {
            results.push(value[property]);
        });
        return results;
    },
    reject: function (iterator, context) {
        var results = [];
        this.each(function (value, index) {
            if (!iterator.call(context, value, index)) results.push(value);
        });
        return results;
    },
    sortBy: function (iterator, context) {
        return this.map(function (value, index) {
            return {
                value: value,
                criteria: iterator.call(context, value, index)
            };
        }).sort(function (left, right) {
            var a = left.criteria,
            b = right.criteria;
            return a < b ? -1 : a > b ? 1 : 0;
        }).pluck('value');
    },
    toArray: function () {
        return this.map();
    },
    zip: function () {
        var iterator = Prototype.K,
        args = $A(arguments);
        if (Object.isFunction(args.last())) iterator = args.pop();
        var collections = [this].concat(args).map($A);
        return this.map(function (value, index) {
            return iterator(collections.pluck(index));
        });
    },
    size: function () {
        return this.toArray().length;
    },
    inspect: function () {
        return '#<Enumerable:' + this.toArray().inspect() + '>';
    }
};

Object.extend(Enumerable, {
    map: Enumerable.collect,
    find: Enumerable.detect,
    select: Enumerable.findAll,
    filter: Enumerable.findAll,
    member: Enumerable.include,
    entries: Enumerable.toArray,
    every: Enumerable.all,
    some: Enumerable.any
});

function $A(iterable) {
    if (!iterable) return [];
    if (iterable.toArray) return iterable.toArray();
    var length = iterable.length || 0,
    results = new Array(length);
    while (length--) results[length] = iterable[length];
    return results;
}

if (Prototype.Browser.WebKit) {
    $A = function (iterable) {
        if (!iterable) return [];
        if (! (typeof iterable === 'function' && typeof iterable.length === 'number' && typeof iterable.item === 'function') && iterable.toArray) return iterable.toArray();
        var length = iterable.length || 0,
        results = new Array(length);
        while (length--) results[length] = iterable[length];
        return results;
    };
}

Array.from = $A;
Object.extend(Array.prototype, Enumerable);
if (!Array.prototype._reverse) Array.prototype._reverse = Array.prototype.reverse;
Object.extend(Array.prototype, {
    _each: function (iterator) {
        for (var i = 0, length = this.length; i < length; i++)
        iterator(this[i]);
    },
    clear: function () {
        this.length = 0;
        return this;
    },
    first: function () {
        return this[0];
    },
    last: function () {
        return this[this.length - 1];
    },
    compact: function () {
        return this.select(function (value) {
            return value != null;
        });
    },
    flatten: function () {
        return this.inject([], function (array, value) {
            return array.concat(Object.isArray(value) ? value.flatten() : [value]);
        });
    },
    without: function () {
        var values = $A(arguments);
        return this.select(function (value) {
            return ! values.include(value);
        });
    },
    reverse: function (inline) {
        return (inline !== false ? this: this.toArray())._reverse();
    },
    reduce: function () {
        return this.length > 1 ? this: this[0];
    },
    uniq: function (sorted) {
        return this.inject([], function (array, value, index) {
            if (0 == index || (sorted ? array.last() != value: !array.include(value))) array.push(value);
            return array;
        });
    },
    intersect: function (array) {
        return this.uniq().findAll(function (item) {
            return array.detect(function (value) {
                return item === value
            });
        });
    },
    clone: function () {
        return [].concat(this);
    },
    size: function () {
        return this.length;
    },
    inspect: function () {
        return '[' + this.map(Object.inspect).join(', ') + ']';
    },
    toJSON: function () {
        var results = [];
        this.each(function (object) {
            var value = Object.toJSON(object);
            if (!Object.isUndefined(value)) results.push(value);
        });
        return '[' + results.join(', ') + ']';
    }
});

if (Object.isFunction(Array.prototype.forEach)) Array.prototype._each = Array.prototype.forEach;
if (!Array.prototype.indexOf) Array.prototype.indexOf = function (item, i) {
    i || (i = 0);
    var length = this.length;
    if (i < 0) i = length + i;
    for (; i < length; i++)
    if (this[i] === item) return i;
    return - 1;
};
if (!Array.prototype.lastIndexOf) Array.prototype.lastIndexOf = function (item, i) {
    i = isNaN(i) ? this.length: (i < 0 ? this.length + i: i) + 1;
    var n = this.slice(0, i).reverse().indexOf(item);
    return (n < 0) ? n: i - n - 1;
};

Array.prototype.toArray = Array.prototype.clone;
function $w(string) {
    if (!Object.isString(string)) return [];
    string = string.strip();
    return string ? string.split(/\s+/) : [];
}

if (Prototype.Browser.Opera) {
    Array.prototype.concat = function () {
        var array = [];
        for (var i = 0, length = this.length; i < length; i++) array.push(this[i]);
        for (var i = 0, length = arguments.length; i < length; i++) {
            if (Object.isArray(arguments[i])) {
                for (var j = 0, arrayLength = arguments[i].length; j < arrayLength; j++)
                array.push(arguments[i][j]);
            } else {
                array.push(arguments[i]);
            }
        }
        return array;
    };
}

Object.extend(Number.prototype, {
    toColorPart: function () {
        return this.toPaddedString(2, 16);
    },
    succ: function () {
        return this + 1;
    },
    times: function (iterator, context) {
        $R(0, this, true).each(iterator, context);
        return this;
    },
    toPaddedString: function (length, radix) {
        var string = this.toString(radix || 10);
        return '0'.times(length - string.length) + string;
    },
    toJSON: function () {
        return isFinite(this) ? this.toString() : 'null';
    }
});
$w('abs round ceil floor').each(function (method) {
    Number.prototype[method] = Math[method].methodize();
});
function $H(object) {
    return new Hash(object);
};
var Hash = Class.create(Enumerable, (function () {
    function toQueryPair(key, value) {
        if (Object.isUndefined(value)) return key;
        return key + '=' + encodeURIComponent(String.interpret(value));
    }
    return {
        initialize: function (object) {
            this._object = Object.isHash(object) ? object.toObject() : Object.clone(object);
        },
        _each: function (iterator) {
            for (var key in this._object) {
                var value = this._object[key],
                pair = [key, value];
                pair.key = key;
                pair.value = value;
                iterator(pair);
            }
        },
        set: function (key, value) {
            return this._object[key] = value;
        },
        get: function (key) {
            if (this._object[key] !== Object.prototype[key]) return this._object[key];
        },
        unset: function (key) {
            var value = this._object[key];
            delete this._object[key];
            return value;
        },
        toObject: function () {
            return Object.clone(this._object);
        },
        keys: function () {
            return this.pluck('key');
        },
        values: function () {
            return this.pluck('value');
        },
        index: function (value) {
            var match = this.detect(function (pair) {
                return pair.value === value;
            });
            return match && match.key;
        },
        merge: function (object) {
            return this.clone().update(object);
        },
        update: function (object) {
            return new Hash(object).inject(this, function (result, pair) {
                result.set(pair.key, pair.value);
                return result;
            });
        },
        toQueryString: function () {
            return this.inject([], function (results, pair) {
                var key = encodeURIComponent(pair.key),
                values = pair.value;
                if (values && typeof values == 'object') {
                    if (Object.isArray(values)) return results.concat(values.map(toQueryPair.curry(key)));
                } else results.push(toQueryPair(key, values));
                return results;
            }).join('&');
        },
        inspect: function () {
            return '#<Hash:{' + this.map(function (pair) {
                return pair.map(Object.inspect).join(': ');
            }).join(', ') + '}>';
        },
        toJSON: function () {
            return Object.toJSON(this.toObject());
        },
        clone: function () {
            return new Hash(this);
        }
    }
})());
Hash.prototype.toTemplateReplacements = Hash.prototype.toObject;
Hash.from = $H;
var ObjectRange = Class.create(Enumerable, {
    initialize: function (start, end, exclusive) {
        this.start = start;
        this.end = end;
        this.exclusive = exclusive;
    },
    _each: function (iterator) {
        var value = this.start;
        while (this.include(value)) {
            iterator(value);
            value = value.succ();
        }
    },
    include: function (value) {
        if (value < this.start) return false;
        if (this.exclusive) return value < this.end;
        return value <= this.end;
    }
});
var $R = function (start, end, exclusive) {
    return new ObjectRange(start, end, exclusive);
};
var Ajax = {
    getTransport: function () {
        return Try.these(function () {
            return new XMLHttpRequest()
        },
        function () {
            return new ActiveXObject('Msxml2.XMLHTTP')
        },
        function () {
            return new ActiveXObject('Microsoft.XMLHTTP')
        }) || false;
    },
    activeRequestCount: 0
};
Ajax.Responders = {
    responders: [],
    _each: function (iterator) {
        this.responders._each(iterator);
    },
    register: function (responder) {
        if (!this.include(responder)) this.responders.push(responder);
    },
    unregister: function (responder) {
        this.responders = this.responders.without(responder);
    },
    dispatch: function (callback, request, transport, json) {
        this.each(function (responder) {
            if (Object.isFunction(responder[callback])) {
                try {
                    responder[callback].apply(responder, [request, transport, json]);
                } catch(e) {}
            }
        });
    }
};
Object.extend(Ajax.Responders, Enumerable);
Ajax.Responders.register({
    onCreate: function () {
        Ajax.activeRequestCount++
    },
    onComplete: function () {
        Ajax.activeRequestCount--
    }
});
Ajax.Base = Class.create({
    initialize: function (options) {
        this.options = {
            method: 'post',
            asynchronous: true,
            contentType: 'application/x-www-form-urlencoded',
            encoding: 'UTF-8',
            parameters: '',
            evalJSON: true,
            evalJS: true
        };
        Object.extend(this.options, options || {});
        this.options.method = this.options.method.toLowerCase();
        if (Object.isString(this.options.parameters)) this.options.parameters = this.options.parameters.toQueryParams();
        else if (Object.isHash(this.options.parameters)) this.options.parameters = this.options.parameters.toObject();
    }
});
Ajax.Request = Class.create(Ajax.Base, {
    _complete: false,
    initialize: function ($super, url, options) {
        $super(options);
        this.transport = Ajax.getTransport();
        this.request(url);
    },
    request: function (url) {
        this.url = url;
        this.method = this.options.method;
        var params = Object.clone(this.options.parameters);
        if (! ['get', 'post'].include(this.method)) {
            params['_method'] = this.method;
            this.method = 'post';
        }
        this.parameters = params;
        if (params = Object.toQueryString(params)) {
            if (this.method == 'get') this.url += (this.url.include('?') ? '&': '?') + params;
            else if (/Konqueror|Safari|KHTML/.test(navigator.userAgent)) params += '&_=';
        }
        try {
            var response = new Ajax.Response(this);
            if (this.options.onCreate) this.options.onCreate(response);
            Ajax.Responders.dispatch('onCreate', this, response);
            this.transport.open(this.method.toUpperCase(), this.url, this.options.asynchronous);
            if (this.options.asynchronous) this.respondToReadyState.bind(this).defer(1);
            this.transport.onreadystatechange = this.onStateChange.bind(this);
            this.setRequestHeaders();
            this.body = this.method == 'post' ? (this.options.postBody || params) : null;
            this.transport.send(this.body);
            if (!this.options.asynchronous && this.transport.overrideMimeType) this.onStateChange();
        }
        catch(e) {
            this.dispatchException(e);
        }
    },
    onStateChange: function () {
        var readyState = this.transport.readyState;
        if (readyState > 1 && !((readyState == 4) && this._complete)) this.respondToReadyState(this.transport.readyState);
    },
    setRequestHeaders: function () {
        var headers = {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Prototype-Version': Prototype.Version,
            'Accept': 'text/javascript, text/html, application/xml, text/xml, */*'
        };
        if (this.method == 'post') {
            headers['Content-type'] = this.options.contentType + (this.options.encoding ? '; charset=' + this.options.encoding: '');
            if (this.transport.overrideMimeType && (navigator.userAgent.match(/Gecko\/(\d{4})/) || [0, 2005])[1] < 2005) headers['Connection'] = 'close';
        }
        if (typeof this.options.requestHeaders == 'object') {
            var extras = this.options.requestHeaders;
            if (Object.isFunction(extras.push)) for (var i = 0, length = extras.length; i < length; i += 2) headers[extras[i]] = extras[i + 1];
            else $H(extras).each(function (pair) {
                headers[pair.key] = pair.value
            });
        }
        for (var name in headers)
        this.transport.setRequestHeader(name, headers[name]);
    },
    success: function () {
        var status = this.getStatus();
        return ! status || (status >= 200 && status < 300);
    },
    getStatus: function () {
        try {
            return this.transport.status || 0;
        } catch(e) {
            return 0
        }
    },
    respondToReadyState: function (readyState) {
        var state = Ajax.Request.Events[readyState],
        response = new Ajax.Response(this);
        if (state == 'Complete') {
            try {
                this._complete = true;
                (this.options['on' + response.status] || this.options['on' + (this.success() ? 'Success': 'Failure')] || Prototype.emptyFunction)(response, response.headerJSON);
            } catch(e) {
                this.dispatchException(e);
            }
            var contentType = response.getHeader('Content-type');
            if (this.options.evalJS == 'force' || (this.options.evalJS && this.isSameOrigin() && contentType && contentType.match(/^\s*(text|application)\/(x-)?(java|ecma)script(;.*)?\s*$/i))) this.evalResponse();
        }
        try { (this.options['on' + state] || Prototype.emptyFunction)(response, response.headerJSON);
            Ajax.Responders.dispatch('on' + state, this, response, response.headerJSON);
        } catch(e) {
            this.dispatchException(e);
        }
        if (state == 'Complete') {
            this.transport.onreadystatechange = Prototype.emptyFunction;
        }
    },
    isSameOrigin: function () {
        var m = this.url.match(/^\s*https?:\/\/[^\/]*/);
        return ! m || (m[0] == '#{protocol}//#{domain}#{port}'.interpolate({
            protocol: location.protocol,
            domain: document.domain,
            port: location.port ? ':' + location.port: ''
        }));
    },
    getHeader: function (name) {
        try {
            return this.transport.getResponseHeader(name) || null;
        } catch(e) {
            return null
        }
    },
    evalResponse: function () {
        try {
            return eval((this.transport.responseText || '').unfilterJSON());
        } catch(e) {
            this.dispatchException(e);
        }
    },
    dispatchException: function (exception) { (this.options.onException || Prototype.emptyFunction)(this, exception);
        Ajax.Responders.dispatch('onException', this, exception);
    }
});
Ajax.Request.Events = ['Uninitialized', 'Loading', 'Loaded', 'Interactive', 'Complete'];
Ajax.Response = Class.create({
    initialize: function (request) {
        this.request = request;
        var transport = this.transport = request.transport,
        readyState = this.readyState = transport.readyState;
        if ((readyState > 2 && !Prototype.Browser.IE) || readyState == 4) {
            this.status = this.getStatus();
            this.statusText = this.getStatusText();
            this.responseText = String.interpret(transport.responseText);
            this.headerJSON = this._getHeaderJSON();
        }
        if (readyState == 4) {
            var xml = transport.responseXML;
            this.responseXML = Object.isUndefined(xml) ? null: xml;
            this.responseJSON = this._getResponseJSON();
        }
    },
    status: 0,
    statusText: '',
    getStatus: Ajax.Request.prototype.getStatus,
    getStatusText: function () {
        try {
            return this.transport.statusText || '';
        } catch(e) {
            return ''
        }
    },
    getHeader: Ajax.Request.prototype.getHeader,
    getAllHeaders: function () {
        try {
            return this.getAllResponseHeaders();
        } catch(e) {
            return null
        }
    },
    getResponseHeader: function (name) {
        return this.transport.getResponseHeader(name);
    },
    getAllResponseHeaders: function () {
        return this.transport.getAllResponseHeaders();
    },
    _getHeaderJSON: function () {
        var json = this.getHeader('X-JSON');
        if (!json) return null;
        json = decodeURIComponent(escape(json));
        try {
            return json.evalJSON(this.request.options.sanitizeJSON || !this.request.isSameOrigin());
        } catch(e) {
            this.request.dispatchException(e);
        }
    },
    _getResponseJSON: function () {
        var options = this.request.options;
        if (!options.evalJSON || (options.evalJSON != 'force' && !(this.getHeader('Content-type') || '').include('application/json')) || this.responseText.blank()) return null;
        try {
            return this.responseText.evalJSON(options.sanitizeJSON || !this.request.isSameOrigin());
        } catch(e) {
            this.request.dispatchException(e);
        }
    }
});
Ajax.Updater = Class.create(Ajax.Request, {
    initialize: function ($super, container, url, options) {
        this.container = {
            success: (container.success || container),
            failure: (container.failure || (container.success ? null: container))
        };
        options = Object.clone(options);
        var onComplete = options.onComplete;
        options.onComplete = (function (response, json) {
            this.updateContent(response.responseText);
            if (Object.isFunction(onComplete)) onComplete(response, json);
        }).bind(this);
        $super(url, options);
    },
    updateContent: function (responseText) {
        var receiver = this.container[this.success() ? 'success': 'failure'],
        options = this.options;
        if (!options.evalScripts) responseText = responseText.stripScripts();
        if (receiver = $(receiver)) {
            if (options.insertion) {
                if (Object.isString(options.insertion)) {
                    var insertion = {};
                    insertion[options.insertion] = responseText;
                    receiver.insert(insertion);
                }
                else options.insertion(receiver, responseText);
            }
            else receiver.update(responseText);
        }
    }
});
Ajax.PeriodicalUpdater = Class.create(Ajax.Base, {
    initialize: function ($super, container, url, options) {
        $super(options);
        this.onComplete = this.options.onComplete;
        this.frequency = (this.options.frequency || 2);
        this.decay = (this.options.decay || 1);
        this.updater = {};
        this.container = container;
        this.url = url;
        this.start();
    },
    start: function () {
        this.options.onComplete = this.updateComplete.bind(this);
        this.onTimerEvent();
    },
    stop: function () {
        this.updater.options.onComplete = undefined;
        clearTimeout(this.timer);
        (this.onComplete || Prototype.emptyFunction).apply(this, arguments);
    },
    updateComplete: function (response) {
        if (this.options.decay) {
            this.decay = (response.responseText == this.lastText ? this.decay * this.options.decay: 1);
            this.lastText = response.responseText;
        }
        this.timer = this.onTimerEvent.bind(this).delay(this.decay * this.frequency);
    },
    onTimerEvent: function () {
        this.updater = new Ajax.Updater(this.container, this.url, this.options);
    }
});
function $(element) {
    if (arguments.length > 1) {
        for (var i = 0, elements = [], length = arguments.length; i < length; i++)
        elements.push($(arguments[i]));
        return elements;
    }
    if (Object.isString(element)) element = document.getElementById(element);
    return Element.extend(element);
}
if (Prototype.BrowserFeatures.XPath) {
    document._getElementsByXPath = function (expression, parentElement) {
        var results = [];
        var query = document.evaluate(expression, $(parentElement) || document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (var i = 0, length = query.snapshotLength; i < length; i++)
        results.push(Element.extend(query.snapshotItem(i)));
        return results;
    };
}
if (!window.Node) var Node = {};
if (!Node.ELEMENT_NODE) {
    Object.extend(Node, {
        ELEMENT_NODE: 1,
        ATTRIBUTE_NODE: 2,
        TEXT_NODE: 3,
        CDATA_SECTION_NODE: 4,
        ENTITY_REFERENCE_NODE: 5,
        ENTITY_NODE: 6,
        PROCESSING_INSTRUCTION_NODE: 7,
        COMMENT_NODE: 8,
        DOCUMENT_NODE: 9,
        DOCUMENT_TYPE_NODE: 10,
        DOCUMENT_FRAGMENT_NODE: 11,
        NOTATION_NODE: 12
    });
} (function () {
    var element = this.Element;
    this.Element = function (tagName, attributes) {
        attributes = attributes || {};
        tagName = tagName.toLowerCase();
        var cache = Element.cache;
        if (Prototype.Browser.IE && attributes.name) {
            tagName = '<' + tagName + ' name="' + attributes.name + '">';
            delete attributes.name;
            return Element.writeAttribute(document.createElement(tagName), attributes);
        }
        if (!cache[tagName]) cache[tagName] = Element.extend(document.createElement(tagName));
        return Element.writeAttribute(cache[tagName].cloneNode(false), attributes);
    };
    Object.extend(this.Element, element || {});
    if (element) this.Element.prototype = element.prototype;
}).call(window);
Element.cache = {};
Element.Methods = {
    visible: function (element) {
        return $(element).style.display != 'none';
    },
    toggle: function (element) {
        element = $(element);
        Element[Element.visible(element) ? 'hide': 'show'](element);
        return element;
    },
    hide: function (element) {
        element = $(element);
        element.style.display = 'none';
        return element;
    },
    show: function (element) {
        element = $(element);
        element.style.display = '';
        return element;
    },
    remove: function (element) {
        element = $(element);
        element.parentNode.removeChild(element);
        return element;
    },
    update: function (element, content) {
        element = $(element);
        if (content && content.toElement) content = content.toElement();
        if (Object.isElement(content)) return element.update().insert(content);
        content = Object.toHTML(content);
        element.innerHTML = content.stripScripts();
        content.evalScripts.bind(content).defer();
        return element;
    },
    replace: function (element, content) {
        element = $(element);
        if (content && content.toElement) content = content.toElement();
        else if (!Object.isElement(content)) {
            content = Object.toHTML(content);
            var range = element.ownerDocument.createRange();
            range.selectNode(element);
            content.evalScripts.bind(content).defer();
            content = range.createContextualFragment(content.stripScripts());
        }
        element.parentNode.replaceChild(content, element);
        return element;
    },
    insert: function (element, insertions) {
        element = $(element);
        if (Object.isString(insertions) || Object.isNumber(insertions) || Object.isElement(insertions) || (insertions && (insertions.toElement || insertions.toHTML))) insertions = {
            bottom: insertions
        };
        var content, insert, tagName, childNodes;
        for (var position in insertions) {
            content = insertions[position];
            position = position.toLowerCase();
            insert = Element._insertionTranslations[position];
            if (content && content.toElement) content = content.toElement();
            if (Object.isElement(content)) {
                insert(element, content);
                continue;
            }
            content = Object.toHTML(content);
            tagName = ((position == 'before' || position == 'after') ? element.parentNode: element).tagName.toUpperCase();
            childNodes = Element._getContentFromAnonymousElement(tagName, content.stripScripts());
            if (position == 'top' || position == 'after') childNodes.reverse();
            childNodes.each(insert.curry(element));
            content.evalScripts.bind(content).defer();
        }
        return element;
    },
    wrap: function (element, wrapper, attributes) {
        element = $(element);
        if (Object.isElement(wrapper)) $(wrapper).writeAttribute(attributes || {});
        else if (Object.isString(wrapper)) wrapper = new Element(wrapper, attributes);
        else wrapper = new Element('div', wrapper);
        if (element.parentNode) element.parentNode.replaceChild(wrapper, element);
        wrapper.appendChild(element);
        return wrapper;
    },
    inspect: function (element) {
        element = $(element);
        var result = '<' + element.tagName.toLowerCase();
        $H({
            'id': 'id',
            'className': 'class'
        }).each(function (pair) {
            var property = pair.first(),
            attribute = pair.last();
            var value = (element[property] || '').toString();
            if (value) result += ' ' + attribute + '=' + value.inspect(true);
        });
        return result + '>';
    },
    recursivelyCollect: function (element, property) {
        element = $(element);
        var elements = [];
        while (element = element[property])
        if (element.nodeType == 1) elements.push(Element.extend(element));
        return elements;
    },
    ancestors: function (element) {
        return $(element).recursivelyCollect('parentNode');
    },
    descendants: function (element) {
        return $(element).select("*");
    },
    firstDescendant: function (element) {
        element = $(element).firstChild;
        while (element && element.nodeType != 1) element = element.nextSibling;
        return $(element);
    },
    immediateDescendants: function (element) {
        if (! (element = $(element).firstChild)) return [];
        while (element && element.nodeType != 1) element = element.nextSibling;
        if (element) return [element].concat($(element).nextSiblings());
        return [];
    },
    previousSiblings: function (element) {
        return $(element).recursivelyCollect('previousSibling');
    },
    nextSiblings: function (element) {
        return $(element).recursivelyCollect('nextSibling');
    },
    siblings: function (element) {
        element = $(element);
        return element.previousSiblings().reverse().concat(element.nextSiblings());
    },
    match: function (element, selector) {
        if (Object.isString(selector)) selector = new Selector(selector);
        return selector.match($(element));
    },
    up: function (element, expression, index) {
        element = $(element);
        if (arguments.length == 1) return $(element.parentNode);
        var ancestors = element.ancestors();
        return Object.isNumber(expression) ? ancestors[expression] : Selector.findElement(ancestors, expression, index);
    },
    down: function (element, expression, index) {
        element = $(element);
        if (arguments.length == 1) return element.firstDescendant();
        return Object.isNumber(expression) ? element.descendants()[expression] : Element.select(element, expression)[index || 0];
    },
    previous: function (element, expression, index) {
        element = $(element);
        if (arguments.length == 1) return $(Selector.handlers.previousElementSibling(element));
        var previousSiblings = element.previousSiblings();
        return Object.isNumber(expression) ? previousSiblings[expression] : Selector.findElement(previousSiblings, expression, index);
    },
    next: function (element, expression, index) {
        element = $(element);
        if (arguments.length == 1) return $(Selector.handlers.nextElementSibling(element));
        var nextSiblings = element.nextSiblings();
        return Object.isNumber(expression) ? nextSiblings[expression] : Selector.findElement(nextSiblings, expression, index);
    },
    select: function () {
        var args = $A(arguments),
        element = $(args.shift());
        return Selector.findChildElements(element, args);
    },
    adjacent: function () {
        var args = $A(arguments),
        element = $(args.shift());
        return Selector.findChildElements(element.parentNode, args).without(element);
    },
    identify: function (element) {
        element = $(element);
        var id = element.readAttribute('id'),
        self = arguments.callee;
        if (id) return id;
        do {
            id = 'anonymous_element_' + self.counter++
        } while ($(id));
        element.writeAttribute('id', id);
        return id;
    },
    readAttribute: function (element, name) {
        element = $(element);
        if (Prototype.Browser.IE) {
            var t = Element._attributeTranslations.read;
            if (t.values[name]) return t.values[name](element, name);
            if (t.names[name]) name = t.names[name];
            if (name.include(':')) {
                return (!element.attributes || !element.attributes[name]) ? null: element.attributes[name].value;
            }
        }
        return element.getAttribute(name);
    },
    writeAttribute: function (element, name, value) {
        element = $(element);
        var attributes = {},
        t = Element._attributeTranslations.write;
        if (typeof name == 'object') attributes = name;
        else attributes[name] = Object.isUndefined(value) ? true: value;
        for (var attr in attributes) {
            name = t.names[attr] || attr;
            value = attributes[attr];
            if (t.values[attr]) name = t.values[attr](element, value);
            if (value === false || value === null) element.removeAttribute(name);
            else if (value === true) element.setAttribute(name, name);
            else element.setAttribute(name, value);
        }
        return element;
    },
    getHeight: function (element) {
        return $(element).getDimensions().height;
    },
    getWidth: function (element) {
        return $(element).getDimensions().width;
    },
    classNames: function (element) {
        return new Element.ClassNames(element);
    },
    hasClassName: function (element, className) {
        if (! (element = $(element))) return;
        var elementClassName = element.className;
        return (elementClassName.length > 0 && (elementClassName == className || new RegExp("(^|\\s)" + className + "(\\s|$)").test(elementClassName)));
    },
    addClassName: function (element, className) {
        if (! (element = $(element))) return;
        if (!element.hasClassName(className)) element.className += (element.className ? ' ': '') + className;
        return element;
    },
    removeClassName: function (element, className) {
        if (! (element = $(element))) return;
        element.className = element.className.replace(new RegExp("(^|\\s+)" + className + "(\\s+|$)"), ' ').strip();
        return element;
    },
    toggleClassName: function (element, className) {
        if (! (element = $(element))) return;
        return element[element.hasClassName(className) ? 'removeClassName': 'addClassName'](className);
    },
    cleanWhitespace: function (element) {
        element = $(element);
        var node = element.firstChild;
        while (node) {
            var nextNode = node.nextSibling;
            if (node.nodeType == 3 && !/\S/.test(node.nodeValue)) element.removeChild(node);
            node = nextNode;
        }
        return element;
    },
    empty: function (element) {
        return $(element).innerHTML.blank();
    },
    descendantOf: function (element, ancestor) {
        element = $(element),
        ancestor = $(ancestor);
        if (element.compareDocumentPosition) return (element.compareDocumentPosition(ancestor) & 8) === 8;
        if (ancestor.contains) return ancestor.contains(element) && ancestor !== element;
        while (element = element.parentNode)
        if (element == ancestor) return true;
        return false;
    },
    scrollTo: function (element) {
        element = $(element);
        var pos = element.cumulativeOffset();
        window.scrollTo(pos[0], pos[1]);
        return element;
    },
    getStyle: function (element, style) {
        element = $(element);
        style = style == 'float' ? 'cssFloat': style.camelize();
        var value = element.style[style];
        if (!value || value == 'auto') {
            var css = document.defaultView.getComputedStyle(element, null);
            value = css ? css[style] : null;
        }
        if (style == 'opacity') return value ? parseFloat(value) : 1.0;
        return value == 'auto' ? null: value;
    },
    getOpacity: function (element) {
        return $(element).getStyle('opacity');
    },
    setStyle: function (element, styles) {
        element = $(element);
        var elementStyle = element.style,
        match;
        if (Object.isString(styles)) {
            element.style.cssText += ';' + styles;
            return styles.include('opacity') ? element.setOpacity(styles.match(/opacity:\s*(\d?\.?\d*)/)[1]) : element;
        }
        for (var property in styles)
        if (property == 'opacity') element.setOpacity(styles[property]);
        else elementStyle[(property == 'float' || property == 'cssFloat') ? (Object.isUndefined(elementStyle.styleFloat) ? 'cssFloat': 'styleFloat') : property] = styles[property];
        return element;
    },
    setOpacity: function (element, value) {
        element = $(element);
        element.style.opacity = (value == 1 || value === '') ? '': (value < 0.00001) ? 0 : value;
        return element;
    },
    getDimensions: function (element) {
        element = $(element);
        var display = element.getStyle('display');
        if (display != 'none' && display != null) return {
            width: element.offsetWidth,
            height: element.offsetHeight
        };
        var els = element.style;
        var originalVisibility = els.visibility;
        var originalPosition = els.position;
        var originalDisplay = els.display;
        els.visibility = 'hidden';
        els.position = 'absolute';
        els.display = 'block';
        var originalWidth = element.clientWidth;
        var originalHeight = element.clientHeight;
        els.display = originalDisplay;
        els.position = originalPosition;
        els.visibility = originalVisibility;
        return {
            width: originalWidth,
            height: originalHeight
        };
    },
    makePositioned: function (element) {
        element = $(element);
        var pos = Element.getStyle(element, 'position');
        if (pos == 'static' || !pos) {
            element._madePositioned = true;
            element.style.position = 'relative';
            if (Prototype.Browser.Opera) {
                element.style.top = 0;
                element.style.left = 0;
            }
        }
        return element;
    },
    undoPositioned: function (element) {
        element = $(element);
        if (element._madePositioned) {
            element._madePositioned = undefined;
            element.style.position = element.style.top = element.style.left = element.style.bottom = element.style.right = '';
        }
        return element;
    },
    makeClipping: function (element) {
        element = $(element);
        if (element._overflow) return element;
        element._overflow = Element.getStyle(element, 'overflow') || 'auto';
        if (element._overflow !== 'hidden') element.style.overflow = 'hidden';
        return element;
    },
    undoClipping: function (element) {
        element = $(element);
        if (!element._overflow) return element;
        element.style.overflow = element._overflow == 'auto' ? '': element._overflow;
        element._overflow = null;
        return element;
    },
    cumulativeOffset: function (element) {
        var valueT = 0,
        valueL = 0;
        do {
            valueT += element.offsetTop || 0;
            valueL += element.offsetLeft || 0;
            element = element.offsetParent;
        } while (element);
        return Element._returnOffset(valueL, valueT);
    },
    positionedOffset: function (element) {
        var valueT = 0,
        valueL = 0;
        do {
            valueT += element.offsetTop || 0;
            valueL += element.offsetLeft || 0;
            element = element.offsetParent;
            if (element) {
                if (element.tagName.toUpperCase() == 'BODY') break;
                var p = Element.getStyle(element, 'position');
                if (p !== 'static') break;
            }
        } while (element);
        return Element._returnOffset(valueL, valueT);
    },
    absolutize: function (element) {
        element = $(element);
        if (element.getStyle('position') == 'absolute') return element;
        var offsets = element.positionedOffset();
        var top = offsets[1];
        var left = offsets[0];
        var width = element.clientWidth;
        var height = element.clientHeight;
        element._originalLeft = left - parseFloat(element.style.left || 0);
        element._originalTop = top - parseFloat(element.style.top || 0);
        element._originalWidth = element.style.width;
        element._originalHeight = element.style.height;
        element.style.position = 'absolute';
        element.style.top = top + 'px';
        element.style.left = left + 'px';
        element.style.width = width + 'px';
        element.style.height = height + 'px';
        return element;
    },
    relativize: function (element) {
        element = $(element);
        if (element.getStyle('position') == 'relative') return element;
        element.style.position = 'relative';
        var top = parseFloat(element.style.top || 0) - (element._originalTop || 0);
        var left = parseFloat(element.style.left || 0) - (element._originalLeft || 0);
        element.style.top = top + 'px';
        element.style.left = left + 'px';
        element.style.height = element._originalHeight;
        element.style.width = element._originalWidth;
        return element;
    },
    cumulativeScrollOffset: function (element) {
        var valueT = 0,
        valueL = 0;
        do {
            valueT += element.scrollTop || 0;
            valueL += element.scrollLeft || 0;
            element = element.parentNode;
        } while (element);
        return Element._returnOffset(valueL, valueT);
    },
    getOffsetParent: function (element) {
        if (element.offsetParent) return $(element.offsetParent);
        if (element == document.body) return $(element);
        while ((element = element.parentNode) && element != document.body)
        if (Element.getStyle(element, 'position') != 'static') return $(element);
        return $(document.body);
    },
    viewportOffset: function (forElement) {
        var valueT = 0,
        valueL = 0;
        var element = forElement;
        do {
            valueT += element.offsetTop || 0;
            valueL += element.offsetLeft || 0;
            if (element.offsetParent == document.body && Element.getStyle(element, 'position') == 'absolute') break;
        } while (element = element.offsetParent);
        element = forElement;
        do {
            if (!Prototype.Browser.Opera || (element.tagName && (element.tagName.toUpperCase() == 'BODY'))) {
                valueT -= element.scrollTop || 0;
                valueL -= element.scrollLeft || 0;
            }
        } while (element = element.parentNode);
        return Element._returnOffset(valueL, valueT);
    },
    clonePosition: function (element, source) {
        var options = Object.extend({
            setLeft: true,
            setTop: true,
            setWidth: true,
            setHeight: true,
            offsetTop: 0,
            offsetLeft: 0
        },
        arguments[2] || {});
        source = $(source);
        var p = source.viewportOffset();
        element = $(element);
        var delta = [0, 0];
        var parent = null;
        if (Element.getStyle(element, 'position') == 'absolute') {
            parent = element.getOffsetParent();
            delta = parent.viewportOffset();
        }
        if (parent == document.body) {
            delta[0] -= document.body.offsetLeft;
            delta[1] -= document.body.offsetTop;
        }
        if (options.setLeft) element.style.left = (p[0] - delta[0] + options.offsetLeft) + 'px';
        if (options.setTop) element.style.top = (p[1] - delta[1] + options.offsetTop) + 'px';
        if (options.setWidth) element.style.width = source.offsetWidth + 'px';
        if (options.setHeight) element.style.height = source.offsetHeight + 'px';
        return element;
    }
};
Element.Methods.identify.counter = 1;
Object.extend(Element.Methods, {
    getElementsBySelector: Element.Methods.select,
    childElements: Element.Methods.immediateDescendants
});
Element._attributeTranslations = {
    write: {
        names: {
            className: 'class',
            htmlFor: 'for'
        },
        values: {}
    }
};
if (Prototype.Browser.Opera) {
    Element.Methods.getStyle = Element.Methods.getStyle.wrap(function (proceed, element, style) {
        switch (style) {
        case 'left':
        case 'top':
        case 'right':
        case 'bottom':
            if (proceed(element, 'position') === 'static') return null;
        case 'height':
        case 'width':
            if (!Element.visible(element)) return null;
            var dim = parseInt(proceed(element, style), 10);
            if (dim !== element['offset' + style.capitalize()]) return dim + 'px';
            var properties;
            if (style === 'height') {
                properties = ['border-top-width', 'padding-top', 'padding-bottom', 'border-bottom-width'];
            }
            else {
                properties = ['border-left-width', 'padding-left', 'padding-right', 'border-right-width'];
            }
            return properties.inject(dim, function (memo, property) {
                var val = proceed(element, property);
                return val === null ? memo: memo - parseInt(val, 10);
            }) + 'px';
        default:
            return proceed(element, style);
        }
    });
    Element.Methods.readAttribute = Element.Methods.readAttribute.wrap(function (proceed, element, attribute) {
        if (attribute === 'title') return element.title;
        return proceed(element, attribute);
    });
}
else if (Prototype.Browser.IE) {
    Element.Methods.getOffsetParent = Element.Methods.getOffsetParent.wrap(function (proceed, element) {
        element = $(element);
        try {
            element.offsetParent
        }
        catch(e) {
            return $(document.body)
        }
        var position = element.getStyle('position');
        if (position !== 'static') return proceed(element);
        element.setStyle({
            position: 'relative'
        });
        var value = proceed(element);
        element.setStyle({
            position: position
        });
        return value;
    });
    $w('positionedOffset viewportOffset').each(function (method) {
        Element.Methods[method] = Element.Methods[method].wrap(function (proceed, element) {
            element = $(element);
            try {
                element.offsetParent
            }
            catch(e) {
                return Element._returnOffset(0, 0)
            }
            var position = element.getStyle('position');
            if (position !== 'static') return proceed(element);
            var offsetParent = element.getOffsetParent();
            if (offsetParent && offsetParent.getStyle('position') === 'fixed') offsetParent.setStyle({
                zoom: 1
            });
            element.setStyle({
                position: 'relative'
            });
            var value = proceed(element);
            element.setStyle({
                position: position
            });
            return value;
        });
    });
    Element.Methods.cumulativeOffset = Element.Methods.cumulativeOffset.wrap(function (proceed, element) {
        try {
            element.offsetParent
        }
        catch(e) {
            return Element._returnOffset(0, 0)
        }
        return proceed(element);
    });
    Element.Methods.getStyle = function (element, style) {
        element = $(element);
        style = (style == 'float' || style == 'cssFloat') ? 'styleFloat': style.camelize();
        var value = element.style[style];
        if (!value && element.currentStyle) value = element.currentStyle[style];
        if (style == 'opacity') {
            if (value = (element.getStyle('filter') || '').match(/alpha\(opacity=(.*)\)/)) if (value[1]) return parseFloat(value[1]) / 100;
            return 1.0;
        }
        if (value == 'auto') {
            if ((style == 'width' || style == 'height') && (element.getStyle('display') != 'none')) return element['offset' + style.capitalize()] + 'px';
            return null;
        }
        return value;
    };
    Element.Methods.setOpacity = function (element, value) {
        function stripAlpha(filter) {
            return filter.replace(/alpha\([^\)]*\)/gi, '');
        }
        element = $(element);
        var currentStyle = element.currentStyle;
        if ((currentStyle && !currentStyle.hasLayout) || (!currentStyle && element.style.zoom == 'normal')) element.style.zoom = 1;
        var filter = element.getStyle('filter'),
        style = element.style;
        if (value == 1 || value === '') { (filter = stripAlpha(filter)) ? style.filter = filter: style.removeAttribute('filter');
            return element;
        } else if (value < 0.00001) value = 0;
        style.filter = stripAlpha(filter) + 'alpha(opacity=' + (value * 100) + ')';
        return element;
    };
    Element._attributeTranslations = {
        read: {
            names: {
                'class': 'className',
                'for': 'htmlFor'
            },
            values: {
                _getAttr: function (element, attribute) {
                    return element.getAttribute(attribute, 2);
                },
                _getAttrNode: function (element, attribute) {
                    var node = element.getAttributeNode(attribute);
                    return node ? node.value: "";
                },
                _getEv: function (element, attribute) {
                    attribute = element.getAttribute(attribute);
                    return attribute ? attribute.toString().slice(23, -2) : null;
                },
                _flag: function (element, attribute) {
                    return $(element).hasAttribute(attribute) ? attribute: null;
                },
                style: function (element) {
                    return element.style.cssText.toLowerCase();
                },
                title: function (element) {
                    return element.title;
                }
            }
        }
    };
    Element._attributeTranslations.write = {
        names: Object.extend({
            cellpadding: 'cellPadding',
            cellspacing: 'cellSpacing'
        },
        Element._attributeTranslations.read.names),
        values: {
            checked: function (element, value) {
                element.checked = !!value;
            },
            style: function (element, value) {
                element.style.cssText = value ? value: '';
            }
        }
    };
    Element._attributeTranslations.has = {};
    $w('colSpan rowSpan vAlign dateTime accessKey tabIndex ' + 'encType maxLength readOnly longDesc frameBorder').each(function (attr) {
        Element._attributeTranslations.write.names[attr.toLowerCase()] = attr;
        Element._attributeTranslations.has[attr.toLowerCase()] = attr;
    });
    (function (v) {
        Object.extend(v, {
            href: v._getAttr,
            src: v._getAttr,
            type: v._getAttr,
            action: v._getAttrNode,
            disabled: v._flag,
            checked: v._flag,
            readonly: v._flag,
            multiple: v._flag,
            onload: v._getEv,
            onunload: v._getEv,
            onclick: v._getEv,
            ondblclick: v._getEv,
            onmousedown: v._getEv,
            onmouseup: v._getEv,
            onmouseover: v._getEv,
            onmousemove: v._getEv,
            onmouseout: v._getEv,
            onfocus: v._getEv,
            onblur: v._getEv,
            onkeypress: v._getEv,
            onkeydown: v._getEv,
            onkeyup: v._getEv,
            onsubmit: v._getEv,
            onreset: v._getEv,
            onselect: v._getEv,
            onchange: v._getEv
        });
    })(Element._attributeTranslations.read.values);
}
else if (Prototype.Browser.Gecko && /rv:1\.8\.0/.test(navigator.userAgent)) {
    Element.Methods.setOpacity = function (element, value) {
        element = $(element);
        element.style.opacity = (value == 1) ? 0.999999 : (value === '') ? '': (value < 0.00001) ? 0 : value;
        return element;
    };
}
else if (Prototype.Browser.WebKit) {
    Element.Methods.setOpacity = function (element, value) {
        element = $(element);
        element.style.opacity = (value == 1 || value === '') ? '': (value < 0.00001) ? 0 : value;
        if (value == 1) if (element.tagName.toUpperCase() == 'IMG' && element.width) {
            element.width++;
            element.width--;
        } else try {
            var n = document.createTextNode(' ');
            element.appendChild(n);
            element.removeChild(n);
        } catch(e) {}
        return element;
    };
    Element.Methods.cumulativeOffset = function (element) {
        var valueT = 0,
        valueL = 0;
        do {
            valueT += element.offsetTop || 0;
            valueL += element.offsetLeft || 0;
            if (element.offsetParent == document.body) if (Element.getStyle(element, 'position') == 'absolute') break;
            element = element.offsetParent;
        } while (element);
        return Element._returnOffset(valueL, valueT);
    };
}
if (Prototype.Browser.IE || Prototype.Browser.Opera) {
    Element.Methods.update = function (element, content) {
        element = $(element);
        if (content && content.toElement) content = content.toElement();
        if (Object.isElement(content)) return element.update().insert(content);
        content = Object.toHTML(content);
        var tagName = element.tagName.toUpperCase();
        if (tagName in Element._insertionTranslations.tags) {
            $A(element.childNodes).each(function (node) {
                element.removeChild(node)
            });
            Element._getContentFromAnonymousElement(tagName, content.stripScripts()).each(function (node) {
                element.appendChild(node)
            });
        }
        else element.innerHTML = content.stripScripts();
        content.evalScripts.bind(content).defer();
        return element;
    };
}
if ('outerHTML' in document.createElement('div')) {
    Element.Methods.replace = function (element, content) {
        element = $(element);
        if (content && content.toElement) content = content.toElement();
        if (Object.isElement(content)) {
            element.parentNode.replaceChild(content, element);
            return element;
        }
        content = Object.toHTML(content);
        var parent = element.parentNode,
        tagName = parent.tagName.toUpperCase();
        if (Element._insertionTranslations.tags[tagName]) {
            var nextSibling = element.next();
            var fragments = Element._getContentFromAnonymousElement(tagName, content.stripScripts());
            parent.removeChild(element);
            if (nextSibling) fragments.each(function (node) {
                parent.insertBefore(node, nextSibling)
            });
            else fragments.each(function (node) {
                parent.appendChild(node)
            });
        }
        else element.outerHTML = content.stripScripts();
        content.evalScripts.bind(content).defer();
        return element;
    };
}
Element._returnOffset = function (l, t) {
    var result = [l, t];
    result.left = l;
    result.top = t;
    return result;
};
Element._getContentFromAnonymousElement = function (tagName, html) {
    var div = new Element('div'),
    t = Element._insertionTranslations.tags[tagName];
    if (t) {
        div.innerHTML = t[0] + html + t[1];
        t[2].times(function () {
            div = div.firstChild
        });
    } else div.innerHTML = html;
    return $A(div.childNodes);
};
Element._insertionTranslations = {
    before: function (element, node) {
        element.parentNode.insertBefore(node, element);
    },
    top: function (element, node) {
        element.insertBefore(node, element.firstChild);
    },
    bottom: function (element, node) {
        element.appendChild(node);
    },
    after: function (element, node) {
        element.parentNode.insertBefore(node, element.nextSibling);
    },
    tags: {
        TABLE: ['<table>', '</table>', 1],
        TBODY: ['<table><tbody>', '</tbody></table>', 2],
        TR: ['<table><tbody><tr>', '</tr></tbody></table>', 3],
        TD: ['<table><tbody><tr><td>', '</td></tr></tbody></table>', 4],
        SELECT: ['<select>', '</select>', 1]
    }
};
(function () {
    Object.extend(this.tags, {
        THEAD: this.tags.TBODY,
        TFOOT: this.tags.TBODY,
        TH: this.tags.TD
    });
}).call(Element._insertionTranslations);
Element.Methods.Simulated = {
    hasAttribute: function (element, attribute) {
        attribute = Element._attributeTranslations.has[attribute] || attribute;
        var node = $(element).getAttributeNode(attribute);
        return !! (node && node.specified);
    }
};
Element.Methods.ByTag = {};
Object.extend(Element, Element.Methods);
if (!Prototype.BrowserFeatures.ElementExtensions && document.createElement('div')['__proto__']) {
    window.HTMLElement = {};
    window.HTMLElement.prototype = document.createElement('div')['__proto__'];
    Prototype.BrowserFeatures.ElementExtensions = true;
}
Element.extend = (function () {
    if (Prototype.BrowserFeatures.SpecificElementExtensions) return Prototype.K;
    var Methods = {},
    ByTag = Element.Methods.ByTag;
    var extend = Object.extend(function (element) {
        if (!element || element._extendedByPrototype || element.nodeType != 1 || element == window) return element;
        var methods = Object.clone(Methods),
        tagName = element.tagName.toUpperCase(),
        property,
        value;
        if (ByTag[tagName]) Object.extend(methods, ByTag[tagName]);
        for (property in methods) {
            value = methods[property];
            if (Object.isFunction(value) && !(property in element)) element[property] = value.methodize();
        }
        element._extendedByPrototype = Prototype.emptyFunction;
        return element;
    },
    {
        refresh: function () {
            if (!Prototype.BrowserFeatures.ElementExtensions) {
                Object.extend(Methods, Element.Methods);
                Object.extend(Methods, Element.Methods.Simulated);
            }
        }
    });
    extend.refresh();
    return extend;
})();
Element.hasAttribute = function (element, attribute) {
    if (element.hasAttribute) return element.hasAttribute(attribute);
    return Element.Methods.Simulated.hasAttribute(element, attribute);
};
Element.addMethods = function (methods) {
    var F = Prototype.BrowserFeatures,
    T = Element.Methods.ByTag;
    if (!methods) {
        Object.extend(Form, Form.Methods);
        Object.extend(Form.Element, Form.Element.Methods);
        Object.extend(Element.Methods.ByTag, {
            "FORM": Object.clone(Form.Methods),
            "INPUT": Object.clone(Form.Element.Methods),
            "SELECT": Object.clone(Form.Element.Methods),
            "TEXTAREA": Object.clone(Form.Element.Methods)
        });
    }
    if (arguments.length == 2) {
        var tagName = methods;
        methods = arguments[1];
    }
    if (!tagName) Object.extend(Element.Methods, methods || {});
    else {
        if (Object.isArray(tagName)) tagName.each(extend);
        else extend(tagName);
    }
    function extend(tagName) {
        tagName = tagName.toUpperCase();
        if (!Element.Methods.ByTag[tagName]) Element.Methods.ByTag[tagName] = {};
        Object.extend(Element.Methods.ByTag[tagName], methods);
    }
    function copy(methods, destination, onlyIfAbsent) {
        onlyIfAbsent = onlyIfAbsent || false;
        for (var property in methods) {
            var value = methods[property];
            if (!Object.isFunction(value)) continue;
            if (!onlyIfAbsent || !(property in destination)) destination[property] = value.methodize();
        }
    }
    function findDOMClass(tagName) {
        var klass;
        var trans = {
            "OPTGROUP": "OptGroup",
            "TEXTAREA": "TextArea",
            "P": "Paragraph",
            "FIELDSET": "FieldSet",
            "UL": "UList",
            "OL": "OList",
            "DL": "DList",
            "DIR": "Directory",
            "H1": "Heading",
            "H2": "Heading",
            "H3": "Heading",
            "H4": "Heading",
            "H5": "Heading",
            "H6": "Heading",
            "Q": "Quote",
            "INS": "Mod",
            "DEL": "Mod",
            "A": "Anchor",
            "IMG": "Image",
            "CAPTION": "TableCaption",
            "COL": "TableCol",
            "COLGROUP": "TableCol",
            "THEAD": "TableSection",
            "TFOOT": "TableSection",
            "TBODY": "TableSection",
            "TR": "TableRow",
            "TH": "TableCell",
            "TD": "TableCell",
            "FRAMESET": "FrameSet",
            "IFRAME": "IFrame"
        };
        if (trans[tagName]) klass = 'HTML' + trans[tagName] + 'Element';
        if (window[klass]) return window[klass];
        klass = 'HTML' + tagName + 'Element';
        if (window[klass]) return window[klass];
        klass = 'HTML' + tagName.capitalize() + 'Element';
        if (window[klass]) return window[klass];
        window[klass] = {};
        window[klass].prototype = document.createElement(tagName)['__proto__'];
        return window[klass];
    }
    if (F.ElementExtensions) {
        copy(Element.Methods, HTMLElement.prototype);
        copy(Element.Methods.Simulated, HTMLElement.prototype, true);
    }
    if (F.SpecificElementExtensions) {
        for (var tag in Element.Methods.ByTag) {
            var klass = findDOMClass(tag);
            if (Object.isUndefined(klass)) continue;
            copy(T[tag], klass.prototype);
        }
    }
    Object.extend(Element, Element.Methods);
    delete Element.ByTag;
    if (Element.extend.refresh) Element.extend.refresh();
    Element.cache = {};
};
document.viewport = {
    getDimensions: function () {
        var dimensions = {},
        B = Prototype.Browser;
        $w('width height').each(function (d) {
            var D = d.capitalize();
            if (B.WebKit && !document.evaluate) {
                dimensions[d] = self['inner' + D];
            } else if (B.Opera && parseFloat(window.opera.version()) < 9.5) {
                dimensions[d] = document.body['client' + D]
            } else {
                dimensions[d] = document.documentElement['client' + D];
            }
        });
        return dimensions;
    },
    getWidth: function () {
        return this.getDimensions().width;
    },
    getHeight: function () {
        return this.getDimensions().height;
    },
    getScrollOffsets: function () {
        return Element._returnOffset(window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft, window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop);
    }
};
var Selector = Class.create({
    initialize: function (expression) {
        this.expression = expression.strip();
        if (this.shouldUseSelectorsAPI()) {
            this.mode = 'selectorsAPI';
        } else if (this.shouldUseXPath()) {
            this.mode = 'xpath';
            this.compileXPathMatcher();
        } else {
            this.mode = "normal";
            this.compileMatcher();
        }
    },
    shouldUseXPath: function () {
        if (!Prototype.BrowserFeatures.XPath) return false;
        var e = this.expression;
        if (Prototype.Browser.WebKit && (e.include("-of-type") || e.include(":empty"))) return false;
        if ((/(\[[\w-]*?:|:checked)/).test(e)) return false;
        return true;
    },
    shouldUseSelectorsAPI: function () {
        if (!Prototype.BrowserFeatures.SelectorsAPI) return false;
        if (!Selector._div) Selector._div = new Element('div');
        try {
            Selector._div.querySelector(this.expression);
        } catch(e) {
            return false;
        }
        return true;
    },
    compileMatcher: function () {
        var e = this.expression,
        ps = Selector.patterns,
        h = Selector.handlers,
        c = Selector.criteria,
        le, p, m;
        if (Selector._cache[e]) {
            this.matcher = Selector._cache[e];
            return;
        }
        this.matcher = ["this.matcher = function(root) {", "var r = root, h = Selector.handlers, c = false, n;"];
        while (e && le != e && (/\S/).test(e)) {
            le = e;
            for (var i in ps) {
                p = ps[i];
                if (m = e.match(p)) {
                    this.matcher.push(Object.isFunction(c[i]) ? c[i](m) : new Template(c[i]).evaluate(m));
                    e = e.replace(m[0], '');
                    break;
                }
            }
        }
        this.matcher.push("return h.unique(n);\n}");
        eval(this.matcher.join('\n'));
        Selector._cache[this.expression] = this.matcher;
    },
    compileXPathMatcher: function () {
        var e = this.expression,
        ps = Selector.patterns,
        x = Selector.xpath,
        le, m;
        if (Selector._cache[e]) {
            this.xpath = Selector._cache[e];
            return;
        }
        this.matcher = ['.//*'];
        while (e && le != e && (/\S/).test(e)) {
            le = e;
            for (var i in ps) {
                if (m = e.match(ps[i])) {
                    this.matcher.push(Object.isFunction(x[i]) ? x[i](m) : new Template(x[i]).evaluate(m));
                    e = e.replace(m[0], '');
                    break;
                }
            }
        }
        this.xpath = this.matcher.join('');
        Selector._cache[this.expression] = this.xpath;
    },
    findElements: function (root) {
        root = root || document;
        var e = this.expression,
        results;
        switch (this.mode) {
        case 'selectorsAPI':
            if (root !== document) {
                var oldId = root.id,
                id = $(root).identify();
                e = "#" + id + " " + e;
            }
            results = $A(root.querySelectorAll(e)).map(Element.extend);
            root.id = oldId;
            return results;
        case 'xpath':
            return document._getElementsByXPath(this.xpath, root);
        default:
            return this.matcher(root);
        }
    },
    match: function (element) {
        this.tokens = [];
        var e = this.expression,
        ps = Selector.patterns,
        as = Selector.assertions;
        var le, p, m;
        while (e && le !== e && (/\S/).test(e)) {
            le = e;
            for (var i in ps) {
                p = ps[i];
                if (m = e.match(p)) {
                    if (as[i]) {
                        this.tokens.push([i, Object.clone(m)]);
                        e = e.replace(m[0], '');
                    } else {
                        return this.findElements(document).include(element);
                    }
                }
            }
        }
        var match = true,
        name, matches;
        for (var i = 0, token; token = this.tokens[i]; i++) {
            name = token[0],
            matches = token[1];
            if (!Selector.assertions[name](element, matches)) {
                match = false;
                break;
            }
        }
        return match;
    },
    toString: function () {
        return this.expression;
    },
    inspect: function () {
        return "#<Selector:" + this.expression.inspect() + ">";
    }
});
Object.extend(Selector, {
    _cache: {},
    xpath: {
        descendant: "//*",
        child: "/*",
        adjacent: "/following-sibling::*[1]",
        laterSibling: '/following-sibling::*',
        tagName: function (m) {
            if (m[1] == '*') return '';
            return "[local-name()='" + m[1].toLowerCase() + "' or local-name()='" + m[1].toUpperCase() + "']";
        },
        className: "[contains(concat(' ', @class, ' '), ' #{1} ')]",
        id: "[@id='#{1}']",
        attrPresence: function (m) {
            m[1] = m[1].toLowerCase();
            return new Template("[@#{1}]").evaluate(m);
        },
        attr: function (m) {
            m[1] = m[1].toLowerCase();
            m[3] = m[5] || m[6];
            return new Template(Selector.xpath.operators[m[2]]).evaluate(m);
        },
        pseudo: function (m) {
            var h = Selector.xpath.pseudos[m[1]];
            if (!h) return '';
            if (Object.isFunction(h)) return h(m);
            return new Template(Selector.xpath.pseudos[m[1]]).evaluate(m);
        },
        operators: {
            '=': "[@#{1}='#{3}']",
            '!=': "[@#{1}!='#{3}']",
            '^=': "[starts-with(@#{1}, '#{3}')]",
            '$=': "[substring(@#{1}, (string-length(@#{1}) - string-length('#{3}') + 1))='#{3}']",
            '*=': "[contains(@#{1}, '#{3}')]",
            '~=': "[contains(concat(' ', @#{1}, ' '), ' #{3} ')]",
            '|=': "[contains(concat('-', @#{1}, '-'), '-#{3}-')]"
        },
        pseudos: {
            'first-child': '[not(preceding-sibling::*)]',
            'last-child': '[not(following-sibling::*)]',
            'only-child': '[not(preceding-sibling::* or following-sibling::*)]',
            'empty': "[count(*) = 0 and (count(text()) = 0)]",
            'checked': "[@checked]",
            'disabled': "[(@disabled) and (@type!='hidden')]",
            'enabled': "[not(@disabled) and (@type!='hidden')]",
            'not': function (m) {
                var e = m[6],
                p = Selector.patterns,
                x = Selector.xpath,
                le,
                v;
                var exclusion = [];
                while (e && le != e && (/\S/).test(e)) {
                    le = e;
                    for (var i in p) {
                        if (m = e.match(p[i])) {
                            v = Object.isFunction(x[i]) ? x[i](m) : new Template(x[i]).evaluate(m);
                            exclusion.push("(" + v.substring(1, v.length - 1) + ")");
                            e = e.replace(m[0], '');
                            break;
                        }
                    }
                }
                return "[not(" + exclusion.join(" and ") + ")]";
            },
            'nth-child': function (m) {
                return Selector.xpath.pseudos.nth("(count(./preceding-sibling::*) + 1) ", m);
            },
            'nth-last-child': function (m) {
                return Selector.xpath.pseudos.nth("(count(./following-sibling::*) + 1) ", m);
            },
            'nth-of-type': function (m) {
                return Selector.xpath.pseudos.nth("position() ", m);
            },
            'nth-last-of-type': function (m) {
                return Selector.xpath.pseudos.nth("(last() + 1 - position()) ", m);
            },
            'first-of-type': function (m) {
                m[6] = "1";
                return Selector.xpath.pseudos['nth-of-type'](m);
            },
            'last-of-type': function (m) {
                m[6] = "1";
                return Selector.xpath.pseudos['nth-last-of-type'](m);
            },
            'only-of-type': function (m) {
                var p = Selector.xpath.pseudos;
                return p['first-of-type'](m) + p['last-of-type'](m);
            },
            nth: function (fragment, m) {
                var mm, formula = m[6],
                predicate;
                if (formula == 'even') formula = '2n+0';
                if (formula == 'odd') formula = '2n+1';
                if (mm = formula.match(/^(\d+)$/)) return '[' + fragment + "= " + mm[1] + ']';
                if (mm = formula.match(/^(-?\d*)?n(([+-])(\d+))?/)) {
                    if (mm[1] == "-") mm[1] = -1;
                    var a = mm[1] ? Number(mm[1]) : 1;
                    var b = mm[2] ? Number(mm[2]) : 0;
                    predicate = "[((#{fragment} - #{b}) mod #{a} = 0) and " + "((#{fragment} - #{b}) div #{a} >= 0)]";
                    return new Template(predicate).evaluate({
                        fragment: fragment,
                        a: a,
                        b: b
                    });
                }
            }
        }
    },
    criteria: {
        tagName: 'n = h.tagName(n, r, "#{1}", c);      c = false;',
        className: 'n = h.className(n, r, "#{1}", c);    c = false;',
        id: 'n = h.id(n, r, "#{1}", c);           c = false;',
        attrPresence: 'n = h.attrPresence(n, r, "#{1}", c); c = false;',
        attr: function (m) {
            m[3] = (m[5] || m[6]);
            return new Template('n = h.attr(n, r, "#{1}", "#{3}", "#{2}", c); c = false;').evaluate(m);
        },
        pseudo: function (m) {
            if (m[6]) m[6] = m[6].replace(/"/g, '\\"');
            return new Template('n = h.pseudo(n, "#{1}", "#{6}", r, c); c = false;').evaluate(m);
        },
        descendant: 'c = "descendant";',
        child: 'c = "child";',
        adjacent: 'c = "adjacent";',
        laterSibling: 'c = "laterSibling";'
    },
    patterns: {
        laterSibling: /^\s*~\s*/,
        child: /^\s*>\s*/,
        adjacent: /^\s*\+\s*/,
        descendant: /^\s/,
        tagName: /^\s*(\*|[\w\-]+)(\b|$)?/,
        id: /^#([\w\-\*]+)(\b|$)/,
        className: /^\.([\w\-\*]+)(\b|$)/,
        pseudo: /^:((first|last|nth|nth-last|only)(-child|-of-type)|empty|checked|(en|dis)abled|not)(\((.*?)\))?(\b|$|(?=\s|[:+~>]))/,
        attrPresence: /^\[((?:[\w]+:)?[\w]+)\]/,
        attr: /\[((?:[\w-]*:)?[\w-]+)\s*(?:([!^$*~|]?=)\s*((['"])([^\4]*?)\4|([^'"][^\]]*?)))?\]/
    },
    assertions: {
        tagName: function (element, matches) {
            return matches[1].toUpperCase() == element.tagName.toUpperCase();
        },
        className: function (element, matches) {
            return Element.hasClassName(element, matches[1]);
        },
        id: function (element, matches) {
            return element.id === matches[1];
        },
        attrPresence: function (element, matches) {
            return Element.hasAttribute(element, matches[1]);
        },
        attr: function (element, matches) {
            var nodeValue = Element.readAttribute(element, matches[1]);
            return nodeValue && Selector.operators[matches[2]](nodeValue, matches[5] || matches[6]);
        }
    },
    handlers: {
        concat: function (a, b) {
            for (var i = 0, node; node = b[i]; i++)
            a.push(node);
            return a;
        },
        mark: function (nodes) {
            var _true = Prototype.emptyFunction;
            for (var i = 0, node; node = nodes[i]; i++)
            node._countedByPrototype = _true;
            return nodes;
        },
        unmark: function (nodes) {
            for (var i = 0, node; node = nodes[i]; i++)
            node._countedByPrototype = undefined;
            return nodes;
        },
        index: function (parentNode, reverse, ofType) {
            parentNode._countedByPrototype = Prototype.emptyFunction;
            if (reverse) {
                for (var nodes = parentNode.childNodes, i = nodes.length - 1, j = 1; i >= 0; i--) {
                    var node = nodes[i];
                    if (node.nodeType == 1 && (!ofType || node._countedByPrototype)) node.nodeIndex = j++;
                }
            } else {
                for (var i = 0, j = 1, nodes = parentNode.childNodes; node = nodes[i]; i++)
                if (node.nodeType == 1 && (!ofType || node._countedByPrototype)) node.nodeIndex = j++;
            }
        },
        unique: function (nodes) {
            if (nodes.length == 0) return nodes;
            var results = [],
            n;
            for (var i = 0, l = nodes.length; i < l; i++)
            if (! (n = nodes[i])._countedByPrototype) {
                n._countedByPrototype = Prototype.emptyFunction;
                results.push(Element.extend(n));
            }
            return Selector.handlers.unmark(results);
        },
        descendant: function (nodes) {
            var h = Selector.handlers;
            for (var i = 0, results = [], node; node = nodes[i]; i++)
            h.concat(results, node.getElementsByTagName('*'));
            return results;
        },
        child: function (nodes) {
            var h = Selector.handlers;
            for (var i = 0, results = [], node; node = nodes[i]; i++) {
                for (var j = 0, child; child = node.childNodes[j]; j++)
                if (child.nodeType == 1 && child.tagName != '!') results.push(child);
            }
            return results;
        },
        adjacent: function (nodes) {
            for (var i = 0, results = [], node; node = nodes[i]; i++) {
                var next = this.nextElementSibling(node);
                if (next) results.push(next);
            }
            return results;
        },
        laterSibling: function (nodes) {
            var h = Selector.handlers;
            for (var i = 0, results = [], node; node = nodes[i]; i++)
            h.concat(results, Element.nextSiblings(node));
            return results;
        },
        nextElementSibling: function (node) {
            while (node = node.nextSibling)
            if (node.nodeType == 1) return node;
            return null;
        },
        previousElementSibling: function (node) {
            while (node = node.previousSibling)
            if (node.nodeType == 1) return node;
            return null;
        },
        tagName: function (nodes, root, tagName, combinator) {
            var uTagName = tagName.toUpperCase();
            var results = [],
            h = Selector.handlers;
            if (nodes) {
                if (combinator) {
                    if (combinator == "descendant") {
                        for (var i = 0, node; node = nodes[i]; i++)
                        h.concat(results, node.getElementsByTagName(tagName));
                        return results;
                    } else nodes = this[combinator](nodes);
                    if (tagName == "*") return nodes;
                }
                for (var i = 0, node; node = nodes[i]; i++)
                if (node.tagName.toUpperCase() === uTagName) results.push(node);
                return results;
            } else return root.getElementsByTagName(tagName);
        },
        id: function (nodes, root, id, combinator) {
            var targetNode = $(id),
            h = Selector.handlers;
            if (!targetNode) return [];
            if (!nodes && root == document) return [targetNode];
            if (nodes) {
                if (combinator) {
                    if (combinator == 'child') {
                        for (var i = 0, node; node = nodes[i]; i++)
                        if (targetNode.parentNode == node) return [targetNode];
                    } else if (combinator == 'descendant') {
                        for (var i = 0, node; node = nodes[i]; i++)
                        if (Element.descendantOf(targetNode, node)) return [targetNode];
                    } else if (combinator == 'adjacent') {
                        for (var i = 0, node; node = nodes[i]; i++)
                        if (Selector.handlers.previousElementSibling(targetNode) == node) return [targetNode];
                    } else nodes = h[combinator](nodes);
                }
                for (var i = 0, node; node = nodes[i]; i++)
                if (node == targetNode) return [targetNode];
                return [];
            }
            return (targetNode && Element.descendantOf(targetNode, root)) ? [targetNode] : [];
        },
        className: function (nodes, root, className, combinator) {
            if (nodes && combinator) nodes = this[combinator](nodes);
            return Selector.handlers.byClassName(nodes, root, className);
        },
        byClassName: function (nodes, root, className) {
            if (!nodes) nodes = Selector.handlers.descendant([root]);
            var needle = ' ' + className + ' ';
            for (var i = 0, results = [], node, nodeClassName; node = nodes[i]; i++) {
                nodeClassName = node.className;
                if (nodeClassName.length == 0) continue;
                if (nodeClassName == className || (' ' + nodeClassName + ' ').include(needle)) results.push(node);
            }
            return results;
        },
        attrPresence: function (nodes, root, attr, combinator) {
            if (!nodes) nodes = root.getElementsByTagName("*");
            if (nodes && combinator) nodes = this[combinator](nodes);
            var results = [];
            for (var i = 0, node; node = nodes[i]; i++)
            if (Element.hasAttribute(node, attr)) results.push(node);
            return results;
        },
        attr: function (nodes, root, attr, value, operator, combinator) {
            if (!nodes) nodes = root.getElementsByTagName("*");
            if (nodes && combinator) nodes = this[combinator](nodes);
            var handler = Selector.operators[operator],
            results = [];
            for (var i = 0, node; node = nodes[i]; i++) {
                var nodeValue = Element.readAttribute(node, attr);
                if (nodeValue === null) continue;
                if (handler(nodeValue, value)) results.push(node);
            }
            return results;
        },
        pseudo: function (nodes, name, value, root, combinator) {
            if (nodes && combinator) nodes = this[combinator](nodes);
            if (!nodes) nodes = root.getElementsByTagName("*");
            return Selector.pseudos[name](nodes, value, root);
        }
    },
    pseudos: {
        'first-child': function (nodes, value, root) {
            for (var i = 0, results = [], node; node = nodes[i]; i++) {
                if (Selector.handlers.previousElementSibling(node)) continue;
                results.push(node);
            }
            return results;
        },
        'last-child': function (nodes, value, root) {
            for (var i = 0, results = [], node; node = nodes[i]; i++) {
                if (Selector.handlers.nextElementSibling(node)) continue;
                results.push(node);
            }
            return results;
        },
        'only-child': function (nodes, value, root) {
            var h = Selector.handlers;
            for (var i = 0, results = [], node; node = nodes[i]; i++)
            if (!h.previousElementSibling(node) && !h.nextElementSibling(node)) results.push(node);
            return results;
        },
        'nth-child': function (nodes, formula, root) {
            return Selector.pseudos.nth(nodes, formula, root);
        },
        'nth-last-child': function (nodes, formula, root) {
            return Selector.pseudos.nth(nodes, formula, root, true);
        },
        'nth-of-type': function (nodes, formula, root) {
            return Selector.pseudos.nth(nodes, formula, root, false, true);
        },
        'nth-last-of-type': function (nodes, formula, root) {
            return Selector.pseudos.nth(nodes, formula, root, true, true);
        },
        'first-of-type': function (nodes, formula, root) {
            return Selector.pseudos.nth(nodes, "1", root, false, true);
        },
        'last-of-type': function (nodes, formula, root) {
            return Selector.pseudos.nth(nodes, "1", root, true, true);
        },
        'only-of-type': function (nodes, formula, root) {
            var p = Selector.pseudos;
            return p['last-of-type'](p['first-of-type'](nodes, formula, root), formula, root);
        },
        getIndices: function (a, b, total) {
            if (a == 0) return b > 0 ? [b] : [];
            return $R(1, total).inject([], function (memo, i) {
                if (0 == (i - b) % a && (i - b) / a >= 0) memo.push(i);
                return memo;
            });
        },
        nth: function (nodes, formula, root, reverse, ofType) {
            if (nodes.length == 0) return [];
            if (formula == 'even') formula = '2n+0';
            if (formula == 'odd') formula = '2n+1';
            var h = Selector.handlers,
            results = [],
            indexed = [],
            m;
            h.mark(nodes);
            for (var i = 0, node; node = nodes[i]; i++) {
                if (!node.parentNode._countedByPrototype) {
                    h.index(node.parentNode, reverse, ofType);
                    indexed.push(node.parentNode);
                }
            }
            if (formula.match(/^\d+$/)) {
                formula = Number(formula);
                for (var i = 0, node; node = nodes[i]; i++)
                if (node.nodeIndex == formula) results.push(node);
            } else if (m = formula.match(/^(-?\d*)?n(([+-])(\d+))?/)) {
                if (m[1] == "-") m[1] = -1;
                var a = m[1] ? Number(m[1]) : 1;
                var b = m[2] ? Number(m[2]) : 0;
                var indices = Selector.pseudos.getIndices(a, b, nodes.length);
                for (var i = 0, node, l = indices.length; node = nodes[i]; i++) {
                    for (var j = 0; j < l; j++)
                    if (node.nodeIndex == indices[j]) results.push(node);
                }
            }
            h.unmark(nodes);
            h.unmark(indexed);
            return results;
        },
        'empty': function (nodes, value, root) {
            for (var i = 0, results = [], node; node = nodes[i]; i++) {
                if (node.tagName == '!' || node.firstChild) continue;
                results.push(node);
            }
            return results;
        },
        'not': function (nodes, selector, root) {
            var h = Selector.handlers,
            selectorType, m;
            var exclusions = new Selector(selector).findElements(root);
            h.mark(exclusions);
            for (var i = 0, results = [], node; node = nodes[i]; i++)
            if (!node._countedByPrototype) results.push(node);
            h.unmark(exclusions);
            return results;
        },
        'enabled': function (nodes, value, root) {
            for (var i = 0, results = [], node; node = nodes[i]; i++)
            if (!node.disabled && (!node.type || node.type !== 'hidden')) results.push(node);
            return results;
        },
        'disabled': function (nodes, value, root) {
            for (var i = 0, results = [], node; node = nodes[i]; i++)
            if (node.disabled) results.push(node);
            return results;
        },
        'checked': function (nodes, value, root) {
            for (var i = 0, results = [], node; node = nodes[i]; i++)
            if (node.checked) results.push(node);
            return results;
        }
    },
    operators: {
        '=': function (nv, v) {
            return nv == v;
        },
        '!=': function (nv, v) {
            return nv != v;
        },
        '^=': function (nv, v) {
            return nv == v || nv && nv.startsWith(v);
        },
        '$=': function (nv, v) {
            return nv == v || nv && nv.endsWith(v);
        },
        '*=': function (nv, v) {
            return nv == v || nv && nv.include(v);
        },
        '$=': function (nv, v) {
            return nv.endsWith(v);
        },
        '*=': function (nv, v) {
            return nv.include(v);
        },
        '~=': function (nv, v) {
            return (' ' + nv + ' ').include(' ' + v + ' ');
        },
        '|=': function (nv, v) {
            return ('-' + (nv || "").toUpperCase() + '-').include('-' + (v || "").toUpperCase() + '-');
        }
    },
    split: function (expression) {
        var expressions = [];
        expression.scan(/(([\w#:.~>+()\s-]+|\*|\[.*?\])+)\s*(,|$)/, function (m) {
            expressions.push(m[1].strip());
        });
        return expressions;
    },
    matchElements: function (elements, expression) {
        var matches = $$(expression),
        h = Selector.handlers;
        h.mark(matches);
        for (var i = 0, results = [], element; element = elements[i]; i++)
        if (element._countedByPrototype) results.push(element);
        h.unmark(matches);
        return results;
    },
    findElement: function (elements, expression, index) {
        if (Object.isNumber(expression)) {
            index = expression;
            expression = false;
        }
        return Selector.matchElements(elements, expression || '*')[index || 0];
    },
    findChildElements: function (element, expressions) {
        expressions = Selector.split(expressions.join(','));
        var results = [],
        h = Selector.handlers;
        for (var i = 0, l = expressions.length, selector; i < l; i++) {
            selector = new Selector(expressions[i].strip());
            h.concat(results, selector.findElements(element));
        }
        return (l > 1) ? h.unique(results) : results;
    }
});
if (Prototype.Browser.IE) {
    Object.extend(Selector.handlers, {
        concat: function (a, b) {
            for (var i = 0, node; node = b[i]; i++)
            if (node.tagName !== "!") a.push(node);
            return a;
        },
        unmark: function (nodes) {
            for (var i = 0, node; node = nodes[i]; i++)
            node.removeAttribute('_countedByPrototype');
            return nodes;
        }
    });
}
function $$() {
    return Selector.findChildElements(document, $A(arguments));
}
var Form = {
    reset: function (form) {
        $(form).reset();
        return form;
    },
    serializeElements: function (elements, options) {
        if (typeof options != 'object') options = {
            hash: !!options
        };
        else if (Object.isUndefined(options.hash)) options.hash = true;
        var key, value, submitted = false,
        submit = options.submit;
        var data = elements.inject({},
        function (result, element) {
            if (!element.disabled && element.name) {
                key = element.name;
                value = $(element).getValue();
                if (value != null && element.type != 'file' && (element.type != 'submit' || (!submitted && submit !== false && (!submit || key == submit) && (submitted = true)))) {
                    if (key in result) {
                        if (!Object.isArray(result[key])) result[key] = [result[key]];
                        result[key].push(value);
                    }
                    else result[key] = value;
                }
            }
            return result;
        });
        return options.hash ? data: Object.toQueryString(data);
    }
};
Form.Methods = {
    serialize: function (form, options) {
        return Form.serializeElements(Form.getElements(form), options);
    },
    getElements: function (form) {
        return $A($(form).getElementsByTagName('*')).inject([], function (elements, child) {
            if (Form.Element.Serializers[child.tagName.toLowerCase()]) elements.push(Element.extend(child));
            return elements;
        });
    },
    getInputs: function (form, typeName, name) {
        form = $(form);
        var inputs = form.getElementsByTagName('input');
        if (!typeName && !name) return $A(inputs).map(Element.extend);
        for (var i = 0, matchingInputs = [], length = inputs.length; i < length; i++) {
            var input = inputs[i];
            if ((typeName && input.type != typeName) || (name && input.name != name)) continue;
            matchingInputs.push(Element.extend(input));
        }
        return matchingInputs;
    },
    disable: function (form) {
        form = $(form);
        Form.getElements(form).invoke('disable');
        return form;
    },
    enable: function (form) {
        form = $(form);
        Form.getElements(form).invoke('enable');
        return form;
    },
    findFirstElement: function (form) {
        var elements = $(form).getElements().findAll(function (element) {
            return 'hidden' != element.type && !element.disabled;
        });
        var firstByIndex = elements.findAll(function (element) {
            return element.hasAttribute('tabIndex') && element.tabIndex >= 0;
        }).sortBy(function (element) {
            return element.tabIndex
        }).first();
        return firstByIndex ? firstByIndex: elements.find(function (element) {
            return ['input', 'select', 'textarea'].include(element.tagName.toLowerCase());
        });
    },
    focusFirstElement: function (form) {
        form = $(form);
        form.findFirstElement().activate();
        return form;
    },
    request: function (form, options) {
        form = $(form),
        options = Object.clone(options || {});
        var params = options.parameters,
        action = form.readAttribute('action') || '';
        if (action.blank()) action = window.location.href;
        options.parameters = form.serialize(true);
        if (params) {
            if (Object.isString(params)) params = params.toQueryParams();
            Object.extend(options.parameters, params);
        }
        if (form.hasAttribute('method') && !options.method) options.method = form.method;
        return new Ajax.Request(action, options);
    }
};
Form.Element = {
    focus: function (element) {
        $(element).focus();
        return element;
    },
    select: function (element) {
        $(element).select();
        return element;
    }
};
Form.Element.Methods = {
    serialize: function (element) {
        element = $(element);
        if (!element.disabled && element.name) {
            var value = element.getValue();
            if (value != undefined) {
                var pair = {};
                pair[element.name] = value;
                return Object.toQueryString(pair);
            }
        }
        return '';
    },
    getValue: function (element) {
        element = $(element);
        var method = element.tagName.toLowerCase();
        return Form.Element.Serializers[method](element);
    },
    setValue: function (element, value) {
        element = $(element);
        var method = element.tagName.toLowerCase();
        Form.Element.Serializers[method](element, value);
        return element;
    },
    clear: function (element) {
        $(element).value = '';
        return element;
    },
    present: function (element) {
        return $(element).value != '';
    },
    activate: function (element) {
        element = $(element);
        try {
            element.focus();
            if (element.select && (element.tagName.toLowerCase() != 'input' || !['button', 'reset', 'submit'].include(element.type))) element.select();
        } catch(e) {}
        return element;
    },
    disable: function (element) {
        element = $(element);
        element.disabled = true;
        return element;
    },
    enable: function (element) {
        element = $(element);
        element.disabled = false;
        return element;
    }
};
var Field = Form.Element;
var $F = Form.Element.Methods.getValue;
Form.Element.Serializers = {
    input: function (element, value) {
        switch (element.type.toLowerCase()) {
        case 'checkbox':
        case 'radio':
            return Form.Element.Serializers.inputSelector(element, value);
        default:
            return Form.Element.Serializers.textarea(element, value);
        }
    },
    inputSelector: function (element, value) {
        if (Object.isUndefined(value)) return element.checked ? element.value: null;
        else element.checked = !!value;
    },
    textarea: function (element, value) {
        if (Object.isUndefined(value)) return element.value;
        else element.value = value;
    },
    select: function (element, value) {
        if (Object.isUndefined(value)) return this[element.type == 'select-one' ? 'selectOne': 'selectMany'](element);
        else {
            var opt, currentValue, single = !Object.isArray(value);
            for (var i = 0, length = element.length; i < length; i++) {
                opt = element.options[i];
                currentValue = this.optionValue(opt);
                if (single) {
                    if (currentValue == value) {
                        opt.selected = true;
                        return;
                    }
                }
                else opt.selected = value.include(currentValue);
            }
        }
    },
    selectOne: function (element) {
        var index = element.selectedIndex;
        return index >= 0 ? this.optionValue(element.options[index]) : null;
    },
    selectMany: function (element) {
        var values, length = element.length;
        if (!length) return null;
        for (var i = 0, values = []; i < length; i++) {
            var opt = element.options[i];
            if (opt.selected) values.push(this.optionValue(opt));
        }
        return values;
    },
    optionValue: function (opt) {
        return Element.extend(opt).hasAttribute('value') ? opt.value: opt.text;
    }
};
Abstract.TimedObserver = Class.create(PeriodicalExecuter, {
    initialize: function ($super, element, frequency, callback) {
        $super(callback, frequency);
        this.element = $(element);
        this.lastValue = this.getValue();
    },
    execute: function () {
        var value = this.getValue();
        if (Object.isString(this.lastValue) && Object.isString(value) ? this.lastValue != value: String(this.lastValue) != String(value)) {
            this.callback(this.element, value);
            this.lastValue = value;
        }
    }
});
Form.Element.Observer = Class.create(Abstract.TimedObserver, {
    getValue: function () {
        return Form.Element.getValue(this.element);
    }
});
Form.Observer = Class.create(Abstract.TimedObserver, {
    getValue: function () {
        return Form.serialize(this.element);
    }
});
Abstract.EventObserver = Class.create({
    initialize: function (element, callback) {
        this.element = $(element);
        this.callback = callback;
        this.lastValue = this.getValue();
        if (this.element.tagName.toLowerCase() == 'form') this.registerFormCallbacks();
        else this.registerCallback(this.element);
    },
    onElementEvent: function () {
        var value = this.getValue();
        if (this.lastValue != value) {
            this.callback(this.element, value);
            this.lastValue = value;
        }
    },
    registerFormCallbacks: function () {
        Form.getElements(this.element).each(this.registerCallback, this);
    },
    registerCallback: function (element) {
        if (element.type) {
            switch (element.type.toLowerCase()) {
            case 'checkbox':
            case 'radio':
                Event.observe(element, 'click', this.onElementEvent.bind(this));
                break;
            default:
                Event.observe(element, 'change', this.onElementEvent.bind(this));
                break;
            }
        }
    }
});
Form.Element.EventObserver = Class.create(Abstract.EventObserver, {
    getValue: function () {
        return Form.Element.getValue(this.element);
    }
});
Form.EventObserver = Class.create(Abstract.EventObserver, {
    getValue: function () {
        return Form.serialize(this.element);
    }
});
if (!window.Event) var Event = {};
Object.extend(Event, {
    KEY_BACKSPACE: 8,
    KEY_TAB: 9,
    KEY_RETURN: 13,
    KEY_ESC: 27,
    KEY_LEFT: 37,
    KEY_UP: 38,
    KEY_RIGHT: 39,
    KEY_DOWN: 40,
    KEY_DELETE: 46,
    KEY_HOME: 36,
    KEY_END: 35,
    KEY_PAGEUP: 33,
    KEY_PAGEDOWN: 34,
    KEY_INSERT: 45,
    cache: {},
    relatedTarget: function (event) {
        var element;
        switch (event.type) {
        case 'mouseover':
            element = event.fromElement;
            break;
        case 'mouseout':
            element = event.toElement;
            break;
        default:
            return null;
        }
        return Element.extend(element);
    }
});
Event.Methods = (function () {
    var isButton;
    if (Prototype.Browser.IE) {
        var buttonMap = {
            0 : 1,
            1 : 4,
            2 : 2
        };
        isButton = function (event, code) {
            return event.button == buttonMap[code];
        };
    } else if (Prototype.Browser.WebKit) {
        isButton = function (event, code) {
            switch (code) {
            case 0:
                return event.which == 1 && !event.metaKey;
            case 1:
                return event.which == 1 && event.metaKey;
            default:
                return false;
            }
        };
    } else {
        isButton = function (event, code) {
            return event.which ? (event.which === code + 1) : (event.button === code);
        };
    }
    return {
        isLeftClick: function (event) {
            return isButton(event, 0)
        },
        isMiddleClick: function (event) {
            return isButton(event, 1)
        },
        isRightClick: function (event) {
            return isButton(event, 2)
        },
        element: function (event) {
            event = Event.extend(event);
            var node = event.target,
            type = event.type,
            currentTarget = event.currentTarget;
            if (currentTarget && currentTarget.tagName) {
                if (type === 'load' || type === 'error' || (type === 'click' && currentTarget.tagName.toLowerCase() === 'input' && currentTarget.type === 'radio')) node = currentTarget;
            }
            if (node.nodeType == Node.TEXT_NODE) node = node.parentNode;
            return Element.extend(node);
        },
        findElement: function (event, expression) {
            var element = Event.element(event);
            if (!expression) return element;
            var elements = [element].concat(element.ancestors());
            return Selector.findElement(elements, expression, 0);
        },
        pointer: function (event) {
            var docElement = document.documentElement,
            body = document.body || {
                scrollLeft: 0,
                scrollTop: 0
            };
            return {
                x: event.pageX || (event.clientX + (docElement.scrollLeft || body.scrollLeft) - (docElement.clientLeft || 0)),
                y: event.pageY || (event.clientY + (docElement.scrollTop || body.scrollTop) - (docElement.clientTop || 0))
            };
        },
        pointerX: function (event) {
            return Event.pointer(event).x
        },
        pointerY: function (event) {
            return Event.pointer(event).y
        },
        stop: function (event) {
            Event.extend(event);
            event.preventDefault();
            event.stopPropagation();
            event.stopped = true;
        }
    };
})();
Event.extend = (function () {
    var methods = Object.keys(Event.Methods).inject({},
    function (m, name) {
        m[name] = Event.Methods[name].methodize();
        return m;
    });
    if (Prototype.Browser.IE) {
        Object.extend(methods, {
            stopPropagation: function () {
                this.cancelBubble = true
            },
            preventDefault: function () {
                this.returnValue = false
            },
            inspect: function () {
                return "[object Event]"
            }
        });
        return function (event) {
            if (!event) return false;
            if (event._extendedByPrototype) return event;
            event._extendedByPrototype = Prototype.emptyFunction;
            var pointer = Event.pointer(event);
            Object.extend(event, {
                target: event.srcElement,
                relatedTarget: Event.relatedTarget(event),
                pageX: pointer.x,
                pageY: pointer.y
            });
            return Object.extend(event, methods);
        };
    } else {
        Event.prototype = Event.prototype || document.createEvent("HTMLEvents")['__proto__'];
        Object.extend(Event.prototype, methods);
        return Prototype.K;
    }
})();
Object.extend(Event, (function () {
    var cache = Event.cache;
    function getEventID(element) {
        if (element._prototypeEventID) return element._prototypeEventID[0];
        arguments.callee.id = arguments.callee.id || 1;
        return element._prototypeEventID = [++arguments.callee.id];
    }
    function getDOMEventName(eventName) {
        if (eventName && eventName.include(':')) return "dataavailable";
        return eventName;
    }
    function getCacheForID(id) {
        return cache[id] = cache[id] || {};
    }
    function getWrappersForEventName(id, eventName) {
        var c = getCacheForID(id);
        return c[eventName] = c[eventName] || [];
    }
    function createWrapper(element, eventName, handler) {
        var id = getEventID(element);
        var c = getWrappersForEventName(id, eventName);
        if (c.pluck("handler").include(handler)) return false;
        var wrapper = function (event) {
            if (!Event || !Event.extend || (event.eventName && event.eventName != eventName)) return false;
            Event.extend(event);
            handler.call(element, event);
        };
        wrapper.handler = handler;
        c.push(wrapper);
        return wrapper;
    }
    function findWrapper(id, eventName, handler) {
        var c = getWrappersForEventName(id, eventName);
        return c.find(function (wrapper) {
            return wrapper.handler == handler
        });
    }
    function destroyWrapper(id, eventName, handler) {
        var c = getCacheForID(id);
        if (!c[eventName]) return false;
        c[eventName] = c[eventName].without(findWrapper(id, eventName, handler));
    }
    function destroyCache() {
        for (var id in cache)
        for (var eventName in cache[id])
        cache[id][eventName] = null;
    }
    if (window.attachEvent) {
        window.attachEvent("onunload", destroyCache);
    }
    if (Prototype.Browser.WebKit) {
        window.addEventListener('unload', Prototype.emptyFunction, false);
    }
    return {
        observe: function (element, eventName, handler) {
            element = $(element);
            var name = getDOMEventName(eventName);
            var wrapper = createWrapper(element, eventName, handler);
            if (!wrapper) return element;
            if (element.addEventListener) {
                element.addEventListener(name, wrapper, false);
            } else {
                element.attachEvent("on" + name, wrapper);
            }
            return element;
        },
        stopObserving: function (element, eventName, handler) {
            element = $(element);
            var id = getEventID(element),
            name = getDOMEventName(eventName);
            if (!handler && eventName) {
                getWrappersForEventName(id, eventName).each(function (wrapper) {
                    element.stopObserving(eventName, wrapper.handler);
                });
                return element;
            } else if (!eventName) {
                Object.keys(getCacheForID(id)).each(function (eventName) {
                    element.stopObserving(eventName);
                });
                return element;
            }
            var wrapper = findWrapper(id, eventName, handler);
            if (!wrapper) return element;
            if (element.removeEventListener) {
                element.removeEventListener(name, wrapper, false);
            } else {
                element.detachEvent("on" + name, wrapper);
            }
            destroyWrapper(id, eventName, handler);
            return element;
        },
        fire: function (element, eventName, memo) {
            element = $(element);
            if (element == document && document.createEvent && !element.dispatchEvent) element = document.documentElement;
            var event;
            if (document.createEvent) {
                event = document.createEvent("HTMLEvents");
                event.initEvent("dataavailable", true, true);
            } else {
                event = document.createEventObject();
                event.eventType = "ondataavailable";
            }
            event.eventName = eventName;
            event.memo = memo || {};
            if (document.createEvent) {
                element.dispatchEvent(event);
            } else {
                element.fireEvent(event.eventType, event);
            }
            return Event.extend(event);
        }
    };
})());
Object.extend(Event, Event.Methods);
Element.addMethods({
    fire: Event.fire,
    observe: Event.observe,
    stopObserving: Event.stopObserving
});
Object.extend(document, {
    fire: Element.Methods.fire.methodize(),
    observe: Element.Methods.observe.methodize(),
    stopObserving: Element.Methods.stopObserving.methodize(),
    loaded: false
});
(function () {
    var timer;
    function fireContentLoadedEvent() {
        if (document.loaded) return;
        if (timer) window.clearInterval(timer);
        document.fire("dom:loaded");
        document.loaded = true;
    }
    if (document.addEventListener) {
        if (Prototype.Browser.WebKit) {
            timer = window.setInterval(function () {
                if (/loaded|complete/.test(document.readyState)) fireContentLoadedEvent();
            },
            0);
            Event.observe(window, "load", fireContentLoadedEvent);
        } else {
            document.addEventListener("DOMContentLoaded", fireContentLoadedEvent, false);
        }
    } else {
        document.write("<script id=__onDOMContentLoaded defer src=//:><\/script>");
        $("__onDOMContentLoaded").onreadystatechange = function () {
            if (this.readyState == "complete") {
                this.onreadystatechange = null;
                fireContentLoadedEvent();
            }
        };
    }
})();
Hash.toQueryString = Object.toQueryString;
var Toggle = {
    display: Element.toggle
};
Element.Methods.childOf = Element.Methods.descendantOf;
var Insertion = {
    Before: function (element, content) {
        return Element.insert(element, {
            before: content
        });
    },
    Top: function (element, content) {
        return Element.insert(element, {
            top: content
        });
    },
    Bottom: function (element, content) {
        return Element.insert(element, {
            bottom: content
        });
    },
    After: function (element, content) {
        return Element.insert(element, {
            after: content
        });
    }
};
var $continue = new Error('"throw $continue" is deprecated, use "return" instead');
var Position = {
    includeScrollOffsets: false,
    prepare: function () {
        this.deltaX = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
        this.deltaY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    },
    within: function (element, x, y) {
        if (this.includeScrollOffsets) return this.withinIncludingScrolloffsets(element, x, y);
        this.xcomp = x;
        this.ycomp = y;
        this.offset = Element.cumulativeOffset(element);
        return (y >= this.offset[1] && y < this.offset[1] + element.offsetHeight && x >= this.offset[0] && x < this.offset[0] + element.offsetWidth);
    },
    withinIncludingScrolloffsets: function (element, x, y) {
        var offsetcache = Element.cumulativeScrollOffset(element);
        this.xcomp = x + offsetcache[0] - this.deltaX;
        this.ycomp = y + offsetcache[1] - this.deltaY;
        this.offset = Element.cumulativeOffset(element);
        return (this.ycomp >= this.offset[1] && this.ycomp < this.offset[1] + element.offsetHeight && this.xcomp >= this.offset[0] && this.xcomp < this.offset[0] + element.offsetWidth);
    },
    overlap: function (mode, element) {
        if (!mode) return 0;
        if (mode == 'vertical') return ((this.offset[1] + element.offsetHeight) - this.ycomp) / element.offsetHeight;
        if (mode == 'horizontal') return ((this.offset[0] + element.offsetWidth) - this.xcomp) / element.offsetWidth;
    },
    cumulativeOffset: Element.Methods.cumulativeOffset,
    positionedOffset: Element.Methods.positionedOffset,
    absolutize: function (element) {
        Position.prepare();
        return Element.absolutize(element);
    },
    relativize: function (element) {
        Position.prepare();
        return Element.relativize(element);
    },
    realOffset: Element.Methods.cumulativeScrollOffset,
    offsetParent: Element.Methods.getOffsetParent,
    page: Element.Methods.viewportOffset,
    clone: function (source, target, options) {
        options = options || {};
        return Element.clonePosition(target, source, options);
    }
};
if (!document.getElementsByClassName) document.getElementsByClassName = function (instanceMethods) {
    function iter(name) {
        return name.blank() ? null: "[contains(concat(' ', @class, ' '), ' " + name + " ')]";
    }
    instanceMethods.getElementsByClassName = Prototype.BrowserFeatures.XPath ?
    function (element, className) {
        className = className.toString().strip();
        var cond = /\s/.test(className) ? $w(className).map(iter).join('') : iter(className);
        return cond ? document._getElementsByXPath('.//*' + cond, element) : [];
    }: function (element, className) {
        className = className.toString().strip();
        var elements = [],
        classNames = (/\s/.test(className) ? $w(className) : null);
        if (!classNames && !className) return elements;
        var nodes = $(element).getElementsByTagName('*');
        className = ' ' + className + ' ';
        for (var i = 0, child, cn; child = nodes[i]; i++) {
            if (child.className && (cn = ' ' + child.className + ' ') && (cn.include(className) || (classNames && classNames.all(function (name) {
                return ! name.toString().blank() && cn.include(' ' + name + ' ');
            }))))
            elements.push(Element.extend(child));
        }
        return elements;
    };
    return function (className, parentElement) {
        return $(parentElement || document.body).getElementsByClassName(className);
    };
} (Element.Methods);
Element.ClassNames = Class.create();
Element.ClassNames.prototype = {
    initialize: function (element) {
        this.element = $(element);
    },
    _each: function (iterator) {
        this.element.className.split(/\s+/).select(function (name) {
            return name.length > 0;
        })._each(iterator);
    },
    set: function (className) {
        this.element.className = className;
    },
    add: function (classNameToAdd) {
        if (this.include(classNameToAdd)) return;
        this.set($A(this).concat(classNameToAdd).join(' '));
    },
    remove: function (classNameToRemove) {
        if (!this.include(classNameToRemove)) return;
        this.set($A(this).without(classNameToRemove).join(' '));
    },
    toString: function () {
        return $A(this).join(' ');
    }
};
Object.extend(Element.ClassNames.prototype, Enumerable);
Element.addMethods();
if (!SOUP) var SOUP = {}
SOUP.Public = function () {
    function remote(action, params) {
        var params = (params) ? '&' + params: '';
        var src = 'http://' + SOUP.Public.storefront_url + '/remote/' + action + '?auth=' + SOUP.Public.cookie.get('soup_session_id') + '&blog_id=' + SOUP.Public.blog_id + '&rnd=' + Math.random() + params;
        SOUP.Public.add_script(src);
    }
    function window_width() {
        if (self.innerHeight) {
            return self.innerWidth;
        } else if (document.documentElement && document.documentElement.clientHeight) {
            return document.documentElement.clientWidth;
        } else if (document.body) {
            return document.body.clientWidth;
        }
    }
    function constrain(n, min, max) {
        if (n < min) {
            return min;
        } else if (n > max) {
            return max;
        } else {
            return n;
        }
    }
    return {
        'lasttime': null,
        'storefront_url': null,
        'blog_id': null,
        'reposting_enabled': false,
        'content_width': 500,
        'only_show_repost_to': false,
        'refresh_reposting': function () {
            if (SOUP.Public.reposting_enabled && $('posts')) {
                $A($('posts').getElementsByClassName('post')).each(function (p) {
                    Event.observe(p, 'mouseover', function () {
                        if (SOUP.Public.reposting_enabled) {
                            p.addClassName('over');
                        }
                    });
                    Event.observe(p, 'mouseout', function () {
                        p.removeClassName('over');
                    });
                    if (p.down('ul.repost') && p.down('ul.repost').down('a.repost-button-main') && p.down('ul.repost').down('a.repost-button-to') && SOUP.Public.groups && SOUP.Public.groups.length > 1 && !SOUP.Public.only_show_repost_to) {
                        p.down('ul.repost').down('a.repost-button-main').removeClassName('repost-button-without-to');
                        p.down('ul.repost').down('a.repost-button-to').removeClassName('hidden');
                    }
                });
            }
        },
        'disable_reposting': function () {
            SOUP.Public.reposting_enabled = false;
        },
        'reenable_reposting': function () {
            SOUP.Public.reposting_enabled = SOUP.Public.reposting_previously_enabled;
        },
        'enable_reposting': function (blog_id, storefront_url) {
            SOUP.Public.reposting_previously_enabled = true;
            SOUP.Public.reposting_enabled = true;
            SOUP.Public.enable_remote(blog_id, storefront_url);
            SOUP.Public.refresh_reposting();
        },
        'enable_remote': function (blog_id, storefront_url) {
            if (blog_id && storefront_url) {
                SOUP.Public.blog_id = blog_id;
                SOUP.Public.storefront_url = storefront_url;
            }
        },
        'default_image': function (icon) {
            icon.src = '/images/feed_default.png';
            return false;
        },
        'toggle_friend': function () {
            SOUP.Public.spinner($('btn-friend').down('a'));
            remote('toggle_friend');
            return false;
        },
        'toggle_hidden': function () {
            SOUP.Public.spinner($('btn-hidden').down('a'));
            remote('toggle_hidden');
            return false;
        },
        'toggle_content_warning': function () {
            SOUP.Public.spinner($('btn-content-warning').down('a'));
            remote('toggle_content_warning');
            return false;
        },
        'toggle_spammer': function () {
            SOUP.Public.spinner($('btn-spammer').down('a'));
            remote('toggle_spammer');
            return false;
        },
        'attempt_membership': function (is_member) {
            if (is_member) SOUP.Public.message({
                'message': SOUP.Text.leave_group,
                'class': 'info',
                'buttons': [[SOUP.Text.leave, function () {
                    SOUP.Public.toggle_membership();
                    SOUP.Public.message();
                }], [SOUP.Text.dismiss, function () {
                    SOUP.Public.message();
                }]]
            });
            else SOUP.Public.message({
                'message': SOUP.Text.request_to_join,
                'class': 'info',
                'buttons': [[SOUP.Text.join, function () {
                    SOUP.Public.toggle_membership();
                    SOUP.Public.message();
                }], [SOUP.Text.dismiss, function () {
                    SOUP.Public.message();
                }]]
            });
            return false;
        },
        'toggle_membership': function () {
            if ($('btn-join')) SOUP.Public.spinner($('btn-join').down('a'));
            remote('toggle_membership');
            return false;
        },
        'add_stylesheet': function (url, id) {
            if (!id || !$(id)) {
                var newstylesheet = document.createElement('link');
                if (id) newstylesheet.id = id;
                newstylesheet.className = 'tempstylesheet';
                newstylesheet.setAttribute('rel', 'stylesheet');
                newstylesheet.href = url;
                document.getElementsByTagName("head")[0].appendChild(newstylesheet);
                return newstylesheet;
            }
        },
        'add_script': function (url) {
            var script = document.createElement('script');
            script.setAttribute('src', url)
            document.body.appendChild(script);
        },
        'add_iframe': function (url) {
            var iframe = $(document.createElement('iframe'));
            iframe.setAttribute('src', url);
            iframe.addClassName('hidden');
            document.body.appendChild(iframe);
        },
        'relation_over': function (o) {
            $(o).addClassName('over');
        },
        'relation_out': function (o) {
            $(o).removeClassName('over');
        },
        'relation_toggle': function (o, userid, relation_type) {
            var relation_form = $(o).up('form');
            relation_form['relation_id'].value = userid;
            if (relation_type) relation_form['relation_type'].value = relation_type;
            var container = relation_form.up('.xhr-container');
            if (relation_form.hasClassName('xhr')) {
                new Ajax.Updater(container, relation_form.getAttribute('action'), {
                    asynchronous: true,
                    evalScripts: true,
                    parameters: relation_form.serialize(),
                    onLoading: function () {
                        SOUP.Public.spinner(o);
                    },
                    onSuccess: function () {
                        if (relation_type == 'ignore' && !$(o).up().hasClassName('true')) {
                            $A($('posts').getElementsByClassName('authorid-' + userid)).each(function (p) {
                                p.hide();
                            });
                        }
                    }
                });
            } else {
                relation_form.submit();
            }
            return false;
        },
        'search_cancel': function () {
            SOUP.Public.switch_panel_vertical($('pagebody').down('.switchable').down());
            var dl = document.location;
            var viewing_search_results = (dl.href.indexOf('/search') > -1 || dl.search.match(/search=.+/)) ? true: false;
            return viewing_search_results;
        },
        'log_event': function (eventname, data) {
            if (SOUP.Public.environment != "production") return;
            data = $H(data);
            new Ajax.Request('/log_event/' + eventname, {
                method: 'post',
                parameters: {
                    'data': data.toJSON()
                }
            });
        },
        'resize_elements': function (container) {
            var max = SOUP.Public.content_width || $(container).offsetWidth;
            var tags = ['embed', 'object', 'iframe', 'img'];
            $A(tags).each(function (t) {
                $A(container.getElementsByTagName(t)).each(function (el) {
                    if (el.offsetWidth > max) {
                        var ratio = max / el.offsetWidth;
                        var orig_height = el.offsetHeight;
                        el.style.width = max + 'px';
                        el.style.height = orig_height * ratio + 'px';
                    }
                });
            });
        },
        'fixup': function (o) {
            SOUP.Public.fixup_timezone(o, true);
            SOUP.Public.fixup_links(o);
            SOUP.Public.fixup_imagewidth(o);
        },
        'fixup_imagewidth': function (o) {
            $A(o.getElementsByClassName('post_regular')).each(function (p) {
                SOUP.Public.resize_elements(p);
            });
        },
        'fixup_timezone': function (o, fixup_posts) {
            var make_date_node = function (className, value) {
                return new Element('span', {
                    'class': className
                }).update(value);
            }
            var formatters = {
                'm': function (date) {
                    return make_date_node(SOUP.Text.date_styles['m'], SOUP.Text.months[date.getMonth()])
                },
                'd': function (date) {
                    return make_date_node(SOUP.Text.date_styles['d'], date.getDate())
                },
                'y': function (date) {
                    return make_date_node(SOUP.Text.date_styles['y'], date.getFullYear())
                }
            };
            if ($(o)) {
                var elts = $(o).getElementsByClassName('time');
                var hidden = false;
                $A(elts).each(function (e) {
                    e.up().up().adjacent('h2.date').each(function (elt) {
                        hidden = elt.hasClassName('hidden');
                        elt.remove();
                    });
                });
                var lasttime = null;
                $A(elts).each(function (p) {
                    var abbr = p.down('abbr');
                    var time = new Date(abbr.title);
                    if (fixup_posts) lasttime = SOUP.Public.lasttime;
                    if (lasttime == null || lasttime.getDate() != time.getDate()) {
                        var header = new Element('h2', {
                            'class': 'date'
                        });
                        if (hidden) header.addClassName('hidden');
                        $A(SOUP.Text.date_format).each(function (elt) {
                            header.appendChild(formatters[elt](time));
                            header.appendChild(document.createTextNode(' '));
                        });
                        var post = p.up().up();
                        var placeholder = null;
                        if ((placeholder = post.previous()) && placeholder.identify() == 'new-today') {
                            post = placeholder;
                        }
                        post.insert({
                            'before': header
                        });
                    }
                    if (fixup_posts) SOUP.Public.lasttime = time;
                    else lasttime = time;
                    var tmp = '';
                    if (time.getHours() < 10) tmp += '0';
                    tmp += time.getHours();
                    tmp += ':';
                    if (time.getMinutes() < 10) tmp += '0';
                    tmp += time.getMinutes();
                    p.down('abbr').update(tmp);
                });
            }
        },
        'fixup_links': function (element) {
            if (!element) return;
            $A($(element).select('a')).each(function (elt) {
                if (!elt.onclick || elt.onclick == '') {
                    elt.observe('click', function (ev) {
                        if (Prototype.Browser.IE || ev.isLeftClick()) {
                            window.open(elt.href);
                            ev.stop();
                        }
                    });
                }
            });
        },
        'bubble_hovering': false,
        'bubble_object': false,
        'bubble_currently_loading': false,
        'bubble': function (o, options) {
            var bubble, offset, width, left, bubble_width, bitoffset, img, container;
            options = options || {}
            bubble = $('bubble');
            if (bubble) {
                if (!o) {
                    setTimeout(function () {
                        if (!SOUP.Public.bubble_hovering && !SOUP.Public.bubble_object) bubble.style.display = 'none';
                    },
                    300);
                } else {
                    if (!o.down) Element.extend(o);
                    var preview_bubble = o.down('.bubble'),
                    preview_link;
                    if (preview_bubble.hasClassName('lazy_load') && (preview_link = preview_bubble.down('a.preview'))) {
                        SOUP.Public.bubble_currently_loading = preview_link;
                        var preview_content = preview_link.up();
                        preview_link.remove();
                        new Ajax.Request(preview_link.href, {
                            method: 'get',
                            onSuccess: function (response) {
                                o.down('.bubble').removeClassName('lazy_load');
                                preview_content.removeClassName('state-spinner');
                                preview_content.innerHTML = response.responseText;
                                if (preview_link == SOUP.Public.bubble_currently_loading) $('bubblepost').update(preview_content.innerHTML);
                                SOUP.Public.fixup_links($('bubblepost'));
                            },
                            onFailure: function (foo) {
                                previewContent.insert(previewLink);
                            }
                        });
                    }
                    $(o).onmouseout = function () {
                        SOUP.Public.bubble();
                    };
                    SOUP.Public.bubble_object = o;
                    setTimeout(function () {
                        if (SOUP.Public.bubble_object == o) SOUP.Public.bubble_object = false;
                    },
                    310);
                    if (o.up) {
                        bubble.className = '';
                        if (!options.classname && o.up('.post')) options.classname = 'wide';
                        if (options.classname) bubble.addClassName(options.classname);
                        bubble.style.display = 'none';
                        $('bubblepost').update(o.down('.bubble').innerHTML);
                        SOUP.Public.fixup_links($('bubblepost'));
                    }
                    origin = options.origin || o;
                    width = window_width();
                    offset = Position.cumulativeOffset(origin);
                    bubble_width = (options.classname && options.classname == 'wide') ? 400 : 250;
                    left = constrain(offset[0] + Math.round(origin.offsetWidth / 2) - bubble_width / 2, 10, width - bubble_width - origin.offsetWidth - 6);
                    bitoffset = offset[0] + Math.round(origin.offsetWidth / 2) - left - 7;
                    $('bubblebit').style.backgroundPosition = bitoffset + 'px 0';
                    bubble.setStyle({
                        'left': left + 'px',
                        'top': offset[1] + origin.offsetHeight + 5 + 'px',
                        'display': 'block'
                    });
                }
            }
        },
        'bubble_over': function () {
            SOUP.Public.bubble_hovering = true;
        },
        'bubble_out': function () {
            SOUP.Public.bubble_hovering = false;
            SOUP.Public.bubble();
        },
        'reaction_toggle_original': function (o) {
            var preview_bubble = $(o).up('li').down('.original');
            if (!preview_bubble.hasClassName('hidden')) {
                preview_bubble.addClassName('hidden');
                o.up('li').removeClassName('original_link_open');
                return;
            }
            o.up('li').addClassName('original_link_open');
            preview_bubble.removeClassName('hidden');
            if (preview_bubble.hasClassName('lazy_load')) {
                var preview_link = preview_bubble.down('a.preview');
                preview_link.remove();
                var content_width = preview_bubble.down('div.content_width_dummy').getWidth();
                var request_url = preview_link.href + '/' + content_width;
                new Ajax.Request(request_url, {
                    method: 'get',
                    onSuccess: function (response) {
                        preview_bubble.removeClassName('lazy_load');
                        preview_bubble.update(response.responseText);
                        preview_bubble.removeClassName('state-spinner');
                        SOUP.Public.fixup_links(preview_bubble);
                    },
                    onFailure: function (foo) {
                        preview_bubble.insert(preview_link);
                    }
                });
            }
        },
        'repost': function (btn, post_id, target_id) {
            var params = 'repostid=' + post_id;
            if (target_id) params += '&target_id=' + target_id;
            remote('repost', params);
            btn.innerHTML = SOUP.Text.reposting;
            btn.up('li').addClassName('state_reposted');
            btn.up('ul').addClassName('state_reposted');
            btn.addClassName('repost-button-without-to');
            SOUP.Public.close_repost_to();
            SOUP.Public.repost_id = false;
        },
        'close_repost_to': function () {
            if (SOUP.Public.repost_id) {
                if ($('post' + SOUP.Public.repost_id)) $('post' + SOUP.Public.repost_id).toggleClassName('state-repost-to');
                $('repost-to').style.display = 'none';
            }
        },
        'repost_to': function (o, post_id) {
            SOUP.Public.close_repost_to();
            if (post_id == SOUP.Public.repost_id) {
                SOUP.Public.repost_id = false;
                return false;
            } else if ($('repost-to')) {
                $('post' + post_id).toggleClassName('state-repost-to');
                $('repost-to').style.display = ($('repost-to').style.display == 'none') ? 'block': 'none';
            } else {
                o.up('.post').addClassName('state-repost-to');
                var ul = new Element('ul', {
                    'id': 'repost-to'
                });
                if (SOUP.Public.groups) {
                    SOUP.Public.groups.each(function (g) {
                        var li = new Element('li');
                        var a = new Element('a', {
                            'href': '#',
                            'data-user-id': g[0]
                        }).update(g[1]);
                        a.style.backgroundImage = 'url(' + g[2] + ')';
                        a.onclick = function () {
                            SOUP.Public.repost($('post' + SOUP.Public.repost_id).down('.repost-button-main'), SOUP.Public.repost_id, g[0]);
                            return false;
                        };
                        li.insert(a);
                        ul.insert(li);
                    });
                }
                document.body.appendChild(ul);
            }
            SOUP.Public.repost_id = post_id;
            var rbt = o.down('.repost-button-to') || o.down();
            var offset = rbt.cumulativeOffset();
            $('repost-to').style.left = offset[0] + 'px';
            $('repost-to').style.top = offset[1] + rbt.offsetHeight + 'px';
            return false;
        },
        'react': function (btn, iframe_url) {
            if (btn.up('li').hasClassName('state_new_reaction')) {
                SOUP.Public.close_react(null);
                return;
            }
            var elem = $$('li.state_share')[0];
            if (elem) {
                addthis_close();
                elem.removeClassName('state_share');
                elem.up('ul').removeClassName('state_share');
            }
            var elem = $$('li.state_new_reaction')[0];
            if (elem) {
                elem.removeClassName('state_new_reaction');
                elem.up('ul').removeClassName('state_new_reaction');
                $('reaction_iframe_container').style.display = 'none';
            }
            SOUP.Public.close_repost_to();
            SOUP.Public.repost_id = false;
            btn.up('li').addClassName('state_new_reaction');
            btn.up('ul').addClassName('state_new_reaction');
            $('reaction_iframe_container').update('<iframe src="' + iframe_url + '" width="448" height="348" scrolling="auto" id="reaction_iframe"></iframe>');
            $('reaction_iframe_container').style.display = 'block';
            $('reaction_iframe_container').style.zIndex = 60;
            $('reaction_iframe_container').style.top = btn.cumulativeOffset()[1] + btn.getHeight() + 'px';
            $('reaction_iframe_container').style.left = btn.cumulativeOffset()[0] + parseInt(btn.getWidth() / 2) + 'px';
            $('actionbar_arrow_up').style.display = 'block';
            $('actionbar_arrow_up').style.top = btn.cumulativeOffset()[1] + btn.getHeight() + 'px';
            $('actionbar_arrow_up').style.left = btn.cumulativeOffset()[0] + parseInt(btn.getWidth() / 2) + 'px';
        },
        'close_react': function (permalink) {
            var reaction_div = $('reaction_iframe_container');
            var btn = $$('li.state_new_reaction')[0].down('a');
            btn.up('li').removeClassName('state_new_reaction');
            btn.up('ul').removeClassName('state_new_reaction');
            reaction_div.style.display = 'none';
            $('actionbar_arrow_up').style.display = 'none';
            var mouse_over_elem = btn.up('div.over');
            if (mouse_over_elem) mouse_over_elem.removeClassName('over');
            if (permalink) {
                btn.up('li').addClassName('state_reaction_created');
                btn.innerHTML = SOUP.Text.reaction_created;
                btn.href = permalink;
                btn.onclick = function () {
                    return true;
                }
            }
        },
        'share': function (btn, post_url, post_title) {
            if (btn.up('li').hasClassName('state_share')) {
                addthis_close();
                return;
            }
            $('actionbar_arrow_up').style.display = 'none';
            SOUP.Public.log_event('share_open');
            $$('.state_share').invoke('removeClassName', 'state_share');
            var elem = $$('li.state_new_reaction')[0];
            if (elem) {
                elem.removeClassName('state_new_reaction');
                elem.up('ul').removeClassName('state_new_reaction');
                $('reaction_iframe_container').style.display = 'none';
            }
            btn.up('li').addClassName('state_share');
            btn.up('ul').addClassName('state_share');
            var orig_atw_clo = _atw.clo;
            _atw.clo = function () {
                orig_atw_clo();
                btn.up('li').removeClassName('state_share');
                btn.up('ul').removeClassName('state_share');
                $('actionbar_arrow_up').style.display = 'none';
            };
            addthis_close = function () {
                SOUP.Public.log_event('share_close');
                _atw.clo();
            };
            addthis_open(btn, '', post_url, post_title);
            $('at15s').onmouseout = null;
            $('at15s').style.zIndex = 60;
            $('at15s').style.top = btn.cumulativeOffset()[1] + btn.getHeight() + 10 + 'px';
            $('at15s').style.left = btn.cumulativeOffset()[0] + parseInt(btn.getWidth() / 2) - 115 + 'px';
            $('actionbar_arrow_up').style.display = 'block';
            $('actionbar_arrow_up').style.top = btn.cumulativeOffset()[1] + btn.getHeight() + 'px';
            $('actionbar_arrow_up').style.left = btn.cumulativeOffset()[0] + parseInt(btn.getWidth() / 2) + 'px';
        },
        'dropdown_active': null,
        'dropdown_click': function (e) {
            var o = Event.element(e);
            if ('A' == o.tagName && '#' != o.href && '' != o.href && window.location.href != o.href && (window.location.href + '#') != o.href) return true;
            else if (!o.hasClassName('.dropdown')) o = o.up('.dropdown');
            SOUP.Public.dropdown_active = o;
            if ($(o).hasClassName('over') && !o._timeout_open) {
                $(o).removeClassName('over');
                $(o).onmouseover = function () {
                    SOUP.Public.dropdown(o)
                };
                Event.stopObserving($(o).down('.dropdown_head'), 'click', SOUP.Public.dropdown_click);
            } else {
                o.onmouseout = null;
                o.onmouseover = null;
                if (o._timeout_open) {
                    clearTimeout(o._timeout_open);
                    o._timeout_open = null;
                    Event.stopObserving(document, 'mousemove', SOUP.Public.dropdown_getcords);
                }
                $(o).addClassName('over');
            }
            return false;
        },
        'dropdown': function (o) {
            var head = $(o).down('.dropdown_head');
            Event.observe(head, 'click', SOUP.Public.dropdown_click);
            o._timeout_open = setTimeout(function () {
                SOUP.Public.dropdown_active = o;
                Event.observe(document, 'mousemove', SOUP.Public.dropdown_getcords);
                $(o).addClassName('over');
            },
            100);
            o.onmouseout = function () {
                if (o._timeout_open) clearTimeout(o._timeout_open);
                o._timeout_open = null;
            }
        },
        'dropdown_getcords': function (e) {
            if (SOUP.Public.dropdown_active) {
                var o1 = $(SOUP.Public.dropdown_active);
                var o2 = o1.down('.dropdown_body');
                if (!SOUP.Public.mouse_is_over(e, o1, o2)) {
                    o1.removeClassName('over');
                    SOUP.Public.dropdown_active = null;
                    Event.stopObserving(document, 'mousemove', SOUP.Public.dropdown_getcords);
                }
            }
        },
        'dropdown_claim': function (o) {
            if (SOUP.Public.cookie.get('soup_tutorial') == 10) SOUP.Admin.tutorial.step( - 1);
            if (!$(o).hasClassName('.dropdown')) o = $(o).up('.dropdown');
            SOUP.Public.dropdown_active = o;
            if ($(o).hasClassName('over')) {
                SOUP.Public.log_event('claim_form_hide');
                $(o).down('div').removeClassName('over');
                $(o).removeClassName('over');
            } else {
                SOUP.Public.log_event('claim_form_show');
                $(o).addClassName('over');
                $(o).down('div').addClassName('over');
            }
            return false;
        },
        'disable_claim_submit_button': function () {
            $('submit-claim').disabled = true;
            $('submit-claim').addClassName('state-spinner');
        },
        'enable_claim_submit_button': function () {
            $('submit-claim').disabled = false;
            $('submit-claim').removeClassName('state-spinner');
        },
        'mouse_is_over': function (event, any_number_of_html_elements) {
            var scrollx = window.scrollX || document.documentElement.scrollLeft || document.body.scrollLeft;
            var scrolly = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
            var mousepos = [Event.pointerX(event) - scrollx, Event.pointerY(event) - scrolly];
            for (var i = 1; i < arguments.length; i++) {
                var o = arguments[i];
                var offset = Element.cumulativeOffset($(o));
                offset.left = $(o).positionedOffset()[0] + $(o).getOffsetParent().offsetLeft;
                var dims = $(o).getDimensions();
                var tolerance = 0;
                var bounds = [[offset.left - tolerance, offset.top - tolerance], [offset.left + dims.width + tolerance, offset.top + dims.height + tolerance]];
                if (mousepos[0] > bounds[0][0] && mousepos[1] > bounds[0][1] && mousepos[0] < bounds[1][0] && mousepos[1] < bounds[1][1]) return true;
            }
        },
        'message_last_params': null,
        'message': function (params) {
            var div;
            if (params == SOUP.Public.message_last_params) return;
            SOUP.Public.message_last_params = params;
            if (params && params['message'] != '') {
                if (!$('admin-message')) {
                    div = document.createElement('div');
                    div.id = 'admin-message';
                    document.body.appendChild(div);
                    new Fx.Style(div, 'opacity', {
                        duration: 500
                    })._start(0, .9);
                } else {
                    div = $('admin-message');
                    div.style.display = 'block';
                }
                div.innerHTML = params['message'];
                if (params['buttons']) {
                    $A(params['buttons']).each(function (b) {
                        var btn = document.createElement('a');
                        if (typeof b[1] == "function") {
                            btn.href = '#';
                            btn.onclick = b[1];
                        } else {
                            btn.href = b[1];
                        }
                        btn.innerHTML = b[0];
                        div.appendChild(btn);
                    });
                }
                div.className = params['class'];
                if (params['class'] == 'flash') {
                    setTimeout(function () {
                        new Fx.Style(div, 'opacity', {
                            duration: 500
                        })._start(.9, 0);
                    },
                    2000);
                    setTimeout(function () {
                        div.style.display = 'none';
                        reset_opacity(div);
                    },
                    2500);
                }
            } else {
                if ($('admin-message')) $('admin-message').style.display = 'none';
            }
        },
        'checkbox_list_initialize': function (list) {
            list.select('li').each(function (item) {
                item.removeClassName('checked');
                if (item.down('input').checked) {
                    item.addClassName('checked');
                }
            });
        },
        'checkbox_list_select': function (list, select_fnc) {
            list.select('li').each(function (item) {
                item.down('input').checked = select_fnc(item);
            });
            SOUP.Public.checkbox_list_initialize(list);
            return false;
        },
        'flashwrite': function (str) {
            document.write(str)
        },
        'first_link': function (o) {
            var a = (o.nodeName == 'A') ? o: $(o).down('a');
            window.location.href = a.href;
        },
        'first_field': function (o) {
            var f = (o.nodeName == 'INPUT' || o.nodeName == 'TEXTAREA') ? o: ($(o).down('input') || $(o).down('textarea'));
            return f;
        },
        'focus': function (o) {
            var f = $(o).hasClassName('focus') ? o: o.down('.focus');
            if (!f) f = SOUP.Public.first_field(o);
            if (f) {
                if (f.nodeName == 'IFRAME') {
                    f.contentWindow.document.body.focus();
                } else {
                    try {
                        f.focus();
                    } catch(e) {}
                }
            }
        },
        'lightbox': function (url, callback) {
            var l = $('lightbox');
            var lbg = $('lightbox-bg');
            lbg.style.display = 'block';
            l.style.display = 'block';
            if (url) l.style.backgroundImage = 'url(' + url + ')';
            l.onclick = function () {
                if (callback != undefined) callback();
                lbg.hide();
                l.style.backgroundImage = '';
                l.hide();
            };
            return false;
        },
        'fadeout': function (id) {
            var delay = 3000;
            var duration = 1000;
            setTimeout(function () {
                if ($(id)) new Fx.Style($(id), 'opacity', {
                    duration: duration
                })._start(1, 0);
            },
            delay);
            setTimeout(function () {
                if ($(id)) $(id).remove();
            },
            delay + duration + 50);
        },
        'spinner': function (o) {
            var o2 = ($(o).down('.spinner-container')) ? $(o).down('.spinner-container') : $(o);
            o2.addClassName('state-spinner');
        },
        'toggle': function (o, c, start, end) {
            if (o.hasClassName(c)) {
                o.removeClassName(c);
                return {
                    direction: 0,
                    from: end,
                    to: start
                }
            } else {
                o.addClassName(c);
                return {
                    direction: 1,
                    from: start,
                    to: end
                }
            }
        },
        'switch_panel': function (o) {
            var container = $(o).up('.switchable');
            var sub1 = container.down('.switchable1');
            var sub2 = container.down('.switchable2');
            if (!container.hasClassName('switchable_switched')) {
                sub1.style.position = 'relative';
                sub2.style.opacity = 0;
                new Fx.Style(sub1, 'left', {
                    duration: 500
                })._start(0, -sub1.offsetWidth);
                setTimeout(function () {
                    SOUP.Public.toggle(container, 'switchable_switched');
                    container.style.height = 'auto'
                },
                500);
                setTimeout(function () {
                    new Fx.Style(sub2, 'opacity', {
                        duration: 300
                    })._start(0, 1);
                },
                600);
            } else {
                sub1.style.position = 'static';
                SOUP.Public.toggle(container, 'switchable_switched');
            }
            return false;
        },
        'switch_panel_vertical': function (o) {
            var container = $(o).up('.switchable');
            var sub1 = container.down('.switchable1');
            var sub2 = container.down('.switchable2');
            var height = container.offsetHeight;
            var padding = 19;
            if (!container.hasClassName('switchable_switched2')) {
                sub1.style.position = 'relative';
                sub1.style.height = height + 'px';
                sub2.style.position = 'relative';
                sub2.style.height = height + 'px';
                container.style.height = height - padding + 'px';
                sub2.style.display = 'block';
                new Fx.Style(sub1, 'marginTop', {
                    duration: 200
                })._start(0, -height - padding);
                SOUP.Public.toggle(container, 'switchable_switched2');
            } else {
                new Fx.Style(sub1, 'marginTop', {
                    duration: 200
                })._start( - height - padding, 0);
                SOUP.Public.toggle(container, 'switchable_switched2');
            }
            return false;
        },
        'image_caption': function (o) {
            var caption = $(o).down('.caption');
            if (caption) {
                o.addClassName('state-caption');
                o.onmouseout = function () {
                    o.removeClassName('state-caption');
                }
            }
        },
        'gallery_switch': function (o, post_id, permalink) {
            var previously_selected = $(o).up('.gallery-thumbs').down('.sel');
            if (previously_selected) previously_selected.removeClassName('sel');
            o.addClassName('sel');
            var images = o.up('div.gallery').down('div.gallery-images');
            if (images.down('div.sel')) images.down('div.sel').removeClassName('sel');
            var post_container = images.down('#post' + post_id);
            post_container.addClassName('sel');
            if (post_container.hasClassName('lazy_load')) {
                var preview_link = post_container.down('a.preview');
                var request_url = preview_link.href;
                new Ajax.Request(request_url, {
                    method: 'get',
                    onSuccess: function (response) {
                        preview_link.remove();
                        post_container.removeClassName('lazy_load');
                        post_container.down('.state-spinner').remove();
                        post_container.innerHTML = response.responseText;
                    }
                });
            }
            post_div = o.up('div.post');
            var attribution = post_div.down('div.meta div.attribution a');
            if (attribution == null) attribution = post_div.down('div.meta div.type a');
            if (attribution) attribution.href = permalink;
        },
        'cookie': {
            'set': function (name, value, expires, path, domain, secure) {
                if (expires == '') expires = new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000);
                document.cookie = name + '=' + escape(value) + ((expires) ? '; expires=' + expires.toGMTString() : '') + ((path) ? '; path=' + path: '') + ((domain) ? '; domain=' + domain: '') + ((secure) ? '; secure': '');
                return false;
            },
            'del': function (name) {
                SOUP.Public.cookie.set(name, '', new Date(new Date().getTime() - 1000));
            },
            'get': function (name) {
                var dc = document.cookie;
                var prefix = name + "=";
                var begin = dc.indexOf("; " + prefix);
                if (begin == -1) {
                    begin = dc.indexOf(prefix);
                    if (begin != 0) return null;
                } else {
                    begin += 2;
                }
                var end = document.cookie.indexOf(";", begin);
                if (end == -1) {
                    end = dc.length;
                }
                return unescape(dc.substring(begin + prefix.length, end));
            }
        },
        'browser': {
            'IEversion': function () {
                var uam = navigator.userAgent.match(/MSIE ([0-9])\./);
                return (uam ? uam[1] : null);
            }
        }
    };
} ();
if (!SOUP) var SOUP = {};
if (/WebKit/i.test(navigator.userAgent)) {
    SOUP.onloadevent = 'load';
} else if (/Gecko|Opera/i.test(navigator.userAgent)) {
    SOUP.onloadevent = 'DOMContentLoaded';
} else {
    SOUP.onloadevent = 'load';
}
if (SOUP.onloadevent) Event.observe(window, SOUP.onloadevent, function () {
    SOUP.Bookmarklet.init()
});
TabControl = function (control_id, options) {
    var id = "#" + control_id;
    var isVisible = function (elt) {
        do {
            if ($(elt).getStyle('display') == 'none') return false;
        } while (document.body != (elt = $(elt.up())))
        return true;
    };
    $$(id + ' ul.tabs li a').each(function (a) {
        var page = a.getAttribute('href').match(/[-_\w]+$/i)[0];
        if (page != options['current']) {
            $(page).hide()
        }
        else {
            $(a.parentNode).addClassName('active')
        }
        Event.observe(a, 'click', function (e) {
            $$(id + ' ul.tabs li.active').each(function (e) {
                e.removeClassName('active');
            })
            $$(id + ' .tab_page[id!=' + page + ']').each(function (e) {
                e.hide()
            });
            $(a.parentNode).addClassName('active');
            $(page).show();
            var to_focus = $(page).down('.focus');
            if (to_focus && isVisible(to_focus)) {
                to_focus.focus();
            }
            if (page == 'image' && $('images')) $('images').scrollTop = $('images').down('.sel').offsetTop;
            Event.stop(e);
            return false;
        });
    });
}
SOUP.Bookmarklet = function () {
    return {
        'init': function () {
            if (!$('header').down('.sel')) return;
            TabControl('tab-control', {
                current: (document.location.href.match(/#([-_\w]+)$/) || []).last() || $A($('header').getElementsByClassName('sel'))[0].id.replace('tab_', '')
            });
            if ($('images')) SOUP.Bookmarklet.images();
            widgInit();
        },
        'images': function () {
            $('images').select('div').each(function (d, i) {
                d.onclick = SOUP.Bookmarklet.select_image;
            });
            $('images').scrollTop = $('images').down('.sel').offsetTop;
        },
        'select_image': function (e) {
            var e = e || window.event;
            var o = this;
            if (e && (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey)) {
                o.toggleClassName('sel');
                SOUP.Bookmarklet.update_image_urls();
            } else {
                $$('#image #post_url')[0].value = escape(o.firstChild.src);
                $A($('images').getElementsByTagName('div')).each(function (d) {
                    d.removeClassName('sel');
                });
                o.addClassName('sel');
            }
        },
        'update_image_urls': function () {
            var v = $A($('images').getElementsByClassName('sel')).collect(function (o) {
                return escape(o.firstChild.src);
            }).join(',');
            $$('#image #post_url')[0].value = v;
        },
        'show_throbber': function () {
            $('tab-control').hide();
            $('throbber').style.display = 'block';
        }
    };
} ();
if (!SOUP) var SOUP = {}
if (/WebKit/i.test(navigator.userAgent)) {
    SOUP.onloadevent = 'load';
} else if (/Gecko|Opera/i.test(navigator.userAgent)) {
    SOUP.onloadevent = 'DOMContentLoaded';
} else {
    SOUP.onloadevent = 'load';
}
if (SOUP.onloadevent) Event.observe(window, SOUP.onloadevent, function () {
    SOUP.Admin.init()
});
SOUP.Admin = function () {
    this.toggle_functions = function (o, c, fn_on, fn_off) {
        if (!o.hasClassName) Element.extend(o);
        if (!o.hasClassName(c)) {
            o.addClassName(c);
            if (fn_on) fn_on(o);
        } else {
            o.removeClassName(c);
            if (fn_off) fn_off(o);
        }
        return false;
    }
    function copy_font_styles(o, n) {
        Element.setStyle(n, {
            'fontFamily': Element.getStyle(o, 'fontFamily'),
            'fontSize': Element.getStyle(o, 'fontSize'),
            'lineHeight': Element.getStyle(o, 'lineHeight'),
            'letterSpacing': Element.getStyle(o, 'letterSpacing'),
            'fontWeight': Element.getStyle(o, 'fontWeight'),
            'fontStyle': Element.getStyle(o, 'fontStyle'),
            'color': Element.getStyle(o, 'color')
        });
    }
    function measure(o) {
        var clone = Element.extend(document.createElement('div'));
        if (o.getStyle) copy_font_styles(o, clone);
        clone.setStyle({
            'position': 'absolute',
            'right': 0,
            'top': 0,
            'border': '1px solid red',
            'visibility': 'hidden'
        });
        document.body.appendChild(clone);
        if (o.nodeName == '#document') {
            copy_font_styles(o.body, clone);
            var width = o.body.offsetWidth;
            if (width >= 20) width = width - 20;
            clone.style.width = width + 'px';
            clone.innerHTML = o.body.innerHTML;
            var height = clone.offsetHeight;
            clone.remove();
            return height;
        } else if (o.nodeName == 'TEXTAREA') {
            clone.style.width = (o.offsetWidth - 20) + 'px';
            clone.innerHTML = o.value.replace(/</g, '&lt;').replace(/\r?\n$/, '<br />X').replace(/\r?\n/g, '<br />');
            var height = clone.offsetHeight;
            clone.remove();
            return height;
        } else if (o.nodeName == 'INPUT') {
            clone.style.overflow = 'hidden';
            if (o.value) {
                clone.innerHTML = o.value;
                var width = clone.offsetWidth;
            }
            clone.remove();
            return width;
        }
    }
    function new_post_form() {
        var form = $('new-future').down('form');
        if (!form) form = $('new-today').down('form');
        return form;
    }
    function reset_opacity(o) {
        o.style.opacity = 1;
        if (o.filters) o.filters.alpha.opacity = 100;
    }
    function ceil(n, max) {
        if (n < 0) {
            return max + n;
        } else if (n >= max) {
            return n - max;
        } else {
            return n;
        }
    }
    function set_enabledness_of_form_fields(container, enabled) {
        var tags = ['input', 'textarea', 'select'];
        if ($A(tags).indexOf(container.tagName.toLowerCase()) > -1) {
            enabled ? container.enable() : container.disable();
        } else {
            $A(tags).each(function (t) {
                $A(container.getElementsByTagName(t)).each(function (el) {
                    enabled ? $(el).enable() : $(el).disable();
                });
            });
        }
    }
    return {
        'styles_for_block': {},
        'hash': null,
        'isIE': null,
        'init': function () {
            SOUP.Admin.isIE = !(/WebKit|Gecko|Opera/i.test(navigator.userAgent));
            SOUP.Admin.tutorial.step();
            var h = document.location.hash.substring(1);
            SOUP.Admin.hash = h;
            if (h.indexOf('new_') == 0) {
                SOUP.Admin.new_start();
                var posttype = h.substring(4);
                new Ajax.Request('/new/' + posttype, {
                    asynchronous: true,
                    evalScripts: true
                });
            } else if (h == 'new') {
                SOUP.Admin.menu_new($('btn-new').down('a'));
            } else if (h == 'panel') {
                SOUP.Admin.menu_open();
            } else if (h == 'edit') {
                SOUP.Admin.edit_toggle();
            } else if (h.indexOf('edit=') == 0) {
                var postid = h.split('=')[1];
                SOUP.Admin.post_edit_toggle(postid);
            }
            if ($('posts')) {
                $('posts').getElementsBySelector('.post').each(function (p) {
                    if (p.down('.content')) {
                        Event.observe(p.down('.content'), 'dblclick', function () {
                            if ($(document.body).hasClassName('edit')) SOUP.Admin.post_edit_toggle(p.id.replace('post', ''));
                        });
                    }
                });
            }
            if ($('admin-panel')) {
                var openidx = SOUP.Public.cookie.get('panel') || 1;
                $A($('admin-panel').getElementsByClassName('admin-section')).each(function (section, i) {
                    section.minheight = (section.offsetHeight > 0) ? section.offsetHeight: 130;
                    if (i == openidx) {
                        section.addClassName('sel');
                    } else {
                        section.down('.admin-container').style.display = 'none';
                    }
                });
                if ($('admin-bookmarklet-instructions')) $('admin-bookmarklet-instructions').update(SOUP.Text['bookmarklet']);
                SOUP.Admin.skin_scroll(0);
            }
            if (!$$('body')[0].hasClassName('disable-backup-message') && SOUP.Public.cookie.get('backup')) {
                SOUP.Public.message({
                    'message': SOUP.Text.unsaved_detected,
                    'buttons': [[SOUP.Text.unsaved_restore, function () {
                        return SOUP.Admin.backup_restore()
                    }], [SOUP.Text.unsaved_discard, function () {
                        return SOUP.Admin.backup_discard()
                    }]]
                });
            }
        },
        'menu_new_button': null,
        'menu_new': function (o) {
            SOUP.Public.log_event('post_type_selector_open');
            if (SOUP.Public.cookie.get('soup_tutorial') == 1) SOUP.Admin.tutorial.step(2);
            SOUP.Admin.edit_cancel();
            if ($('btn-options')) SOUP.Admin.panel_cancel();
            if (!o.id) o.id = 'menu_new_buttonTempId';
            SOUP.Admin.menu_new_button = {
                o: o,
                onc: o.onclick
            };
            o.onclick = function () {
                return false
            };
            var o2 = (o.nodeName == 'LI') ? o: o.parentNode;
            $(o2).addClassName('sel');
            $('admin').addClassName('state_new');
            $('admin-new').style.display = 'block';
            new Fx.Style('admin-new', 'opacity', {
                duration: 400
            })._start(0, .9);
            setTimeout("document.body.onclick = function() { SOUP.Admin.menu_new_end($('btn-new')); }", 0);
            return false;
        },
        'menu_new_end': function (o) {
            SOUP.Public.log_event('post_type_selector_close');
            SOUP.Admin.menu_new_button.o.onclick = SOUP.Admin.menu_new_button.onc;
            var anim = SOUP.Public.toggle(o, 'sel', 0, .9);
            new Fx.Style('admin-new', 'opacity', {
                duration: 200
            })._start(anim.from, anim.to);
            setTimeout(function () {
                $('admin-new').style.display = 'none';
                $('admin').removeClassName('state_new');
            },
            200);
            document.body.onclick = null;
        },
        'new_start': function () {
            if (SOUP.Public.cookie.get('soup_tutorial') == 2) SOUP.Admin.tutorial.step(3);
            $('new-future').innerHTML = '<div style="text-align:center; margin-top:1em"><img src="/images/throbber.gif" /></div>';
            SOUP.Public.disable_reposting();
            SOUP.Admin.backup_interval = new PeriodicalExecuter(SOUP.Admin.backup, 3);
        },
        'new_cancel': function () {
            $('new-future').innerHTML = '';
            $('new-today').innerHTML = '';
            SOUP.Public.reenable_reposting();
            SOUP.Admin.backup_stop();
            return false;
        },
        'menu_sub_last_pos': null,
        'menu_coords': [ - 244, -244 + 6, 0],
        'menu_durations': [250, 500, 400],
        'menu_sub': function (o, from_index, skip) {
            if (SOUP.Public.cookie.get('soup_tutorial') == 8) SOUP.Admin.tutorial.step(9);
            skip = skip || 0;
            if ($('colorpicker')) $('colorpicker').style.display = 'none';
            if (o) {
                var o2 = (o.nodeName == 'LI') ? o: o.parentNode;
                var anim = SOUP.Public.toggle($(o2), 'sel');
            } else {
                var anim = {
                    direction: 0
                };
            }
            SOUP.Public.log_event(anim.direction == 0 ? 'admin_panel_close': 'admin_panel_open');
            var from_position = (SOUP.Admin.menu_sub_last_pos == undefined) ? SOUP.Admin.menu_coords[0] : SOUP.Admin.menu_sub_last_pos;
            if (anim.direction == 0 && from_index == 0) {
                var to_index = 0;
                $('admin-hot').removeClassName('state_panel');
            } else {
                var to_index = from_index + anim.direction + skip;
                $('admin-hot').addClassName('state_panel');
            }
            var to_position = SOUP.Admin.menu_coords[to_index];
            SOUP.Admin.menu_sub_last_pos = to_position;
            var dur = SOUP.Admin.menu_durations[from_index];
            new Fx.Style(document.body, 'marginLeft', {
                duration: dur
            })._start( - SOUP.Admin.menu_coords[0] + from_position, -SOUP.Admin.menu_coords[0] + to_position);
            new Fx.Style('admin-sidebar', 'left', {
                duration: dur
            })._start(from_position, to_position);
            new Fx.Style('admin-hot', 'left', {
                duration: dur
            })._start(from_position + 244, to_position + 244);
            return false;
        },
        'menu_open': function () {
            SOUP.Public.toggle($('btn-options'), 'sel');
            var to_position = SOUP.Admin.menu_coords[2];
            SOUP.Admin.menu_sub_last_pos = to_position;
            document.body.style.marginLeft = -SOUP.Admin.menu_coords[0] + to_position + 'px';
            $('admin-sidebar').style.left = to_position + 'px';
            $('admin-hot').style.left = to_position + 244 + 'px';
            return false;
        },
        'panel_expand': function (btn) {
            var section = $(btn).hasClassName('admin-section') ? btn: $(btn).up('.admin-section');
            var is_same_as_last = section.hasClassName('sel');
            $A($('admin-panel').getElementsByClassName('admin-section')).each(function (section) {
                if (section.hasClassName('sel')) {
                    section.addClassName('closing');
                    new Fx.Style(section, 'height', {
                        duration: 250,
                        onComplete: function () {
                            section.removeClassName('closing');
                            section.removeClassName('sel');
                        }
                    })._start(section.minheight, 25);
                }
            });
            if (!is_same_as_last) {
                var sections = $('admin-panel').getElementsByClassName('admin-section');
                var sectionidx = 0;
                $A(sections).each(function (o, i) {
                    if (o == section) sectionidx = i
                });
                SOUP.Public.cookie.set('panel', sectionidx);
                section.addClassName('sel');
                section.addClassName('opening');
                new Fx.Style(section, 'height', {
                    duration: 250,
                    onComplete: function () {
                        section.removeClassName('opening');
                        section.style.height = 'auto';
                    }
                })._start(25, section.minheight);
            }
        },
        'panel_cancel': function () {
            if ($('btn-options').hasClassName('sel')) {
                SOUP.Admin.menu_sub($('btn-options'), 0, 1);
            }
            return false;
        },
        'update_group': function (id, target) {
            this.update_with = function (value) {
                var css = '';
                $A(target).each(function (t) {
                    css += t.selectors.join(',') + "{ " + t.attribute + ":" + value + "; }\n";
                });
                SOUP.Admin.append_css(id, css);
            }
        },
        'kill_skin': function (destroy_all_skincss) {
            $$('.tempstylesheet').each(function (t) {
                t.remove();
            });
            if (destroy_all_skincss && $('skin_css')) $('skin_css').disabled = true;
        },
        'replace_css': function (css_string) {
            SOUP.Admin.kill_skin();
            var custom_css = $('custom_css');
            if (custom_css) {
                custom_css.remove();
            }
            SOUP.Admin.append_css('replace_css', css_string, 'admin-customcss');
        },
        'append_css': function (id, css_string, formid) {
            var formid = formid || 'admin-style';
            if ($('_new_style_' + id)) $('_new_style_' + id).remove();
            var new_style = document.createElement('style');
            new_style.setAttribute('type', 'text/css');
            if (new_style.styleSheet) {
                new_style.styleSheet.cssText = css_string;
            } else {
                var css_text = document.createTextNode(css_string);
                new_style.appendChild(css_text);
            }
            new_style.id = '_new_style_' + id;
            new_style.className = 'tempstylesheet';
            document.getElementsByTagName('head')[0].appendChild(new_style);
            SOUP.Messages.skin_preview(formid);
        },
        'append_stylesheet': function (id, css_string, formid, where) {
            var formid = formid || 'admin-style';
            if ($('_new_style_' + id)) $('_new_style_' + id).remove();
            var new_style = document.createElement('link');
            new_style.setAttribute('rel', 'stylesheet');
            new_style.setAttribute('type', 'text/css');
            new_style.setAttribute('href', '/skins/' + css_string);
            new_style.setAttribute('class', 'tempstylesheet');
            $('after_skin_css').insert({
                'before': new_style
            });
            SOUP.Messages.skin_preview(formid);
        },
        'skin_scroll': function (n) {
            var skindiv = $('admin-style-skins');
            var skins = $A(skindiv.getElementsByTagName('a'));
            var max = skins.length;
            if (skindiv.scrollOffset == undefined) skindiv.scrollOffset = skindiv.down('.sel') ? parseInt(skindiv.down('.sel').id.charAt(16)) - 1 : 0;
            skindiv.scrollOffset = ceil(skindiv.scrollOffset + n, max);
            var show = [skindiv.scrollOffset, ceil(skindiv.scrollOffset + 1, max), ceil(skindiv.scrollOffset + 2, max)];
            skins.each(function (s) {
                s.style.display = 'none';
            });
            show.each(function (offset) {
                var s = $('admin-style-skin' + offset);
                skindiv.appendChild(s);
                s.style.display = 'block';
            });
            return false;
        },
        'skin_switch': function (o, name, update_func, pretty_name) {
            $A(o.parentNode.getElementsByTagName('a')).each(function (p) {
                $(p).removeClassName('sel');
            });
            $(o).addClassName('sel');
            $('appearance_name').value = name;
            SOUP.Admin.skin_preview_fadeout(this, pretty_name, update_func);
            return false;
        },
        'skin_preview_fadeout': function (select_element, new_skin_name, update_func) {
            new Fx.Style('content', 'opacity', {
                duration: 500
            })._start(1, 0);
            SOUP.Public.message({
                'message': SOUP.Text.skin_loading + ' "' + new_skin_name + '"...',
                'class': 'progress'
            });
            update_func();
        },
        'skin_preview_fadein': function (url) {
            SOUP.Admin.kill_skin(true);
            if (url) SOUP.Public.add_stylesheet(url);
            new Fx.Style('content', 'opacity')._start(0, 1);
            SOUP.Messages.skin_preview('admin-style');
        },
        'toggle_element_callbacks': {},
        'toggle_element': function (rule, on, elementname) {
            var display = on ? 'block': 'none';
            var start = on ? 0 : 1;
            var end = on ? 1 : 0;
            var timeout = on ? 0 : 310;
            if (rule) {
                var nodes = $$(rule);
                nodes.each(function (o) {
                    if (nodes.size() < 3) {
                        new Fx.Style(o, 'opacity', {
                            duration: 300
                        })._start(start, end);
                        setTimeout(function () {
                            o.toggleClassName('hidden')
                        },
                        timeout);
                    } else {
                        o.toggleClassName('hidden');
                    }
                });
            }
            var callback = SOUP.Admin.toggle_element_callbacks[elementname];
            if (callback) {
                setTimeout(callback.bind(this, elementname, on), timeout);
            }
            SOUP.Messages.skin_preview('admin-elements');
        },
        'custom_css_text': null,
        'custom_css_content_width': null,
        'fill_custom_css_form': function () {
            var el = $('appearance_body');
            if (el) el.value = SOUP.Admin.custom_css_text;
            el = $('admin-content-width-value');
            if (el) el.value = SOUP.Admin.custom_css_content_width;
        },
        'set_favicon': function (value) {
            $$('head link[rel="shortcut icon"]').invoke('remove');
            if (!value) value = '/favicon.ico';
            var el = new Element('link', {
                'type': 'image/png',
                'rel': 'shortcut icon',
                'href': value
            });
            $$('head')[0].appendChild(el);
        },
        'edit_toggle': function () {
            if (SOUP.Public.cookie.get('soup_tutorial') == 4) SOUP.Admin.tutorial.step(5);
            return toggle_functions(document.body, 'edit', function (o) {
                SOUP.Public.log_event('edit_mode_on');
                $(document.body).removeClassName('not_edit');
                SOUP.Admin.new_cancel();
                if ($('btn-options')) {
                    SOUP.Admin.panel_cancel();
                    SOUP.Admin.input_init('admin-h1');
                    widgInit('descriptioncontainer');
                }
                SOUP.Public.disable_reposting();
            },
            function (o) {
                SOUP.Admin.edit_cancel();
                $A($('posts').getElementsByClassName('post')).each(function (p) {
                    p.removeClassName('state-edit')
                });
            });
        },
        'edit_cancel': function () {
            if (!$(document.body).hasClassName('not_edit')) {
                SOUP.Public.log_event('edit_mode_off');
            }
            $(document.body).removeClassName('edit');
            $(document.body).addClassName('not_edit');
            SOUP.Public.reenable_reposting();
            return true;
        },
        'reaction_switch': function (linkelem, typename) {
            var activate = $(typename);
            $('reactions').down('div.sel').removeClassName('sel');
            $('reaction_switcher').down('li.sel').removeClassName('sel');
            linkelem.addClassName('sel');
            activate.addClassName('sel');
            SOUP.Public.focus(activate);
        },
        'post_edit_toggle': function (id, suffix) {
            if (!suffix) suffix = '';
            var p = $('post' + suffix + id);
            return toggle_functions(p, 'state-edit', function () {
                SOUP.Public.log_event('edit_post', {
                    'associated_record_type': 'Post',
                    'associated_record_id': id
                });
                if (window.pageYOffset && Position.cumulativeOffset(p)[1] < window.pageYOffset) {
                    p.scrollTo();
                    window.scrollBy(0, -20);
                }
                if (p.down('.submitting')) p.down('.submitting').removeClassName('submitting');
                widgInit(p);
                SOUP.Public.focus(p);
            });
        },
        'post_delete_toggle': function (id) {
            return toggle_functions($('post' + id), 'state-del');
        },
        'post_delete_ok': function (id) {
            new Ajax.Request('/delete/' + id, {
                onLoading: function () {
                    SOUP.Public.spinner($('post' + id).down('.admin-del'));
                },
                onSuccess: function () {
                    var post = $('post' + id);
                    new Fx.Style(post, 'opacity', {
                        duration: 300
                    })._start(1, 0);
                    setTimeout(function () {
                        if (post.hasClassName('multipost')) {
                            post.up('.gallery').down('#multipost_thumbnail_' + id).remove();
                        }
                        post.remove();
                    },
                    350);
                }
            });
            return false;
        },
        'post_update': function (id, request) {
            var post = $('post' + id);
            var post_to_update = (post.hasClassName('multipost')) ? post: post.down('.content-container');
            var adminedit = post.down('.admin-edit');
            new Fx.Style(adminedit, 'opacity', {
                duration: 400
            })._start(1, 0.01);
            setTimeout(function () {
                post_to_update.innerHTML = unescape(request.responseText);
            },
            400);
            setTimeout(function () {
                post.removeClassName('state-edit');
            },
            420);
            setTimeout(function () {
                adminedit.down('.admin-bar').removeClassName('state-spinner');
                adminedit.style.opacity = 1;
            },
            450);
        },
        'toggle_div': function (o) {
            return toggle_functions($(o).up('.toggle'), 'state-toggled', function () {
                SOUP.Admin.toggle_div_disable_inputs($(o), 'toggle2', 'toggle1');
            },
            function () {
                SOUP.Admin.toggle_div_disable_inputs($(o), 'toggle1', 'toggle2');
            });
        },
        'toggle_div_disable_inputs': function (o, active, inactive) {
            var parent_div = o.up('.toggle');
            var active_div = parent_div.down('.' + active);
            set_enabledness_of_form_fields(active_div, true);
            set_enabledness_of_form_fields(parent_div.down('.' + inactive), false);
            SOUP.Public.focus(active_div);
        },
        'post_showfield': function (link, container) {
            container.show();
            set_enabledness_of_form_fields(container, true);
            widgInit(container.parentNode);
            SOUP.Public.focus(container);
            link.hide();
            return false;
        },
        'post_hidefield': function (link, container) {
            container.hide();
            set_enabledness_of_form_fields(container, false);
            link.show();
            return false;
        },
        'post_review_switch': function (o, active, inactive) {
            SOUP.Admin.toggle_div_disable_inputs(o, active, inactive);
            $(o).up('.toggle').down('.' + active).show();
            $(o).up('.toggle').down('.' + inactive).hide();
            $(o).hide();
            $(o).up().down('a.' + inactive + '-button').show();
            return false;
        },
        'feed_select': function (s) {
            var val = s.options[s.selectedIndex].value;
            $A(s.parentNode.getElementsByClassName('group')).each(function (g) {
                g.style.display = 'none';
            });
            s.parentNode.removeClassName('state-custom');
            if (SOUP.Admin.service_username_labels[val]) {
                $('service_username').value = '';
                var username_label = SOUP.Text['my'] + ' ' + SOUP.Admin.service_username_labels[val] + ' ' + SOUP.Text['is'];
            } else {
                var username_label = SOUP.Text['im'];
            }
            $('service_username_label').update(username_label);
            if (val.indexOf('group-') == 0) {
                s.parentNode.down('.' + val).style.display = 'block';
                return false;
            } else if (val == 'custom') {
                s.parentNode.addClassName('state-custom');
                SOUP.Public.focus(s.parentNode);
            }
        },
        'feed_edit_toggle': function (f) {
            $A($('admin-feeds').getElementsByClassName('state-edit')).each(function (o) {
                if (o != f) o.removeClassName('state-edit');
            });
            return toggle_functions(f, 'state-edit', function () {
                SOUP.Admin.feed_refresher.disabled = true
            },
            function () {
                SOUP.Admin.feed_refresher.disabled = false
            });
        },
        'feed_icon_error': function (icon) {
            icon.src = '/images/feed_default.png';
            return false;
        },
        'feed_add': {
            'disable': function () {
                var btn = $('feed-add-btn');
                btn.disabled = true;
                btn.old_value = btn.value;
                btn.value = SOUP.Text['just_a_moment'];
            },
            'enable': function () {
                var btn = $('feed-add-btn');
                btn.disabled = false;
                btn.value = btn.old_value;
                btn.blur();
                btn.up('form').getElementsBySelector('input[type=text]').each(function (o) {
                    o.value = '';
                });
            }
        },
        'title_before_save': function () {
            var btn = $('admin-h1').up('form').down('input.submit');
            btn.disabled = true;
            btn.addClassName("state-spinner");
        },
        'title_cancel': function () {
            SOUP.Admin.edit_cancel();
            var btn = $('admin-h1').up('form').down('input.submit');
            btn.disabled = false;
            btn.removeClassName("state-spinner");
        },
        'description_before_save': function () {
            var btn = $('admin-description').up('form').down('input.submit');
            btn.disabled = true;
            btn.addClassName("state-spinner");
        },
        'description_cancel': function () {
            SOUP.Admin.edit_cancel();
            var container = $('headercontainer2');
            if ($F('admin-description') == '') {
                container.addClassName('description_empty');
            } else {
                container.removeClassName('description_empty');
            }
            var btn = $('admin-description').up('form').down('input.submit');
            btn.disabled = false;
            btn.removeClassName("state-spinner");
        },
        'feed_refresher': {
            'interval_s': 5,
            'disabled': false,
            'start': function (url) {
                setTimeout(function () {
                    SOUP.Admin.feed_refresher.refresh(url)
                },
                SOUP.Admin.feed_refresher.interval_s * 1000);
            },
            'refresh': function (url) {
                if (!SOUP.Admin.feed_refresher.disabled) {
                    new Ajax.Updater('admin-feeds-list', url, {
                        asynchronous: true,
                        evalScripts: true
                    });
                } else {
                    SOUP.Admin.feed_refresher.start(url);
                }
            }
        },
        'input_init': function (id) {
            var o = $(id);
            o.onkeypress = function (e) {
                SOUP.Admin.input_autoexpand(this, e);
            }
            o.setStyle({
                'background': 'transparent'
            });
            SOUP.Admin.input_autoexpand(o);
        },
        'input_autoexpand_last_called': null,
        'input_autoexpand_timer': null,
        'input_autoexpand': function (o, e, alsominimize) {
            if (!e) var e = window.event;
            if (!o) return;
            if (o.nodeName != 'INPUT' && (e && e.keyCode != 13) && (SOUP.Admin.input_autoexpand_last_called && (new Date() - SOUP.Admin.input_autoexpand_last_called < 500))) {
                clearTimeout(SOUP.Admin.input_autoexpand_timer);
                SOUP.Admin.input_autoexpand_timer = setTimeout('SOUP.Admin.input_autoexpand($("' + o.id + '"), null, ' + alsominimize + ')', 500);
                return;
            }
            SOUP.Admin.input_autoexpand_last_called = new Date();
            if (o.nodeName == 'INPUT') {
                if (!o.up('form')) return;
                var minwidth = measure(o) + 40;
                o.style.width = minwidth + 'px';
            } else if (o.nodeName == 'TEXTAREA') {
                var lines = o.value.split('\n');
                var newRows = lines.length + 1;
                if (newRows > o.rows) o.rows = newRows;
                if (alsominimize && newRows < o.rows) o.rows = Math.max(3, newRows);
            } else {
                var minheight = measure(o) + 25;
                if (o.nodeName == '#document') o = $(o.iframeid + '');
                if (o && (alsominimize || o.offsetHeight < minheight)) o.style.height = minheight + 'px';
            }
        },
        'hide_display': function () {
            var el = $('display');
            if (el) el.hide();
        },
        'bookmarklet_button': function () {
            if (window.event) var e = window.event;
            if (!e || !e.button || e.button != 2) {
                alert(SOUP.Text['bookmarklet_button']);
                return false;
            }
        },
        'backup_interval': null,
        'backup': function () {
            var do_backup = false;
            var form = new_post_form();
            if (form) {
                form.getElements().each(function (i) {
                    if ((i.getAttribute('type') != 'hidden') && i.getAttribute('type') != 'submit' && i.value != '') do_backup = true;
                    if (i.widgEditorObject) i.widgEditorObject.updateInput();
                });
                if (do_backup) {
                    var formdata = form.serialize();
                    if (formdata.length < 3000) {
                        SOUP.Public.cookie.set('backup', formdata, '');
                    }
                }
            }
        },
        'backup_restore': function () {
            var data = SOUP.Public.cookie.get('backup').toQueryParams();
            if (data && data['post[type]']) {
                SOUP.Admin.new_start();
                new Ajax.Request('/new/' + data['post[type]'].substring(4).toLowerCase(), {
                    asynchronous: true,
                    evalScripts: true,
                    onComplete: function () {
                        var form = new_post_form();
                        form.getElements().each(function (i) {
                            if (data[i.name]) i.value = data[i.name];
                            if (i.style.display == 'none') {
                                var showbtn = i.up('.addfield');
                                if (showbtn) showbtn = showbtn.down('a');
                                if (showbtn) {
                                    SOUP.Admin.post_showfield(showbtn, i);
                                } else {
                                    i.style.display = 'block';
                                }
                            }
                            if (i.name == 'post[rating]') {
                                SOUP.Admin.reset_stars(i);
                            }
                        });
                        SOUP.Admin.backup_discard();
                    }
                });
            } else {
                SOUP.Public.message({
                    'message': SOUP.Text.backup_restore_error,
                    'class': 'warning',
                    'buttons': [[SOUP.Text.dismiss, function () {
                        SOUP.Public.message();
                    }]]
                });
            }
            return false;
        },
        'backup_stop': function (dont_discard) {
            if (SOUP.Admin.backup_interval) SOUP.Admin.backup_interval.stop();
            if (!dont_discard) SOUP.Admin.backup_discard();
            return true;
        },
        'backup_discard': function () {
            SOUP.Public.cookie.del('backup');
            SOUP.Public.message();
            return false;
        },
        'tutorial': {
            'init': function (step) {
                if (!$('tutorial')) {
                    if (step < 10) $(document.body).addClassName('tutorial_active');
                    var tut_container = new Element('div', {
                        'id': 'tutorial'
                    });
                    tut_container.insert(new Element('div', {
                        'id': 'tutorial_shadow',
                        'class': 'tutorial_div'
                    }));
                    tut_container.insert(new Element('div', {
                        'id': 'tutorial_box',
                        'class': 'tutorial_div'
                    }));
                    var tut_close = new Element('a', {
                        'id': 'tutorial_close',
                        'href': '#nojs',
                        'title': SOUP.Text.tutorial_end
                    }).update('&times;');
                    tut_close.onclick = function () {
                        if (confirm(SOUP.Text.tutorial_confirm_end)) {
                            SOUP.Admin.tutorial.step( - 1);
                        }
                        return false;
                    }
                    tut_container.insert(tut_close);
                    tut_container.insert(new Element('div', {
                        'id': 'tutorial_arrow'
                    }));
                    tut_container.insert(new Element('div', {
                        'id': 'tutorial_character'
                    }));
                    $(document.body).insert(tut_container);
                    var timeout = 0;
                } else {
                    new Fx.Style($('tutorial'), 'opacity', {
                        duration: 500
                    })._start(1, 0);
                    var timeout = 510;
                }
                return timeout;
            },
            'step': function (step) {
                var cookiestep = SOUP.Public.cookie.get('soup_tutorial');
                if (!cookiestep || step == cookiestep) return;
                var step = step || cookiestep;
                switch (step) {
                case null:
                    return;
                    break;
                case - 1 : SOUP.Public.log_event('close_tutorial', {
                        'last_step': cookiestep
                    });
                    $('tutorial').remove();
                    $(document.body).removeClassName('tutorial_active');
                    SOUP.Public.cookie.del('soup_tutorial');
                    break;
                default:
                    var timeout = SOUP.Admin.tutorial.init(step);
                    SOUP.Public.log_event('show_tutorial', {
                        'step': step
                    });
                    SOUP.Public.cookie.set('soup_tutorial', step);
                    setTimeout(function () {
                        $('tutorial').style.opacity = 0;
                        $('tutorial').className = 'step' + step;
                        $(document.body).removeClassName('tutorial_step' + (step - 1)).addClassName('tutorial_step' + step);
                        if (step == 0 && SOUP.Public.cookie.get('soup_initial_import_username') != null) {
                            $('tutorial').className += ' initialimport ' + SOUP.Public.cookie.get('soup_initial_import_service').toLowerCase();
                            var txt = SOUP.Text['tutorial_initialimport'];
                            txt = txt.replace(/\$1/g, SOUP.Public.cookie.get('soup_initial_import_servicename'));
                            txt = txt.replace(/\$2/g, SOUP.Public.cookie.get('soup_initial_import_username'));
                        } else {
                            var txt = SOUP.Text['tutorial'][step];
                        }
                        $('tutorial_box').update(txt);
                        $('tutorial_shadow').update(txt);
                        new Fx.Style($('tutorial'), 'opacity', {
                            duration: 500
                        })._start(0, 1);
                        if ($('tutorial').filters) {
                            setTimeout(function () {
                                $('tutorial').filters[0].enabled = false;
                            },
                            520);
                        }
                        if (step == 0 && SOUP.Public.cookie.get('soup_initial_import_service') != null) {
                            if (SOUP.Public.cookie.get('soup_initial_import_username') != null) {
                                SOUP.Public.cookie.del('soup_initial_import_username');
                                SOUP.Public.cookie.del('soup_initial_import_service');
                                SOUP.Public.cookie.del('soup_initial_import_servicename');
                            } else {
                                var theform = $('admin-feeds').down('form');
                                $('service').parentNode.removeChild($('service'));
                                theform.appendChild(new Element('input', {
                                    'name': 'service',
                                    'value': SOUP.Public.cookie.get('soup_initial_import_service')
                                }));
                                var username = prompt(SOUP.Text.tutorial_initialusername.replace(/\$1/g, SOUP.Public.cookie.get('soup_initial_import_servicename')));
                                if (username) {
                                    $('service_username').value = username;
                                    SOUP.Public.cookie.set('soup_initial_import_username', username);
                                    $('tutorial').remove();
                                    eval('function _foo() { ' + theform.getAttribute('onsubmit') + '}; _foo();');
                                    SOUP.Admin.tutorial.step();
                                }
                            }
                        } else if (step == 2 && !$('btn-new').hasClassName('sel')) {
                            SOUP.Admin.menu_new($('btn-new').down());
                        } else if (step == 6) {
                            if (document.body.addEventListener) $('tutorial_box').down('a.bmlet').addEventListener('dragend', function (e) {
                                SOUP.Admin.tutorial.step(7)
                            },
                            false);
                        } else if (step == 9 && !$('btn-options').hasClassName('sel')) {
                            SOUP.Admin.menu_sub($('btn-options').down(), 0, 1);
                        }
                    },
                    timeout);
                }
                return false;
            }
        },
        'set_stars': function (o, amount) {
            o.up('div.rating').down('input#post_rating').value = amount;
            return false;
        },
        'show_stars': function (o, amount) {
            var rating_obj = o.up('div.rating');
            for (var i = 0; i < amount; ++i) {
                rating_obj.down('img.star' + (i + 1)).src = '/images/star_active.png';
            }
            for (var i = amount; i < 5; ++i) {
                rating_obj.down('img.star' + (i + 1)).src = '/images/star.png';
            }
            rating_obj.className = 'rating rating' + amount;
            return false;
        },
        'reset_stars': function (o) {
            var amount = o.up('div.rating').down('input#post_rating').value;
            SOUP.Admin.show_stars(o, parseInt(amount));
            return false;
        }
    };
} ();
SOUP.Messages = {
    'skin_preview': function (formid) {
        SOUP.Public.message({
            'message': SOUP.Text.skin_preview,
            'class': 'info',
            'buttons': [[SOUP.Text.skin_save, function () {
                $(formid).submit();
                return false;
            }], [SOUP.Text.skin_cancel, function () {
                var dl = document.location;
                dl.href = dl.href.substring(0, dl.href.indexOf('#')) + '#panel';
                dl.reload();
                return false;
            }]]
        });
    }
};
function f_tcalParseDate(s_date) {
    var re_date = /^\s*(\d{2,4})\-(\d{1,2})\-(\d{1,2})\s*$/;
    if (!re_date.exec(s_date)) return alert("Invalid date: '" + s_date + "'.\nAccepted format is yyyy-mm-dd.") var n_day = Number(RegExp.$3),
    n_month = Number(RegExp.$2),
    n_year = Number(RegExp.$1);
    if (n_year < 100) n_year += (n_year < this.a_tpl.centyear ? 2000 : 1900);
    if (n_month < 1 || n_month > 12) return alert("Invalid month value: '" + n_month + "'.\nAllowed range is 01-12.");
    var d_numdays = new Date(n_year, n_month, 0);
    if (n_day > d_numdays.getDate()) return alert("Invalid day of month value: '" + n_day + "'.\nAllowed range for selected month is 01 - " + d_numdays.getDate() + ".");
    return new Date(n_year, n_month - 1, n_day);
}
function f_tcalGenerDate(d_date) {
    return (d_date.getFullYear() + "-" + (d_date.getMonth() < 9 ? '0': '') + (d_date.getMonth() + 1) + "-" + (d_date.getDate() < 10 ? '0': '') + d_date.getDate());
}
function tcal(a_cfg, a_tpl) {
    if (!a_tpl) a_tpl = A_TCALDEF;
    if (!window.A_TCALS) window.A_TCALS = [];
    if (!window.A_TCALSIDX) window.A_TCALSIDX = [];
    this.s_id = a_cfg.id ? a_cfg.id: A_TCALS.length;
    window.A_TCALS[this.s_id] = this;
    window.A_TCALSIDX[window.A_TCALSIDX.length] = this;
    this.f_show = f_tcalShow;
    this.f_hide = f_tcalHide;
    this.f_toggle = f_tcalToggle;
    this.f_update = f_tcalUpdate;
    this.f_relDate = f_tcalRelDate;
    this.f_parseDate = f_tcalParseDate;
    this.f_generDate = f_tcalGenerDate;
    this.s_iconId = 'tcalico_' + this.s_id;
    this.e_icon = $(this.s_iconId);
    if (!this.e_icon) {
        document.write('<img src="' + a_tpl.imgpath + 'cal.gif" id="' + this.s_iconId + '" onclick="A_TCALS[\'' + this.s_id + '\'].f_toggle()" class="tcalIcon" alt="Open Calendar" />');
        this.e_icon = $(this.s_iconId);
    }
    this.a_cfg = a_cfg;
    this.a_tpl = a_tpl;
}
function f_tcalShow(d_date) {
    if (this.a_cfg.formname) {
        var e_form = document.forms[this.a_cfg.formname];
        if (!e_form) throw ("TC: form '" + this.a_cfg.formname + "' can not be found");
        this.e_input = e_form.elements[this.a_cfg.controlname];
    }
    else this.e_input = $(this.s_id);
    if (!this.e_input || !this.e_input.tagName || this.e_input.tagName != 'INPUT') throw ("TC: element '" + this.a_cfg.controlname + "' does not exist in " + (this.a_cfg.formname ? "form '" + this.a_cfg.controlname + "'": 'this document'));
    this.e_div = $('tcal');
    if (!this.e_div) {
        this.e_div = document.createElement("DIV");
        this.e_div.id = 'tcal';
        document.body.appendChild(this.e_div);
    }
    this.e_iframe = $('tcalIF')
    if (b_ieFix && !this.e_iframe) {
        this.e_iframe = document.createElement("IFRAME");
        this.e_iframe.style.filter = 'alpha(opacity=0)';
        this.e_iframe.id = 'tcalIF';
        this.e_iframe.src = this.a_tpl.imgpath + 'pixel.gif';
        document.body.appendChild(this.e_iframe);
    }
    f_tcalHideAll();
    this.e_icon = $(this.s_iconId);
    if (!this.f_update()) return;
    this.e_div.style.visibility = 'visible';
    if (this.e_iframe) this.e_iframe.style.visibility = 'visible';
    this.e_icon.src = this.a_tpl.imgpath + 'no_cal.gif';
    this.e_icon.title = 'Close Calendar';
    this.b_visible = true;
}
function f_tcalHide(n_date) {
    if (n_date) this.e_input.value = this.f_generDate(new Date(n_date));
    if (!this.b_visible) return;
    if (this.e_iframe) this.e_iframe.style.visibility = 'hidden';
    this.e_div.style.visibility = 'hidden';
    this.e_icon = $(this.s_iconId);
    this.e_icon.src = this.a_tpl.imgpath + 'cal.gif';
    this.e_icon.title = 'Open Calendar';
    this.b_visible = false;
}
function f_tcalToggle() {
    return this.b_visible ? this.f_hide() : this.f_show();
}
function f_tcalUpdate(d_date) {
    var d_today = this.a_cfg.today ? this.f_parseDate(this.a_cfg.today) : new Date();
    var d_selected = this.e_input.value == '' ? (this.a_cfg.selected ? this.f_parseDate(this.a_cfg.selected) : d_today) : this.f_parseDate(this.e_input.value);
    if (!d_date) d_date = d_selected;
    else if (typeof(d_date) == 'number') d_date = new Date(d_date);
    else if (typeof(d_date) == 'string') this.f_parseDate(d_date);
    if (!d_date) return false;
    var d_firstday = new Date(d_date);
    d_firstday.setDate(1);
    d_firstday.setDate(1 - (7 + d_firstday.getDay() - this.a_tpl.weekstart) % 7);
    var a_class, s_html = '<table class="ctrl"><tbody><tr>' + (this.a_tpl.yearscroll ? '<td' + this.f_relDate(d_date, -1, 'y') + ' title="Previous Year"> &lArr;</td>': '') + '<td' + this.f_relDate(d_date, -1) + ' title="' + SOUP.Text['cal_month_prev'] + '" class="nav"> &larr;</td><th>' + this.a_tpl.months[d_date.getMonth()] + ' ' + d_date.getFullYear() + '</th><td' + this.f_relDate(d_date, 1) + ' title="' + SOUP.Text['cal_month_next'] + '" class="nav">&rarr; </td>' + (this.a_tpl.yearscroll ? '<td' + this.f_relDate(d_date, 1, 'y') + ' title="Next Year">&rArr; </td></td>': '') + '</tr></tbody></table><table><tbody><tr class="wd">';
    for (var i = 0; i < 7; i++)
    s_html += '<th>' + this.a_tpl.weekdays[(this.a_tpl.weekstart + i) % 7] + '</th>';
    s_html += '</tr>';
    var d_current = new Date(d_firstday);
    while (d_current.getMonth() == d_date.getMonth() || d_current.getMonth() == d_firstday.getMonth()) {
        s_html += '<tr>';
        for (var n_wday = 0; n_wday < 7; n_wday++) {
            a_class = [];
            if (d_current.getMonth() != d_date.getMonth()) a_class[a_class.length] = 'othermonth';
            if (d_current.getDay() == 0 || d_current.getDay() == 6) a_class[a_class.length] = 'weekend';
            if (Math.floor(d_current.valueOf() / 8.64e7) == Math.floor(d_today.valueOf() / 8.64e7)) a_class[a_class.length] = 'today';
            if (Math.floor(d_current.valueOf() / 8.64e7) == Math.floor(d_selected.valueOf() / 8.64e7)) a_class[a_class.length] = 'selected';
            s_html += '<td onclick="A_TCALS[\'' + this.s_id + '\'].f_hide(' + d_current.valueOf() + ')"' + (a_class.length ? ' class="' + a_class.join(' ') + '">': '>') + d_current.getDate() + '</td>';
            d_current.setDate(d_current.getDate() + 1);
        }
        s_html += '</tr>';
    }
    s_html += '</tbody></table>';
    this.e_div.innerHTML = s_html;
    var n_width = this.e_div.offsetWidth;
    var n_height = this.e_div.offsetHeight;
    var n_top = f_getPosition(this.e_icon, 'Top') + this.e_icon.offsetHeight;
    var n_left = f_getPosition(this.e_icon, 'Left') - n_width + this.e_icon.offsetWidth;
    if (n_left < 0) n_left = 0;
    this.e_div.style.left = n_left + 'px';
    this.e_div.style.top = n_top + 'px';
    if (this.e_iframe) {
        this.e_iframe.style.left = n_left + 'px';
        this.e_iframe.style.top = n_top + 'px';
        this.e_iframe.style.width = (n_width + 6) + 'px';
        this.e_iframe.style.height = (n_height + 6) + 'px';
    }
    return true;
}
function f_getPosition(e_elemRef, s_coord) {
    var n_pos = 0,
    n_offset, e_elem = e_elemRef;
    while (e_elem) {
        n_offset = e_elem["offset" + s_coord];
        n_pos += n_offset;
        e_elem = e_elem.offsetParent;
    }
    if (b_ieMac) n_pos += parseInt(document.body[s_coord.toLowerCase() + 'Margin']);
    else if (b_safari) n_pos -= n_offset;
    e_elem = e_elemRef;
    while (e_elem != document.body) {
        n_offset = e_elem["scroll" + s_coord];
        if (n_offset && e_elem.style.overflow == 'scroll') n_pos -= n_offset;
        e_elem = e_elem.parentNode;
    }
    return n_pos;
}
function f_tcalRelDate(d_date, d_diff, s_units) {
    var s_units = (s_units == 'y' ? 'FullYear': 'Month');
    var d_result = new Date(d_date);
    d_result['set' + s_units](d_date['get' + s_units]() + d_diff);
    if (d_result.getDate() != d_date.getDate()) d_result.setDate(0);
    return ' onclick="A_TCALS[\'' + this.s_id + '\'].f_update(' + d_result.valueOf() + ')"';
}
function f_tcalHideAll() {
    for (var i = 0; i < window.A_TCALSIDX.length; i++)
    window.A_TCALSIDX[i].f_hide();
}
var s_userAgent = navigator.userAgent.toLowerCase(),
re_webkit = /WebKit\/(\d+)/i;
var b_mac = s_userAgent.indexOf('mac') != -1,
b_ie5 = s_userAgent.indexOf('msie 5') != -1,
b_ie6 = s_userAgent.indexOf('msie 6') != -1 && s_userAgent.indexOf('opera') == -1;
var b_ieFix = b_ie5 || b_ie6,
b_ieMac = b_mac && b_ie5,
b_safari = b_mac && re_webkit.exec(s_userAgent) && Number(RegExp.$1) < 500;
var widgStylesheet = "/stylesheets/wysiwyg.css";
var widgSelectBlockOptions = new Array();
widgSelectBlockOptions.push("", "Change block type");
widgSelectBlockOptions.push("<h1>", "Heading 1");
widgSelectBlockOptions.push("<h2>", "Heading 2");
widgSelectBlockOptions.push("<h3>", "Heading 3");
widgSelectBlockOptions.push("<h4>", "Heading 4");
widgSelectBlockOptions.push("<h5>", "Heading 5");
widgSelectBlockOptions.push("<h6>", "Heading 6");
widgSelectBlockOptions.push("<p>", "Paragraph");
var widgInsertParagraphs = false;
var widgAutoClean = false;
var widgAreas = 0;
function widgInit(startNode) {
    if (!startNode) startNode = document.body;
    var agent = navigator.userAgent.toLowerCase();
    if (agent.indexOf('iphone') > -1 || agent.indexOf('symbian') > -1) return;
    if (SOUP.Public && SOUP.Public.environment == 'test') return;
    if (typeof(document.designMode) == "string" && (document.all || document.designMode == "off")) {
        $A($(startNode).getElementsByTagName('textarea')).each(function (theTextarea, i) {
            if (!theTextarea.hasClassName) theTextarea = $(theTextarea);
            if (theTextarea.hasClassName("wysiwyg") && theTextarea.getStyle('display') != 'none') {
                widgAreas++;
                if ($(theTextarea.id) != theTextarea) theTextarea.id = 'wysiwyg' + widgAreas;
                setTimeout("new widgEditor('" + theTextarea.id + "')", 500 * (i));
            }
        });
        return true;
    } else {
        return false;
    }
}
function widgEditor(replacedTextareaID) {
    var self = this;
    this.theTextarea = document.getElementById(replacedTextareaID);
    this.theContainer = document.createElement("div");
    this.theIframe = document.createElement("iframe");
    this.theInput = document.createElement("input");
    this.locked = true;
    this.pasteCache = "";
    this.wysiwyg = true;
    this.expand = this.theTextarea.hasClassName('expand');
    this.IE = false;
    this.theContainer.id = this.theTextarea.id + "WidgContainer";
    this.theContainer.className = "widgContainer";
    this.theContainer.onmouseover = function () {
        this.over = true;
        Element.addClassName(this, 'show-toolbar');
    }
    this.theContainer.onmouseout = function () {
        this.over = false;
        if (!this.focused && !this.overToolbar) Element.removeClassName(this, 'show-toolbar');
    }
    this.theIframe.id = this.theTextarea.id + "WidgIframe";
    this.theIframe.className = "widgIframe";
    this.theIframe.wysiwygInput = this.theInput;
    this.theIframe.setAttribute('allowtransparency', true)
    this.theInput.type = "hidden";
    this.theInput.id = this.theTextarea.id;
    this.theInput.name = this.theTextarea.name;
    this.theInput.value = this.theTextarea.value;
    this.theInput.widgEditorObject = this;
    var toolbarItems = [];
    var fw = this.theTextarea.getStyle('fontWeight');
    if (fw != 'bold' && fw != '700') toolbarItems.push('bold');
    if (this.theTextarea.getStyle('fontStyle') != 'italic') toolbarItems.push('italic');
    toolbarItems.push('hyperlink');
    toolbarItems.push('htmlsource');
    this.theToolbar = new widgToolbar(this, toolbarItems);
    this.theToolbar.onmouseover = function () {
        this.parentNode.overToolbar = true;
    }
    this.theToolbar.onmouseout = function () {
        this.parentNode.overToolbar = false;
    }
    copy_font_styles(this.theTextarea, this.theInput);
    this.theTextarea.id += "WidgTextarea";
    this.theTextarea.name += "WidgTextarea";
    this.theTextarea.addClassName('sourcecode');
    this.theContainer.appendChild(this.theToolbar.theList);
    this.theContainer.appendChild(this.theIframe);
    this.theContainer.appendChild(this.theInput);
    this.theContainer.style.visibility = "hidden";
    var clone = this.theTextarea.cloneNode(true);
    clone.id = '__clone' + this.theTextarea.id;
    document.body.appendChild(clone);
    this.theIframe.style.height = clone.offsetHeight + 'px';
    if (this.theTextarea.getStyle('backgroundColor') != '') this.theIframe.style.backgroundColor = this.theTextarea.getStyle('backgroundColor');
    this.theTextarea.style.visibility = "hidden";
    $('__clone' + this.theTextarea.id).remove();
    this.theTextarea.parentNode.replaceChild(this.theContainer, this.theTextarea);
    this.theTextarea.onkeydown = function (e) {
        self.detectShortcuts(e)
    };
    this.theTextarea.onkeypress = function (e) {
        SOUP.Admin.input_autoexpand(this, e)
    };
    this.writeDocument(this.theInput.value);
    this.initEdit();
    this.modifyFormSubmit();
    return true;
}
widgEditor.prototype.cleanPaste = function () {
    if (widgAutoClean) {
        var matchedHead = "";
        var matchedTail = "";
        var newContent = this.theIframe.contentWindow.document.getElementsByTagName("body")[0].innerHTML.strip();
        var newContentStart = 0;
        var newContentFinish = 0;
        var newSnippet = "";
        var tempNode = document.createElement("div");
        for (newContentStart = 0; newContentStart < this.pasteCache.length && newContent.charAt(newContentStart) == this.pasteCache.charAt(newContentStart); newContentStart++) {
            matchedHead += this.pasteCache.charAt(newContentStart);
        }
        var newContentRev = newContent.reverse();
        var pasteCacheRev = this.pasteCache.reverse();
        for (newContentFinish = 0; newContentFinish < pasteCacheRev.length && newContentRev.charAt(newContentFinish) == pasteCacheRev.charAt(newContentFinish); newContentFinish++) {
            matchedTail += pasteCacheRev.charAt(newContentFinish);
        }
        matchedTail = matchedTail.reverse();
        if (matchedHead == matchedTail || newContentStart == newContent.length - newContentFinish) {
            return false;
        }
        newSnippet = newContent.substring(newContentStart, newContent.length - newContentFinish);
        console.log('head=' + matchedHead);
        console.log('tail=' + matchedTail);
        newSnippet = newSnippet.replace(/<([^>]*)>/g, '&lt;$1&gt;');
        newSnippet = newSnippet.validTags();
        newSnippet = newSnippet.replace(/<b(\s+|>)/g, "<strong$1");
        newSnippet = newSnippet.replace(/<\/b(\s+|>)/g, "</strong$1");
        newSnippet = newSnippet.replace(/<i(\s+|>)/g, "<em$1");
        newSnippet = newSnippet.replace(/<\/i(\s+|>)/g, "</em$1");
        tempNode.innerHTML = newSnippet;
        acceptableChildren(tempNode);
        console.log('stripped=' + tempNode.innerHTML);
        this.theInput.value = matchedHead + tempNode.innerHTML + matchedTail;
        this.theInput.value = this.theInput.value.replace(/<\?xml[^>]*>/g, "");
        this.theInput.value = this.theInput.value.replace(/<[^ >]+:[^>]*>/g, "");
        this.theInput.value = this.theInput.value.replace(/<\/[^ >]+:[^>]*>/g, "");
        this.refreshDisplay();
        if (!this.IE) this.convertSPANs();
    }
    return true;
}
widgEditor.prototype.updateInput = function () {
    var theHTML = '';
    if (this.wysiwyg) {
        if (! (this.theIframe.contentWindow.document.getElementsByTagName("body")[0])) return;
        theHTML = this.theIframe.contentWindow.document.getElementsByTagName("body")[0].innerHTML;
    } else {
        theHTML = this.theTextarea.value;
    }
    this.theInput.value = theHTML;
}
widgEditor.prototype.cleanSource = function () {
    var theHTML = '';
    if (this.wysiwyg) {
        theHTML = this.theIframe.contentWindow.document.getElementsByTagName("body")[0].innerHTML;
    } else {
        theHTML = this.theTextarea.value;
    }
    theHTML = theHTML.validTags();
    theHTML = theHTML.replace(/^\s+/, "");
    theHTML = theHTML.replace(/\s+$/, "");
    theHTML = theHTML.replace(/<br>/g, "<br />");
    theHTML = theHTML.replace(/<br \/>$/, '');
    theHTML = theHTML.replace(/<br \/>\s*<\/(h1|h2|h3|h4|h5|h6|li|p)/g, "</$1");
    theHTML = theHTML.replace(/(<img [^>]+[^\/])>/g, "$1 />");
    theHTML = theHTML.replace(/(<([^\/])>|<([^\/][^\s]*)[^>]*[^\/]>)\s*<\/(\2|\3)>/g, "");
    if (this.wysiwyg) {
        this.theIframe.contentWindow.document.getElementsByTagName("body")[0].innerHTML = theHTML;
    } else {
        this.theTextarea.value = theHTML;
    }
    this.theInput.value = theHTML;
    return true;
}
widgEditor.prototype.convertSPANs = function (theSwitch) {
    if (theSwitch) {
        var theSPANs = this.theIframe.contentWindow.document.getElementsByTagName("span");
        while (theSPANs.length > 0) {
            var theChildren = new Array();
            var theReplacementElement = null;
            var theParentElement = null;
            for (var j = 0; j < theSPANs[0].childNodes.length; j++) {
                theChildren.push(theSPANs[0].childNodes[j].cloneNode(true));
            }
            switch (theSPANs[0].getAttribute("style")) {
            case "font-weight: bold;":
                theReplacementElement = this.theIframe.contentWindow.document.createElement("strong");
                theParentElement = theReplacementElement;
                break;
            case "font-style: italic;":
                theReplacementElement = this.theIframe.contentWindow.document.createElement("em");
                theParentElement = theReplacementElement;
                break;
            case "font-weight: bold; font-style: italic;":
                theParentElement = this.theIframe.contentWindow.document.createElement("em");
                theReplacementElement = this.theIframe.contentWindow.document.createElement("strong");
                theReplacementElement.appendChild(theParentElement);
                break;
            case "font-style: italic; font-weight: bold;":
                theParentElement = this.theIframe.contentWindow.document.createElement("strong");
                theReplacementElement = this.theIframe.contentWindow.document.createElement("em");
                theReplacementElement.appendChild(theParentElement);
                break;
            default:
                replaceNodeWithChildren(theSPANs[0]);
                break;
            }
            if (theReplacementElement != null) {
                for (var j = 0; j < theChildren.length; j++) {
                    theParentElement.appendChild(theChildren[j]);
                }
                theSPANs[0].parentNode.replaceChild(theReplacementElement, theSPANs[0]);
            }
            theSPANs = this.theIframe.contentWindow.document.getElementsByTagName("span");
        }
    } else {
        var theEMs = this.theIframe.contentWindow.document.getElementsByTagName("em");
        while (theEMs.length > 0) {
            var theChildren = new Array();
            var theSpan = this.theIframe.contentWindow.document.createElement("span");
            theSpan.setAttribute("style", "font-style: italic;");
            for (var j = 0; j < theEMs[0].childNodes.length; j++) {
                theChildren.push(theEMs[0].childNodes[j].cloneNode(true));
            }
            for (var j = 0; j < theChildren.length; j++) {
                theSpan.appendChild(theChildren[j]);
            }
            theEMs[0].parentNode.replaceChild(theSpan, theEMs[0]);
            theEMs = this.theIframe.contentWindow.document.getElementsByTagName("em");
        }
        var theSTRONGs = this.theIframe.contentWindow.document.getElementsByTagName("strong");
        while (theSTRONGs.length > 0) {
            var theChildren = new Array();
            var theSpan = this.theIframe.contentWindow.document.createElement("span");
            theSpan.setAttribute("style", "font-weight: bold;");
            for (var j = 0; j < theSTRONGs[0].childNodes.length; j++) {
                theChildren.push(theSTRONGs[0].childNodes[j].cloneNode(true));
            }
            for (var j = 0; j < theChildren.length; j++) {
                theSpan.appendChild(theChildren[j]);
            }
            theSTRONGs[0].parentNode.replaceChild(theSpan, theSTRONGs[0]);
            theSTRONGs = this.theIframe.contentWindow.document.getElementsByTagName("strong");
        }
    }
    return true;
}
widgEditor.prototype.detectPaste = function (e) {
    var theEvent = e ? e: event;
    if ((theEvent.ctrlKey || theEvent.metaKey) && (theEvent.keyCode == 86 || theEvent.keyCode == 224) && this.wysiwyg) {
        var self = this;
        this.pasteCache = this.theIframe.contentWindow.document.getElementsByTagName("body")[0].innerHTML.strip();
        setTimeout(function () {
            self.cleanPaste();
            return true;
        },
        100);
    }
    return true;
}
widgEditor.prototype.detectShortcuts = function (e) {
    var theEvent = e ? e: event;
    if ((theEvent.ctrlKey || theEvent.metaKey) && theEvent.keyCode == 85) {
        this.switchMode();
        if (theEvent.preventDefault && theEvent.stopPropagation) {
            theEvent.preventDefault();
            theEvent.stopPropagation();
        } else {
            theEvent.cancelBubble = true;
            theEvent.returnValue = false;
        }
    }
}
widgEditor.prototype.initEdit = function () {
    var self = this;
    try {
        this.theIframe.contentWindow.document.designMode = "on";
    } catch(e) {
        setTimeout(function () {
            self.initEdit()
        },
        250);
        return false;
    }
    if (!this.IE) this.convertSPANs(false);
    this.theContainer.style.visibility = "visible";
    this.theTextarea.style.visibility = "visible";
    if (typeof document.addEventListener == "function") {
        this.theIframe.contentWindow.document.addEventListener("mouseup", function () {
            widgToolbarCheckState(self);
            return true;
        },
        false);
        this.theIframe.contentWindow.document.addEventListener("keyup", function () {
            widgToolbarCheckState(self);
            return true;
        },
        false);
        this.theIframe.contentWindow.document.addEventListener("keydown", function (e) {
            self.detectShortcuts(e);
            return true;
        },
        false);
        this.theIframe.contentWindow.document.addEventListener("focus", function (e) {
            self.theContainer.focused = true;
            self.theContainer.addClassName('show-toolbar');
            return true;
        },
        false);
        this.theIframe.contentWindow.document.addEventListener("blur", function (e) {
            self.theContainer.focused = false;
            if (!self.theContainer.over && !self.theContainer.overToolbar) self.theContainer.removeClassName('show-toolbar');
            return true;
        },
        false);
        this.theTextarea.addEventListener("focus", function (e) {
            self.theContainer.focused = true;
            self.theContainer.addClassName('show-toolbar');
            return true;
        },
        false);
        this.theTextarea.addEventListener("blur", function (e) {
            self.theContainer.focused = false;
            if (!self.theContainer.over && !self.theContainer.overToolbar) self.theContainer.removeClassName('show-toolbar');
            return true;
        },
        false);
        if (this.expand) this.theIframe.contentWindow.document.addEventListener("keyup", function (e) {
            SOUP.Admin.input_autoexpand(this, e);
            return true
        },
        false);
    } else {
        this.theIframe.contentWindow.document.attachEvent("onmouseup", function () {
            widgToolbarCheckState(self);
            return true;
        });
        this.theIframe.contentWindow.document.attachEvent("onkeyup", function () {
            widgToolbarCheckState(self);
            return true;
        });
        this.theIframe.contentWindow.document.attachEvent("onkeydown", function (e) {
            self.detectShortcuts(e);
            return true;
        },
        false);
        this.theIframe.attachEvent("onfocus", function (e) {
            self.theContainer.focused = true;
            self.theContainer.addClassName('show-toolbar');
            return true;
        },
        false);
        if (this.expand) this.theIframe.contentWindow.document.onkeyup = function () {
            widgToolbarCheckState(self);
            SOUP.Admin.input_autoexpand(this);
        }
    }
    this.theIframe.contentWindow.document.iframeid = this.theIframe.id;
    new PeriodicalExecuter(function (pe) {
        if (self.theIframe && !self.theIframe.contentWindow.document.body) {
            return;
        } else if (self.theIframe.contentWindow.document.body) {
            copy_font_styles(self.theInput, self.theIframe.contentWindow.document.body);
            if (self.expand) setTimeout(function () {
                SOUP.Admin.input_autoexpand(self.theIframe.contentWindow.document);
            },
            200);
            SOUP.Public.focus(self.theIframe);
            pe.stop();
        } else {
            pe.stop();
        }
    },
    .2);
    this.locked = false;
    return true;
}
widgEditor.prototype.insertNewParagraph = function (elementArray, succeedingElement) {
    var theBody = this.theIframe.contentWindow.document.getElementsByTagName("body")[0];
    var theParagraph = this.theIframe.contentWindow.document.createElement("p");
    for (var i = 0; i < elementArray.length; i++) {
        theParagraph.appendChild(elementArray[i]);
    }
    if (typeof(succeedingElement) != "undefined") {
        theBody.insertBefore(theParagraph, succeedingElement);
    } else {
        theBody.appendChild(theParagraph);
    }
    return true;
}
widgEditor.prototype.modifyFormSubmit = function () {
    var self = this;
    var theForm = this.theContainer.parentNode;
    var oldOnsubmit = null;
    while (theForm.nodeName.toLowerCase() != "form") {
        theForm = theForm.parentNode;
    }
    theForm.oldOnsubmit = theForm.onsubmit;
    if (typeof theForm.onsubmit != "function") {
        theForm.onsubmit = function () {
            return self.updateWidgInput();
        }
    } else {
        theForm.onsubmit = function () {
            self.updateWidgInput();
            return theForm.oldOnsubmit();
        }
    }
    return true;
}
widgEditor.prototype.paragraphise = function () {
    if (widgInsertParagraphs && this.wysiwyg) {
        var theBody = this.theIframe.contentWindow.document.getElementsByTagName("body")[0];
        for (var i = 0; i < theBody.childNodes.length; i++) {
            if (theBody.childNodes[i].nodeName.toLowerCase() == "#text" && theBody.childNodes[i].data.search(/^\s*$/) != -1) {
                theBody.removeChild(theBody.childNodes[i]);
                i--;
            }
        }
        var removedElements = new Array();
        for (var i = 0; i < theBody.childNodes.length; i++) {
            if (theBody.childNodes[i].nodeName.isInlineName()) {
                removedElements.push(theBody.childNodes[i].cloneNode(true));
                theBody.removeChild(theBody.childNodes[i]);
                i--;
            }
            else if (theBody.childNodes[i].nodeName.toLowerCase() == "br") {
                if (i + 1 < theBody.childNodes.length) {
                    if (theBody.childNodes[i + 1].nodeName.toLowerCase() == "br") {
                        while (i < theBody.childNodes.length && theBody.childNodes[i].nodeName.toLowerCase() == "br") {
                            theBody.removeChild(theBody.childNodes[i]);
                        }
                        if (removedElements.length > 0) {
                            this.insertNewParagraph(removedElements, theBody.childNodes[i]);
                            removedElements = new Array();
                        }
                    }
                    else if (!theBody.childNodes[i + 1].nodeName.isInlineName()) {
                        theBody.removeChild(theBody.childNodes[i]);
                    }
                    else if (removedElements.length > 0) {
                        removedElements.push(theBody.childNodes[i].cloneNode(true));
                        theBody.removeChild(theBody.childNodes[i]);
                    }
                    else {
                        theBody.removeChild(theBody.childNodes[i]);
                    }
                    i--;
                }
                else {
                    theBody.removeChild(theBody.childNodes[i]);
                }
            }
            else if (removedElements.length > 0) {
                this.insertNewParagraph(removedElements, theBody.childNodes[i]);
                removedElements = new Array();
            }
        }
        if (removedElements.length > 0) {
            this.insertNewParagraph(removedElements);
        }
    }
    return true;
}
widgEditor.prototype.refreshDisplay = function () {
    if (this.wysiwyg) {
        this.theIframe.contentWindow.document.getElementsByTagName("body")[0].innerHTML = this.theInput.value;
    } else {
        this.theTextarea.value = this.theInput.value;
    }
    return true;
}
widgEditor.prototype.switchMode = function () {
    if (!this.locked) {
        this.locked = true;
        if (this.wysiwyg) {
            this.updateWidgInput();
            this.theTextarea.value = this.theInput.value;
            this.theTextarea.style.height = this.theIframe.offsetHeight - 4 + 'px';
            this.theContainer.addClassName('state-html');
            this.theContainer.replaceChild(this.theTextarea, this.theIframe);
            this.wysiwyg = false;
            this.locked = false;
            SOUP.Admin.input_autoexpand(this.theTextarea);
            setTimeout("$('" + this.theTextarea.id + "').focus()", 100);
        } else {
            this.updateWidgInput();
            this.theContainer.replaceChild(this.theIframe, this.theTextarea);
            this.theContainer.removeClassName('state-html');
            this.writeDocument(this.theInput.value);
            this.initEdit();
            this.wysiwyg = true;
            SOUP.Public.focus(this.theIframe);
        }
    }
    return true;
}
widgEditor.prototype.updateWidgInput = function () {
    if (this.wysiwyg) {
        if (!this.IE) this.convertSPANs(true);
        this.paragraphise();
        this.cleanSource();
    } else {
        this.theInput.value = this.theTextarea.value;
    }
    return true;
}
widgEditor.prototype.writeDocument = function (documentContent) {
    if (!documentContent) documentContent = '<br />';
    var documentTemplate = "\
  <html>\
   <head>\
    <style type=\"text/css\">@import url(\"INSERT:STYLESHEET:END\");</style>\
   </head>\
   <body id=\"iframeBody\" style=\"height:70%\">\
    INSERT:CONTENT:END\
   </body>\
  </html>\
 ";
    documentTemplate = documentTemplate.replace(/INSERT:STYLESHEET:END/, widgStylesheet);
    documentTemplate = documentTemplate.replace(/INSERT:CONTENT:END/, documentContent);
    this.theIframe.contentWindow.document.open();
    this.theIframe.contentWindow.document.write(documentTemplate);
    this.theIframe.contentWindow.document.close();
    return true;
}
function widgToolbar(theEditor, items) {
    var self = this;
    this.widgEditorObject = theEditor;
    this.theList = document.createElement("ul");
    this.theList.id = this.widgEditorObject.theInput.id + "WidgToolbar";
    this.theList.className = "widgToolbar";
    this.theList.widgToolbarObject = this;
    for (var i = 0; i < items.length; i++) {
        switch (items[i]) {
        case "bold":
            this.addButton(this.theList.id + "ButtonBold", "widgButtonBold", "Bold", "bold");
            break;
        case "italic":
            this.addButton(this.theList.id + "ButtonItalic", "widgButtonItalic", "Italic", "italic");
            break;
        case "hyperlink":
            this.addButton(this.theList.id + "ButtonLink", "widgButtonLink", "Hyperlink", "link");
            break;
        case "unorderedlist":
            this.addButton(this.theList.id + "ButtonUnordered", "widgButtonUnordered", "Unordered List", "insertunorderedlist");
            break;
        case "orderedlist":
            this.addButton(this.theList.id + "ButtonOrdered", "widgButtonOrdered", "Ordered List", "insertorderedlist");
            break;
        case "image":
            this.addButton(this.theList.id + "ButtonImage", "widgButtonImage", "Insert Image", "image");
            break;
        case "htmlsource":
            this.addButton(this.theList.id + "ButtonHTML", "widgButtonHTML", "HTML Source", "html");
            break;
        case "blockformat":
            this.addSelect(this.theList.id + "SelectBlock", "widgSelectBlock", widgSelectBlockOptions, "formatblock");
            break;
        }
    }
    return true;
}
widgToolbar.prototype.addButton = function (theID, theClass, theLabel, theAction) {
    var menuItem = document.createElement("li");
    var theLink = document.createElement("a");
    var theText = document.createTextNode(theLabel);
    menuItem.id = theID;
    menuItem.className = "widgEditButton";
    theLink.href = "#";
    theLink.title = theLabel;
    theLink.className = theClass;
    menuItem.className = theClass;
    theLink.action = theAction;
    theLink.onclick = widgToolbarAction;
    theLink.onmouseover = widgToolbarMouseover;
    theLink.appendChild(theText);
    menuItem.appendChild(theLink);
    this.theList.appendChild(menuItem);
    return true;
}
widgToolbar.prototype.addSelect = function (theID, theClass, theContentArray, theAction) {
    var menuItem = document.createElement("li");
    var theSelect = document.createElement("select");
    menuItem.className = "widgEditSelect";
    theSelect.id = theID;
    theSelect.name = theID;
    theSelect.className = theClass;
    theSelect.action = theAction;
    theSelect.onchange = widgToolbarAction;
    for (var i = 0; i < theContentArray.length; i += 2) {
        var theOption = document.createElement("option");
        var theText = document.createTextNode(theContentArray[i + 1]);
        theOption.value = theContentArray[i];
        theOption.appendChild(theText);
        theSelect.appendChild(theOption);
    }
    menuItem.appendChild(theSelect);
    this.theList.appendChild(menuItem);
    return true;
}
widgToolbar.prototype.disable = function () {
    this.theList.className += " widgSource";
    for (var i = 0; i < this.theList.childNodes.length; i++) {
        var theChild = this.theList.childNodes[i];
        if (theChild.nodeName.toLowerCase() == "li" && theChild.className == "widgEditSelect") {
            for (j = 0; j < theChild.childNodes.length; j++) {
                if (theChild.childNodes[j].nodeName.toLowerCase() == "select") {
                    theChild.childNodes[j].disabled = "disabled";
                    break;
                }
            }
        }
    }
    return true;
}
widgToolbar.prototype.enable = function () {
    this.theList.className = this.theList.className.replace(/ widgSource/, "");
    for (var i = 0; i < this.theList.childNodes.length; i++) {
        var theChild = this.theList.childNodes[i];
        if (theChild.nodeName.toLowerCase() == "li" && theChild.className == "widgEditSelect") {
            for (j = 0; j < theChild.childNodes.length; j++) {
                if (theChild.childNodes[j].nodeName.toLowerCase() == "select") {
                    theChild.childNodes[j].disabled = "";
                    break;
                }
            }
        }
    }
    return true;
}
widgToolbar.prototype.setState = function (theState, theStatus) {
    if (theState != "SelectBlock") {
        var theButton = document.getElementById(this.theList.id + "Button" + theState);
        if (theButton != null) {
            if (theStatus == "on") {
                theButton.addClassName("on");
            } else {
                theButton.removeClassName("on");
            }
        }
    } else {
        var theSelect = document.getElementById(this.theList.id + "SelectBlock");
        if (theSelect != null) {
            theSelect.value = "";
            theSelect.value = theStatus;
        }
    }
    return true;
}
widgEditor.prototype.insert = function (html) {
    var selection, range, container;
    if (this.theIframe.contentWindow.document.selection) {
        selection = this.theIframe.contentWindow.document.selection;
        range = selection.createRange();
        range.collapse(false);
        range.pasteHTML(html);
    } else {
        try {
            selection = this.theIframe.contentWindow.getSelection();
        } catch(e) {
            return false;
        }
        range = selection.getRangeAt(0);
        range.collapse(false);
        var container = this.theIframe.contentWindow.document.createElement('span');
        container.innerHTML = html;
        range.insertNode(container);
    }
}
function widgToolbarAction() {
    var theToolbar = this.parentNode.parentNode.widgToolbarObject;
    var theWidgEditor = theToolbar.widgEditorObject;
    var theIframe = theWidgEditor.theIframe;
    var theSelection = "";
    if (!theWidgEditor.wysiwyg && this.action != "html") {
        return false;
    }
    switch (this.action) {
    case "formatblock":
        theIframe.contentWindow.document.execCommand(this.action, false, this.value);
        theWidgEditor.theToolbar.setState("SelectBlock", this.value);
        break;
    case "html":
        theWidgEditor.switchMode();
        break;
    case "link":
        if (theIframe.contentWindow.document.selection) {
            theSelection = theIframe.contentWindow.document.selection.createRange().text;
        } else {
            theSelection = theIframe.contentWindow.getSelection();
        }
        if (this.parentNode.hasClassName("on")) {
            if (theWidgEditor.objectAtCursor && theWidgEditor.objectAtCursor.href) {
                var theURL = prompt("Enter the URL for this link:", theWidgEditor.objectAtCursor.href);
                if (theURL != null) {
                    theIframe.contentWindow.document.execCommand("Unlink", false, null);
                    theWidgEditor.theToolbar.setState("Link", "off");
                } else {
                    theWidgEditor.objectAtCursor.href = theURL;
                }
            }
        } else {
            var theURL = prompt("Enter the URL for this link:", "http://");
            if (theURL != null) {
                if (theSelection == '') {
                    theWidgEditor.insert('<a href="' + theURL + '">' + theURL + '</a>');
                } else {
                    theIframe.contentWindow.document.execCommand("CreateLink", false, theURL);
                    theWidgEditor.theToolbar.setState("Link", "on");
                }
            }
        }
        break;
    case "image":
        var theImage = prompt("Enter the location for this image:", "");
        if (theImage != null && theImage != "") {
            var theAlt = prompt("Enter the alternate text for this image:", "");
            var theSelection = null;
            var theRange = null;
            if (theIframe.contentWindow.document.selection) {
                theAlt = theAlt.replace(/"/g, "'");
                theSelection = theIframe.contentWindow.document.selection;
                theRange = theSelection.createRange();
                theRange.collapse(false);
                theRange.pasteHTML("<img alt=\"" + theAlt + "\" src=\"" + theImage + "\" />");
                break;
            }
            else {
                try {
                    theSelection = theIframe.contentWindow.getSelection();
                }
                catch(e) {
                    return false;
                }
                theRange = theSelection.getRangeAt(0);
                theRange.collapse(false);
                var theImageNode = theIframe.contentWindow.document.createElement("img");
                theImageNode.src = theImage;
                theImageNode.alt = theAlt;
                theRange.insertNode(theImageNode);
                break;
            }
        }
        else {
            return false;
        }
    default:
        theIframe.contentWindow.document.execCommand(this.action, false, null);
        var theAction = this.action.replace(/^./, function (match) {
            return match.toUpperCase();
        });
        if (this.action == "insertorderedlist") {
            theAction = "Ordered";
            theWidgEditor.theToolbar.setState("Unordered", "off");
        }
        if (this.action == "insertunorderedlist") {
            theAction = "Unordered";
            theWidgEditor.theToolbar.setState("Ordered", "off");
        }
        if (theIframe.contentWindow.document.queryCommandState(this.action, false, null)) {
            theWidgEditor.theToolbar.setState(theAction, "on");
        }
        else {
            theWidgEditor.theToolbar.setState(theAction, "off");
        }
    }
    if (theWidgEditor.wysiwyg == true) {
        theIframe.contentWindow.focus();
    } else {
        theWidgEditor.theTextarea.focus();
    }
    return false;
}
function widgToolbarCheckState(theWidgEditor, resubmit) {
    if (!resubmit) {
        setTimeout(function () {
            widgToolbarCheckState(theWidgEditor, true);
            return true;
        },
        500);
    }
    var theSelection = null;
    var theRange = null;
    var theParentNode = null;
    var theLevel = 0;
    var menuListItems = theWidgEditor.theToolbar.theList.childNodes;
    for (var i = 0; i < menuListItems.length; i++) {
        Element.removeClassName(menuListItems[i], "on");
    }
    if (theWidgEditor.theIframe.contentWindow && theWidgEditor.theIframe.contentWindow.document.selection) {
        theSelection = theWidgEditor.theIframe.contentWindow.document.selection;
        theRange = theSelection.createRange();
        try {
            theParentNode = theRange.parentElement();
        }
        catch(e) {
            return false;
        }
    }
    else {
        try {
            theSelection = theWidgEditor.theIframe.contentWindow.getSelection();
            theRange = theSelection.getRangeAt(0);
            theParentNode = theRange.commonAncestorContainer;
        }
        catch(e) {
            return false;
        }
    }
    while (theParentNode.nodeType == 3) {
        theParentNode = theParentNode.parentNode;
    }
    while (theParentNode.nodeName.toLowerCase() != "body") {
        if (theLevel == 0) theWidgEditor.objectAtCursor = theParentNode;
        switch (theParentNode.nodeName.toLowerCase()) {
        case "a":
            theWidgEditor.theToolbar.setState("Link", "on");
            break;
        case "em":
            theWidgEditor.theToolbar.setState("Italic", "on");
            break;
        case "li":
            break;
        case "ol":
            theWidgEditor.theToolbar.setState("Ordered", "on");
            theWidgEditor.theToolbar.setState("Unordered", "off");
            break;
        case "span":
            if (theParentNode.getAttribute("style") == "font-weight: bold;") {
                theWidgEditor.theToolbar.setState("Bold", "on");
            }
            else if (theParentNode.getAttribute("style") == "font-style: italic;") {
                theWidgEditor.theToolbar.setState("Italic", "on");
            }
            else if (theParentNode.getAttribute("style") == "font-weight: bold; font-style: italic;") {
                theWidgEditor.theToolbar.setState("Bold", "on");
                theWidgEditor.theToolbar.setState("Italic", "on");
            }
            else if (theParentNode.getAttribute("style") == "font-style: italic; font-weight: bold;") {
                theWidgEditor.theToolbar.setState("Bold", "on");
                theWidgEditor.theToolbar.setState("Italic", "on");
            }
            break;
        case "strong":
            theWidgEditor.theToolbar.setState("Bold", "on");
            break;
        case "ul":
            theWidgEditor.theToolbar.setState("Unordered", "on");
            theWidgEditor.theToolbar.setState("Ordered", "off");
            break;
        default:
            theWidgEditor.theToolbar.setState("SelectBlock", "<" + theParentNode.nodeName.toLowerCase() + ">");
            break;
        }
        theParentNode = theParentNode.parentNode;
        theLevel++;
    }
    return true;
}
function widgToolbarMouseover() {
    window.status = "";
    return true;
}
function acceptableChildren(theNode) {
    var theChildren = theNode.childNodes;
    for (var i = 0; i < theChildren.length; i++) {
        if (!theChildren[i].nodeName.isAcceptedElementName()) {
            if (!theChildren[i].nodeName.isInlineName()) {
                if (theNode.nodeName.toLowerCase() == "p") {
                    acceptableChildren(replaceNodeWithChildren(theNode));
                    return true;
                }
                changeNodeType(theChildren[i], "p");
            }
            else {
                replaceNodeWithChildren(theChildren[i]);
            }
            i = -1;
        }
    }
    for (var i = 0; i < theChildren.length; i++) {
        acceptableChildren(theChildren[i]);
    }
    return true;
}
function changeNodeType(theNode, nodeType) {
    var theChildren = new Array();
    var theNewNode = document.createElement(nodeType);
    var theParent = theNode.parentNode;
    if (theParent != null) {
        for (var i = 0; i < theNode.childNodes.length; i++) {
            theChildren.push(theNode.childNodes[i].cloneNode(true));
        }
        for (var i = 0; i < theChildren.length; i++) {
            theNewNode.appendChild(theChildren[i]);
        }
        theParent.replaceChild(theNewNode, theNode);
    }
    return true;
}
function replaceNodeWithChildren(theNode) {
    var theChildren = new Array();
    var theParent = theNode.parentNode;
    if (theParent != null) {
        for (var i = 0; i < theNode.childNodes.length; i++) {
            theChildren.push(theNode.childNodes[i].cloneNode(true));
        }
        for (var i = 0; i < theChildren.length; i++) {
            theParent.insertBefore(theChildren[i], theNode);
        }
        theParent.removeChild(theNode);
        return theParent;
    }
    return true;
}
String.prototype.isAcceptedElementName = function () {
    var elementList = new Array("#text", "a", "em", "p", "strong");
    var theName = this.toLowerCase();
    for (var i = 0; i < elementList.length; i++) {
        if (theName == elementList[i]) return true;
    }
    return false;
}
String.prototype.isInlineName = function () {
    var inlineList = new Array("#text", "a", "em", "font", "span", "strong", "u");
    var theName = this.toLowerCase();
    for (var i = 0; i < inlineList.length; i++) {
        if (theName == inlineList[i]) return true;
    }
    return false;
}
String.prototype.reverse = function () {
    var theString = "";
    for (var i = this.length - 1; i >= 0; i--) {
        theString += this.charAt(i);
    }
    return theString;
}
String.prototype.validTags = function () {
    var theString = this;
    theString = theString.replace(/<[^> ]*/g, function (match) {
        return match.toLowerCase();
    });
    theString = theString.replace(/<[^>]*>/g, function (match) {
        match = match.replace(/ [^=]+=/g, function (match2) {
            return match2.toLowerCase();
        });
        return match;
    });
    theString = theString.replace(/<[^>]*>/g, function (match) {
        match = match.replace(/( [^=]+=)([^"][^ >]*)/g, "$1\"$2\"");
        return match;
    });
    return theString;
}
function copy_font_styles(o, n) {
    if (o && n) {
        n.style.fontFamily = Element.getStyle(o, 'fontFamily');
        n.style.fontSize = Element.getStyle(o, 'fontSize');
        n.style.letterSpacing = Element.getStyle(o, 'letterSpacing');
        n.style.lineHeight = Element.getStyle(o, 'lineHeight');
        n.style.fontWeight = Element.getStyle(o, 'fontWeight');
        n.style.fontStyle = Element.getStyle(o, 'fontStyle');
        n.style.color = Element.getStyle(o, 'color');
        n.style.backgroundColor = Element.getStyle(o, 'backgroundColor');
    }
}