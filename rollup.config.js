import { terser } from 'rollup-plugin-terser';
import copy from 'rollup-plugin-copy';

export default {
  input: 'force-app/main/default/lwc/signals/signals.js',
  output: {
    file: 'dist/signals/signals.js',
    format: 'es',
    sourcemap: false,
  },
  plugins: [
    terser(),
    copy({
      targets: [
        { src: 'force-app/main/default/lwc/signals/signals.js-meta.xml', dest: 'dist/signals' }
      ]
    })
  ]
};
