const warn = require('../utils/warn');
const { rdfsRange, owlUnionOf, rdfFirst, rdfRest, rdfNil  } = require('../constants');

// Possible bug: stack overflow

// Both methods walk a graph: g
// from a given vertex (:=startVertex): iri

// Adds startVertex to the output
// exits startVertex using a given edge: walkIri, and recurse on the result
function walkmap(g, iri, walkIri, s = new Set()) {
  if (s.has(iri)) return s; // Prevents cycles
  if (!g[iri]) return warn(`Resource missing in graph: ${iri}`) || s;

  s.add(iri);

  if (g[iri][walkIri]) g[iri][walkIri].forEach(wIri => walkmap(g, wIri, walkIri, s));

  return s;
}

// Adds vertices connected to startVertex by a given edge: lookIri, to the output
// if the output is not empty returns the output
// else exit startVertex using a given edge: walkIri, and recurse on the result
function walklook(g, iri, walkIri, lookIri, s = new Set(), ws = new Set()) {
  if (ws.has(iri)) return s; // Prevents cycles
  if (!g[iri]) return warn(`Resource missing in graph: ${iri}`) || s;

  ws.add(iri);

  if (g[iri][lookIri]) g[iri][lookIri].forEach(lIri => s.add(lIri));

  if (s.size) return s;

  if (g[iri][walkIri]) g[iri][walkIri].forEach(wIri => walklook(g, wIri, walkIri, lookIri, s, ws));

  return s;
}

// TODO: Possible bug: stack overflow - using recursive function without debounce (_walkLinkedList).
// Resolves any resources that represent a Union of resources
// The resource must contain an owl:unionOf predicate to be considered a union resource.
// Additionally the object of the owl:unionOf must be an rdf linked list, having predicates rdf:first, rdf:rest and rdf:nil
// Inputs: 
// g : graph
// resources : array[iri] 
// returns: array[iri] after replacing all union iris with the resources in the union.
function resolveUnionResources (g, resources) {
  function _walkLinkedList(listNode) {
    const head = g[listNode][rdfFirst]
    if (listNode != rdfNil && head && head != rdfNil) {
      const tail = g[listNode][rdfRest];
      if (tail && tail != rdfNil) {
        return [head].concat(_walkLinkedList(tail));
      }
      return [head];
    }        
    return [];
  }

  const unionResources = resources
    .filter((iri) => g[iri][owlUnionOf])
    // flatMap
    .reduce((list, iri) => list.concat(g[iri][owlUnionOf]), [])
    // flatMap
    .reduce((list, listNode) => list.concat.apply(list,_walkLinkedList(listNode)), []);

  const nonUnionResources = resources
    .filter((iri) => !g[iri][owlUnionOf]);

  return nonUnionResources.concat(unionResources).sort();
}

module.exports = {
  walkmap,
  walklook,
  resolveUnionResources
};
