const { rdfsResource } = require('../constants');
const getGraphqlInterfaceType = require('./getGraphqlInterfaceType');
const memorize = require('../graph/memorize');
const { GraphQLUnionType } = require('graphql');
const getGraphqlName = require('./getGraphqlName');
const getGraphqlObjectType = require('./getGraphqlObjectType');

// Generate an IRI that represents the Union of some resources
function getUnionIri(g, iris) {
  const gqlNames = iris.map(x => getGraphqlName(g,x)).sort().join(',');
  return `union:${gqlNames}`;
}

// This adapter exists to compensate for the caller passing in a array of IRIs, and this breaks memorize.
// So the idea is we create an IRI that represents the array(ranges) and pass that to memorize.
// then we will receive that generated IRI in getGraphqlPolymorphicObjectType and have to 
// reverse the process to get the ranges back from the generated IRI.
function memorizeRangesAdapter(fn, key) {
  return (g, ranges) => {
    const unionUri = getUnionIri(g, ranges);
    // make sure the IRI for for this range is in the graph
    g[unionUri] = g[unionUri] || {ranges:ranges};
    // and pass the IRI through, instead of the ranges
    return memorize(fn,key)(g,unionUri);
  }
}

// Creates a GraphQLUnionType from a collection of iris in ranges.
// g : graph
// iri : resource name of the range
// ranges: array[resource:iri]
function getGraphQlUnionObjectType(g, iri, ranges) {
  const types = ranges.map(x => getGraphqlObjectType(g,x)).sort();
  const typeMap = types.reduce((a,c,i) => {
    return Object.assign(a, {[c.name]: c});
  }, {});
  const gqlNames   = ranges.map(x => getGraphqlName(g,x)).sort();
  const unionName =  gqlNames.join('_');

  return new GraphQLUnionType({
    name: `U_${unionName}`,
    types: types,
    description: `Union of ${gqlNames.join(' and ')}`,
    resolveType : (value) => typeMap[value.type]
  });
}

// Responsible for determining which type of GraphQlPolymorphicObject is used.
function getGraphqlPolymorphicObjectType(g, iri) {
  const ranges = g[iri]["ranges"]; // this assumes memorizeRangesAdapter was used to wrap this call.
  // Union strategy
  if (ranges) {
    return getGraphQlUnionObjectType(g, iri, ranges);
  }
  // TODO: other strategies.
  return null;
}

module.exports = {
  getUnionIri,
  memorizeRangesAdapter,
  getGraphQlUnionObjectType,
  getGraphqlPolymorphicObjectType : memorizeRangesAdapter(getGraphqlPolymorphicObjectType, 'graphqlPolymorphicObjectType')
};
