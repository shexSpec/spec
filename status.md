April 12, 2018
Changes of the fork w.r.t. the master spec for addressing pfps's issues.
https://github.com/iovka/spec


# Changes

* added the notion of a _typing_, which is similar to a shapeMap but contains pairs of RDFnode/shape (and not RDFnode/shape label)
(sect. 5.2 Validation Requirement)


* the nodes of the depenency graph are Shapes, and not shapeExprLabels as it used to be
(Sect. 5.7.4 Negation Requirement)

> Rationale:
> 1. If we know all the shapes satisfied by a node _n_ we can easily check whether _n_ satisfies a shape expression
> 2. Having shape expressions that are not shapes in the dependency graph restricts more than having only the shapes (with shapes only, more schemas satisfy the negation requirement).
> 3. To have all the shapes in the typing (and not only those that are labeled) makes the definition of the satisfies function simpler. Otherwise we would need to distinguish several cases. Also, if some shapes are not considered for computing the dependency graph, we might miss true negative dependencies; see (3) below.


* introduced _completeTyping(G, Sch)_ that is a unique "maximal" typing for a graph G and a schema Sch
(sect. 5.2 Validation Requirement)

> Rationale: This is what allows to have a unique semantics, and answers one of Peter's complains


* the function _satisfies_ is defined with a typing as parameter (and not with shapeMap as before)


* satisfies(n, s, G, Sch, t) for a Shape s is defined by:  satisfies(n, s, G, Sch, t) iff (n, s) belongs to the typing t

> Rationale: This breaks the possible infinite recursion pointed out by Peter.



* introduced shape reference and triple expression reference schema requirements to avoid circular definitions of shape expressions
(Sect. 5.7.2 and 5.7.3)

> Remark: for shapes expressions this was already ensured by the fact that a shapeExprRef is required to be a reference to a Shape. The latter restriction however does not seem to be necessary.


# To do

* A document with the algorithms for:
  * check the schema requirements
  * construct a stratification
  * compute completeTyping and the validation algorithm based on it
  * validation algorithm not based on the computation of completeTyping
* Fix the examples in the spec


# Examples
These examples can be used to justify the choice of shapes only in the dependency graph and in the typing.

Can be added as test cases.

(1)
_not stratified_
ex:T {ex:p NOT @ex:S}
ex:U {ex:q @ex:S}
ex:S NOT @ex:T AND @ex:U

(2)
_stratified_
ex:T {ex:p NOT @ex:S}
ex:U {ex:q .}
ex:S NOT @ex:T AND @ex:U

(3)
_not stratified_
ex:T {ex:a {ex:b NOT @T}}
