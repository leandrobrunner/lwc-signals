# LWC Signals

A lightweight reactive state management library for Salesforce Lightning Web Components.

## Features

- 🚀 Fine-grained reactivity
- 📦 Zero dependencies
- 🔄 Deep reactivity for objects and collections
- 📊 Computed values with smart caching
- 🎭 Batch updates for performance
- ⚡ Small and efficient

## About This Library

This library brings the power of signals to Salesforce Lightning Web Components today. While Salesforce has [conceptualized signals](https://www.npmjs.com/package/@lwc/signals) as a future feature for LWC, it's currently just a concept and not available for use. 

This library provides:
- Complete signals implementation
- Rich feature set beyond basic signals:
  - Computed values
  - Effects
  - Batch updates
  - Deep reactivity
  - Manual subscriptions
- Design aligned with Salesforce's signals concept for future compatibility

Inspired by:
- [Preact Signals](https://preactjs.com/guide/v10/signals/) - Fine-grained reactivity system
- Salesforce's signals concept and API design principles

## Installation

### Step 1: Install the Package from [NPM](https://www.npmjs.com/package/lwc-signals)

In your project folder, run:

```
npm install lwc-signals
```

### Step 2: Link the Component to Your Salesforce Project

After installation, link the LWC component from `node_modules` into your Salesforce project so it’s available as a standard Lightning Web Component.

#### On macOS / Linux

Run:

```
ln -s ../../../../node_modules/lwc-signals/dist/signals ./force-app/main/default/lwc/signals
```

#### On Windows

Option A: Using Command Prompt (run as Administrator)

```
mklink /D "force-app\main\default\lwc\signals" "..\..\..\..\node_modules\lwc-signals\dist\signals"
```

Option B: Using PowerShell

```
New-Item -ItemType SymbolicLink -Path "force-app\main\default\lwc\signals" -Target "..\..\..\..\node_modules\lwc-signals\dist\signals"
```

Note: If you are not running as Administrator, enable Developer Mode on Windows to allow symlink creation.

### Step 3: Start Using LWC Signals

You can now import and use the library in your Lightning Web Components. See the Usage section of the README for examples.

## Core Concepts

### Signals
```javascript
const name = signal('John');
console.log(name.value);  // Get value: 'John'
name.value = 'Jane';      // Set value: triggers updates
```

### Computed Values
```javascript
const firstName = signal('John');
const lastName = signal('Doe');

// Updates whenever firstName or lastName changes
const fullName = computed(() => `${firstName.value} ${lastName.value}`);
console.log(fullName.value);  // 'John Doe'
```

### Effects
```javascript
effect(() => {
    // This runs automatically when name.value changes
    console.log(`Name changed to: ${name.value}`);
    
    // Optional cleanup function
    return () => {
        // Cleanup code here
    };
});
```

### Manual Subscriptions
```javascript
const counter = signal(0);

// Subscribe to changes
const unsubscribe = counter.subscribe(() => {
    console.log('Counter changed:', counter.value);
});

counter.value = 1;  // Logs: "Counter changed: 1"

// Stop listening to changes
unsubscribe();
```

## Usage

### Basic Component
```javascript
import { LightningElement } from 'lwc';
import { WithSignals, signal } from 'c/signals';

export default class Counter extends WithSignals(LightningElement) {
    count = signal(0);
    
    increment() {
        this.count.value++;
    }
    
    get doubleCount() {
        return this.count.value * 2;
    }
}
```

```html
<template>
    <div>
        <p>Count: {count.value}</p>
        <p>Double: {doubleCount}</p>
        <button onclick={increment}>Increment</button>
    </div>
</template>
```

### Parent-Child Communication
```javascript
// parent.js
import { LightningElement } from 'lwc';
import { WithSignals, signal } from 'c/signals';

// Signal shared between components
export const parentData = signal('parent data');

export default class Parent extends WithSignals(LightningElement) {
    updateData(event) {
        parentData.value = event.target.value;
    }
}
```

```html
<!-- parent.html -->
<template>
    <div>
        <input value={parentData.value} onchange={updateData} />
        <c-child></c-child>
    </div>
</template>
```

```javascript
// child.js
import { LightningElement } from 'lwc';
import { WithSignals } from 'c/signals';
import { parentData } from './parent';

export default class Child extends WithSignals(LightningElement) {
    // Use the shared signal directly
    get message() {
        return parentData.value;
    }
}
```

```html
<!-- child.html -->
<template>
    <div>
        Message from parent: {message}
    </div>
</template>
```

### Global State
```javascript
// store/userStore.js
import { signal, computed } from 'c/signals';

export const user = signal({
    name: 'John',
    theme: 'light'
});

export const isAdmin = computed(() => user.value.role === 'admin');

export const updateTheme = (theme) => {
    user.value.theme = theme;
};
```

```javascript
// header.js
import { LightningElement } from 'lwc';
import { WithSignals } from 'c/signals';
import { user, updateTheme } from './store/userStore';

export default class Header extends WithSignals(LightningElement) {
    // You can access global signals directly in the template
    get userName() {
        return user.value.name;
    }

    get theme() {
        return user.value.theme;
    }

    toggleTheme() {
        updateTheme(this.theme === 'light' ? 'dark' : 'light');
    }
}
```

```javascript
// settings.js
import { LightningElement } from 'lwc';
import { WithSignals } from 'c/signals';
import { user, isAdmin } from './store/userStore';

export default class Settings extends WithSignals(LightningElement) {
    // Global signals and computed values can be used anywhere
    get showAdminPanel() {
        return isAdmin.value;
    }

    updateName(event) {
        user.value.name = event.target.value;
    }
}
```

### Deep Reactivity
```javascript
const user = signal({
    name: 'John',
    settings: { theme: 'dark' }
});

// Direct property mutations work!
user.value.settings.theme = 'light';

const list = signal([]);
// Array methods are fully reactive
list.value.push('item');
list.value.unshift('first');
list.value[1] = 'updated';
```

### Effects auto-dispose
```javascript
import { LightningElement } from 'lwc';
import { WithSignals, effect } from 'c/signals';

export default class Component extends WithSignals(LightningElement) {
    connectedCallback() {
        effect(() => {
            console.log("Effect created.");

            return () => {
                console.log("Effect disposed."); // Automatically called when the component is disconnected
            }
        })
    }
}
```

### Considerations

For components using the `WithSignals` mixin, it's crucial to maintain proper lifecycle behavior by following specific requirements.

Here's what you need to know:

1. **constructor**:
Always call `super()` as the first statement in your constructor. This ensures proper initialization of both the `LightningElement` base class and signals functionality.
2. **render**:
You must call `super.__triggerSignals()` before returning your template. This method ensures that all signal updates are properly processed before the component renders.
3. **renderedCallback**:
When overriding `renderedCallback()`, always include `super.renderedCallback()`. This maintains the parent class's rendering lifecycle behavior while adding your custom logic.
4. **disconnectedCallback**:
Include `super.disconnectedCallback()` when implementing `disconnectedCallback()`. This ensures proper cleanup of signal subscriptions, effects and prevents memory leaks.

```javascript
import { LightningElement } from 'lwc';
import template from "./template.html";
import { WithSignals } from 'c/signals';

export default class Component extends WithSignals(LightningElement) {
    constructor() {
        super(); // Required: Initialize parent class
    }

    render() {
        super.__triggerSignals(); // Required: Process signal updates

        return template;
    }

    renderedCallback() {
        super.renderedCallback(); // Required: Maintain parent lifecycle
        // Your custom logic here
    }

    disconnectedCallback() {
        super.disconnectedCallback(); // Required: Clean up signals and effects
        // Your cleanup code here
    }
}
```

## Documentation

- [Architecture and Internal Concepts](./docs/architecture.md)

## License

MIT © Leandro Brunner
