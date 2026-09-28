// Turn the Vite build into an Artifact page: the page is a fragment (the host adds the
// document skeleton), and scripts, styles, art and music are published alongside it.
//   npm run build && node tools/make-artifact.mjs   -> dist/artifact.html + dist/artifact-files.json
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const js = html.match(/src="\.\/(assets\/[^"]+\.js)"/)?.[1];
const css = html.match(/href="\.\/(assets\/[^"]+\.css)"/)?.[1];
const fonts = html.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com[^"]+)"/)?.[1];
if (!js || !css || !fonts) throw new Error('unexpected dist/index.html');

const page = `<title>Steliterate</title>
<meta name="description" content="A survival strategy game at the end of starlight." />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${fonts}" />
<link rel="stylesheet" href="${css}" />
<style>
  html, body { height: 100%; margin: 0; background: #030306; color: #e9dfcf; color-scheme: dark; overflow: hidden; }
</style>
<div id="stage"></div>
<div id="ui"></div>
<script type="module" src="${js}"></script>
`;
writeFileSync(join(dist, 'artifact.html'), page);

const files = {};
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else files[relative(dist, p)] = p;
  }
};
for (const d of ['assets', 'art', 'music']) walk(join(dist, d));
writeFileSync(join(dist, 'artifact-files.json'), JSON.stringify(files, null, 2));
console.log(`dist/artifact.html + ${Object.keys(files).length} files`);
console.log(JSON.stringify(files));
