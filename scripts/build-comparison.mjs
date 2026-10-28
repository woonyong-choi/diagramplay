import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildFigure, toHtml, toSvg } from '../src/index.js';
import { toComparison } from '../src/html/listing.js';
import { COMPARISON_EXAMPLES } from './lib/comparison-examples.mjs';

const output = resolve('.local/comparison');
mkdirSync(output, { recursive: true });
const errors = [];
for (const example of COMPARISON_EXAMPLES) {
  let result;
  try { result = await buildFigure(example.source, { strict: true }); }
  catch (error) { errors.push(`${example.id}: ${error.message}`); continue; }
  console.log(`${example.id}: ${result.figure.nodes.length} nodes, ${result.scene.edges.length} rendered edges, ${result.timeline.steps.length} scenes`);
  writeFileSync(resolve(output, `${example.id}.diagramplay`), example.source);
  writeFileSync(resolve(output, `${example.id}.svg`), await toSvg(result, { isStatic: true, scene: example.scene }));
  writeFileSync(resolve(output, `${example.id}.html`), await toHtml(result, example.id));
}
if (errors.length) throw new Error(errors.join('\n'));
writeFileSync(resolve(output, 'index.html'), toComparison(COMPARISON_EXAMPLES));
console.log(`${COMPARISON_EXAMPLES.length} expressions → ${output}/index.html`);
