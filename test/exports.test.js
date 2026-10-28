// 장면 방식과 결과물: 움직이는 SVG, 멈춘 SVG, HTML 재생기와 정본 내려받기의 계약. 결정성과 바깥 자원 없음도 여기서 본다.
// 브라우저가 있어야 보이는 것(탭, 시계, 전체 화면)은 docs/design/expression-coverage.md의 브라우저에서만 보이는 계약 표에 있다. 시험 이름 첫 낱말(X1~X11)이 요구사항 번호이고 시험 번호 표에 대응이 있다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { figureViewBounds } from '../src/html/view-bounds.js';
import { statusBoxes } from '../src/layout/status.js';


import { EXAMPLES, build, descendants, diagramplay, findAll, findOne, parseMarkup, read, reject, textContent, textsOf, toHtml, toSvg } from './support.js';

const MOVE = (mode, speed = 1, time = '10s') => diagramplay(`box a "A"\nbox b "B"\na -> b\nscene "s" mode=${mode} speed=${speed}\n  a -> b "m" time=${time}\n`);
test('embedded bounds include status pills beyond the node corner', async () => {
  const result = await build(diagramplay('box a "A"\nscene "warning" status="a=warn"\n  light a\n'));
  const svg = await toSvg(result);
  assert.match(svg, /class="status-pill"/);
  assert.match(svg, /class="status-icon"/);
  const bounds = figureViewBounds(result);
  const pills = statusBoxes(result.scene, result.timeline);
  assert.equal(pills.length, 1);
  for (const box of pills) {
    assert.ok(box.x > bounds.x && box.y > bounds.y);
    assert.ok(box.x + box.w < bounds.x + bounds.w);
    assert.ok(box.y + box.h < bounds.y + bounds.h);
  }
});
const ANIMATION = new Set(['animate', 'set', 'animateMotion', 'animateTransform']);
const animations = (dom) => descendants(dom).filter((n) => ANIMATION.has(n.tag));
const seconds = (text) => (text.endsWith('ms') ? Number.parseFloat(text) / 1000 : Number.parseFloat(text));

test('X1 mode picks the playback: loop repeats forever, once plays once and freezes, static has no animation at all', async () => {
  const svg = async (mode, options) => parseMarkup(await toSvg(await build(MOVE(mode)), options));
  const loop = await svg('loop');
  assert.equal(loop.attrs['data-mode'], 'loop');
  assert.ok(animations(loop).length > 0 && animations(loop).every((n) => n.attrs.repeatCount === 'indefinite'));
  const once = await svg('once');
  assert.equal(once.attrs['data-mode'], 'once');
  assert.ok(animations(once).length > 0 && animations(once).every((n) => n.attrs.repeatCount === '1' && n.attrs.fill === 'freeze'));
  const still = await svg('static');
  assert.equal(still.attrs['data-mode'], 'static');
  assert.equal(animations(still).length, 0);
  // --static は mode に関係なく動かない(마지막 모습 하나)
  const forced = await svg('loop', { isStatic: true });
  assert.equal(forced.attrs['data-mode'], 'static');
  assert.equal(animations(forced).length, 0);
  assert.equal(descendants(forced).filter((n) => ANIMATION.has(n.tag) || /\banimation\s*:/.test(n.attrs.style ?? '')).length, 0);
});

test('X2 speed scales the playback length, not the logical times: 10s at speed 2 plays in half, plus the fixed effect tail', async () => {
  const dur = async (speed) => {
    const lengths = new Set(animations(parseMarkup(await toSvg(await build(MOVE('loop', speed))))).map((n) => seconds(n.attrs.dur)));
    assert.equal(lengths.size, 1);
    return [...lengths][0];
  };
  assert.equal(await dur(1), 10.4);
  assert.equal(await dur(2), 5.4);
  assert.equal(await dur(0.5), 20.4);
});

test('X3 speed must be a positive finite number, and a length of under 1ms after dividing is an invalid-speed error', async () => {
  for (const speed of ['0', '-1', 'abc', 'NaN', 'Infinity', '1e999', '']) {
    const source = diagramplay(`box a "A"\nbox b "B"\na -> b\nscene "s" mode=once speed=${speed}\n  a -> b time=1s\n`);
    assert.ok((await reject(source)).length, `speed=${speed}`);
  }
  const fast = await reject(diagramplay(`box a "A"\nbox b "B"\na -> b\nscene "s" mode=once speed=100000\n  a -> b time=1s\n`));
  assert.ok(fast.some((p) => p.code === 'invalid-speed'), JSON.stringify(fast));
  await build(diagramplay(`box a "A"\nbox b "B"\na -> b\nscene "s" mode=once speed=1000\n  a -> b time=1s\n`));
});

test('X4 a scene is chosen by number or by name; only its own messages show; an unknown scene is a RangeError', async () => {
  const source = diagramplay(`
    person u "U"
    box s "S"
    view sequence {
      u
      s
    }
    scene "first" mode=static
      u -> s "one"
    scene "second" mode=static
      u -> s "two"
  `);
  const result = await build(source);
  const shown = async (scene) => textsOf(parseMarkup(await toSvg(result, { scene, isStatic: true })));
  assert.ok((await shown(0)).includes('one') && !(await shown(0)).includes('two'));
  assert.ok((await shown(1)).includes('two') && !(await shown(1)).includes('one'));
  assert.deepEqual(await shown('second'), await shown(1));
  assert.equal(parseMarkup(await toSvg(result, { scene: 1 })).attrs['data-scene'], '1');
  await assert.rejects(toSvg(result, { scene: 2 }), RangeError);
  await assert.rejects(toSvg(result, { scene: 'nope' }), RangeError);
});

test('X5 a figure with no scenes is one still picture of the declared start values', async () => {
  const result = await build(diagramplay('box a "A"\nvalue n "n" on=a from=5\n'));
  const dom = parseMarkup(await toSvg(result));
  assert.equal(animations(dom).length, 0);
  assert.equal(dom.attrs['data-mode'], 'static');
});

// ---- 정본 내려받기와 단독 HTML ----

const DOC = diagramplay(`
  title "Doc </script><img src=x onerror=alert(1)> & \\"q\\""
  box a "A <b>"
  box b "B & 'c'"
  a -> b
  scene "one" mode=once
    a -> b "x"
  scene "two" mode=loop
    a -> b "y"
`);

test('X7 the HTML is one standalone file: no outside resource, only inline script, and nothing from the text leaks into markup', async () => {
  const html = await toHtml(await build(DOC), 'doc');
  const dom = parseMarkup(html, { html: true });
  const all = descendants(dom);
  assert.deepEqual(all.filter((n) => n.tag === 'script' && n.attrs.src), []);
  assert.deepEqual(all.filter((n) => n.tag === 'link' && n.attrs.rel === 'stylesheet'), []);
  assert.deepEqual(all.filter((n) => n.tag === 'link' && n.attrs.rel === 'icon'), []);
  for (const node of all) {
    for (const name of ['src', 'href', 'poster', 'data', 'action']) {
      if (node.attrs[name] !== undefined) assert.match(node.attrs[name], /^(data:|#)/, `${node.tag} ${name}`);
    }
  }
  assert.doesNotMatch(html, /@import|url\(\s*['"]?https?:|<iframe|<object|<embed/i);
  // 원본의 글은 마크업으로 새지 않는다
  assert.deepEqual(all.filter((n) => n.tag === 'img' || n.attrs.onerror !== undefined), []);
  const texts = all.filter((n) => n.tag === 'text').map(textContent);
  assert.ok(texts.includes('A <b>') && texts.includes("B & 'c'"));
  assert.equal(all.filter((n) => n.tag === 'b').length, 0);
});

test('X8 the canonical copy in the page head rebuilds the whole page byte for byte (the download contract)', async () => {
  const html = await toHtml(await build(DOC), 'doc');
  const dom = parseMarkup(html, { html: true });
  const meta = findOne(dom, (n) => n.tag === 'meta' && n.attrs.name === 'diagramplay-canonical', 'canonical meta');
  const template = Buffer.from(meta.attrs.content, 'base64').toString('utf8');
  assert.match(template, /<meta name="diagramplay-canonical" content="">/);
  // 내려받기가 하는 일: 칸이 빈 정본에 같은 base64를 다시 채운다
  const head = '<meta name="diagramplay-canonical" content="';
  const at = template.indexOf(head) + head.length;
  assert.equal(template.slice(0, at) + meta.attrs.content + template.slice(at), html);
  // 정본 안에는 정본이 또 들어 있지 않아 다시 내려받아도 커지지 않는다
  assert.equal((template.match(/diagramplay-canonical/g) ?? []).length, 2, 'name and the script constant only, never a nested copy');
});

test('X9 siblings keep their declared order when the narrow-screen layout stacks them one per layer, and the wide layout is unchanged', async () => {
  const source = diagramplay(`
    box lb "LB"
    box a1 "API 1" icon=nhn-general-application-instance
    box a2 "API 2" icon=nhn-general-application-instance
    box a3 "API 3" icon=nhn-general-application-instance
    value p95 "p95" on=lb from=110
    value cpu1 "CPU" on=a1 from=34
    value cpu2 "CPU" on=a2 from=41
    value cpu3 "CPU" on=a3 from=38
    lb -> a1
    lb -> a2
    lb -> a3
  `);
  const siblings = async (layoutWidth) => (await build(source, { layoutWidth })).scene.items.filter((item) => /^a\d$/.test(item.id));
  for (const layoutWidth of [272, undefined]) {
    const column = await siblings(layoutWidth);
    assert.deepEqual(column.map((item) => item.id), ['a1', 'a2', 'a3']);
    assert.ok(column.every((item, i) => i === 0 || item.y > column[i - 1].y), `${layoutWidth}: ${JSON.stringify(column.map((item) => [item.id, item.y]))}`);
  }
});

test('X9e an unmet narrow target keeps the narrower valid group candidate (#272)', async () => {
  const source = read(EXAMPLES, 'architecture.diagramplay');
  const roomy = await build(source, { baseDir: EXAMPLES, layoutWidth: 650, strict: false });
  const narrow = await build(source, { baseDir: EXAMPLES, layoutWidth: 272, strict: false });
  assert.ok(narrow.scene.width <= roomy.scene.width, 'a narrower target must not discard an already valid narrower layout');
  assert.deepEqual(narrow.scene.items.map(item => item.id), roomy.scene.items.map(item => item.id));
  assert.deepEqual(narrow.scene.edges.map(({ from, to }) => [from, to]), roomy.scene.edges.map(({ from, to }) => [from, to]));
});

test('toHtml_graph_only_ships_one_geometry_for_all_viewport_widths', async () => {
  const names = ['a', 'b', 'c', 'd', 'e', 'f'];
  const source = diagramplay(`${names.map(id => `box ${id} "Service ${id}"`).join('\n')}\n${names.slice(1).map((id, i) => `${names[i]} -> ${id}`).join('\n')}\n`);
  const html = await toHtml(await build(source), 'graph');
  assert.ok(!descendants(parseMarkup(html, { html: true })).some(node => node.tag === 'template' && /\bfl-narrow\b/.test(node.attrs.class ?? '')));
});

test('X9c the shared viewer has no viewport-height cap in the document, and keeps the fixed full-screen frame', async () => {
  const html = await toHtml(await build(diagramplay('box a "A"\n')), 'x');
  const css = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
  assert.doesNotMatch(css, /max-height:[^;}]*\d+[sld]?vh/);
  assert.match(css, /\.fl-figure\.full \{[^}]*\bposition: fixed;/);
  assert.equal(findAll(parseMarkup(html, { html: true }), (n) => n.tag === 'button' && n.attrs['aria-label'] === '전체화면').length, 1);
});

test('X11 the page keeps the original source exactly (line endings and all) so the copy button copies what the author wrote', async () => {
  const source = `diagramplay\r\ntitle "한글 \\"따옴표\\" <b>"\r\nbox a "A" # comment\r\n`;
  const html = parseMarkup(await toHtml(await build(source), 'doc'), { html: true });
  const carried = findAll(html, (n) => n.tag === 'script' && n.attrs.type === 'application/json').map((n) => JSON.parse(textContent(n)));
  assert.deepEqual(carried.filter((value) => value === source), [source]);
});

test('toHtml_source_override_preserves_exact_copy_text_and_canonical_download_without_changing_the_build', async () => {
  const source = diagramplay('box a "A"\n');
  const result = await build(source);
  const baseline = await toHtml(result, 'doc');
  const svg = await toSvg(result);
  assert.equal(await toHtml(result, 'doc', { source: undefined }), baseline);
  for (const original of ['host source\r\n한글 \" & < >\r\n', '', '</textarea><script>alert("source")</script>\u2028\u2029']) {
    const html = await toHtml(result, 'doc', { source: original });
    const dom = parseMarkup(html, { html: true });
    const carried = findOne(dom, (node) => node.tag === 'script' && node.attrs.class === 'fl-source', 'source payload');
    assert.equal(JSON.parse(textContent(carried)), original);
    assert.doesNotMatch(textContent(carried), /<\/script/i);
    assert.deepEqual(findAll(dom, (node) => node.tag === 'textarea'), []);
    const canonical = findOne(dom, (node) => node.tag === 'meta' && node.attrs.name === 'diagramplay-canonical', 'canonical payload');
    const template = Buffer.from(canonical.attrs.content, 'base64').toString('utf8');
    const head = '<meta name="diagramplay-canonical" content="';
    const at = template.indexOf(head) + head.length;
    assert.equal(template.slice(0, at) + canonical.attrs.content + template.slice(at), html);
    const saved = findOne(parseMarkup(template, { html: true }), (node) => node.tag === 'script' && node.attrs.class === 'fl-source', 'downloaded source');
    assert.equal(JSON.parse(textContent(saved)), original);
  }
  for (const source of [null, false, 1, {}, []]) {
    await assert.rejects(toHtml(result, 'doc', { source }), TypeError);
  }
  assert.equal(await toHtml(result, 'doc'), baseline);
  assert.equal(await toSvg(result), svg);
});

// 부모가 나중에 초기화되어 첫 높이 메시지를 놓쳐도 테마 연결 때 다시 전달한다.
test('X9d an embedded player reports its height again when a late host connects', async () => {
  const html = await toHtml(await build(diagramplay('box a "A"\n')), 'x');
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(text => text.includes('themeRequest'));
  const events = {}, messages = [];
  const parent = { postMessage: message => messages.push(message) };
  const root = { classList: { add() {} }, style: {}, setAttribute() {}, removeAttribute() {} };
  runInNewContext(script, { window: { self: {}, top: {} }, parent, document: { documentElement: root, body: { getBoundingClientRect: () => ({ height: 1634.5 }) } }, addEventListener: (name, listener) => events[name] = listener, requestAnimationFrame: callback => callback() });
  messages.length = 0;
  events.message({ source: {}, data: { theme: 'light' } });
  assert.equal(messages.length, 0);
  events.message({ source: parent, data: { theme: 'light' } });
  assert.equal(messages.at(-1).figureHeight, 1635);
});
