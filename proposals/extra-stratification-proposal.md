# EXTRA, Negation, and Stratification: a proposal for a more permissive semantics

**Status:** draft for discussion
**Motivation:** Wikidata entity schemas lean heavily on `EXTRA` because popular
predicates (instance-of, depicts, part-of, …) carry values beyond what any one
schema describes. Because `EXTRA` secretly introduces negation, many
reasonable-looking schemas violate the negation requirement and are rejected
before any data is seen. This document reviews why ShEx demands stratification,
shows what a stratification failure does and does not signal, locates the
hidden negation in `EXTRA`, and proposes a relaxed, still-declarative semantics
("certain-match leftovers") that removes `EXTRA` from the negation requirement
entirely.

All examples use a museum vocabulary with `PREFIX : <http://museum.example/>`.
Each example is a self-contained schema over that vocabulary; a shape name like
`<Person>` may be redefined from one example to the next. The museum predicates
stand in for Wikidata properties (`:type` ≈ `wdt:P31` *instance of*,
`:depicts` ≈ `wdt:P180`, `:notableWork` ≈ `wdt:P800`) without the opaque
identifiers.

---

## 1. Why ShEx validation needs stratification

### 1.1 Typings

ShEx defines validation against a **typing**: a set of pairs *(node, shape
label)* ([spec §Validation Definition]). A typing is **correct** if every pair
in it is justified — for each *(n, l)* in the typing, *n* satisfies the
declared shape expression of *l*, where any shape reference `@<X>` encountered
during that check is answered by consulting the typing itself.

Correctness alone is too weak to define validation: the empty typing is always
correct (it makes no claims to justify). What validation needs is a typing that
is both:

* **correct** — everything in it is justified, and
* **complete** — everything justified by it is in it: if *n* satisfies
  *def(l)* with respect to the typing, then *(n, l)* is in the typing.

In other words, a *fixed point* of the satisfies relation. The spec's
`completeTyping(G, Sch)` is required to be the unique canonical such typing.
The interesting question is when it exists.

### 1.2 Positive recursion is safe

```shex
<Artwork> {
  :title . ;
  :depicts @<Person> *
}
<Person> {
  :name . ;
  :notableWork @<Artwork> *
}
```

`<Artwork>` and `<Person>` refer to each other, but only *positively*: adding
a pair to the typing can never break the justification of another pair.
Satisfaction is **monotone** in the typing, so the union of all correct
typings is itself correct — and it is complete, giving a canonical answer.
This is why mutually recursive (even self-supporting) shapes are unproblematic
in ShEx, exactly as recursion without negation is unproblematic in Datalog.

### 1.3 Negation breaks monotonicity — stratification restores order

```shex
<Person>     { :name . }
<Anonymous>  NOT @<Person>
<Documented> NOT @<Anonymous>    # double negation, by chaining
```

Here satisfaction is *not* monotone: adding *(n, Person)* to the typing
*removes* the justification for *(n, Anonymous)*. Unions of correct typings
are no longer guaranteed correct, so the §1.2 construction fails.

But this schema is harmless, because the negation never feeds back into
itself. We can layer it:

| stratum | shapes | negation consults |
|---|---|---|
| 1 | `<Person>` | — |
| 2 | `<Anonymous>` | stratum 1, already frozen |
| 3 | `<Documented>` | stratum 2, already frozen |

Compute the complete typing stratum by stratum
([spec `completeTypingOn`]): within each stratum only positive recursion
remains, so the union-of-correct-typings construction works; every `NOT`
consults strata that are already finalized and can never be disturbed by later
additions. That is precisely the spec's **stratification**, and the **negation
requirement** — no cycle in the hierarchy and dependency graph traverses a
negated reference — is exactly the condition that makes such a layering
possible. (The spec measures negation by *parity*: a reference under an even
number of `NOT`s is positive, so `<X> { :p NOT (NOT @<X>) }` is legal and
means what `<X> { :p @<X> }` means. Chained double negation, as with
`<Documented>` ≡ conforms-to-`<Person>`, just occupies two strata.)

### 1.4 What a stratification failure signals: sometimes, a liar

```shex
<Humble> {
  :admires NOT @<Humble> +
}
```

*"A humble artist admires at least one artist, none of them humble."* The
negated self-reference violates the negation requirement. Is that pedantry?
Consider three data sets:

```turtle
# (a) innocent
:vermeer  :admires :rembrandt .
:rembrandt :name "Rembrandt" .          # admires no one → not Humble
```

Fine: `:rembrandt` has no `:admires`, so it fails the `+`; it is not Humble.
Then `:vermeer` admires exactly one non-Humble artist: Humble. One fixed
point; no drama.

```turtle
# (b) the liar
:narcissus :admires :narcissus .
```

Is `:narcissus` Humble? If yes, he admires a Humble artist (himself), so he
isn't. If no, everyone he admires (himself) is non-Humble, so he is. Neither
answer is stable: **no typing is both correct and complete**. This is the
liar's paradox, and any odd cycle of admiration (`:a → :b → :c → :a`)
reproduces it: Humble(x) ⟺ ¬Humble(next), an odd chain of flips.

```turtle
# (c) the symmetric pair
:romeo  :admires :juliet .
:juliet :admires :romeo .
```

An *even* cycle: Humble(:romeo) ⟺ ¬Humble(:juliet) and vice versa. Now there
are **two** fixed points — {romeo Humble} or {juliet Humble} — and no
principled way to pick one. Not a paradox, but no canonical answer either.

So a failed stratification signals one of two dangers, *depending on data the
validator hasn't seen yet*: odd negative cycles in the data yield
contradiction (no fixed point); even ones yield ambiguity (multiple fixed
points). Since a static check cannot foresee the data, the negation
requirement must reject the schema outright — including for data set (a),
where validation would have been perfectly determined.

The purely schema-level analogue of case (c) shows how coarse this
over-approximation is:

```shex
<Figurative> NOT @<Abstract>
<Abstract>   NOT @<Figurative>
```

*No* data can make this paradoxical — every node simply gets a free choice of
which of the two shapes to satisfy — yet it is rejected, because there is no
canonical way to make the choice. (Readers of the logic-programming
literature will recognize all of this: stratified programs have a unique
perfect model; even negative loops yield multiple stable models; odd ones may
yield none.)

**Summary:** stratification is a *sufficient, data-independent* guarantee of a
unique fixed point, bought at the price of rejecting every schema whose
negation *could* feed back into itself — even when the feedback is benign on
all data anyone will ever write.

---

## 2. EXTRA is negation in disguise

### 2.1 Where the negation hides

The shape-satisfaction semantics ([spec `matchesShape`], index.html:1530–1544)
requires a partition of the focus node's neighborhood into `matched` (which
must satisfy the triple expression) and a remainder, and then constrains the
remainder's `matchables` (triples whose predicate is mentioned in some
TripleConstraint):

> * There is no triple in **matchables** which **matches a TripleConstraint**
>   in one of the mainShape(parentsᵢ) nor one of the TripleConstraint in
>   S.expression. *(index.html:1537)*
> * There is no triple in matchables whose predicate does not appear in
>   **extra**. *(index.html:1542)*

So `EXTRA :p` licenses leftover `:p` triples to *exist* (second clause), but
the first clause still demands that each of them **fail every** same-predicate
TripleConstraint. `EXTRA` means "other values of `:p` are tolerated —
*provided they do not conform*." Explicitly:

```shex
<S> EXTRA :p {
  :p @<T1> ;
  :p @<T2>
}
```

is equivalent to the closed form

```shex
<S> {
  :p @<T1> ;
  :p @<T2> ;
  :p (NOT @<T1> AND NOT @<T2>) *
}
```

Every value expression reachable through an `EXTRA`'d predicate therefore
also occurs *negatively*, and the negation requirement must treat those
references as negated — which is why the spec's examples reject

```shex
ex:S EXTRA ex:p {
  ex:p @ex:S
}
```

as a violation (index.html:3123).

> **Editorial aside.** The formal definition of *negated reference*
> (index.html:2759) currently counts only odd nesting under `ShapeNot`; the
> bullet extending it to `EXTRA`'d predicates is commented out
> (index.html:2765), while the examples at index.html:3123 still assert the
> violation. The spec is internally inconsistent here and must be resolved in
> one direction or the other. The proposal in §3 resolves it in the
> permissive direction, making the current formal text the correct one.

Implementations enforce the strict reading. Probing shex.js
(@shexjs/validator 1.0.0-alpha.30):

```shex
<Person>   { :name . }
<Portrait> EXTRA :depicts { :depicts @<Person> }   # card {1,1}
```

```turtle
:selfie :depicts :vermeer, :easel .    # 1 Person + 1 non-Person → conformant
:duo    :depicts :romeo,   :juliet .   # 2 Persons             → NONconformant
```

`:duo` fails because whichever person-triple is left over *matches* the
TripleConstraint. The same holds with no shape references at all:

```shex
<Artwork> EXTRA :type { :type [ :PaintingType :SculptureType ] }
```

```turtle
:pure   :type :PaintingType, :OilType .        # conformant
:hybrid :type :PaintingType, :SculptureType .  # NONconformant
```

### 2.2 A liar built from EXTRA alone

No `NOT` appears in the following schema:

```shex
<Masterpiece> { :period [ :Renaissance ] }
  OR EXTRA :inspiredBy {
       :inspiredBy @<Masterpiece>          # card {1,1}
     }
```

*"A masterpiece is a Renaissance work, or a work inspired by exactly one
masterpiece (other inspirations tolerated)."* The hidden clause: those other
inspirations must not themselves be masterpieces.

First, the hidden negation earning its keep:

```turtle
:primavera :period :Renaissance .                  # Masterpiece (base case)
:nocturne  :inspiredBy :primavera .                # Masterpiece
:pastiche  :inspiredBy :primavera , :nocturne .    # NOT a Masterpiece
```

`:pastiche` fails deterministically: match either masterpiece and the other is
a leftover that matches the TripleConstraint. The schema genuinely
discriminates "exactly one masterpiece influence."

Now the liar:

```turtle
:primavera :period :Renaissance .
:ouroboros :inspiredBy :primavera , :ouroboros .
```

Is `:ouroboros` a Masterpiece? If not, match `:primavera`; the leftover
self-inspiration doesn't conform, so it is tolerated — `:ouroboros`
conforms after all. If yes, every choice of matched triple leaves a
masterpiece as leftover — so it doesn't conform. No fixed point: the liar's
paradox of §1.4(b), manufactured entirely out of `EXTRA`. (And as in §1.4(c),
two works each inspired by `:primavera` and by each other give the even-cycle
ambiguity instead.) This is why the negation requirement cannot simply
exempt `EXTRA` under the current satisfaction semantics.

### 2.3 The cost: reasonable open schemas are rejected

The trouble is that the same static rejection hits schemas whose authors
intended nothing but openness:

```shex
<Artwork> EXTRA :depicts {
  :title . ;
  :depicts @<Person> *
}
<Person> {
  :name . ;
  :notableWork @<Artwork> *
}
```

*"Artworks depict all sorts of things — people, balconies, easels; this schema
only describes the people."* The `EXTRA`-induced negated reference
`<Artwork> → <Person>` closes a cycle with the positive reference
`<Person> → <Artwork>`, so the schema is rejected.

Yet here the hidden negation is semantically *vacuous*: with unbounded
cardinality (`*`), every conforming `:depicts` value can simply be matched, so
no conforming triple is ever forced into the leftovers. The strict and
permissive readings agree on **every** graph — there is no data set on which
this schema is paradoxical or even ambiguous — but the syntactic check cannot
see that.

This is the Wikidata situation in miniature. Entity schemas routinely write
`EXTRA wdt:P31` (because instance-of claims are many and general-purpose) and
`EXTRA` on relational properties like *depicts* or *notable work*, while the
described entities refer to each other in cycles (author ↔ work,
creator ↔ collection). The combination — `EXTRA`'d predicate whose value
expression is a shape reference participating in a cycle — is pervasive, and
each instance is a negation-requirement violation today.

---

## 3. Proposal: certain-match leftovers (reference-tolerant EXTRA)

**Design principle:** `EXTRA` should express *openness* (a structural fact
about the neighborhood), never *negation* (a logical operator). Negation
belongs only where the author writes `NOT`.

### 3.1 Definition

Replace the clause at index.html:1537:

> There is no triple in matchables which matches a TripleConstraint in one of
> the mainShape(parentsᵢ) nor one of the TripleConstraint in S.expression.

with:

> There is no triple in matchables which **certainly matches** a
> TripleConstraint in one of the mainShape(parentsᵢ) nor one of the
> TripleConstraint in S.expression.
>
> A triple *t* **certainly matches** a TripleConstraint *tc* if *t* matches
> *tc* under **every** typing of *Sch* over *G*.

Since only shape references consult the typing, "under every typing" is
equivalent to: evaluate *tc*'s value expression on *t*'s value with each
shape reference treated as an unknown, and reject the leftover only if the
result is *true* under every assignment of true/false to those references.
Node constraints, value sets, datatypes, and facets evaluate as today.
Operationally this is a small, data-local, typing-independent test — for the
overwhelmingly common case of a value expression that is either reference-free
or a bare `@<X>`, it degenerates to "evaluate as usual" or "never certain,"
respectively.

Consequences for the leftover check on an `EXTRA`'d predicate:

* value expression is a **node constraint** (`[ :PaintingType ]`,
  `xsd:string`, facets): *unchanged* — a conforming leftover is still
  rejected;
* value expression is a **shape reference** `@<X>`, or any boolean
  combination in which references occur (`@<X> OR [:Q]` rejects only the
  `[:Q]` part with certainty; `[:Q] AND @<X>` is never certain): leftovers
  can no longer be rejected *because of the reference* — references are never
  followed to exclude a leftover.

### 3.2 Effect on the negation requirement

The certain-match test consults no typing, so `EXTRA` contributes **no
negated references at all** to the hierarchy and dependency graph. The
*negated reference* definition remains exactly the live text at
index.html:2759 (odd nesting under `ShapeNot`) — the commented-out `EXTRA`
bullet stays out, and the two `EXTRA` examples at index.html:3123 and :3146
change status: the first becomes legal; the second remains a violation (its
`NOT @ex:S` is an explicitly negated reference).

With `EXTRA` neutralized, all typing-dependence in `matchesShape` outside
explicit `NOT` is positive, monotonicity within a stratum is restored, and
the existing `completeTyping` construction goes through unchanged. There are
no priorities, fallbacks, or evaluation orders: the semantics stays a single
canonical fixed point.

### 3.3 The examples, revisited

| schema | today | under the proposal |
|---|---|---|
| `<Portrait> EXTRA :depicts { :depicts @<Person> }` (§2.1, acyclic) | accepted; `:duo` (two persons) **nonconformant** | accepted; `:duo` **conformant** — behavior change |
| `<Artwork>`/`<Person>` cycle with `:depicts @<Person> *` (§2.3) | **rejected** statically | accepted; verdicts identical to what the strict reading would have given on every graph |
| `<Masterpiece>` OR-`EXTRA` (§2.2) | **rejected** statically | accepted; `:ouroboros` conformant, `:pastiche` conformant — the "exactly one masterpiece influence" discrimination is *not* expressed by `EXTRA` anymore |
| `<Artwork> EXTRA :type { :type [ :PaintingType :SculptureType ] }` (§2.1) | accepted; `:hybrid` nonconformant | unchanged — value sets carry no references |
| `<Humble>` (§1.4, explicit `NOT` cycle) | rejected | rejected — unchanged |

The `<Masterpiece>` row deserves a closer look. Under the proposal a work
inspired by two masterpieces conforms: matched one, tolerated the other. An
author who *wants* the strict meaning must write the negation out:

```shex
<Masterpiece> { :period [ :Renaissance ] }
  OR { :inspiredBy @<Masterpiece> ;
       :inspiredBy NOT @<Masterpiece> * }
```

(no `EXTRA` needed: the two constraints jointly cover all `:inspiredBy`
triples). This schema is rejected by the negation requirement — *and rightly
so*, since §2.2 shows its meaning is genuinely paradox-prone. Note the
division of labor this creates: the paradox potential was always inherent in
the strict *meaning*, not in the `EXTRA` *syntax*; the proposal lets the
harmless open reading through and forces the dangerous discriminating reading
to declare itself with a visible `NOT`, where the existing machinery correctly
prices it. Where the strict meaning is safe — the acyclic `<Portrait>` case —
the explicit rewrite

```shex
<Portrait> { :depicts @<Person> ;
             :depicts NOT @<Person> * }
```

stratifies fine and restores today's `:duo`-rejecting behavior exactly. No
expressivity is lost relative to the status quo; it just stops being spelled
`EXTRA`.

### 3.4 Strengths

1. **The entire class of `EXTRA`-induced stratification failures vanishes.**
   Schema acceptance depends only on written `NOT`s — an author can reason
   locally: "did I negate anything?" The Wikidata idiom (`EXTRA` on shared
   predicates + mutually referential entities) becomes uniformly legal.
2. **Still fully declarative.** One canonical complete typing; no operational
   priorities or fallbacks; results independent of evaluation order and
   implementation.
3. **Minimal spec surface.** One clause in `matchesShape` changes; the formal
   *negated reference* definition is already the permissive one (the current
   inconsistency between index.html:2759 and the examples gets resolved
   rather than papered over); the stratification and `completeTyping`
   machinery is untouched.
4. **Backward compatible where it matters most.** Discrimination by node
   constraint — `EXTRA wdt:P31 { wdt:P31 [ wd:Q5 ] }` and kin, the dominant
   pattern in entity schemas — behaves identically (the `:pure`/`:hybrid`
   probe results are unchanged).
5. **Cheap.** Certain-match is typing-independent and local to one triple and
   one value expression; validators stop doing recursive conformance checks
   on leftovers.
6. **Honest pricing of negation.** Strict discrimination remains available
   via explicit `NOT`, and pays the stratification cost only where the danger
   is real (§3.3).

### 3.5 Weaknesses

1. **Not a conservative change: accepted schemas get more permissive,
   silently.** Every schema like `<Portrait>` (§2.1) that today stratifies
   *and* relies on leftover rejection through a reference changes verdicts:
   `:duo` flips from nonconformant to conformant with no syntactic signal.
   Mitigations: (a) a validator warning when a leftover was tolerated that
   *would* have matched under the computed typing — cheap to check post hoc
   and flags exactly the affected cases; (b) versioned semantics (a ShEx 2.x
   → next-version change logged alongside 2.1-2.2-changelog.md) rather than
   an in-place redefinition; (c) at the syntax level, a distinct keyword for
   the old meaning — though keyword proliferation is its own cost.
2. **Upper-bound cardinalities weaken on reference-valued `EXTRA`'d
   constraints.** `:depicts @<Person> {1,2}` under `EXTRA :depicts` still
   demands one-or-two matched persons but can no longer forbid a third
   conforming value — surplus slides into the tolerated leftovers, so bounded
   maxima degrade to minima. Authors needing true maxima must use the
   explicit-`NOT` form.
3. **An asymmetry to teach.** A leftover `:type :SculptureType` is still
   rejected by `[ :PaintingType :SculptureType ]`, while a leftover depicting
   a conforming `<Person>` is tolerated. The rule is short — **`EXTRA` never
   follows references** — but it is a wrinkle users must learn, and mixed
   expressions (`[:Q] AND @<X>`) tolerate more than either conjunct alone
   might suggest.
4. **A new evaluation mode.** "Matches under every typing" (equivalently,
   3-valued evaluation with references unknown) is a small but genuinely new
   piece of spec text and implementation, with at least one corner to
   pin down (a value expression tautologous in its references, e.g.
   `@<X> OR NOT @<X>`, *certainly* matches despite containing references).
5. **Out of scope: explicit-`NOT` cycles.** Schemas like `<Humble>` stay
   rejected. If Wikidata practice also demands those, that is Option C
   territory (below), not this proposal.

### 3.6 Alternatives considered

* **Option A — fully permissive `EXTRA`:** delete the leftover-matching check
  for `EXTRA`'d predicates altogether; `EXTRA :p` means "unmatched `:p`
  triples are unconditionally tolerated." Even simpler to state and teach,
  same stratification benefit; strictly more permissive than this proposal
  (conformance grows monotonically: status quo ⊆ certain-match ⊆ Option A).
  Cost: value-set exactness goes too — `:hybrid` in §2.1 flips to conformant
  — so the dominant entity-schema discrimination idiom changes behavior,
  a much larger migration footprint. Choosing between A and certain-match is
  an empirical question about deployed schemas (see §4).
* **Option C — keep strict `EXTRA`, drop the negation requirement, adopt
  well-founded (3-valued) semantics:** every schema is accepted; on
  paradoxical data (`:narcissus`, `:ouroboros`) the affected node/shape pairs
  come out *undefined* and can be reported as nonconformant-with-diagnostic.
  Fully declarative and maximally permissive at the schema level, and the
  natural endgame if explicit-`NOT` cycles also need rescuing. But it is a
  new semantic framework (typings become 3-valued, `completeTyping` becomes a
  well-founded fixpoint), a substantial implementation burden, it changes
  even-cycle outcomes (`<Figurative>`/`<Abstract>` become undefined
  everywhere), and it moves failure from authoring time ("schema rejected")
  to validation time ("undefined because your data contains an odd
  inspiration cycle") — arguably a worse place to discover it. Orthogonal to
  and compatible with the present proposal; not proposed now.
* **Option D — operational priorities/fallbacks:** e.g. "prefer matching over
  tolerating," ordered retry of partitions, or first-listed-constraint wins.
  Rejected: results become order- and implementation-dependent, the fixed
  point characterization is lost, and the spec would be describing an
  algorithm rather than a semantics.

**Recommendation:** adopt certain-match leftovers (this proposal); keep
Option A on the table pending corpus evidence; treat Option C as a separate,
later conversation.

---

## 4. Empirical survey of deployed Wikidata schemas

To test whether these concerns are real and to gauge the impact of the
proposal, the accompanying script
[`extra-stratification-survey.cjs`](extra-stratification-survey.cjs) pulls the
full [EntitySchema
directory](https://www.wikidata.org/wiki/Wikidata:Database_reports/EntitySchema_directory),
fetches each schema's ShExC via the MediaWiki API, parses it with
`@shexjs/parser`, and builds the hierarchy-and-dependency graph under **both**
negation rules:

* **conventional (strict):** a reference is negated if it occurs under an odd
  number of `ShapeNot` *or* it is the value expression of a TripleConstraint
  whose predicate is `EXTRA`'d in the enclosing shape (the hidden negation of
  §2.1);
* **certain-match (proposed):** a reference is negated only under odd
  `ShapeNot`; `EXTRA` contributes no negated references (§3.2).

A schema fails a rule iff some negated edge lies within a strongly connected
component of the graph (Tarjan SCC), i.e. a negated reference sits on a cycle.
This is the exact condition of the spec's negation requirement. The directory
was captured 2026-07-01; the run below analyzed it on 2026-07-13.

### 4.1 Results

```
EntitySchemas listed in directory                             445
empty / deleted (no schemaText)                                16
parse errors (skipped)                                          6
analyzed                                                       423

  … use EXTRA                                                 227
  … have a shape ref reachable via an EXTRA'd predicate        49
  … use explicit ShapeNot on a reference                        1
  … IMPORT other schemas                                       48

pass conventional stratification                              422
FAIL conventional stratification                                1
  … permissible under certain-match leftovers                   1
  … still prohibited (explicit NOT on a cycle)                   0
```

**Every schema that conventional stratification rejects is rescued by
certain-match, and none is left prohibited.** The strict rule rejects exactly
one deployed schema; the proposal accepts it while changing nothing about the
422 that already pass. (Full per-schema data in
[`extra-stratification-survey-results.json`](extra-stratification-survey-results.json).)

### 4.2 The one rejected schema: E113, *Gene Wiki disease terms*

The single conventional-stratification failure is a real, non-toy schema
(abridged):

```shex
start = @<#gene-wiki-disease-item>

<#gene-wiki-disease-item> EXTRA p:P279 p:P2888 {
  p:P279  @<#P279_subclassof> * ;      # "subclass of" statements
  p:P2888 @<#P2888_exactmatch> ;
  …
}

<#P279_subclassof> {
  ps:P279 @<#gene-wiki-disease-item> OR { ps:P279 [wd:Q12136] ; … } ;
}
```

The cycle is
`gene-wiki-disease-item` → (via `EXTRA p:P279`) → `P279_subclassof` →
`gene-wiki-disease-item`. Under the strict rule the `EXTRA`'d edge is negated
and lies on the cycle, so the schema violates the negation requirement. It is
exactly the §2.3 pattern from real data: an `EXTRA`'d relational predicate
(`P279`, *subclass of*) whose value expression references a shape that
references back. And as in §2.3 the hidden negation is **vacuous** here — the
constraint is `@<#P279_subclassof> *`, unbounded, so no conforming triple is
ever forced into the leftovers; strict and permissive readings agree on every
graph. certain-match accepts it (its only negated edge, the `EXTRA` one,
disappears), with no change to validation results on any data.

### 4.3 Reading the numbers

* **`EXTRA` is pervasive (227/423, 54%), but rarely dangerous.** Most `EXTRA`'d
  predicates carry *node constraints* (value sets like `[wd:Q5]`, datatypes) —
  which the hidden negation never made problematic and which certain-match
  leaves untouched (§3.1). Only 49 schemas have a shape *reference* reachable
  through an `EXTRA`'d predicate — the population §3 legalizes — and only one
  of those closes a cycle.
* **Explicit `NOT` on a reference is nearly absent (1/423).** Thirteen schemas
  use a `NOT` keyword, but in twelve it negates an inline shape or node
  constraint (`NOT { wdt:P31 wd:Q245423 }`), which cannot reference a labeled
  shape and so cannot form a negated cycle. Only E34 (*Danish noun*) writes
  `NOT @<ref>`, and that reference is not on a cycle. So Option C's extra
  reach (rescuing explicit-`NOT` cycles, §3.6) buys nothing on today's corpus;
  certain-match already covers 100% of observed failures.
* **The low absolute count is consistent with the history.** These schemas
  were authored *with the shex.js stratification check disabled*, so a
  latent violation like E113 was never surfaced to its author. That only one
  such latent violation exists suggests authors mostly steer clear of the
  pattern by instinct — but E113 shows the pattern does arise naturally from
  ordinary modeling (a class whose *subclass-of* target is the class itself),
  and it is precisely the kind of schema the negation requirement would reject
  the moment the check is switched back on.

### 4.4 Threats to validity

* **Imports are not resolved.** 48 schemas `IMPORT` others; the survey analyzes
  each schema's own text, so a negated cycle that closes only *across* an
  import boundary would be missed. (E113's violating cycle is internal, so it
  is caught; its imports E273/E274 supply only leaf shapes.) A follow-up that
  inlines imports before analysis would tighten the strict-failure count —
  plausibly upward — which would only *strengthen* the case for the proposal,
  since every additional `EXTRA`-induced cycle is likewise rescued.
* **Six parse errors excluded** (E216, E272, E293, E342, E455, E12345 — the
  last a sandbox), from ShExC the current `@shexjs/parser` rejects; they could
  not be analyzed either way.
* **This measures *acceptance*, not *verdict changes*.** The survey counts
  which schemas the negation requirement admits, not how many graphs would
  validate differently under §3.1 (the §3.5(1) concern). Measuring that needs
  data, and is item 4 of the next steps.

## 5. Suggested next steps

1. **Corpus study.** A first pass is done (§4): the negation-requirement
   acceptance question is settled on the deployed directory — one strict
   failure (E113), rescued. Remaining refinements: (a) resolve `IMPORT`s and
   re-run to catch cross-schema `EXTRA` cycles (§4.4); (b) among the 49
   schemas with a shape reference through an `EXTRA`'d predicate, flag bounded
   upper cardinalities or other signs of intended strict discrimination — the
   population §3 would silently weaken; (c) count `EXTRA`'d value sets with
   more than one member — the Option-A-vs-certain-match discriminator.
2. **Spec edits** (if adopted): the `matchesShape` clause (index.html:1537);
   resolve the negated-reference inconsistency by keeping index.html:2759 as
   is and deleting the commented-out bullet at :2765; update the `EXTRA`
   examples at index.html:3123 (becomes legal, with its new semantics
   explained) and :3146 (still illegal); add certain-match definition and the
   `:duo`/`:hybrid`-style examples to the Shape semantics section.
3. **Test suite.** Add the probe cases from §2.1 and §3.3 (selfie/duo,
   pure/hybrid, the vacuous-`*` cycle, the Masterpiece rewrites) with
   expected results under the new semantics.
4. **Implementation experiment.** Prototype certain-match in shex.js behind a
   flag; re-run the Wikidata corpus to count schemas that (a) newly stratify,
   (b) change any verdict on live data — evidence for the migration story.
5. **Diagnostics.** Specify the advisory warning of §3.5(1): "leftover triple
   tolerated under `EXTRA` that conforms to `@<X>` under the computed typing,"
   easing the transition for authors who meant the strict reading.
