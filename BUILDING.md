# Building the ShEx Spec

This doc should help you construct the ShEx specification, including using `rollup` to produce web-ready code to e.g. parse ShExC.

## Installation
- clone this repo, (`main` branch)
``` sh
git clone git@github.com:shexSpec/spec
```
- clone respec-ieee repo (`ieee branch`)
``` sh
cd ../../ericprud # some other directory
git clone git@github.com:ericprud/respec-ieee -b ieee
cd -
```
- `npm ci`
- `npm run rollup`
- load `index.html` page in browser

## Features

- Size normalization - The load script makes sure that all examples divs with a class of `repchoice` have multiple representations that use the same vertial and horizontal space (so stuff doesn't hop around when different formats are selected (ctrl-J for ShEx-J, ctrl-C for  ShExC).
``` html
<div class="repchoice incomplete" tabindex="0">
    <pre class="json nohighlight repchosen">{ "type": "Shape", <span class="comment">…</span> }   </pre>
    <pre class="shexc nohighlight rephidden">{ <span class="comment">…</span> }                    </pre>
  <button>json</button></div>
```
Size inequivalence is marked with the `rep-choice-size-mismatch` class.
- Format equivalence - for anything that isn't given the class `incomplete` (seen above), the `pre.innerText` is parsed (ShExC is prepended by a base and prefixed).
Failure to parse is marked with a `rep-choice-parse-error` class and parsing to non-equivalent schemas is marked with a `rep-choice-semantics-mismatch` class.

## W3C CG Specification
The current draft is on the main branch. It includes a reference to a respec.js which is copied into the same directory:
``` html
<script src='respec-ieee.js' defer class='remove'></script>
```

## IEEE Standard
The spec is also developed for IEEE. This requires the `ieee` branch of a [GitHub respec fork `ericprud/respec-ieee`](https://github.com/ericprud/respec-ieee/tree/ieee).
To enable this view, clone the repo (make sure you switch to the `ieee` branch and update the respec script src to reference `profiles/ieee.js` in that clone, e.g.
``` html
<script src='../../ericprud/respec-ieee/profiles/ieee.js' type="module" class='remove'></script>
```
Next select the respec menu painted on the upper right of the rendering.
Then select '💾 Export…' and 'Labra's import' (TODO - change that to Word or...)
The document will be saved in your downloads with a name like 'ED-shex-semantics-20250910.labrify.html'.

## Debugging
If you want to improve the export script, it's advisble to sent a [breakpoint in <respec-repo>/src/ui/save-html.js](https://github.com/ericprud/respec-ieee/blob/c4867483f8d0c4ebc86c27861fe3cc4c7af61c7c/src/ui/save-html.js#L70).
You can also view the rendered document without having to save by setting `cloneDoc` = `document` (commenting out `.cloneNode(true)`).
