import terser from "@rollup/plugin-terser";
import copy from "rollup-plugin-copy";
import dts from "rollup-plugin-dts";

const input = "force-app/main/default/lwc/signals/signals.js";

export default [
  {
    input: "force-app/main/default/lwc/signals/signals.js",
    output: {
      file: "dist/signals/signals.js",
      format: "es",
      sourcemap: false,
    },
    plugins: [
      terser({
        mangle: {
          properties: true,
        },
      }),
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
    input,
    output: {
      file: "dist/index.js",
      format: "es",
    },
    plugins: [
      terser({
        mangle: {
          properties: true,
        },
      }),
    ],
  },
  {
    input,
    output: {
      file: "dist/index.cjs",
      format: "cjs",
    },
    plugins: [
      terser({
        mangle: {
          properties: true,
        },
      }),
    ],
  },
  {
    input,
    output: [{ file: "dist/index.d.ts", format: "es" }],
    plugins: [dts()],
  },
];
