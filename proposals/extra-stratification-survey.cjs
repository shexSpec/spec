// Survey Wikidata EntitySchemas for stratification (negation-requirement) violations
// under two rules:
//   strict:        negated reference = odd # of ShapeNot on the occurrence path,
//                  PLUS references in the valueExpr of a TripleConstraint whose
//                  predicate is EXTRA'd in the enclosing Shape (the hidden negation).
//   certain-match: negated reference = odd # of ShapeNot only (proposed semantics).
//
// A schema violates the negation requirement iff some negated edge lies on a cycle,
// i.e. both endpoints are in the same SCC of the dependency graph.
//
// Usage:  node extra-stratification-survey.cjs
// Requires @shexjs/parser (already a devDependency of this repo). Schema texts
// are cached under .extra-survey-cache/ so re-runs are offline; delete it to
// re-fetch. Results are written to extra-stratification-survey-results.json and
// a summary is printed to stdout. Companion analysis: extra-stratification-proposal.md §4.

const fs = require("fs");
const path = require("path");
const ShExParser = require("@shexjs/parser");

const UA = "shexSpec-stratification-survey/0.1 (eric+claude.ai@uu3.org)";
const CACHE = path.join(__dirname, ".extra-survey-cache");
const RESULTS = path.join(__dirname, "extra-stratification-survey-results.json");
const DIR_URL = "https://www.wikidata.org/w/index.php?title=Wikidata:Database_reports/EntitySchema_directory&action=raw";
const API = "https://www.wikidata.org/w/api.php";
const TEXT_URL = (id) => `https://www.wikidata.org/wiki/Special:EntitySchemaText/${id}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// Fetch a batch of EntitySchema page contents via the MediaWiki API.
// Returns Map(id -> schemaText). Missing/errored ids are simply absent.
async function fetchBatch(ids) {
  const titles = ids.map((id) => "EntitySchema:" + id).join("|");
  const url = `${API}?action=query&prop=revisions&rvprop=content&rvslots=main` +
    `&format=json&formatversion=2&titles=${encodeURIComponent(titles)}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const out = new Map();
    for (const p of json.query?.pages || []) {
      const content = p.revisions?.[0]?.slots?.main?.content;
      if (content == null) continue;
      const m = /^E\d+/.exec(p.title.replace(/^EntitySchema:/, ""));
      if (!m) continue;
      try {
        out.set(m[0], JSON.parse(content).schemaText || "");
      } catch { out.set(m[0], ""); }
    }
    return out;
  }
  throw new Error("429 after retries");
}

async function getDirectory() {
  const wiki = await fetchText(DIR_URL);
  const names = new Map();
  for (const m of wiki.matchAll(/\[\[EntitySchema:(E\d+)\|([^\]]*)\]\]/g))
    if (!names.has(m[1])) names.set(m[1], m[2]);
  for (const m of wiki.matchAll(/EntitySchema:(E\d+)/g))
    if (!names.has(m[1])) names.set(m[1], "");
  return names;
}

function cachePath(id) { return path.join(CACHE, id + ".shex"); }

// Ensure every id has a cached .shex file, fetching missing ones in API batches.
async function ensureCached(ids) {
  const missing = ids.filter((id) => !fs.existsSync(cachePath(id)));
  console.error(`${missing.length} to fetch, ${ids.length - missing.length} cached`);
  for (let i = 0; i < missing.length; i += 50) {
    const chunk = missing.slice(i, i + 50);
    const got = await fetchBatch(chunk);
    for (const id of chunk)
      if (got.has(id)) fs.writeFileSync(cachePath(id), got.get(id));
    console.error(`  fetched ${Math.min(i + 50, missing.length)}/${missing.length}`);
    await sleep(500);
  }
}

// ---- dependency graph construction ------------------------------------------

// Collect named triple expressions (tripleExprRef targets) in a prepass.
function collectTeMap(obj, teMap) {
  if (obj === null || typeof obj !== "object") return;
  if (Array.isArray(obj)) { obj.forEach((o) => collectTeMap(o, teMap)); return; }
  if (obj.id && ["EachOf", "OneOf", "TripleConstraint"].includes(obj.type))
    teMap.set(obj.id, obj);
  for (const v of Object.values(obj)) collectTeMap(v, teMap);
}

// Walk one shape declaration, emitting edges {to, parity, viaExtra}.
function edgesOfDecl(decl, teMap) {
  const edges = [];
  const seenTe = new Set();

  function walkShapeExpr(se, parity) {
    if (se == null) return;
    if (typeof se === "string") { edges.push({ to: se, parity, viaExtra: false }); return; }
    switch (se.type) {
      case "ShapeNot": walkShapeExpr(se.shapeExpr, parity + 1); break;
      case "ShapeAnd":
      case "ShapeOr": (se.shapeExprs || []).forEach((x) => walkShapeExpr(x, parity)); break;
      case "ShapeDecl": walkShapeExpr(se.shapeExpr, parity); break;
      case "Shape": {
        (se.extends || []).forEach((x) =>
          walkShapeExpr(typeof x === "string" ? x : x, parity));
        walkTripleExpr(se.expression, parity, se.extra || []);
        break;
      }
      case "NodeConstraint":
      case "ShapeExternal":
      default: break;
    }
  }

  function walkTripleExpr(te, parity, extra) {
    if (te == null) return;
    if (typeof te === "string") { // tripleExprRef
      if (seenTe.has(te)) return;
      seenTe.add(te);
      if (teMap.has(te)) walkTripleExpr(teMap.get(te), parity, extra);
      return;
    }
    switch (te.type) {
      case "EachOf":
      case "OneOf": (te.expressions || []).forEach((x) => walkTripleExpr(x, parity, extra)); break;
      case "TripleConstraint": {
        if (te.valueExpr !== undefined) {
          walkShapeExpr(te.valueExpr, parity);
          // hidden negation: leftover triples of an EXTRA'd (non-inverse) predicate
          // must NOT match this constraint
          if (!te.inverse && extra.includes(te.predicate))
            markExtra(() => walkShapeExpr(te.valueExpr, parity + 1));
        }
        break;
      }
      default: break;
    }
  }

  let inExtra = false;
  function markExtra(f) {
    const save = inExtra;
    inExtra = true;
    const start = edges.length;
    f();
    for (let i = start; i < edges.length; i++) edges[i].viaExtra = true;
    inExtra = save;
  }

  walkShapeExpr(decl.shapeExpr, 0);
  return edges;
}

// Tarjan SCC (iterative)
function sccOf(nodes, adj) {
  let idx = 0;
  const index = new Map(), low = new Map(), onStack = new Set(), comp = new Map();
  const stack = [];
  let compCount = 0;
  for (const root of nodes) {
    if (index.has(root)) continue;
    const work = [[root, 0]];
    while (work.length) {
      const [v, pi] = work[work.length - 1];
      if (pi === 0) {
        index.set(v, idx); low.set(v, idx); idx++;
        stack.push(v); onStack.add(v);
      }
      const succ = adj.get(v) || [];
      if (pi < succ.length) {
        work[work.length - 1][1]++;
        const w = succ[pi];
        if (!index.has(w)) work.push([w, 0]);
        else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
      } else {
        work.pop();
        if (work.length) {
          const [p] = work[work.length - 1];
          low.set(p, Math.min(low.get(p), low.get(v)));
        }
        if (low.get(v) === index.get(v)) {
          for (;;) {
            const w = stack.pop(); onStack.delete(w);
            comp.set(w, compCount);
            if (w === v) break;
          }
          compCount++;
        }
      }
    }
  }
  return comp;
}

function analyze(schema) {
  const teMap = new Map();
  collectTeMap(schema, teMap);
  const decls = (schema.shapes || []).map((s) =>
    s.type === "ShapeDecl" ? s : { id: s.id, shapeExpr: s });

  const allEdges = [];
  for (const d of decls)
    for (const e of edgesOfDecl(d, teMap))
      allEdges.push({ from: d.id, to: e.to, negated: e.parity % 2 === 1, viaExtra: e.viaExtra });

  const nodes = new Set(decls.map((d) => d.id));
  allEdges.forEach((e) => { nodes.add(e.from); nodes.add(e.to); });
  const adj = new Map();
  allEdges.forEach((e) => {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from).push(e.to);
  });
  const comp = sccOf(nodes, adj);

  const cyclic = (e) => comp.get(e.from) === comp.get(e.to) &&
    (e.from !== e.to || (adj.get(e.from) || []).includes(e.to));
  const strictViol = allEdges.filter((e) => e.negated && cyclic(e));
  const certainViol = strictViol.filter((e) => !e.viaExtra);

  // corpus characterization
  const usesExtra = allEdges.some((e) => e.viaExtra) ||
    decls.some((d) => hasExtra(d.shapeExpr));
  const extraRefEdges = allEdges.filter((e) => e.viaExtra); // ref reachable via EXTRA'd pred
  const explicitNotEdges = allEdges.filter((e) => e.negated && !e.viaExtra);

  return {
    nShapes: decls.length,
    imports: (schema.imports || []).length,
    usesExtra,
    hasExtraRef: extraRefEdges.length > 0,
    hasExplicitNot: explicitNotEdges.length > 0,
    strictViolation: strictViol.length > 0,
    certainViolation: certainViol.length > 0,
    strictEdges: strictViol.map((e) => `${short(e.from)} -${e.viaExtra ? "EXTRA" : "NOT"}-> ${short(e.to)}`),
  };
}

function hasExtra(obj) {
  if (obj === null || typeof obj !== "object") return false;
  if (Array.isArray(obj)) return obj.some(hasExtra);
  if (Array.isArray(obj.extra) && obj.extra.length) return true;
  return Object.values(obj).some(hasExtra);
}

const short = (iri) => iri.replace(/^.*[#/]/, "");

// ---- main --------------------------------------------------------------------

async function main() {
  fs.mkdirSync(CACHE, { recursive: true });
  const dir = await getDirectory();
  const ids = [...dir.keys()].sort((a, b) => +a.slice(1) - +b.slice(1));
  console.error(`${ids.length} EntitySchemas listed`);

  await ensureCached(ids);

  const results = [];
  for (const id of ids) {
    const rec = { id, name: dir.get(id) };
    const file = cachePath(id);
    if (!fs.existsSync(file)) {
      rec.status = "fetch_error"; rec.error = "not retrievable";
      results.push(rec); continue;
    }
    const text = fs.readFileSync(file, "utf8");
    rec.bytes = text.length;
    if (!text.trim()) { rec.status = "empty"; results.push(rec); continue; }
    try {
      const schema = ShExParser.construct(TEXT_URL(id) + "#").parse(text);
      Object.assign(rec, analyze(schema), { status: "ok" });
    } catch (e) {
      rec.status = "parse_error";
      rec.error = String(e.message || e).split("\n")[0].slice(0, 120);
    }
    results.push(rec);
  }

  results.sort((a, b) => +a.id.slice(1) - +b.id.slice(1));
  fs.writeFileSync(RESULTS, JSON.stringify(results, null, 1));

  const ok = results.filter((r) => r.status === "ok");
  const strictFail = ok.filter((r) => r.strictViolation);
  const rescued = strictFail.filter((r) => !r.certainViolation);
  const failBoth = strictFail.filter((r) => r.certainViolation);

  const sum = (label, n) => console.log(label.padEnd(58) + String(n).padStart(5));
  sum("EntitySchemas listed in directory", results.length);
  sum("empty / deleted (no schemaText)", results.filter((r) => r.status === "empty").length);
  sum("fetch errors", results.filter((r) => r.status === "fetch_error").length);
  sum("parse errors (skipped)", results.filter((r) => r.status === "parse_error").length);
  sum("analyzed", ok.length);
  console.log("");
  sum("  … use EXTRA", ok.filter((r) => r.usesExtra).length);
  sum("  … have a shape ref reachable via an EXTRA'd predicate", ok.filter((r) => r.hasExtraRef).length);
  sum("  … use explicit ShapeNot on a reference", ok.filter((r) => r.hasExplicitNot).length);
  sum("  … IMPORT other schemas", ok.filter((r) => r.imports > 0).length);
  console.log("");
  sum("pass conventional stratification", ok.length - strictFail.length);
  sum("FAIL conventional stratification", strictFail.length);
  sum("  … permissible under certain-match leftovers", rescued.length);
  sum("  … still prohibited (explicit NOT on a cycle)", failBoth.length);
  console.log("\nParse errors (excluded from analysis):");
  results.filter((r) => r.status === "parse_error")
    .forEach((r) => console.log(`  ${r.id} (${r.name || "?"}): ${r.error}`));

  const show = (r) => `  ${r.id} (${r.name || "?"}): ${r.strictEdges.slice(0, 3).join("; ")}${r.strictEdges.length > 3 ? " …" : ""}`;
  console.log("\nRescued by certain-match (EXTRA-only violations):");
  rescued.forEach((r) => console.log(show(r)));
  console.log("\nStill prohibited (explicit NOT cycles):");
  failBoth.forEach((r) => console.log(show(r)));
}

main().catch((e) => { console.error(e); process.exit(1); });
