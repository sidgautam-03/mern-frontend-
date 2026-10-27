const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'src');
const problems = [];

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(jsx?|tsx?)$/.test(e.name) ? [p] : [];
  });

// path ka har hissa exact spelling aur case ke saath maujood hai ya nahi
const existsExact = (full) => {
  const rel = path.relative(root, full);
  if (rel.startsWith('..')) return false;
  let cur = root;
  for (const part of rel.split(path.sep)) {
    if (!fs.existsSync(cur) || !fs.readdirSync(cur).includes(part)) return false;
    cur = path.join(cur, part);
  }
  return true;
};

const re = /from\s+['"](\.[^'"]+)['"]/g;

for (const file of walk(root)) {
  const src = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = re.exec(src))) {
    const target = path.resolve(path.dirname(file), m[1]);
    const candidates = [
      target,
      `${target}.js`,
      `${target}.jsx`,
      path.join(target, 'index.js'),
      path.join(target, 'index.jsx'),
    ];
    const ok = candidates.some((c) => existsExact(c) && fs.statSync(c).isFile());
    if (!ok) {
      problems.push(`${path.relative(__dirname, file)} -> '${m[1]}'`);
    }
  }
}

if (problems.length === 0) {
  console.log('All relative imports resolve with exact case.');
} else {
  console.log(`${problems.length} broken import(s):\n`);
  problems.forEach((p) => console.log(' - ' + p));
}