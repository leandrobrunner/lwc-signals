import terser from "@rollup/plugin-terser";
import copy from "rollup-plugin-copy";
import dts from "rollup-plugin-dts";

const INPUT = "force-app/main/default/lwc/signals/signals.js";

const TERSER_CONFIG = terser({
  mangle: {
    properties: {
      regex: /^_/,
      reserved: ["peek", "value", "subscribe", "notify", "__triggerSignals"],
    },
  },
});

export default [
  {
    input: INPUT,
    output: {
      file: "dist/signals/signals.js",
      format: "es",
      sourcemap: false,
    },
    plugins: [
      TERSER_CONFIG,
      copy({
        targets: [
          {
            src: "force-app/main/default/lwc/signals/signals.js-meta.xml",
            dest: "dist/signals",
          },
        ],
      }),
    ],
  },
  {
    input: INPUT,
    output: {
      file: "dist/index.js",
      format: "es",
    },
    plugins: [TERSER_CONFIG],
  },
  {
    input: INPUT,
    output: {
      file: "dist/index.cjs",
      format: "cjs",
    },
    plugins: [TERSER_CONFIG],
  },
  {
    input: INPUT,
    output: [{ file: "dist/index.d.ts", format: "es" }],
    plugins: [dts()],
  },
];
