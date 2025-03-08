# Editing guidelines

This spec uses [ReSpec](https://github.com/w3c/respec/wiki/ReSpec-Editor's-Guide) which automatically [adds anchors](https://github.com/w3c/respec/wiki/ReSpec-Editor's-Guide#definitions-and-linking) to `<dfn>` and `<a>` elements and adds style to `<code>` elements.

## Tags

* **dfn**: highlights a term being defined. The label attribute defines a tag to this position, to be used with the a tag
* **a**: `<a>some term</a>` adds a reference to `<dfn label="some term">...</dfn>`
* **code**: pretty much any introduced term to which you want to call attention. It's OK to arbitrarily not add `<code>s` to avoid overloading the reader's eyes.


## CSS classes
We use some class conventions to style those `<dfn>` and `<a>` elements for internal consistency:

"Always" indicates that the class should always be used in the described situation.

* **math** (span): for locally-intrudced variables. Always.
* **param** (span): for the names of the keys in the json grammar. Always.
* **jobjref** (span, a): for the names of the types in the json grammar (AKA non-objects). Always.
* **label** (dfn): identifier in prose description (could probably be a dfn tag)
* **function** (code): identifers for functions in the definition of validity.
* **comment** (span): elements introduced into the JSON schema syntax to indicate repetition or enumeration.

## JSON syntax definitions
The document uses a JSON syntax as a form a abstract syntax. The [schema for that syntax](https://github.com/ericprud/jsg) includes:

* *object declaration*: `<div class="shexj simupre"><a class="obj">Object1</a> { <a class="param">parameter 1</a>:[<a class="objref">Object2</a>+]? <a class="param">parameter 2</a>:<a class="nobref">nonObject1</a>? }</div>`
* *non-object declaration*: `<div class="shexj simupre"><a class="nob">nonObject1</a> = <a class="objref">Object3</a> | <a class="nobref">nonObject2</a> ;</div>`
