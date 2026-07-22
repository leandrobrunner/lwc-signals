const effectsStack = [];
const batchSignalsToNotify = new Set();
let batchDepth = 0;

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

const isReactiveTarget = (obj) => {
  if (obj === null || typeof obj !== "object") return false;
  const proto = Object.getPrototypeOf(obj);
  return (
    (proto === Object.prototype || proto === null) ||
    Array.isArray(obj) ||
    obj instanceof Map ||
    obj instanceof Set
  );
};

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

  return true;
};

const reactiveCache = new WeakMap();
const makeReactive = (obj, notifyFn) => {
  if (reactiveCache.has(obj)) {
    return reactiveCache.get(obj);
  }

  if (!isReactiveTarget(obj)) {
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

      return isReactiveTarget(value) ? makeReactive(value, notifyFn) : value;
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
    if (this._disposed) {
      return;
    }

    if (typeof this._callbackCleanup === "function") {
      this._callbackCleanup();
    }

    let _callbackCleanup;

    try {
      _callbackCleanup = this._callback?.();
    } finally {
      this._callbackCleanup = _callbackCleanup;
    }
  }

  _addDependency(signalInstance) {
    if (this._disposed) {
      return;
    }

    if (!this._dependencies.has(signalInstance)) {
      const signalSubscriptionDispose = signalInstance.subscribe(() =>
        this._run(),
      );

      this._dependencyDisposes.add(signalSubscriptionDispose);
      this._dependencies.add(signalInstance);
    }
  }

  _dispose() {
    if (this._disposed) {
      return;
    }

    this._disposed = true;

    if (typeof this._callbackCleanup === "function") {
      this._callbackCleanup?.();
    }

    this._callbackCleanup = null;

    for (const signalDispose of this._dependencyDisposes) {
      signalDispose();
    }

    this._dependencyDisposes.clear();
    this._dependencies.clear();
    this._dependencyDisposes = null;
    this._dependencies = null;
    this._callback = null;
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
  }

  _validateEffect() {
    if (this._effectRan) {
      return;
    }

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
      this._compute();
    }

    return this._value;
  }

  _track() {
    this._validateEffect();

    const currentEffect =
      effectsStack.length > 0 ? effectsStack[effectsStack.length - 1] : null;

    currentEffect?._addDependency(this);
  }

  _compute() {
    if (this._computing) {
      return;
    }

    this._computing = true;

    let value;

    try {
      value = this._computation();
    } catch (e) {
      console.error(e);

      value = this._value;
    }

    this._computing = false;

    if (this._value !== value) {
      this._value = value;
    }

    this._dirty = false;
  }

  subscribe(onUpdate) {
    this._validateEffect();

    return super.subscribe(onUpdate);
  }

  notify() {
    if (batchDepth > 0) {
      batchSignalsToNotify.add(this);
    } else {
      super.notify();
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
  let effectInstance = new Effect(() => {
    let callbackCleanup;

    try {
      callbackCleanup = callback?.();
    } catch (e) {
      console.error(e);
    }

    return callbackCleanup;
  });

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
    effectInstance?._dispose();
    effectInstance = null;
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
    __componentContext;

    constructor() {
      super();

      const componentContext = new ComponentContext(this);
      this.__componentContext = componentContext;

      componentContextsStack.push(componentContext);
    }

    __validateEffect() {
      if (this.__effectInstance != null) {
        return;
      }

      this.__effectInstance = new Effect(() => {
        this.__updateTimestamp = Date.now();
      });

      this.__effectInstance._run();
    }

    __triggerSignals() {
      this.__validateEffect();
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
      this.__effectInstance = null;

      componentContextsStack.pop();

      for (const effectInstance of this.__componentContext._effectsStack) {
        try {
          effectInstance._dispose();
        } catch (e) {
          console.error(e);
        }
      }

      this.__componentContext._effectsStack.length = 0;

      super.disconnectedCallback?.();
    }
  };
};
