# Editing guidelines

The js processor uses different tags, and the document css style defines several classes for formattig.
Here is how they should be used.

## Tags

* **dfn**: highlights a term being defined. The label attribute defines a tag to this position, to be used with the a tag
* **a**: `<a>some term</a>` adds a reference to `<dfn label="some term">...</dfn>`
* **code**: 


## CSS classes
Between parenthesis, the tags it can be used with.

"Always" indicates that the class should always be used in the described situation.

* **math** (span): for variables that locally name elements (e.g. shape expressions, triple expressions, etc.). Always.
* **param** (span): for the names of the keys in the json grammar. Always.
* **jobjref** (span, a): for the names of the types in the json grammar. Always.
* **label** (dfn): see tag dfn
* **function** (code)
* **comment** (span)
