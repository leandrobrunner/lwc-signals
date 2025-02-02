import {
  signal,
  computed,
  effect,
  untracked,
  batch,
  WithSignals,
} from "c/signals";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
});

describe("Signal", () => {
  test("should allow subscription and notify subscribers", () => {
    const firstName = signal("John");
    const mockSubscriber = jest.fn();

    const unsubscribe = firstName.subscribe(mockSubscriber);
    firstName.value = "Jane";

    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(1);
    expect(firstName.peek()).toBe("Jane");

    unsubscribe();
    firstName.value = "John";

    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(1); // No calls after unsubscribe
  });

  test("should only notify when value changes", () => {
    const lastName = signal("Doe");
    const mockSubscriber = jest.fn();
    lastName.subscribe(mockSubscriber);

    lastName.value = "Doe"; // No change
    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(0);

    lastName.value = "Smith"; // Value changes
    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(1);
  });
});

describe("ComputedSignal", () => {
  test("should compute values based on dependencies", () => {
    const firstName = signal("John");
    const lastName = signal("Doe");

    const fullName = computed(() => `${firstName.value} ${lastName.value}`);
    expect(fullName.value).toBe("John Doe");

    firstName.value = "Jane";
    jest.runAllTimers();

    expect(fullName.value).toBe("Jane Doe");

    lastName.value = "Smith";
    jest.runAllTimers();

    expect(fullName.value).toBe("Jane Smith");
  });

  test("should notify subscribers of computed signals", () => {
    const firstName = signal("John");
    const lastName = signal("Doe");
    const fullName = computed(() => `${firstName.value} ${lastName.value}`);
    const mockSubscriber = jest.fn();

    fullName.subscribe(mockSubscriber);

    firstName.value = "Jane";
    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(1);
    expect(fullName.peek()).toBe("Jane Doe");

    lastName.value = "Smith";
    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(2);
    expect(fullName.peek()).toBe("Jane Smith");
  });

  test("should handle nested computed signals", () => {
    const firstName = signal("John");
    const lastName = signal("Doe");

    const fullName = computed(() => `${firstName.value} ${lastName.value}`);
    const fullNameWithTitle = computed(() => `Full Name: ${fullName.value}`);

    expect(fullNameWithTitle.value).toBe("Full Name: John Doe");

    firstName.value = "Jane";
    jest.runAllTimers();

    expect(fullNameWithTitle.value).toBe("Full Name: Jane Doe");
  });
});

describe("Effect", () => {
  test("should trigger effect on dependency changes", () => {
    const firstName = signal("John");
    const mockEffect = jest.fn();

    effect(() => {
      mockEffect(firstName.value);
    });

    expect(mockEffect).toHaveBeenCalledWith("John");

    firstName.value = "Jane";
    jest.runAllTimers();

    expect(mockEffect).toHaveBeenCalledWith("Jane");
  });

  test("should handle cascading effects", () => {
    const firstName = signal("John");
    const lastName = signal("Doe");
    const fullName = computed(() => `${firstName.value} ${lastName.value}`);
    const mockEffect = jest.fn();

    effect(() => {
      mockEffect(fullName.value);
    });

    expect(mockEffect).toHaveBeenCalledWith("John Doe");

    firstName.value = "Jane";
    jest.runAllTimers();

    expect(mockEffect).toHaveBeenCalledWith("Jane Doe");

    lastName.value = "Smith";
    jest.runAllTimers();

    expect(mockEffect).toHaveBeenCalledWith("Jane Smith");
  });

  test("should handle cleanup correctly", () => {
    const firstName = signal("John");
    const mockCleanup = jest.fn();

    const dispose = effect(() => {
      return () => mockCleanup();
    });

    firstName.value = "Jane";
    jest.runAllTimers();

    expect(mockCleanup).toHaveBeenCalledTimes(0);

    dispose();
    firstName.value = "John";
    jest.runAllTimers();

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });
});

describe("Batch Operations", () => {
  test("should batch multiple signal updates", () => {
    const count = signal(0);
    const mockSubscriber = jest.fn();
    count.subscribe(mockSubscriber);

    batch(() => {
      count.value = 1;
      count.value = 2;
      count.value = 3;
    });

    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(1);
    expect(count.value).toBe(3);
  });

  test("should handle nested batch operations", () => {
    const count = signal(0);
    const mockSubscriber = jest.fn();
    count.subscribe(mockSubscriber);

    batch(() => {
      count.value = 1;

      batch(() => {
        count.value = 2;
        count.value = 3;
      });

      count.value = 4;
    });

    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(1);
    expect(count.value).toBe(4);
  });
});

describe("Untracked Operations", () => {
  test("should not track signal access in untracked scope", () => {
    const count = signal(0);
    const mockEffect = jest.fn();

    effect(() => {
      mockEffect(untracked(() => count.value));
    });

    count.value = 1;
    jest.runAllTimers();

    expect(mockEffect).toHaveBeenCalledTimes(1);
  });
});

describe("Signal Edge Cases", () => {
  test("should handle undefined and null values", () => {
    const value = signal(undefined);
    expect(value.peek()).toBe(undefined);

    value.value = null;
    jest.runAllTimers();

    expect(value.peek()).toBe(null);
  });

  test("should handle multiple subscriptions and unsubscriptions", () => {
    const count = signal(0);
    const mock1 = jest.fn();
    const mock2 = jest.fn();
    const mock3 = jest.fn();

    const unsub1 = count.subscribe(mock1);
    const unsub2 = count.subscribe(mock2);
    count.subscribe(mock3);

    count.value = 1;
    jest.runAllTimers();

    expect(mock1).toHaveBeenCalledTimes(1);
    expect(mock2).toHaveBeenCalledTimes(1);
    expect(mock3).toHaveBeenCalledTimes(1);

    unsub1();

    count.value = 2;
    jest.runAllTimers();

    expect(mock1).toHaveBeenCalledTimes(1);
    expect(mock2).toHaveBeenCalledTimes(2);
    expect(mock3).toHaveBeenCalledTimes(2);

    unsub2();

    count.value = 3;
    jest.runAllTimers();

    expect(mock1).toHaveBeenCalledTimes(1);
    expect(mock2).toHaveBeenCalledTimes(2);
    expect(mock3).toHaveBeenCalledTimes(3);
  });
});

describe("ComputedSignal Extended", () => {
  test("should handle computed chain reactions", () => {
    const base = signal(1);
    const doubled = computed(() => base.value * 2);
    const quadrupled = computed(() => doubled.value * 2);
    const final = computed(() => quadrupled.value + 1);

    const mockSubscriber = jest.fn();
    final.subscribe(mockSubscriber);

    expect(final.value).toBe(5);

    base.value = 2;
    jest.runAllTimers();

    expect(final.value).toBe(9);
    expect(mockSubscriber).toHaveBeenCalledTimes(1);
  });

  test("should handle circular dependencies gracefully", () => {
    const a = signal(1);
    const b = computed(() => a.value + 1);
    const c = computed(() => b.value + 1);

    a.value = c.value; // This should work without infinite loops
    jest.runAllTimers();

    expect(a.value).toBe(3);
  });
});

describe("Effect Cleanup", () => {
  test("should handle multiple cleanup functions", () => {
    const count = signal(0);
    const mockCleanup1 = jest.fn();
    const mockCleanup2 = jest.fn();

    let cleanup2 = mockCleanup2;

    const dispose = effect(() => {
      expect(count.value).not.toBe(undefined);

      cleanup2 = mockCleanup2;

      return () => {
        mockCleanup1();
        cleanup2();
      };
    });

    count.value = 1;
    jest.runAllTimers();

    expect(mockCleanup1).toHaveBeenCalledTimes(1);
    expect(mockCleanup2).toHaveBeenCalledTimes(1);

    dispose();
    expect(mockCleanup1).toHaveBeenCalledTimes(2);
    expect(mockCleanup2).toHaveBeenCalledTimes(2);
  });
});

describe("WithSignals", () => {
  const originalCrypto = global.crypto;

  beforeEach(() => {
    Object.defineProperty(global, "crypto", {
      value: { randomUUID: () => "test-uuid" },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(global, "crypto", {
      value: originalCrypto,
      writable: true,
    });
  });

  const counter = signal(0);

  class MockLightningComponent {
    isConnected = true;
    renderedCallback() {}
    render() {}
  }

  class MockComponent extends WithSignals(MockLightningComponent) {
    counter = counter;
  }

  test("should handle signal updates in component lifecycle", () => {
    const instance = new MockComponent();
    const mockRender = jest.spyOn(instance, "render");
    const mockRenderedCallback = jest.spyOn(instance, "renderedCallback");

    instance.render();

    expect(instance.counter.value).toBe(0);

    jest.runAllTimers();

    instance.renderedCallback();

    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(instance.__updateTimestamp).toBeDefined();
    expect(instance.__previousUpdateTimestamp).toBeDefined();
    expect(mockRenderedCallback).toHaveBeenCalledTimes(1);

    counter.value = 1;
    jest.runAllTimers();

    instance.render();

    jest.runAllTimers();

    expect(instance.counter.value).toBe(1);

    instance.renderedCallback();

    expect(mockRender).toHaveBeenCalledTimes(2);
    expect(instance.__updateTimestamp).toBeDefined();
    expect(
      instance.__previousUpdateTimestamp === undefined ||
        instance.__previousUpdateTimestamp === instance.__updateTimestamp
    ).toBeTruthy();
    expect(mockRenderedCallback).toHaveBeenCalledTimes(2);

    counter.value = 2;
    jest.runAllTimers();

    instance.render();

    expect(instance.counter.value).toBe(2);

    jest.runAllTimers();

    instance.renderedCallback();

    expect(mockRender).toHaveBeenCalled();
    expect(instance.__updateTimestamp).toBeDefined();
    expect(instance.__previousUpdateTimestamp).toBeDefined();
    expect(mockRenderedCallback).toHaveBeenCalledTimes(3);
  });

  test("should cleanup disconnected components", () => {
    const instance = new MockComponent();
    const testSignal = signal("test");

    instance.render();
    expect(testSignal.value).toBe("test");

    instance.disconnectedCallback();

    testSignal.value = "updated";
    jest.runAllTimers();

    // Component should be removed from signal's tracking
    expect(instance.__effectInstance).toBeDefined();
    expect(instance.__effectInstance._dependencies?.size).toBe(0);
    expect(instance.__effectInstance._dependencyDisposes?.size).toBe(0);
  });
});

describe("Signal Deep Reactivity", () => {
  test("should update when modifying object properties", () => {
    const todo = signal({ completed: false, text: "Task" });
    const mockSubscriber = jest.fn();
    todo.subscribe(mockSubscriber);

    expect(todo.value.completed).toBe(false);

    todo.value.completed = true; // Modify nested property
    jest.runAllTimers();

    expect(todo.value.completed).toBe(true);
    expect(mockSubscriber).toHaveBeenCalledTimes(1); // Ensure reactivity
  });

  test("should track array mutations (push, pop, splice)", () => {
    const list = signal([]);

    const mockSubscriber = jest.fn();
    list.subscribe(mockSubscriber);

    list.value.push("Task 1");
    jest.runAllTimers();

    expect(list.value).toEqual(["Task 1"]);
    expect(mockSubscriber).toHaveBeenCalledTimes(1);

    list.value.pop();
    jest.runAllTimers();

    expect(list.value).toEqual([]);
    expect(mockSubscriber).toHaveBeenCalledTimes(2);

    list.value.push("Task 2");
    list.value.push("Task 3");
    list.value.splice(0, 1); // Remove first item
    jest.runAllTimers();

    expect(list.value).toEqual(["Task 3"]);
    expect(mockSubscriber).toHaveBeenCalledTimes(5); // 3 operations triggered updates
  });

  test("should track nested array mutations (push)", () => {
    const todo = signal({ classList: [] });
    const mockSubscriber = jest.fn();
    todo.subscribe(mockSubscriber);

    todo.value.classList.push("important");
    jest.runAllTimers();

    expect(todo.value.classList).toEqual(["important"]);
    expect(mockSubscriber).toHaveBeenCalledTimes(1);
  });

  test("should handle batch updates correctly", () => {
    const todo = signal({ completed: false, text: "Task", classList: [] });
    const mockSubscriber = jest.fn();
    todo.subscribe(mockSubscriber);

    batch(() => {
      todo.value.completed = true;
      todo.value.text = "Updated Task";
      todo.value.classList.push("urgent");
    });

    jest.runAllTimers();

    expect(todo.value.completed).toBe(true);
    expect(todo.value.text).toBe("Updated Task");
    expect(todo.value.classList).toEqual(["urgent"]);
    expect(mockSubscriber).toHaveBeenCalledTimes(1); // Batch should notify only once
  });

  test("should support deleting properties", () => {
    const todo = signal({ completed: false, text: "Task" });
    const mockSubscriber = jest.fn();
    todo.subscribe(mockSubscriber);

    delete todo.value.completed;
    jest.runAllTimers();

    expect(todo.value.completed).toBe(undefined);
    expect(mockSubscriber).toHaveBeenCalledTimes(1);
  });

  test("should not notify if setting the same value", () => {
    const todo = signal({ completed: false });

    const mockSubscriber = jest.fn();
    todo.subscribe(mockSubscriber);

    todo.value.completed = false; // Setting the same value
    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(0); // No redundant notifications
  });

  test("should work with deeply nested objects", () => {
    const state = signal({
      user: {
        name: "Alice",
        settings: {
          theme: "light",
        },
      },
    });

    const mockSubscriber = jest.fn();
    state.subscribe(mockSubscriber);

    state.value.user.settings.theme = "dark";
    jest.runAllTimers();

    expect(state.value.user.settings.theme).toBe("dark");
    expect(mockSubscriber).toHaveBeenCalledTimes(1);
  });

  test("should allow multiple subscriptions", () => {
    const todo = signal({ completed: false });

    const mock1 = jest.fn();
    const mock2 = jest.fn();

    const unsub1 = todo.subscribe(mock1);
    const unsub2 = todo.subscribe(mock2);

    expect(unsub1).not.toBe(undefined);
    expect(unsub2).not.toBe(undefined);

    todo.value.completed = true;
    jest.runAllTimers();

    expect(mock1).toHaveBeenCalledTimes(1);
    expect(mock2).toHaveBeenCalledTimes(1);

    unsub1();

    todo.value.completed = false;
    jest.runAllTimers();

    expect(mock1).toHaveBeenCalledTimes(1); // Unsubscribed
    expect(mock2).toHaveBeenCalledTimes(2);
  });

  test("should track mutations inside an array of objects", () => {
    const todos = signal([
      { id: 1, text: "Task 1", completed: false },
      { id: 2, text: "Task 2", completed: false },
    ]);

    const mockSubscriber = jest.fn();
    todos.subscribe(mockSubscriber);

    todos.value[1].completed = true;
    jest.runAllTimers();

    expect(todos.value[1].completed).toBe(true);
    expect(mockSubscriber).toHaveBeenCalledTimes(1);
  });

  test("should support array filtering and updating items", () => {
    const todos = signal([
      { id: 1, text: "Task 1", completed: false },
      { id: 2, text: "Task 2", completed: false },
    ]);

    const mockSubscriber = jest.fn();
    todos.subscribe(mockSubscriber);

    // Modify an item
    todos.value[1].text = "Updated Task";
    jest.runAllTimers();

    expect(todos.value[1].text).toBe("Updated Task");
    expect(mockSubscriber).toHaveBeenCalledTimes(1);

    // Remove an item
    todos.value = todos.value.filter((todo) => todo.id !== 1);
    jest.runAllTimers();

    expect(todos.value.length).toBe(1);
    expect(mockSubscriber).toHaveBeenCalledTimes(2);
  });

  test("should handle deeply nested array mutations", () => {
    const data = signal({
      list: [
        { name: "Item 1", tags: [] },
        { name: "Item 2", tags: ["important"] },
      ],
    });

    const mockSubscriber = jest.fn();
    data.subscribe(mockSubscriber);

    data.value.list[0].tags.push("urgent");
    jest.runAllTimers();

    expect(data.value.list[0].tags).toEqual(["urgent"]);
    expect(mockSubscriber).toHaveBeenCalledTimes(1);
  });

  test("should work with large array mutations efficiently", () => {
    const numbers = signal(Array(100).fill(0));

    const mockSubscriber = jest.fn();
    numbers.subscribe(mockSubscriber);

    batch(() => {
      for (let i = 0; i < 100; i++) {
        numbers.value[i] = i + 1;
      }
    });
    jest.runAllTimers();

    expect(numbers.value).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    expect(mockSubscriber).toHaveBeenCalledTimes(1); // Only notified once
  });
});

describe("Signal Efficient Mutation Detection", () => {
  test("should update when modifying object properties", () => {
    const todo = signal({ completed: false });
    const mockSubscriber = jest.fn();
    todo.subscribe(mockSubscriber);

    todo.value.completed = true;
    jest.runAllTimers();

    expect(todo.value.completed).toBe(true);
    expect(mockSubscriber).toHaveBeenCalledTimes(1);
  });

  test("should update when calling mutating array methods", () => {
    const list = signal([]);
    const mockSubscriber = jest.fn();
    list.subscribe(mockSubscriber);

    list.value.push("Task 1"); // Mutation
    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(1);

    list.value.pop(); // Mutation
    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(2);
  });

  test("should NOT update when calling read-only array methods", () => {
    const list = signal(["Task 1"]);
    const mockSubscriber = jest.fn();
    list.subscribe(mockSubscriber);

    list.value.map((task) => task); // Read-only
    list.value.filter((task) => task !== "Task 1"); // Read-only

    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(0); // No reactivity
  });

  test("should update when modifying a Map", () => {
    const map = signal(new Map());
    const mockSubscriber = jest.fn();
    map.subscribe(mockSubscriber);

    map.value.set("key", "value"); // Mutation
    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(1);

    map.value.delete("key"); // Mutation
    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(2);
  });

  test("should update when modifying a Set", () => {
    const set = signal(new Set());
    const mockSubscriber = jest.fn();
    set.subscribe(mockSubscriber);

    set.value.add("Task 1"); // Mutation
    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(1);

    set.value.delete("Task 1"); // Mutation
    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(2);
  });

  test("should NOT update when calling read-only Map/Set methods", () => {
    const map = signal(new Map([["key", "value"]]));
    const mockSubscriber = jest.fn();
    map.subscribe(mockSubscriber);

    map.value.get("key"); // Read-only
    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(0);
  });
});

describe("Signal Extra Mutations", () => {
  test("should track Date mutations", () => {
    const date = signal(new Date());
    const mockSubscriber = jest.fn();
    date.subscribe(mockSubscriber);

    date.value.setFullYear(2025); // Mutation
    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(1);
  });

  test("should track TypedArray mutations", () => {
    const buffer = new Uint8Array(10);
    const typedArray = signal(buffer);
    const mockSubscriber = jest.fn();
    typedArray.subscribe(mockSubscriber);

    typedArray.value.set([255], 0); // Mutation
    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(1);
  });

  test("should NOT track WeakMap mutations", () => {
    const weakMap = signal(new WeakMap());
    const mockSubscriber = jest.fn();
    weakMap.subscribe(mockSubscriber);

    weakMap.value.set({}, "value"); // No reactivity
    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(0);
  });

  test("should track Map and Set mutations", () => {
    const map = signal(new Map());
    const mockSubscriber = jest.fn();
    map.subscribe(mockSubscriber);

    map.value.set("key", "value"); // Mutation
    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(1);

    const set = signal(new Set());
    set.subscribe(mockSubscriber);

    set.value.add("Task 1"); // Mutation
    jest.runAllTimers();

    expect(mockSubscriber).toHaveBeenCalledTimes(2);
  });
});
