let effectsStack = [];
let batchDepth = 0;
let batchSignalsToNotify = new Set();

const ARRAY_MUTATING_METHODS = new Set([
  "push",
  "pop",
  "splice",
  "shift",
  "unshift",
  "sort",
  "reverse",
]);
const SET_MUTATING_METHODS = new Set(["add", "delete", "clear"]);
const MAP_MUTATING_METHODS = new Set(["set", "delete", "clear"]);
const DATE_MUTATING_METHODS_PREFIX = "set";
const TYPED_ARRAY_MUTATING_METHOD = "set";

const isMutableType = (obj) =>
  obj !== null &&
  typeof obj === "object" &&
  !(obj instanceof WeakMap) &&
  !(obj instanceof WeakSet);

const didMutate = (target, method, beforeSize) => {
  if (Array.isArray(target)) {
    return ARRAY_MUTATING_METHODS.has(method);
  }

  if (target instanceof Set) {
    return beforeSize !== target.size || SET_MUTATING_METHODS.has(method);
  }

  if (target instanceof Map) {
    return beforeSize !== target.size || MAP_MUTATING_METHODS.has(method);
  }

  if (target instanceof Date) {
    return method.startsWith(DATE_MUTATING_METHODS_PREFIX);
  }

  if (ArrayBuffer.isView(target)) {
    return method === TYPED_ARRAY_MUTATING_METHOD;
  }

  return true;
};

const reactiveCache = new WeakMap();
const makeReactive = (obj, notifyFn) => {
  if (reactiveCache.has(obj)) {
    return reactiveCache.get(obj);
  }

  if (!isMutableType(obj)) {
    return obj;
  }

  const proxy = new Proxy(obj, {
    get: (target, prop) => {
      const value = target[prop];

      if (typeof value === "function") {
        return (...args) => {
          const beforeSize = target.size ?? target.length ?? null;
          const result = value.apply(target, args);

          if (didMutate(target, prop, beforeSize)) {
            notifyFn();
          }

          return result;
        };
      }

      return isMutableType(value) ? makeReactive(value, notifyFn) : value;
    },
    set: (target, prop, value) => {
      if (target[prop] !== value) {
        target[prop] = value;

        notifyFn();
      }
      return true;
    },
    deleteProperty: (target, prop) => {
      if (prop in target) {
        delete target[prop];

        notifyFn();
      }
      return true;
    },
  });

  reactiveCache.set(obj, proxy);

  return proxy;
};

class SignalBaseClass {
  constructor() {
    this.subscribers = new Set();
  }

  subscribe(onUpdate) {
    this.subscribers.add(onUpdate);

    return () => {
      this.subscribers.delete(onUpdate);
    };
  }

  notify() {
    for (const subscriber of this.subscribers) {
      subscriber();
    }
  }
}

const componentContextsStack = [];

class ComponentContext {
  _component;
  _effectsStack;

  constructor(component) {
    this._component = component;
    this._effectsStack = [];
  }
}

class Effect {
  _callback;
  _callbackCleanup;
  _dependencyDisposes;
  _dependencies;
  _disposed;

  constructor(callback) {
    this._callback = callback;
    this._dependencyDisposes = new Set();
    this._dependencies = new Set();
    this._disposed = false;
  }

  _run() {
    this._callbackCleanup?.();
    this._callbackCleanup = this._callback?.();
  }

  _addDependency(signalInstance) {
    if (!this._dependencies.has(signalInstance)) {
      const signalDispose = signalInstance.subscribe(() => this._run());

      this._dependencyDisposes.add(signalDispose);
      this._dependencies.add(signalInstance);
    }
  }

  _dispose() {
    if (this._disposed) {
      return;
    }

    this._callbackCleanup?.();
    this._callbackCleanup = null;

    for (const signalDispose of this._dependencyDisposes) {
      try {
        signalDispose();
      } catch (e) {
        console.error(e);
      }
    }

    this._dependencyDisposes.clear();
    this._dependencies.clear();
  }
}

class Signal extends SignalBaseClass {
  _value;

  constructor(initialValue) {
    super();

    this._value = makeReactive(initialValue, () => this.notify());
  }

  get value() {
    this._track();

    return this.peek();
  }

  peek() {
    return this._value;
  }

  set value(newValue) {
    if (this._value !== newValue) {
      this._value = makeReactive(newValue, () => this.notify());
      this.notify();
    }
  }

  _track() {
    const currentEffect =
      effectsStack.length > 0 ? effectsStack[effectsStack.length - 1] : null;

    currentEffect?._addDependency(this);
  }

  notify() {
    if (batchDepth > 0) {
      batchSignalsToNotify.add(this);
    } else {
      super.notify();
    }
  }
}

class ComputedSignal extends SignalBaseClass {
  _computation;
  _value;
  _dirty;
  _effectRan;
  _computing;

  constructor(computation) {
    super();

    this._computation = computation;
    this._effectRan = false;
    this._dirty = true;

    effect(() => {
      if (!this._effectRan) {
        this._compute();
        this._effectRan = true;
      } else if (!this._dirty) {
        this._dirty = true;
        this.notify();
      }
    });
  }

  get value() {
    this._track();

    return this.peek();
  }

  peek() {
    if (this._dirty) {
      this._compute(false);
    }

    return this._value;
  }

  _track() {
    const currentEffect =
      effectsStack.length > 0 ? effectsStack[effectsStack.length - 1] : null;

    if (currentEffect != null) {
      currentEffect?._addDependency(this);
    }
  }

  _compute() {
    if (this._computing) {
      return;
    }

    this._computing = true;
    const newValue = this._computation();
    this._computing = false;

    if (this._value !== newValue) {
      this._value = newValue;
      this._dirty = false;
    }
  }
}

export function signal(initialValue) {
  return new Signal(initialValue);
}

export function computed(computation) {
  return new ComputedSignal(computation);
}

export function effect(callback) {
  const effectInstance = new Effect(callback);

  effectsStack.push(effectInstance);

  const currentComponentContext =
    componentContextsStack.length > 0
      ? componentContextsStack[componentContextsStack.length - 1]
      : null;

  if (currentComponentContext != null) {
    currentComponentContext._effectsStack.push(effectInstance);
  }

  try {
    effectInstance._run();
  } finally {
    effectsStack.pop();
  }

  return () => {
    return effectInstance._dispose();
  };
}

export function untracked(callback) {
  let result;

  effectsStack.push(null);

  try {
    result = callback();
  } finally {
    effectsStack.pop();
  }

  return result;
}

export function batch(callback) {
  batchDepth += 1;

  try {
    callback();
  } finally {
    batchDepth -= 1;
  }

  if (batchDepth === 0) {
    const signalsToNotify = Array.from(batchSignalsToNotify);

    batchSignalsToNotify.clear();

    for (const signalInstance of signalsToNotify) {
      signalInstance.notify();
    }
  }
}

export const WithSignals = (BaseClass) => {
  return class extends BaseClass {
    __updateTimestamp;
    __previousUpdateTimestamp;
    __effectInstance;
    __effectsStack;
    __componentContext;

    constructor() {
      super();

      const component = this;

      this.__effectsStack = [];

      this.__effectInstance = new Effect(() => {
        component.__updateTimestamp = Date.now();
      });

      this.__effectInstance._run();

      const componentContext = new ComponentContext(component);
      this.__componentContext = componentContext;

      componentContextsStack.push(componentContext);
    }

    __triggerSignals() {
      effectsStack.push(this.__effectInstance);

      this.__previousUpdateTimestamp = this.__updateTimestamp;
    }

    render() {
      this.__triggerSignals();

      return super.render?.();
    }

    renderedCallback() {
      effectsStack.pop();

      super.renderedCallback?.();
    }

    disconnectedCallback() {
      this.__effectInstance?._dispose();
      componentContextsStack.pop();

      for (const effectInstance of this.__componentContext._effectsStack) {
        try {
          effectInstance._dispose();
        } catch (e) {
          console.error(e);
        }
      }

      super.disconnectedCallback?.();
    }
  };
};
